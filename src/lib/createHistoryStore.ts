import { Schema } from "effect"
import { ResearchDiscovery } from "../research/ResearchDiscovery"
import { ResearchLocation } from "../research/ResearchLocation"
import { ResearchStory } from "../research/ResearchStory"
import { ResearchSource } from "../research/ResearchSource"
import { boundedText } from "../research/boundedText"
import type { Conversation, Discovery, Location } from "../types"
import { distanceBetween } from "./distanceBetween"

/** Store bounded offline reading snapshots without retaining expired provider geography. */
export function createHistoryStore(
  /** Injectable browser persistence and clock. Omit storage to use this browser's localStorage. */
  options: Options = {},
) {
  const storage = options.storage ?? browserStorage()
  const now = options.now ?? Date.now
  let history: StoredHistory = { version: 1, discoveries: [], conversations: [] }
  try {
    const raw = storage?.getItem(KEY)
    if (raw) {
      const parsed =
        byteLength(raw) <= MAX_BYTES ? decode(StoredHistory, JSON.parse(raw)) : undefined
      if (parsed) history = parsed
      else storage?.removeItem(KEY)
    }
  } catch {
    try {
      storage?.removeItem(KEY)
    } catch {
      /* A damaged or inaccessible archive must not prevent opening Tourist. */
    }
  }

  /** Persist a filtered snapshot; fall back to memory when storage is unavailable or full. */
  function persist(removeExpiredOnFailure = false): boolean {
    if (!storage) return false
    try {
      storage.setItem(KEY, JSON.stringify(history))
      return true
    } catch {
      // Keep a valid previous archive on quota failure; remove it only when it contains expired geography.
      if (removeExpiredOnFailure) {
        try {
          storage.removeItem(KEY)
        } catch {
          /* Browser policy can deny removal as well. */
        }
      }
      return false
    }
  }

  /** Discard whole snapshots at their geographic deadline; all their prose is readable until then. */
  function prune() {
    const previous = JSON.stringify(history)
    const previousCount = history.discoveries.length + history.conversations.length
    history = {
      version: 1,
      discoveries: history.discoveries.filter(item =>
        retained(item.researchedAt, item.coordinatesExpireAt, now()),
      ),
      conversations: history.conversations
        .filter(
          item =>
            retained(item.context.researchedAt, item.context.coordinatesExpireAt, now()) &&
            Date.parse(item.updatedAt) <= now() + 300_000,
        )
        .map(item =>
          item.pending && now() - Date.parse(item.updatedAt) >= DAY
            ? {
                ...item,
                restartRequired: true,
                error: "This research session expired. Retry to start the answer again.",
              }
            : item,
        ),
    }
    if (JSON.stringify(history) !== previous)
      persist(history.discoveries.length + history.conversations.length < previousCount)
  }

  /** Fit the whole archive by dropping the oldest complete records first. */
  function bound() {
    history = {
      ...history,
      discoveries: history.discoveries.slice(0, 12),
      conversations: history.conversations.slice(0, 12),
    }
    while (byteLength(JSON.stringify(history)) > MAX_BYTES) {
      const discovery = history.discoveries.at(-1)
      const conversation = history.conversations.at(-1)
      if (
        !conversation ||
        (discovery && Date.parse(discovery.researchedAt) <= Date.parse(conversation.updatedAt))
      )
        history = { ...history, discoveries: history.discoveries.slice(0, -1) }
      else history = { ...history, conversations: history.conversations.slice(0, -1) }
    }
  }

  return {
    /** Read independent copies, including stale research suitable for offline reading. */
    read(): HistorySnapshot {
      prune()
      return {
        discoveries: history.discoveries.map(toDiscovery),
        conversations: structuredClone(history.conversations) as Conversation[],
      }
    },
    /** Save one validated discovery; false means it was invalid or could not be persisted. */
    saveDiscovery(discovery: Discovery): boolean {
      if (
        discovery.researchedAt instanceof Date &&
        !Number.isFinite(discovery.researchedAt.getTime())
      )
        return false
      const value = decode(StoredDiscovery, {
        ...discovery,
        researchedAt:
          discovery.researchedAt instanceof Date
            ? discovery.researchedAt.toISOString()
            : discovery.researchedAt,
      })
      if (
        !value ||
        !retained(value.researchedAt, value.coordinatesExpireAt, now()) ||
        byteLength(JSON.stringify(value)) > MAX_BYTES
      )
        return false
      prune()
      history = {
        ...history,
        discoveries: [
          structuredClone(value),
          ...history.discoveries.filter(item => discoveryId(item) !== discoveryId(value)),
        ].sort((a, b) => Date.parse(b.researchedAt) - Date.parse(a.researchedAt)),
      }
      bound()
      return persist()
    },
    /** Save a full originating context and transcript, including the exact pending request for retry. */
    saveConversation(conversation: Conversation): boolean {
      const value = decode(StoredConversation, {
        ...conversation,
        messages: conversation.messages.slice(-80),
      })
      if (
        !value ||
        Date.parse(value.updatedAt) > now() + 300_000 ||
        !retained(value.context.researchedAt, value.context.coordinatesExpireAt, now()) ||
        value.id !== value.context.id ||
        byteLength(JSON.stringify(value)) > MAX_BYTES
      )
        return false
      if (
        value.context.selectedStoryId &&
        !value.context.stories.some(story => story.id === value.context.selectedStoryId)
      )
        return false
      prune()
      history = {
        ...history,
        conversations: [
          structuredClone(value),
          ...history.conversations.filter(item => item.id !== value.id),
        ].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      }
      bound()
      return persist()
    },
    /** Reuse fresh research only for a matching version, radius and nearby origin. */
    findSuitableDiscovery(query: CacheQuery): Discovery | undefined {
      prune()
      const location = decode(ResearchLocation, query.location)
      if (!location) return undefined
      const result = history.discoveries.find(item => {
        const age = now() - Date.parse(item.researchedAt)
        const freshness = item.stories.some(story => story.timeSensitive) ? HOUR : DAY
        return (
          item.promptVersion === query.promptVersion &&
          item.radiusMeters === query.radiusMeters &&
          age >= 0 &&
          age < freshness &&
          distanceBetween(item.location.coordinates, location.coordinates) <=
            Math.min(50, item.radiusMeters / 4)
        )
      })
      return result && toDiscovery(result)
    },
    /** Clear only Tourist's archive; return whether the browser copy was also removed. */
    clear(): boolean {
      history = { version: 1, discoveries: [], conversations: [] }
      if (!storage) return false
      try {
        storage.removeItem(KEY)
        return true
      } catch {
        return false
      }
    },
  }
}

