import { ResearchError } from "./ResearchError.ts"
import { readBoundedBody } from "./readBoundedBody.ts"

/** Parse capped provider data without returning raw malformed content. */
export async function readProviderJson(
  /** Provider response after status handling. */
  response: Response,
): Promise<unknown> {
  try {
    return JSON.parse(
      new TextDecoder().decode(await readBoundedBody(response, 160_000, "malformed")),
    )
  } catch (error) {
    if (error instanceof ResearchError) throw error
    throw new ResearchError("malformed")
  }
}
