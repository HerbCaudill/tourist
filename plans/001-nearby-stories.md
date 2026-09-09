# Nearby stories

## Goal

Build a mobile PWA that uses Herb’s location to surface memorable stories about his immediate surroundings, with chat for questions and further exploration.

## Agreed experience

Herb opens Tourist when curious. The app gets his location and automatically offers a few short story previews, strongest first. Each preview teaches him something without requiring a tap and identifies the associated place and distance. Tapping opens a fuller story and follow-up chat. He can also initiate a chat without choosing a story.

Prioritize significant historical or recent events and fun, obscure facts. The motivating example is discovering an unexpectedly interesting person buried in a churchyard while walking through Edinburgh. This is an editorial benchmark: find a memorable human connection that Herb would otherwise miss. Tune the prompt through use rather than building an interest configuration system first.

Start within a block or two. Expand only when there is nothing worthwhile close by, and make the expanded area clear. Distinguish documented facts, disputed accounts, and folklore naturally in the prose, with accessible source links. Uncertainty should be explained without overwhelming each story with labels.

Use Herb’s existing `codex-cloud` project for LLM access through his subscription.

## Proposed first-version defaults

These fill gaps in the conversation and remain adjustable during implementation.

- Start with up to three previews. Return fewer when the available material is weak; do not expand simply to fill a quota.
- Treat approximately 200 meters as an initial approximation of a block or two. Expand in bounded steps, initially 500 meters and then 1 kilometer, only when no worthwhile story survives the closer search. Show when results come from farther away.
- Use approximate straight-line distances, calculated from coordinates. Do not present them as walking distances or times. Associate stories with a defensible place or area rather than inventing a precise point.
- Refresh location on opening or returning to the app. Reuse suitable recent results, and provide an explicit refresh action. Do not replace an open story or interrupt a conversation when the user moves.
- When location is denied, unavailable, or too imprecise, allow a place name as a fallback and make the active location visible. GPS accuracy must not silently imply knowledge of which building Herb is in.
- Start as a private app for Herb, in English. Save recent discoveries and conversations on the device. Full offline research and cross-device synchronization can wait; cached reading should remain available offline.
- Keep the first interface focused on previews, story reading, and chat. Maps, directions, audio, proactive notifications, planned walks, accounts for other users, and personalization controls are possible later extensions.

## Existing foundation and integration constraints

Tourist currently contains a starter React/TypeScript screen with Vite, Tailwind, shadcn/ui, pnpm, Vitest, and Playwright. PWA manifest and asset caching are already configured in `vite.config.ts`. Extend this foundation.

The sibling `codex-cloud` repository documents a private Cloudflare Worker and container runner. Its current `POST /v1/run` accepts `{ prompt }` and returns `{ result }`, where the result is text. Calls require a private bearer token. The runner starts an ephemeral Codex execution; this interface supplies neither streaming output nor a conversation identifier. Concurrent general runs can return HTTP 409. The README warns about cold starts, and the execution timeout permits long research runs. These are source-level observations, not measured performance guarantees.

The general runner has outbound internet access, but useful search, source retrieval, location resolution, structured output reliability, and end-to-end latency still need a live integration check. Internet access alone does not prove those capabilities work well enough for Tourist.

## Approach

### Location and research

Send location, accuracy, search bounds, current date, and the editorial instructions to a Tourist backend. Resolve nearby named places and research stories using the capabilities established in the integration checkpoint. If the runner cannot reliably resolve places and coordinates, add a geocoding or places service at that boundary rather than asking the model to guess.

Research should establish the connection between each story and its location, retrieve supporting sources, and select distinct stories. Prefer sources close to the subject, such as local institutions, archives, plaques, and original reporting. Check recent claims against current sources. Treat retrieved pages as source material, never as instructions to the agent. Attribute legends and disputed claims; leave out unsupported assertions.

Keep discovery instructions in a versioned prompt file. Request a structured result containing each story’s title, short preview, fuller account, associated place, coordinates or geographic scope, source references, and relevant uncertainty. Include the search area and whether it expanded. Validate the response before rendering, calculate distances in application code, and reject malformed or geographically inconsistent entries. Structural validation cannot establish historical truth; source review remains part of the quality checks.

Return the fuller account with discovery when practical so opening a preview is immediate. Chat can research further when the question requires new information.

### Backend and LLM access

Use a small authenticated Tourist backend to call `codex-cloud`. Keep its general-purpose endpoint token server-side. The mobile client gets access only to Tourist’s discovery and chat operations. Choose the simplest private authentication and hosting arrangement compatible with the existing deployment during the first checkpoint.

