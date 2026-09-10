import { createModelRequest } from "../server/createModelRequest.ts"
import { createHash, randomUUID } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { homedir } from "node:os"
import { createInterface } from "node:readline"
import { Readable } from "node:stream"
import { setTimeout as wait } from "node:timers/promises"
import { createPlacesAdapter } from "../server/createPlacesAdapter.ts"
import { createResearchService } from "../server/createResearchService.ts"
import { createRunnerAdapter } from "../server/createRunnerAdapter.ts"
import { ResearchError } from "../server/ResearchError.ts"
import type { PlaceCandidate, RunnerAdapter, RunnerJob } from "../server/types.ts"
import type { ResearchLocation } from "../src/research/ResearchLocation.ts"

await main()

/** Compare live API and cloud paths without changing production behavior. */
async function main() {
  // This diagnostic uses live providers but never changes the deployed application.
  const apiKey = required("OPENAI_API_KEY")
  const places = createPlacesAdapter(required("GOOGLE_MAPS_API_KEY"))
  const cloud = createRunnerAdapter(
    process.env.RESEARCH_RUNNER_URL || "https://codex-cloud.herbcaudill.workers.dev",
    process.env.RESEARCH_RUNNER_TOKEN ||
      readFileSync(resolve(homedir(), ".config/codex-cloud/token"), "utf8").trim(),
  )
  const contextSecret = randomUUID()
  const { instructions } = await createModelRequest("benchmark")
  const samples: Record<string, unknown>[] = []
  const outputPath = process.argv[2] ?? "plans/api-latency-samples.json"
  const date = new Date()
  const locations = [
    {
      name: "Greyfriars Kirk, Edinburgh",
      area: "Edinburgh",
      coordinates: { lat: 55.9468, lon: -3.1928 },
      accuracyMeters: 10,
    },
    {
      name: "Plaça del Rei, Barcelona",
      area: "Barcelona",
      coordinates: { lat: 41.384, lon: 2.1777 },
      accuracyMeters: 10,
    },
    {
      name: "Place des Vosges, Paris",
      area: "Paris",
      coordinates: { lat: 48.8556, lon: 2.3655 },
      accuracyMeters: 10,
    },
  ]

  for (const location of locations.filter(
    location =>
      !process.env.BENCHMARK_LOCATION || location.name.includes(process.env.BENCHMARK_LOCATION),
  )) {
    // Both arms receive the same in-memory Google context for each radius.
    const candidates = new Map<number, Promise<readonly PlaceCandidate[]>>()
    const sharedPlaces = {
      ...places,
      nearby: (origin: ResearchLocation, radius: number) => {
        if (!candidates.has(radius)) candidates.set(radius, places.nearby(origin, radius))
        return candidates.get(radius)!
      },
    }
    const nearbyStarted = performance.now()
    await sharedPlaces.nearby(location, 200)
    const initialPlacesMs = Math.round(performance.now() - nearbyStarted)
    const results = await Promise.allSettled([run("api"), run("cloud")])
    for (const result of results) {
      if (result.status === "rejected") {
        // Provider errors can contain private request data; export only a controlled label.
        console.log(JSON.stringify({ location: location.name, error: "benchmark_failed" }))
        process.exitCode = 1
      }
    }

    /** Exercise the existing service, including schema checks and geographic rejection/expansion. */
    async function run(arm: "api" | "cloud") {
      const started = performance.now()
      const jobs = new Map<string, RunnerJob>()
      const passes: Record<string, unknown>[] = []
      let geocodeMs = 0
      let stage = "discovery_start"
      const runner: RunnerAdapter = {
        get: async id => (arm === "cloud" ? cloud.get(id) : (jobs.get(id) ?? null)),
        start: async (id, prompt, context) => {
          const pass: Record<string, unknown> = {
            jobId: id,
            promptSha256: hash(prompt),
            submittedAt: new Date().toISOString(),
          }
          passes.push(pass)
          console.log(
            JSON.stringify({ event: "benchmark_start", arm, location: location.name, jobId: id }),
          )
          if (arm === "cloud") return cloud.start(id, prompt, context)
          const response = await generate(prompt, apiKey)
          Object.assign(pass, response.metrics)
          const job: RunnerJob = { id, status: "completed", result: response.text, context }
          jobs.set(id, job)
          return job
        },
      }
      const service = createResearchService({
        runner,
        secret: contextSecret,
        now: () => date,
        places: {
          ...sharedPlaces,
          resolveStory: async query => {
            const start = performance.now()
            const previousStage = stage
            stage = "site_validation"
            try {
              const site = await places.resolveStory(query)
              stage = previousStage
              return site
            } finally {
              geocodeMs += performance.now() - start
            }
          },
        },
      })
      try {
        let response = await service.discover({ requestId: randomUUID(), location })
        let firstRunningMs: number | undefined
        while (response.status !== "completed") {
          if (performance.now() - started > 12 * 60_000) throw new Error("benchmark_timeout")
          if (response.status === "running")
            firstRunningMs ??= Math.round(performance.now() - started)
          if (arm === "cloud") await wait(response.retryAfterMs)
          stage = "discovery_poll"
          response = await service.discover({ ticket: response.ticket })
        }
        const sample = {
          location: location.name,
          arm,
          initialPlacesMs,
          elapsedMs: Math.round(performance.now() - started),
          firstRunningMs,
          geocodeMs: Math.round(geocodeMs),
          storyCount: response.discovery.stories.length,
          radiusMeters: response.discovery.radiusMeters,
          passes,
        }
        record(sample)
        console.log(JSON.stringify({ event: "benchmark_complete", ...sample }))
      } catch (error) {
        record({
          location: location.name,
          arm,
          status: "benchmark_failed",
          initialPlacesMs,
          elapsedMs: Math.round(performance.now() - started),
          failureStage: stage,
          errorCode: error instanceof ResearchError ? error.code : "benchmark_or_api_failure",
          passes,
        })
        throw new Error("benchmark_failed")
      }
    }
  }
  /** Persist successful and failed samples without private provider diagnostics. */
  function record(
    /** Timing, outcome, and controlled failure metadata. */
    sample: Record<string, unknown>,
  ) {
    samples.push(sample)
    writeFileSync(
      outputPath,
      JSON.stringify(
        {
          date: date.toISOString(),
          model: "gpt-6-astra",
          reasoning: "low",
          webSearch: false,
          instructionsSha256: hash(instructions),
          apiServiceTier: "default",
          usdPerMillionTokens: { input: 10, cachedInput: 1, output: 50 },
          samples,
        },
        null,
        2,
      ) + "\n",
    )
  }
}

