import { ResearchError } from "./ResearchError.ts"

/** Bound network latency and sanitize transport failures at the provider boundary. */
export async function fetchProvider(
  /** Fixed provider URL, constructed only by trusted adapters. */
  url: string | URL,
  /** Private headers and body. */
  init: RequestInit = {},
  /** Injectable transport for focused tests. */
  transport: typeof fetch = fetch,
): Promise<Response> {
  try {
    const response = await transport(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    })
    if (response.status === 401 || response.status === 403) throw new ResearchError("auth")
    if (response.status === 409 || response.status === 429) throw new ResearchError("busy")
    if (response.status === 408 || response.status === 504) throw new ResearchError("timeout")
    if (!response.ok && response.status !== 404) throw new ResearchError("unavailable")
    return response
  } catch (error) {
    if (error instanceof ResearchError) throw error
    if (error instanceof Error && /timeout|abort/i.test(error.name))
      throw new ResearchError("timeout")
    throw new ResearchError("unavailable")
  }
}
