import type { ResearchDiscovery } from "./ResearchDiscovery.ts"
import type { ResearchAnswer } from "./ResearchAnswer.ts"

/** Resumable research progress. POST this ticket back to the same operation. */
export type PendingResearch = {
  /** Transient provider labels and distances, present on a fresh discovery submission. */
  nearbyPlaces?: readonly { name: string; distanceMeters: number }[]
  /** Current runner state. */
  status: "queued" | "running"
  /** Opaque encrypted context, suitable for transient session recovery. */
  ticket: string
  /** Minimum polling interval. */
  retryAfterMs: number
  /** Search radius while discovering, absent for chat. */
  radiusMeters?: 200 | 500 | 1000
}
/** Discovery operation result. */
export type DiscoveryResponse =
  | PendingResearch
  | {
      /** Research finished, including the valid empty case. */
      status: "completed"
      /** Validated final result. */
      discovery: ResearchDiscovery
    }
/** Chat operation result. */
export type ChatResponse =
  | PendingResearch
  | {
      /** Research finished. */
      status: "completed"
      /** Validated final answer. */
      answer: ResearchAnswer
    }
/** Public failures never include provider output or credentials. */
export type ResearchErrorCode =
  | "invalid"
  | "busy"
  | "auth"
  | "timeout"
  | "malformed"
  | "unavailable"
  | "expired"
  | "location_not_found"
