import { handleResearchRequest } from "../server/handleResearchRequest.ts"

// oxlint-disable-next-line herbcaudill/no-default-exports -- Vercel requires the Web Standard handler object.
export default {
  /** Fetch a complete, attributed Google Static map without exposing its key. */
  fetch: (request: Request) => handleResearchRequest(request, "map"),
}