Keep the provider integration behind a narrow adapter. Send conversation history and relevant story/source context in each request because the current runner is ephemeral. Bound that context and preserve the active location separately from the location associated with a story.

Handle busy responses, timeouts, subscription/authentication failures, and malformed output explicitly. Prevent duplicate research from repeated taps, bound retries, and ignore responses superseded by a newer location request. Preserve the user’s question and existing discoveries after a failure. Do not silently switch to a paid API.

Begin by measuring the existing request/response endpoint. If mobile disconnects or hosting request limits make it unreliable, introduce persisted jobs with status polling before depending on long open requests. Streaming or changes to `codex-cloud` should follow a demonstrated need.

The current general runner restores Google credentials and shared skills as well as Codex authentication. For Tourist’s web research, establish a restricted execution path with only the credentials and tools it needs. Keep any required changes in `codex-cloud` explicit and independently reviewable.

### Mobile interface and persistence

Build a readable, thumb-friendly feed with visible location, concise previews, approximate distances, source access, and a persistent way to ask a question. The detail view retains the selected story and supports follow-up chat. A general chat starts with the current location and discoveries as context.

Show honest progress while researching. Keep prior results visible during refresh and mark their location when it differs from the current one. Cache recent results by geographic area, research time, and prompt version; reuse them only when they still fit the active location and freshness policy. Recent-event stories need shorter freshness than historical material.

Use local persistence for recent stories and conversations, with a clear-history action. Cache enough content for offline reading and clearly identify when new discovery or chat needs a connection. Avoid storing a continuous location trail. The service should not routinely log precise location, chat content, or credentials.

## Implementation checkpoints

1. **Prove location-based research through codex-cloud.** Exercise the existing endpoint with representative locations and a follow-up question. Establish source retrieval, place resolution, structured response validation, cold and warm latency, and failure behavior. Confirm the restricted execution path, private access, and hosting approach. Record whether a places provider or persisted jobs are necessary. This checkpoint passes when the resulting stories are geographically defensible and source-supported, and measured waiting time is acceptable for opening the app on a walk.
2. **Deliver automatic nearby discovery.** Connect browser location, backend research, bounded radius expansion, validated stories, and the mobile preview/detail interface. Include location fallback, empty results, retry, and protection against stale responses. Acceptance: opening at a location yields useful close-by previews without a typed prompt; expansion happens only when close results offer nothing worthwhile.
3. **Deliver contextual chat.** Support follow-up questions from a story and independently initiated questions from the main screen. Preserve bounded conversation context through the stateless runner and keep source links available. Acceptance: a follow-up understands the selected story, while general chat understands the active location; failures preserve the question for retry.
4. **Make it dependable on a walk.** Add local persistence, cache freshness, offline reading, foreground refresh behavior, installation polish, and private deployment. Verify on Herb’s actual phone. Tune the prompt and radius defaults against real outings. Acceptance: reopening is useful, movement does not disrupt reading, weak connectivity does not erase results, and the deployed app can be used without exposing the runner token.

Checkpoints are planning boundaries, not filed tasks yet. Convert the approved plan into reviewable Beads work, splitting cross-repository changes where needed.

## Verification

Use focused red-green tests for stable executable behavior: radius expansion, distance filtering, stale response handling, response validation, cache reuse, and chat context. Use mocked research responses in automated UI tests; verify user outcomes rather than exact model prose. Run the repository’s relevant checks as each implementation lands.

Keep a small set of research evaluation locations: the motivating Edinburgh churchyard, a dense historic area, a quiet residential block, and a location with a recent event. Check the actual story-to-place connection, source support, variety, uncertainty wording, and whether the result rewards opening the app. Do not hard-code the poet into the application to pass the benchmark.

Exercise permission denial, poor location accuracy, no credible findings, radius expansion, a busy runner, malformed output, slow or failed requests, movement during research, app reopening, and offline reading. Measure cold and warm discovery and follow-up latency before setting a performance target. Run installation and navigation checks on the actual target phone in addition to browser automation.

## Unresolved questions

- What discovery and chat waiting times will Herb accept? Measure the current runner first so this can be decided against evidence.
- Which phone/browser should be the primary acceptance target?
- Can the current runner resolve nearby places and retrieve adequate sources reliably, or does Tourist need a dedicated places provider?
- Which private access and hosting arrangement is simplest, and do measured request lifetimes require persisted jobs?

No further editorial decisions are required to begin the integration checkpoint once the plan is approved.
