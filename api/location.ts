import { handleResearchRequest } from "../server/handleResearchRequest.ts"

// oxlint-disable-next-line herbcaudill/no-default-exports -- Vercel requires the Web Standard handler object.
export default {
  /** Resolve a user-entered street or landmark. */
  fetch: (request: Request) => handleResearchRequest(request, "locate"),
}
