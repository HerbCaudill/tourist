import { Schema } from "effect"
import { ResearchAnswer } from "../research/ResearchAnswer"
import { ResearchDiscovery } from "../research/ResearchDiscovery"
import { ResearchLocation } from "../research/ResearchLocation"
import { ResearchStory } from "../research/ResearchStory"
import type { Discovery, Research, ResearchOptions } from "../types"
import { ResearchClientError } from "./ResearchClientError"
import { locateBrowser } from "./locateBrowser"

/** Connect the Ledger to validated Tourist operations and resumable server jobs. */
export function createLiveResearch(
  /** Injectable browser transport and polling delay. */
  { fetch: transport = globalThis.fetch.bind(globalThis), wait = waitForPoll }: Dependencies = {},
): Research {
  const continuations = new Map<string, string>()

  /** Send a bounded operation request without caching location or context. */
  async function post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    try {
      const response = await transport(`/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
          : AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        let code = "unavailable"
        try {
          const failure = (await response.json()) as { error?: { code?: string } }
          code = failure.error?.code ?? code
        } catch {
          /* A failed proxy response can be HTML. */
        }
        throw new ResearchClientError(code, ERRORS[code] ?? ERRORS.unavailable)
      }
      try {
        return await response.json()
      } catch {
        throw new ResearchClientError("malformed", ERRORS.malformed)
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (
        error instanceof TypeError ||
        (error instanceof DOMException && ["TimeoutError", "AbortError"].includes(error.name))
      )
        throw new Error("The connection was interrupted. Try again to reconnect to this research.")
      throw error
    }
  }

  /** Continue the same operation ticket until its research finishes. */
  async function poll(path: "discover" | "chat", initial: unknown, options: ResearchOptions) {
    const id = options.requestId ?? crypto.randomUUID()
    let body: unknown = continuations.has(id) ? { ticket: continuations.get(id) } : initial
    while (true) {
      options.signal?.throwIfAborted()
      const response = await post(path, body, options.signal)
      if (
        response &&
        typeof response === "object" &&
        "status" in response &&
        response.status === "completed"
      ) {
        continuations.delete(id)
        return response
      }
      const pending = decode(Pending, response)
      continuations.set(id, pending.ticket)
      if (continuations.size > 8) continuations.delete(continuations.keys().next().value!)
      if (path === "discover")
        options.onProgress?.({
          status: pending.status,
          radiusMeters: pending.radiusMeters ?? 200,
          ...(pending.nearbyPlaces ? { nearbyPlaces: pending.nearbyPlaces } : {}),
        })
      await wait(pending.retryAfterMs, options.signal)
      body = { ticket: pending.ticket }
    }
  }

  return {
    mapProvider: "google",
    locate: locateBrowser,
    resolveLocation: async query => decode(ResearchLocation, await post("location", { query })),
    discover: async (location, options = {}) => {
      const requestId = options.requestId ?? crypto.randomUUID()
      const result = decode(
        CompletedDiscovery,
        await poll("discover", { requestId, location }, { ...options, requestId }),
      )
      const researchedAt = new Date(result.discovery.researchedAt)
      if (
        !Number.isFinite(researchedAt.getTime()) ||
        !Number.isFinite(Date.parse(result.discovery.coordinatesExpireAt))
      )
        throw new ResearchClientError("malformed", ERRORS.malformed)
      const discovery: Discovery = {
        ...result.discovery,
        stories: result.discovery.stories.map(story => ({
          ...story,
          account: [...story.account],
          sources: [...story.sources],
          suggestedQuestions: [...story.suggestedQuestions],
        })),
        researchedAt,
        mapProvider: "google",
      }
      return discovery
    },
    ask: async (request, options = {}) => {
      const stories = request.stories.map(value => decode(ResearchStory, value))
      const history = request.history
        .slice(-12)
        .map(message => ({ ...message, text: message.text.slice(0, 6000) }))
      const body = { ...request, stories, history }
      const size = () => new TextEncoder().encode(JSON.stringify(body)).byteLength
      // Drop oldest context before exceeding the server byte boundary, retaining the selected story.
      while (size() > 68_000 && body.history.length > 0) body.history.shift()
      while (size() > 68_000 && body.stories.length > 1) {
        const removable = body.stories.findIndex(story => story.id !== request.selectedStoryId)
        if (removable < 0) break
        body.stories.splice(removable, 1)
      }
      while (size() > 68_000 && body.stories[0]?.account.length > 1)
        body.stories[0] = { ...body.stories[0], account: body.stories[0].account.slice(0, -1) }
      while (size() > 68_000 && body.stories[0]?.sources.length > 1)
        body.stories[0] = { ...body.stories[0], sources: body.stories[0].sources.slice(0, -1) }
      const result = decode(
        CompletedAnswer,
        await poll("chat", body, { ...options, requestId: request.requestId }),
      )
      return { text: result.answer.text, sources: [...result.answer.sources] }
    },
  }
}

/** Validate server data and avoid exposing raw schema diagnostics in the interface. */
function decode<A, I>(schema: Schema.Schema<A, I>, input: unknown): A {
  try {
    return Schema.decodeUnknownSync(schema)(input)
  } catch {
    throw new ResearchClientError("malformed", ERRORS.malformed)
  }
}

/** Wait between polls, releasing the timer when the UI supersedes this operation. */
function waitForPoll(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const abort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", abort, { once: true })
  })
}

const Pending = Schema.Struct({
  nearbyPlaces: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(1000)),
        distanceMeters: Schema.Number.pipe(Schema.int(), Schema.between(0, 1000)),
      }),
    ).pipe(Schema.maxItems(12)),
  ),
  status: Schema.Literal("queued", "running"),
  ticket: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(40_000)),
  retryAfterMs: Schema.Number.pipe(Schema.between(1000, 60_000)),
  radiusMeters: Schema.optional(Schema.Literal(200, 500, 1000)),
})
const CompletedDiscovery = Schema.Struct({
  status: Schema.Literal("completed"),
  discovery: ResearchDiscovery,
})
const CompletedAnswer = Schema.Struct({
  status: Schema.Literal("completed"),
  answer: ResearchAnswer,
})
const ERRORS: Record<string, string> = {
  busy: "Research is busy. Try again shortly.",
  auth: "The research service needs attention before it can continue.",
  timeout: "Research took too long. Try again to start a new request.",
  malformed: "The research service did not return a valid result. Try again.",
  unavailable:
    "Research is unavailable right now. Try again to reconnect, or refresh to start another search.",
  expired: "This research has expired. Try again to start a new request.",
  invalid: "This request could not be used. Try another location or refresh.",
  location_not_found:
    "That place could not be located precisely. Enter a street or landmark and city.",
}

type Dependencies = {
  /** Browser fetch, replaceable in tests. */
  fetch?: typeof globalThis.fetch
  /** Abortable polling delay, replaceable in tests. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>
}
