import { Schema } from "effect"
import { ResearchSource } from "./ResearchSource.ts"
import { boundedText } from "./boundedText.ts"

/** A chat response with optional sources. */
export const ResearchAnswer = Schema.Struct({
  /** Plain text response. */
  text: boundedText(12_000),
  /** Sources supplied in context; may be empty for answers from model knowledge. */
  sources: Schema.Array(ResearchSource).pipe(Schema.maxItems(8)),
})

/** Serializable ResearchAnswer contract inferred from its boundary schema. */
export type ResearchAnswer = typeof ResearchAnswer.Type
