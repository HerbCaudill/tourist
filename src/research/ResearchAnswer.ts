import { Schema } from "effect"
import { ResearchSource } from "./ResearchSource.ts"
import { boundedText } from "./boundedText.ts"

/** A sourced chat response. */
export const ResearchAnswer = Schema.Struct({
  /** Plain text response. */
  text: boundedText(12_000),
  /** Sources supporting factual claims; may be empty for a clarification. */
  sources: Schema.Array(ResearchSource).pipe(Schema.maxItems(8)),
})

/** Serializable ResearchAnswer contract inferred from its boundary schema. */
export type ResearchAnswer = typeof ResearchAnswer.Type
