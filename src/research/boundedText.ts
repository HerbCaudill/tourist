import { Schema } from "effect"

/** A bounded, nonblank text field for public research data. */
export function boundedText(
  /** Maximum characters accepted at the boundary. */
  maximum: number,
) {
  return Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximum),
    Schema.filter(value => value.trim().length > 0),
  )
}
