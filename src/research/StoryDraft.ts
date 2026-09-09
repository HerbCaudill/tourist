import { Schema } from "effect"
import { ResearchSource } from "./ResearchSource.ts"
import { boundedText } from "./boundedText.ts"

/** Model output before trusted geographic coordinates are attached. */
export const StoryDraft = Schema.Struct({
  /** Identifier unique within this discovery. */
  id: boundedText(100),
  /** An exact identifier from the supplied geographic candidates. */
  placeId: boundedText(300),
  /** Place label recognized from the supplied candidate. */
  place: boundedText(200),
  /** Informative headline. */
  title: boundedText(200),
  /** Standalone short preview. */
  preview: boundedText(1000),
  /** Complete paragraphs ready for offline reading. */
  account: Schema.Array(boundedText(3000)).pipe(Schema.minItems(1), Schema.maxItems(8)),
  /** How the narrative distinguishes its evidence. */
  kind: Schema.Literal("documented", "disputed", "folklore"),
  /** Optional sources supplied in context; empty for accounts from model knowledge. */
  sources: Schema.Array(ResearchSource).pipe(Schema.maxItems(8)),
  /** Optional starting points for conversation. */
  suggestedQuestions: Schema.Array(boundedText(300)).pipe(Schema.maxItems(3)),
  /** Whether the story needs a shorter cache lifetime. */
  timeSensitive: Schema.Boolean,
})

/** Serializable StoryDraft contract inferred from its boundary schema. */
export type StoryDraft = typeof StoryDraft.Type