/** Stream text for timing while keeping prompts, answers, and credentials out of diagnostics. */
async function generate(
  /** Exactly the prompt submitted to the paired cloud job. */
  prompt: string,
  /** API credential retained only in memory. */
  apiKey: string,
) {
  const started = performance.now()
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(await createModelRequest(prompt)),
      stream: true,
    }),
    signal: AbortSignal.timeout(180_000),
  })
  if (!response.ok || !response.body) throw new Error(`api_http_${response.status}`)
  const headersMs = Math.round(performance.now() - started)
  let firstTextMs: number | undefined
  let text = ""
  let usage: Usage | undefined
  let model: string | undefined
  let serviceTier: string | undefined
  const lines = createInterface({
    input: Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
  })
  for await (const line of lines) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue
    const event = JSON.parse(line.slice(6))
    if (event.type === "response.output_text.delta") {
      firstTextMs ??= Math.round(performance.now() - started)
      text += event.delta
    }
    if (["error", "response.failed", "response.incomplete"].includes(event.type))
      throw new Error("api_generation_failed")
    if (event.type === "response.completed") {
      usage = event.response.usage
      model = event.response.model
      serviceTier = event.response.service_tier
    }
  }
  if (!usage || !text) throw new Error("api_missing_completion")
  const cachedInputTokens = usage.input_tokens_details?.cached_tokens ?? 0
  return {
    text,
    metrics: {
      headersMs,
      firstTextMs,
      completedMs: Math.round(performance.now() - started),
      model,
      serviceTier,
      inputTokens: usage.input_tokens,
      cachedInputTokens,
      outputTokens: usage.output_tokens,
      reasoningTokens: usage.output_tokens_details?.reasoning_tokens,
      estimatedUsd:
        ((usage.input_tokens - cachedInputTokens) * 10 +
          cachedInputTokens +
          usage.output_tokens * 50) /
        1_000_000,
    },
  }
}

/** Fail without displaying any environment values. */
function required(
  /** Name of the necessary private configuration. */
  name: string,
) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

/** Compare exact prompts without retaining Google context. */
function hash(
  /** Private text whose content must not appear in reports. */
  value: string,
) {
  return createHash("sha256").update(value).digest("hex")
}

type Usage = {
  /** All input tokens, including cache hits. */
  input_tokens: number
  /** Output tokens, including reasoning. */
  output_tokens: number
  /** Reported prompt cache hits. */
  input_tokens_details?: { cached_tokens?: number }
  /** Reported reasoning tokens. */
  output_tokens_details?: { reasoning_tokens?: number }
}
