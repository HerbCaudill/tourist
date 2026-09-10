import type { Coordinates, ResearchLocation } from "../src/research/contracts.ts"

/** Minimal provider candidate; labels may appear in the temporary progress feed. */
export type PlaceCandidate = {
  /** Provider identifier. */
  id: string
  /** Temporary identification clue, never copied into the completed discovery. */
  name: string
  /** Temporary street/locality context for orienting the model, never archived. */
  address?: string
  /** Provider-backed position. */
  coordinates: Coordinates
}
/** Bounded mapping operations. */
export type PlacesAdapter = {
  /** Resolve a typed location without returning provider display text. */
  resolve: (query: string) => Promise<ResearchLocation>
  /** Resolve a story's present-day site; null means no sufficiently specific match. */
  resolveStory: (query: string) => Promise<{ id: string; coordinates: Coordinates } | null>
  /** Find orientation clues of any category within one radius. */
  nearby: (location: ResearchLocation, radiusMeters: number) => Promise<readonly PlaceCandidate[]>
  /** Fetch an attributed map image server-side. */
  map: (
    center: Coordinates,
    markers: readonly Coordinates[],
    radiusMeters: number,
  ) => Promise<ArrayBuffer>
}
/** Persistent runner job record. */
export type RunnerJob = {
  /** Idempotency identifier. */
  id: string
  /** Durable execution state. */
  status: "queued" | "running" | "completed" | "failed"
  /** Model output only on success. */
  result?: string
  /** Private upstream diagnostic, never returned verbatim. */
  error?: string
  /** Original opaque recovery context, encrypted by the caller. */
  context?: string
}
/** Private async runner transport. */
export type RunnerAdapter = {
  /** Submit a replayable job. */
  start: (id: string, prompt: string, context?: string) => Promise<RunnerJob>
  /** Read status; null means absent or expired. */
  get: (id: string) => Promise<RunnerJob | null>
}
/** Dependency injection keeps orchestration behavior deterministic in tests. */
export type ResearchDependencies = {
  /** Encryption/signing secret. */
  secret: string
  /** Provider boundary. */
  places: PlacesAdapter
  /** Durable research boundary. */
  runner: RunnerAdapter
  /** Clock for expiry tests. */
  now?: () => Date
}
