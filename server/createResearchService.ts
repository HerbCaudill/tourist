import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Schema } from "effect"
import {
  ChatMessage,
  Coordinates,
  ResearchAnswer,
  ResearchLocation,
  ResearchStory,
  StoryDraft,
} from "../src/research/contracts.ts"
import type { ChatResponse, DiscoveryResponse, PendingResearch } from "../src/research/contracts.ts"
import { distanceBetween } from "../src/lib/distanceBetween.ts"
import { compassBearing } from "../src/lib/compassBearing.ts"
import { createContextTickets } from "./createContextTickets.ts"
import { decode } from "./decode.ts"
import { ResearchError } from "./ResearchError.ts"
import type { ResearchDependencies, RunnerJob } from "./types.ts"

/** Coordinate bounded place research and durable jobs without holding a mobile request open. */
export function createResearchService(
  /** Private transports and deterministic clock. */
  dependencies: ResearchDependencies,
) {
  const { places, runner, secret } = dependencies
  const now = dependencies.now ?? (() => new Date())
  const tickets = createContextTickets(secret, now)

  /** Submit or reuse one radius of discovery. */
  async function startDiscovery(context: DiscoveryContext): Promise<PendingResearch> {
    const candidates = (await places.nearby(context.location, context.radiusMeters))
      .filter(
        place =>
          distanceBetween(context.location.coordinates, place.coordinates) <= context.radiusMeters,
      )
      .slice(0, 12)
    const jobId = tickets.jobId([
      "discovery",
      context.requestId,
      context.location,
      context.radiusMeters,
    ])
    const existing = await runner.get(jobId)
    const job =
      existing ??
      (await runner.start(
        jobId,
        prompt("discovery", {
          date: now().toISOString().slice(0, 10),
          location: context.location,
          radiusMeters: context.radiusMeters,
          candidates,
        }),
      ))
    const ticket = tickets.seal({
      ...context,
      jobId,
      candidates: candidates.map(({ id, coordinates }) => ({ id, coordinates })),
    })
    return pending(job, ticket, context.radiusMeters)
  }

  return {
    /** Start a 200-meter search or resume its authentic context; only empty results allow expansion. */
    async discover(input: unknown): Promise<DiscoveryResponse> {
      const request = decode(DiscoveryRequest, input)
      if (!("ticket" in request))
        return startDiscovery({
          ...request,
          kind: "discovery",
          radiusMeters: 200,
          jobId: "",
          candidates: [],
        })
      const context = decode(DiscoveryContext, tickets.open(request.ticket), "expired")
      const job = await runner.get(context.jobId)
      if (!job) throw new ResearchError("expired")
      if (job.status !== "completed") return pending(job, request.ticket, context.radiusMeters)
      const result = decode(DiscoveryOutput, parseResult(job), "malformed")
      const drafts = result.stories.map(value => decode(StoryDraft, value, "malformed"))
      const seen = new Set<string>()
      const stories = drafts
        .flatMap(story => {
          const anchor = context.candidates.find(place => place.id === story.placeId)
          if (!anchor || seen.has(story.id)) return []
          const distanceMeters = distanceBetween(context.location.coordinates, anchor.coordinates)
          if (!Number.isFinite(distanceMeters) || distanceMeters > context.radiusMeters) return []
          seen.add(story.id)
          return [
            {
              ...story,
              coordinates: anchor.coordinates,
              distanceMeters: Math.round(distanceMeters),
              bearing: compassBearing(context.location.coordinates, anchor.coordinates),
            },
          ]
        })
        .slice(0, 3)
      if (stories.length === 0 && context.radiusMeters < 1000)
        return startDiscovery({
          ...context,
          radiusMeters: context.radiusMeters === 200 ? 500 : 1000,
        })
      return {
        status: "completed",
        discovery: {
          location: context.location,
          stories,
          radiusMeters: context.radiusMeters,
          researchedAt: now().toISOString(),
          coordinatesExpireAt: new Date(now().getTime() + 29 * 86_400_000).toISOString(),
          promptVersion: "ledger-1",
        },
      }
    },
    /** Submit bounded conversational context or resume a chat job. */
    async chat(input: unknown): Promise<ChatResponse> {
      const request = decode(ChatRequest, input)
      if ("ticket" in request) {
        const context = decode(ChatContext, tickets.open(request.ticket), "expired")
        const job = await runner.get(context.jobId)
        if (!job) throw new ResearchError("expired")
        if (job.status !== "completed") return pending(job, request.ticket)
        return {
          status: "completed",
          answer: decode(ResearchAnswer, parseResult(job), "malformed"),
        }
      }
      if (
        request.selectedStoryId &&
        !request.stories.some(story => story.id === request.selectedStoryId)
      )
        throw new ResearchError("invalid")
      if (JSON.stringify(request).length > 70_000) throw new ResearchError("invalid")
      const jobId = tickets.jobId(["chat", request])
      const job =
        (await runner.get(jobId)) ??
        (await runner.start(
          jobId,
          prompt("chat", { ...request, date: now().toISOString().slice(0, 10) }),
        ))
      return pending(job, tickets.seal({ kind: "chat", jobId }))
    },
    /** Resolve user-entered text while preserving its label. */
    async locate(input: unknown) {
      const { query } = decode(LocationRequest, input)
      return places.resolve(query)
    },
    /** Return an attributed image without putting location or credentials in a browser URL. */
    async map(input: unknown) {
      const { center, markers, radiusMeters } = decode(MapRequest, input)
      if (markers.some(point => distanceBetween(center, point) > radiusMeters + 1))
        throw new ResearchError("invalid")
      return places.map(center, markers, radiusMeters)
    },
  }
}

