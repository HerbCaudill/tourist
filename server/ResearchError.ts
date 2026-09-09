import type { ResearchErrorCode } from "../src/research/contracts.ts"

/** A controlled failure safe to translate at the HTTP boundary. */
export class ResearchError extends Error {
  /** Stable code understood by the client. */
  readonly code: ResearchErrorCode
  /** Construct a failure without leaking provider diagnostics. */
  constructor(
    /** Stable public error category. */
    code: ResearchErrorCode,
  ) {
    super(messages[code])
    this.code = code
  }
}

/** Public messages deliberately exclude raw upstream responses. */
const messages: Record<ResearchErrorCode, string> = {
  invalid: "This request is incomplete or too large.",
  busy: "Research is busy. Please try again shortly.",
  auth: "The research service needs its connection renewed.",
  timeout: "The service did not respond in time. You can retry this request.",
  malformed: "The research response could not be verified. Please try again.",
  unavailable: "The service is temporarily unavailable. Please try again.",
  expired: "This research session has expired. Please start again.",
  location_not_found:
    "That place could not be located precisely enough. Try a nearby street or landmark.",
}
