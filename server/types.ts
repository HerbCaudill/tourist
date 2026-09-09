import type { Coordinates, ResearchLocation } from "../src/research/contracts.ts"

/** Minimal provider candidate; names stay server-side. */
export type PlaceCandidate = {
  /** Provider identifier. */
  id: string
  /** Temporary search clue, never copied into the public result. */
  name: string
  /** Provider-backed position. */
  coordinates: Coordinates
}
/** Bounded mapping operations. */
export type PlacesAdapter = {
  /** Resolve a typed location without returning provider display text. */
  resolve: (query: string) => Promise<ResearchLocation>
  /** Find geographic anchors within one radius. */
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
}
/** Private async runner transport. */
export type RunnerAdapter = {
  /** Submit a replayable job. */
  start: (id: string, prompt: string) => Promise<RunnerJob>
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