/** Read versioned editorial instructions from a file bundled with the Vercel function. */
function prompt(name: "discovery" | "chat", context: unknown) {
  return `${readFileSync(join(process.cwd(), "server", "prompts", `${name}.prompt.md`), "utf8")}\n\nContext JSON:\n${JSON.stringify(context)}`
}

/** Translate terminal failures without returning private runner messages. */
function pending(job: RunnerJob, ticket: string, radiusMeters?: 200 | 500 | 1000): PendingResearch {
  if (job.status === "failed") {
    const error = job.error?.toLowerCase() ?? ""
    throw new ResearchError(
      /auth|login|subscription|credential/.test(error)
        ? "auth"
        : /timeout|timed out/.test(error)
          ? "timeout"
          : /busy|capacity/.test(error)
            ? "busy"
            : "unavailable",
    )
  }
  return {
    status: job.status === "running" ? "running" : "queued",
    ticket,
    retryAfterMs: 5000,
    ...(radiusMeters ? { radiusMeters } : {}),
  }
}

/** Parse only bounded JSON, never scrape arbitrary text for a plausible object. */
function parseResult(job: RunnerJob): unknown {
  try {
    if (!job.result || job.result.length > 100_000) throw new Error()
    return JSON.parse(job.result)
  } catch {
    throw new ResearchError("malformed")
  }
}

const uuid = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
)
const PollRequest = Schema.Struct({
  ticket: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(40_000)),
})
const DiscoveryRequest = Schema.Union(
  PollRequest,
  Schema.Struct({ requestId: uuid, location: ResearchLocation }),
)
const DiscoveryContext = Schema.Struct({
  kind: Schema.Literal("discovery"),
  requestId: uuid,
  location: ResearchLocation,
  radiusMeters: Schema.Literal(200, 500, 1000),
  jobId: Schema.String,
  candidates: Schema.Array(Schema.Struct({ id: Schema.String, coordinates: Coordinates })).pipe(
    Schema.maxItems(12),
  ),
})
const ChatContext = Schema.Struct({ kind: Schema.Literal("chat"), jobId: uuid })
const DiscoveryOutput = Schema.Struct({
  stories: Schema.Array(Schema.Unknown).pipe(Schema.maxItems(10)),
})
const ChatRequest = Schema.Union(
  PollRequest,
  Schema.Struct({
    requestId: uuid,
    question: Schema.String.pipe(
      Schema.minLength(1),
      Schema.maxLength(2000),
      Schema.filter(value => !!value.trim()),
    ),
    location: ResearchLocation,
    stories: Schema.Array(ResearchStory).pipe(Schema.maxItems(3)),
    history: Schema.Array(ChatMessage).pipe(Schema.maxItems(12)),
    selectedStoryId: Schema.optional(Schema.String.pipe(Schema.maxLength(100))),
  }),
)
const LocationRequest = Schema.Struct({
  query: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(200),
    Schema.filter(value => !!value.trim()),
  ),
})
const MapRequest = Schema.Struct({
  center: Coordinates,
  markers: Schema.Array(Coordinates).pipe(Schema.maxItems(3)),
  radiusMeters: Schema.Literal(200, 500, 1000),
})

/** Authenticated discovery continuation state. */
type DiscoveryContext = typeof DiscoveryContext.Type
