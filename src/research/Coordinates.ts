import { Schema } from "effect"

/** Valid earth coordinates, using the same longitude name as the Ledger. */
export const Coordinates = Schema.Struct({
  /** Latitude in degrees. */
  lat: Schema.Number.pipe(Schema.between(-90, 90)),
  /** Longitude in degrees. */
  lon: Schema.Number.pipe(Schema.between(-180, 180)),
})

/** Serializable Coordinates contract inferred from its boundary schema. */
export type Coordinates = typeof Coordinates.Type
