# Tourist research backend

The Ledger remains on its dummy adapter until the coordinator verifies the live runner, these operations, and the later UI integration. This implementation does not switch the production UI.

All browser operations use `POST`, `Content-Type: application/json`, a body without extra fields, and no query string. Responses use `Cache-Control: private, no-store`. Never put precise location, chat text, context tickets, or credentials into URLs or logs. Source links are evidence links; the backend does not fetch caller-supplied URLs.

## Frontend contract

Serializable Effect schemas and inferred types are exported by `src/research/contracts.ts`. Schemas also have individual files. `ResearchStory` contains `suggestedQuestions`, never fixture regexes or canned answers. Timestamps in `ResearchDiscovery` are ISO strings, not `Date` objects.

| Operation       | Initial body                                                                                                                                                                  | Successful response                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/api/location` | `{query: string}`; 1–200 nonblank characters                                                                                                                                  | `ResearchLocation`                                                        |
| `/api/discover` | `{requestId: UUIDv4, location: ResearchLocation}`                                                                                                                             | Pending research or `{status: "completed", discovery: ResearchDiscovery}` |
| `/api/chat`     | `{requestId: UUIDv4, question: string, location: ResearchLocation, stories: ResearchStory[], history: {role: "user" \| "tourist", text: string}[], selectedStoryId?: string}` | Pending research or `{status: "completed", answer: ResearchAnswer}`       |
| `/api/map`      | `{center: Coordinates, markers: Coordinates[], radiusMeters: 200 \| 500 \| 1000}`                                                                                             | A complete PNG image with Google attribution                              |

Pending research has HTTP 202 and `{status: "queued" | "running", ticket: string, retryAfterMs: 5000, radiusMeters?: 200 | 500 | 1000}`. Discover responses always include the current radius; chat responses do not. Poll the same discovery/chat endpoint with `{ticket}` after at least `retryAfterMs`. Replace the saved ticket whenever a poll returns a new one. Use a transient recovery record containing the request ID, originating context and latest ticket; preserve it across a mobile disconnect. Do not archive provider candidates or map images. Tickets contain only encrypted, authenticated context and expire after one day. A missing or expired runner job returns `expired`; restart explicitly with a new request ID.

Create the initial UUID once per user action and retain it through connection retries. Job IDs are deterministically derived from that UUID and the bounded operation/context. If a submission succeeds but its response is lost, replaying the initial request reuses that job. Radius expansion also reuses deterministic IDs. Ordinary polling never starts the original job again. The initial encrypted ticket is also stored as the runner job’s bounded opaque `context` field. Replayed submissions read that original context before calling Google, so a provider outage or changed candidates cannot change the geography of already running research. Concurrent duplicate submissions recover the first stored context even when their candidate queries differ.

Discovery starts at 200 meters. The server alone authorizes 500 meters and then 1 kilometer after a valid result leaves no geographically supported story. One accepted story stops expansion; a quota never triggers it. Malformed output, unsupported source URL schemes, and upstream failures are errors, not empty discoveries. A well-formed story with an unknown candidate ID is dropped. The server attaches coordinates by provider ID and calculates straight-line distances and bearings; the model cannot set these fields. Three empty searches return a completed discovery with no stories and radius 1000.

The chat request accepts at most three complete stories, twelve prior messages of at most 6000 characters each, and a 2000-character question. Its serialized input is capped at 70,000 characters, within the runner's 100,000-character prompt cap after instructions. The selected story must exist in `stories`. Keep the location and story snapshot associated with the conversation rather than substituting the newest GPS position. Trim old history before submitting. Inputs are context, never system instructions. Answers contain plain text and an array of independently retrieved evidence links.

Map inputs accept at most three markers, all within the supplied radius (one meter of rounding tolerance). Fetch the PNG as a blob, show it with an object URL, and revoke that URL on replacement. Render the complete image, including its bottom attribution; do not crop, cover or desaturate the rendered image. Map styling is requested from Google so the map stays subdued while attribution remains intact.

## Errors and limits

Failures have `{error: {code, message, retryable}}`. Messages are controlled public text and never include a raw runner/provider error. `retryable` means the user can retry; it is not an instruction to loop automatically.

| Code                 | HTTP | Meaning                                                            |
| -------------------- | ---- | ------------------------------------------------------------------ |
| `invalid`            | 400  | Invalid schema, oversized request, or location in query parameters |
| `busy`               | 429  | Runner/provider capacity or quota; Retry-After is 10 seconds       |
| `auth`               | 503  | A private service connection needs renewal                         |
| `timeout`            | 504  | A private HTTP request timed out                                   |
| `malformed`          | 502  | Model/provider output failed validation                            |
| `unavailable`        | 503  | Temporary service failure                                          |
| `expired`            | 410  | Invalid/expired ticket or missing/expired job                      |
| `location_not_found` | 422  | No precise geocode; request a street or landmark                   |

Non-POST requests return 405 with `Allow: POST`. JSON request bodies are capped at 90,000 actual bytes, including chunked bodies. Each private HTTP call has a 20-second timeout; provider JSON, model output and map bytes have separate bounds. Persisted jobs keep research execution independent of Vercel/mobile request lifetime. Vercel requests perform submission or polling only, never a long model run.

## Private configuration

Configure `RESEARCH_RUNNER_URL`, `RESEARCH_RUNNER_TOKEN`, `TOURIST_CONTEXT_SECRET` (at least 32 random characters), and `GOOGLE_MAPS_API_KEY` as deployment secrets. Never prefix them with `VITE_`. Only the runner's `/v1/research/jobs` POST and `/v1/research/jobs/:id` GET paths are used; the general execution endpoint is inaccessible through this adapter.

The API files use Vercel's native Web Standard handler export. `vercel.json` includes `server/prompts/*.prompt.md` in each function. The prompt loader resolves those files from the deployment working directory. Live verification must confirm that bundling through actual deployed discovery, not just a local Vite build.

## Google data boundaries

Nearby Search (New) requests only IDs, display names and coordinates for up to twelve geographic candidates. Names are temporary server-side search clues; the research prompt requires independently sourced place labels and stories. The public discovery never contains provider descriptions, names, addresses, photos, reviews, or the candidate list. Nearby responses already establish place IDs and coordinates, so extra Place Details calls would duplicate that data. Reverse geocoding is unnecessary for coordinate-based GPS labels; typed fallback uses geocoding and preserves the user's label.

The backend requests Google Static Maps through its private key and returns only the attributed image. Google-derived coordinates must stay on the Google map, not the prototype's OpenStreetMap tiles. The public discovery carries `coordinatesExpireAt`, set conservatively to 29 days after validation. The later persistence layer must discard provider-derived coordinates by that deadline and must not archive raw candidates or map images. User-supplied GPS coordinates and independently sourced narratives have different origins, but retaining every discovery only until the conservative deadline is a simple first-version policy.

Before switching the live UI, add publicly accessible terms and privacy pages linking Google's applicable terms and privacy policy, and describe sharing research location/context with the backend, Google and the research service. Keep Google's attribution visible. These requirements are recorded for the UI/release tasks rather than silently modifying the prototype in this backend task.

Sources checked on 9 September 2026: [Places policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies), [Nearby Search field masks](https://developers.google.com/maps/documentation/places/web-service/nearby-search), [Static Maps parameters](https://developers.google.com/maps/documentation/maps-static/start), and [Vercel native Node handlers](https://vercel.com/docs/functions/runtimes/node-js). The account's applicable regional terms still govern its retention allowances.

## Verification

`pnpm test run server/tests` exercises radius expansion, bad source URLs, invented place IDs, idempotent submission, expiry, chat context, private transports, HTTP byte bounds, safe failure messages and map proxying. `pnpm typecheck` includes strict backend checking through `tsconfig.server.json`. Unit checks do not establish historical truth or prove deployed secret/prompt wiring; live discovery and follow-up plus source review remain coordinator acceptance gates.
