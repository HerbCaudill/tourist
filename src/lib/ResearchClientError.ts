/** A controlled API failure that distinguishes reconnection from a fresh research job. */
export class ResearchClientError extends Error {
  /** Public service failure category, or connection for a transport interruption. */
  readonly code: string

  /** Whether the current job can no longer produce a valid answer. */
  readonly restartRequired: boolean

  /** Preserve a stable error category alongside its user-facing explanation. */
  constructor(
    /** Public service failure category, or connection for a transport interruption. */
    code: string,
    /** Safe text for the interface. */
    message: string,
  ) {
    super(message)
    this.name = "ResearchClientError"
    this.code = code
    this.restartRequired = ["expired", "auth", "timeout", "malformed"].includes(code)
  }
}
