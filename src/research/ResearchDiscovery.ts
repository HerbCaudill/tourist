import { Schema } from "effect"
import { ResearchLocation } from "./ResearchLocation.ts"
import { ResearchStory } from "./ResearchStory.ts"

/** Serializable discovery and explicit retention metadata. */
export const ResearchDiscovery = Schema.Struct({
  /** Originating location retained while newer searches run. */
  location: ResearchLocation,
  /** Strongest stories first. */
  stories: Schema.Array(ResearchStory).pipe(Schema.maxItems(3)),
  /** Final search radius, even for an empty result. */
  radiusMeters: Schema.Literal(200, 500, 1000),
  /** ISO timestamp for display and cache decisions. */
  researchedAt: Schema.String,
  /** ISO deadline for retaining provider-derived coordinates. */
  coordinatesExpireAt: Schema.String,
  /** Editorial and validation version for cache invalidation. */
  promptVersion: Schema.Literal("ledger-2"),
})

/** Serializable ResearchDiscovery contract inferred from its boundary schema. */
export type ResearchDiscovery = typeof ResearchDiscovery.Type
