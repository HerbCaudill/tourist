import { createResearchService } from "./createResearchService.ts"
import { createPlacesAdapter } from "./createPlacesAdapter.ts"
import { createRunnerAdapter } from "./createRunnerAdapter.ts"
import { readBoundedBody } from "./readBoundedBody.ts"
import { ResearchError } from "./ResearchError.ts"
import type { ResearchErrorCode } from "../src/research/contracts.ts"

/** Apply a uniform, bounded JSON boundary to the public Tourist operations. */
export async function handleResearchRequest(
  /** Browser request; precise location belongs only in its body. */
  request: Request,
  /** Narrow operation allowed by this route. */
  operation: "discover" | "chat" | "locate" | "map",
  /** Injectable service factory so validation can be tested without credentials. */
  getService: () => ReturnType<typeof createResearchService> = productionService,
): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
  if (request.method !== "POST")
    return Response.json(
      { error: { code: "invalid", message: "Use POST with a JSON body.", retryable: false } },
      { status: 405, headers: { ...headers, Allow: "POST" } },
    )
  try {
    if (
      new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")
    )
      throw new ResearchError("invalid")
    let input: unknown
    try {
      input = JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request, 90_000, "invalid")),
      )
    } catch {
      throw new ResearchError("invalid")
    }
    const result = await getService()[operation](input)
    if (operation === "map")
      return new Response(result as ArrayBuffer, {
        headers: { ...headers, "Content-Type": "image/png" },
      })
    const isPending =
      typeof result === "object" &&
      result &&
      "status" in result &&
      ["queued", "running"].includes(result.status)
    return Response.json(result, {
      status: isPending ? 202 : 200,
      headers: { ...headers, ...(isPending ? { "Retry-After": "5" } : {}) },
    })
  } catch (error) {
    const failure = error instanceof ResearchError ? error : new ResearchError("unavailable")
    const retryable = ["busy", "timeout", "unavailable", "malformed"].includes(failure.code)
    return Response.json(
      { error: { code: failure.code, message: failure.message, retryable } },
      {
        status: statusCodes[failure.code],
        headers: { ...headers, ...(failure.code === "busy" ? { "Retry-After": "10" } : {}) },
      },
    )
  }
}

/** Construct private adapters lazily so missing configuration produces a controlled response. */
function productionService() {
  return createResearchService({
    secret: process.env.TOURIST_CONTEXT_SECRET ?? "",
    runner: createRunnerAdapter(
      process.env.RESEARCH_RUNNER_URL ?? "",
      process.env.RESEARCH_RUNNER_TOKEN ?? "",
    ),
    places: createPlacesAdapter(process.env.GOOGLE_MAPS_API_KEY ?? ""),
  })
}

const statusCodes: Record<ResearchErrorCode, number> = {
  invalid: 400,
  busy: 429,
  auth: 503,
  timeout: 504,
  malformed: 502,
  unavailable: 503,
  expired: 410,
  location_not_found: 422,
}
