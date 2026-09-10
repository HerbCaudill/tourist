import { Schema } from "effect"
import { createModelRequest } from "./createModelRequest.ts"
import { decode } from "./decode.ts"
import { fetchProvider } from "./fetchProvider.ts"
import { readProviderJson } from "./readProviderJson.ts"
import { ResearchError } from "./ResearchError.ts"
import type { RunnerAdapter } from "./types.ts"

/** Call only the authenticated, persistent research-job endpoint. */
export function createRunnerAdapter(
  /** Private runner origin configured in deployment secrets. */
  origin: string,
  /** Dedicated research credential. */
  token: string,
  /** Injectable HTTP boundary. */
  transport: typeof fetch = fetch,
): RunnerAdapter {
  let base: URL
  try {
    base = new URL(origin)
  } catch {
    throw new ResearchError("unavailable")
  }
  if (base.protocol !== "https:" || base.username || base.password || !token)
    throw new ResearchError("unavailable")
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  return {
    /** Submit the fixed request shape, safely replaying the same identifier. */
    async start(id, prompt, context) {
      const response = await fetchProvider(
        new URL("/v1/research/jobs", base),
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            id,
            request: await createModelRequest(prompt),
            ...(context !== undefined ? { context } : {}),
          }),
        },
        transport,
      )
      if (response.status === 404) throw new ResearchError("unavailable")
      const job = decode(Job, await readProviderJson(response), "malformed")
      if (job.id !== id) throw new ResearchError("malformed")
      return job
    },
    /** Poll the private runner by an authenticated identifier; never expose that endpoint to browsers. */
    async get(id) {
      const response = await fetchProvider(
        new URL(`/v1/research/jobs/${encodeURIComponent(id)}`, base),
        { headers },
        transport,
      )
      if (response.status === 404) return null
      const job = decode(Job, await readProviderJson(response), "malformed")
      if (job.id !== id) throw new ResearchError("malformed")
      return job
    },
  }
}

const Job = Schema.Struct({
  id: Schema.String,
  status: Schema.Literal("queued", "running", "completed", "failed"),
  context: Schema.optional(Schema.String.pipe(Schema.maxLength(40_000))),
  result: Schema.optional(Schema.String.pipe(Schema.maxLength(100_000))),
  error: Schema.optional(Schema.String.pipe(Schema.maxLength(4000))),
})
