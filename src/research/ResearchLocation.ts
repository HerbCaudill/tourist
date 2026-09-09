import { Schema } from "effect"
import { Coordinates } from "./Coordinates.ts"
import { boundedText } from "./boundedText.ts"

/** An active location whose label comes from the user or coordinates, not Google display text. */
export const ResearchLocation = Schema.Struct({
  /** User-supplied or coordinate label. */
  name: boundedText(200),
  /** Optional user-supplied area label. */
  area: Schema.String.pipe(Schema.maxLength(200)),
  /** Center of the search. */
  coordinates: Coordinates,
  /** Browser accuracy or conservative geocoder viewport size. */
  accuracyMeters: Schema.Number.pipe(Schema.between(0, 100_000)),
})

/** Serializable ResearchLocation contract inferred from its boundary schema. */
export type ResearchLocation = typeof ResearchLocation.Type