/** Read browser storage only when access is permitted. */
function browserStorage(): Options["storage"] {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Decode only known fields, ensuring fixtures, raw candidates and images never enter the archive. */
function decode<A, I>(schema: Schema.Schema<A, I, never>, value: unknown): A | undefined {
  const result = Schema.decodeUnknownOption(schema)(value)
  return result._tag === "Some" ? result.value : undefined
}

/** Restore the UI's Date and mutable arrays after validating serializable storage. */
function toDiscovery(value: StoredDiscovery): Discovery {
  return {
    ...structuredClone(value),
    stories: structuredClone(value.stories) as Discovery["stories"],
    researchedAt: new Date(value.researchedAt),
    mapProvider: "google",
  }
}

/** Identify the same discovery without retaining an additional continuous location log. */
function discoveryId(value: StoredDiscovery) {
  return `${value.researchedAt}:${value.location.coordinates.lat}:${value.location.coordinates.lon}:${value.radiusMeters}`
}

/** Enforce the provider deadline and an independent thirty-day maximum, including malformed dates. */
function retained(researchedAt: string, coordinatesExpireAt: string, now: number) {
  const created = Date.parse(researchedAt)
  const expiry = Date.parse(coordinatesExpireAt)
  return (
    Number.isFinite(created) &&
    Number.isFinite(expiry) &&
    created <= now + 300_000 &&
    expiry > created &&
    now < Math.min(expiry, created + 30 * DAY)
  )
}

/** Count actual UTF-8 bytes so multibyte prose cannot bypass the storage cap. */
function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

const KEY = "tourist.history.v1"
const MAX_BYTES = 1_500_000
const HOUR = 3_600_000
const DAY = 24 * HOUR
const Timestamp = Schema.String.pipe(
  Schema.maxLength(40),
  Schema.filter(value => Number.isFinite(Date.parse(value))),
)
const StoredDiscovery = Schema.Struct({
  ...ResearchDiscovery.fields,
  researchedAt: Timestamp,
  coordinatesExpireAt: Timestamp,
  promptVersion: boundedText(80),
})
const StoredMessage = Schema.Struct({
  id: boundedText(200),
  role: Schema.Literal("user", "tourist"),
  text: boundedText(12_000),
  source: Schema.optional(boundedText(2048)),
  sources: Schema.optional(Schema.Array(ResearchSource).pipe(Schema.maxItems(8))),
})
const StoredContext = Schema.Struct({
  id: boundedText(500),
  originLocation: ResearchLocation,
  stories: Schema.Array(ResearchStory).pipe(Schema.maxItems(3)),
  selectedStoryId: Schema.optional(boundedText(100)),
  number: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 3))),
  researchedAt: Timestamp,
  coordinatesExpireAt: Timestamp,
  promptVersion: boundedText(80),
})
const PendingRequest = Schema.Struct({
  requestId: boundedText(100),
  question: boundedText(2000),
  location: ResearchLocation,
  originLocation: ResearchLocation,
  stories: Schema.Array(ResearchStory).pipe(Schema.maxItems(3)),
  history: Schema.Array(
    Schema.Struct({ role: Schema.Literal("user", "tourist"), text: boundedText(6000) }),
  ).pipe(Schema.maxItems(12)),
  selectedStoryId: Schema.optional(boundedText(100)),
})
const StoredConversation = Schema.Struct({
  id: boundedText(500),
  context: StoredContext,
  messages: Schema.Array(StoredMessage).pipe(Schema.maxItems(80)),
  pending: Schema.optional(PendingRequest),
  restartRequired: Schema.optional(Schema.Boolean),
  error: Schema.optional(boundedText(2000)),
  updatedAt: Timestamp,
})
const StoredHistory = Schema.Struct({
  version: Schema.Literal(1),
  discoveries: Schema.Array(StoredDiscovery).pipe(Schema.maxItems(12)),
  conversations: Schema.Array(StoredConversation).pipe(Schema.maxItems(12)),
})

/** Browser-independent storage boundary. */
type Options = {
  /** A Storage-compatible object; denied access falls back to memory. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">
  /** Epoch milliseconds for cache and retention decisions. */
  now?: () => number
}
/** UI records restored from the archive. */
type HistorySnapshot = {
  /** Most recently researched first. */
  discoveries: Discovery[]
  /** Most recently changed first. */
  conversations: Conversation[]
}
/** Criteria for showing a previous discovery as current nearby research. */
type CacheQuery = {
  /** Current location; a fifty-meter maximum allows small GPS variation. */
  location: Location
  /** Exact area size requested. Expanded searches remain explicit. */
  radiusMeters: number
  /** Editorial contract understood by the caller. */
  promptVersion: string
}
type StoredDiscovery = typeof StoredDiscovery.Type
type StoredHistory = typeof StoredHistory.Type
