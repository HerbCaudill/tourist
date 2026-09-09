import { handleResearchRequest } from "../server/handleResearchRequest.ts"

// oxlint-disable-next-line herbcaudill/no-default-exports -- Vercel requires the Web Standard handler object.
export default {
  /** Start or resume a bounded discovery. */
  fetch: (request: Request) => handleResearchRequest(request, "discover"),
}
