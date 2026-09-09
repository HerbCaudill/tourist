import { Schema } from "effect"
import { boundedText } from "./boundedText.ts"

/** Client conversation history: bounded and explicitly untrusted context. */
export const ChatMessage = Schema.Struct({
  /** Speaker for this turn. */
  role: Schema.Literal("user", "tourist"),
  /** Text only; no system instructions accepted. */
  text: boundedText(6000),
})

/** Serializable ChatMessage contract inferred from its boundary schema. */
export type ChatMessage = typeof ChatMessage.Type
