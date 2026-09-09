import { Schema } from "effect"
import type { ResearchErrorCode } from "../src/research/contracts.ts"
import { ResearchError } from "./ResearchError.ts"

/** Decode a boundary value without exposing input or parser diagnostics. */
export function decode<A, I>(
  /** Contract to enforce. */
  schema: Schema.Schema<A, I, never>,
  /** Untrusted input. */
  input: unknown,
  /** Appropriate public failure category. */
  code: ResearchErrorCode = "invalid",
): A {
  try {
    return Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(input)
  } catch {
    throw new ResearchError(code)
  }
}
