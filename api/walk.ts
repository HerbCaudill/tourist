import { handleWalkingRequest } from "../server/handleWalkingRequest.ts"

// oxlint-disable-next-line herbcaudill/no-default-exports -- Vercel requires the Web Standard handler object.
export default {
  /** Produce a walking-route map from private request coordinates. */
  fetch: (request: Request) => handleWalkingRequest(request),
}
