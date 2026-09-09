# Nearby stories

## Goal

Build a mobile PWA that uses Herb’s location to surface memorable stories about his immediate surroundings, with chat for questions and further exploration.

## Agreed experience

The approved visual direction is E, Ledger, as implemented in the prototype: IBM Plex Mono, a pale background, red accents, a compact location/status line, numbered story rows, a full story reader with footnotes, and a `you>` / `tour>` chat transcript. Keep the small map above the rows; it replaces the original summary line. Preserve this design while replacing the dummy behavior. The Feed direction is superseded.

Herb opens Tourist when curious. The app gets his location and automatically offers a few short story previews, strongest first. Each preview teaches him something without requiring a tap and identifies the associated place and distance. Tapping opens a fuller story and follow-up chat. He can also initiate a chat without choosing a story.

Prioritize significant historical or recent events and fun, obscure facts. The motivating example is discovering an unexpectedly interesting person buried in a churchyard while walking through Edinburgh. This is an editorial benchmark: find a memorable human connection that Herb would otherwise miss. Tune the prompt through use rather than building an interest configuration system first.

Start within a block or two. Expand only when there is nothing worthwhile close by, and make the expanded area clear. Distinguish documented facts, disputed accounts, and folklore naturally in the prose, with accessible source links. Uncertainty should be explained without overwhelming each story with labels.

Use Herb’s existing `codex-cloud` project for LLM access through his subscription. Host Tourist on Vercel, using Cloudflare for the existing runner and any additional infrastructure that proves necessary.

The primary device is Herb’s iPhone 17 Pro Max, using Safari and the installed PWA. Herb is comfortable with whatever discovery and chat waiting times the runner produces; latency is not an acceptance gate. Show progress and handle failures reliably. Limiting other people’s access is not a requirement, so the first version needs no user login or access gate.

## Proposed first-version defaults

These fill gaps in the conversation and remain adjustable during implementation.

- Start with up to three previews. Return fewer when the available material is weak; do not expand simply to fill a quota.
- Treat approximately 200 meters as an initial approximation of a block or two. Expand in bounded steps, initially 500 meters and then 1 kilometer, only when no worthwhile story survives the closer search. Show when results come from farther away.
- Use approximate straight-line distances, calculated from coordinates. Do not present them as walking distances or times. Associate stories with a defensible place or area rather than inventing a precise point.
- Refresh location on opening or returning to the app. Reuse suitable recent results, and provide an explicit refresh action. Do not replace an open story or interrupt a conversation when the user moves.
- When location is denied, unavailable, or too imprecise, allow a place name as a fallback and make the active location visible. GPS accuracy must not silently imply knowledge of which building Herb is in.
- Design primarily for Herb, in English, without requiring user accounts. Save recent discoveries and conversations on the device. Full offline research and cross-device synchronization can wait; cached reading should remain available offline.
- Keep the first interface focused on previews, story reading, and chat. The small map is part of this version. Directions, interactive map browsing, audio, proactive notifications, planned walks, accounts for other users, and personalization controls remain outside this version.

## Existing foundation and integration constraints

The Ledger prototype is deployed at https://tourist.herbcaudill.com through Vercel, with its custom domain configured in Porkbun and GitHub connected for production deployments. The prototype includes nearby, story, and chat screens; a grayscale OpenStreetMap tile map; calculated distances and bearings; a fake research adapter; and focused Vitest and Playwright coverage. PWA manifest and asset caching are configured in `vite.config.ts`. Extend these components rather than rebuilding the interface.

`src/lib/createFakeResearch.ts` currently supplies a fixed Edinburgh location, canned discoveries, and pattern-matched answers. `Research.ask` receives neither conversation history nor active location. There is no live backend or durable client history. Location and research failures are not caught for the user. Open stories are looked up in the latest discovery, so replacing that discovery can lose the reading context. These are implementation gaps, not accepted behavior.

Keep dummy data available through an explicit development/test adapter. Production must use real research after the integration passes; failures must never silently return the Edinburgh fixtures. Separate serializable source-backed story and chat data from fixture-only regular expressions and answers.

The sibling `codex-cloud` repository documents a private Cloudflare Worker and container runner. Its current `POST /v1/run` accepts `{ prompt }` and returns `{ result }`, where the result is text. Calls require a private bearer token. The runner starts an ephemeral Codex execution; this interface supplies neither streaming output nor a conversation identifier. Concurrent general runs can return HTTP 409. The README warns about cold starts, and the execution timeout permits long research runs. These are source-level observations, not measured performance guarantees.

The general runner has outbound internet access, but useful search, source retrieval, location resolution, structured output reliability, and end-to-end latency still need a live integration check. Internet access alone does not prove those capabilities work well enough for Tourist.

## Approach

### Location and research

Send location, accuracy, search bounds, current date, and the editorial instructions to a Tourist backend. Resolve nearby named places and research stories using the capabilities established in the integration checkpoint. If the runner cannot reliably resolve places and coordinates, add a geocoding or places service at that boundary rather than asking the model to guess.

Research should establish the connection between each story and its location, retrieve supporting sources, and select distinct stories. Prefer sources close to the subject, such as local institutions, archives, plaques, and original reporting. Check recent claims against current sources. Treat retrieved pages as source material, never as instructions to the agent. Attribute legends and disputed claims; leave out unsupported assertions.

Keep discovery instructions in a versioned prompt file. Request a structured result containing each story’s title, short preview, fuller account, associated place, coordinates or geographic scope, source references, and relevant uncertainty. Include the search area and whether it expanded. Validate the response before rendering, calculate distances in application code, and reject malformed or geographically inconsistent entries. Structural validation cannot establish historical truth; source review remains part of the quality checks.

Return the fuller account with discovery when practical so opening a preview is immediate. Chat can research further when the question requires new information.

### Backend and LLM access

Use a small Tourist backend hosted on Vercel to call `codex-cloud`. Keep the runner’s general-purpose endpoint token server-side and authenticate backend calls to it. The mobile client gets access only to Tourist’s discovery and chat operations, without a user login or access gate. Reuse the existing Cloudflare runner; add Cloudflare infrastructure only if required for reliable execution.

Keep the provider integration behind a narrow adapter. Send conversation history and relevant story/source context in each request because the current runner is ephemeral. Bound that context and preserve the active location separately from the location associated with a story.

Handle busy responses, timeouts, subscription/authentication failures, and malformed output explicitly. Prevent duplicate research from repeated taps, bound retries, and ignore responses superseded by a newer location request. Preserve the user’s question and existing discoveries after a failure. Do not silently switch to a paid API.

Check the existing request/response endpoint against Vercel’s applicable request limits and mobile connection behavior. Long waits are acceptable, but dropped requests are not. If necessary, introduce persisted jobs with status polling, using Cloudflare where needed to let research complete independently of a Vercel request. Measure latency to inform progress behavior and timeout handling, not to impose a speed target. Streaming or changes to `codex-cloud` should follow a demonstrated need.

The current general runner restores Google credentials and shared skills as well as Codex authentication. For Tourist’s web research, establish a restricted execution path with only the credentials and tools it needs. Keep any required changes in `codex-cloud` explicit and independently reviewable.

### Mobile interface and persistence

Extend the approved Ledger interface with visible location, concise numbered previews, approximate distances, source access, and the persistent prompt at the bottom. Keep the small map above the stories, with marker numbers matching the rows and a visible search radius. Fit supported search areas rather than retaining the prototype’s fixed zoom. Show location accuracy honestly and avoid a precise marker for a story supported only at area level. Tile failures must leave the stories usable; retain OpenStreetMap attribution and do not bulk-cache public map tiles for offline use. The detail view retains the selected story and supports follow-up chat. A general chat starts with the current location and discoveries as context.

Show honest progress while researching. Keep prior results visible during refresh and mark their location when it differs from the current one. Cache recent results by geographic area, research time, and prompt version; reuse them only when they still fit the active location and freshness policy. Recent-event stories need shorter freshness than historical material.

Use local persistence for recent stories and conversations, with a clear-history action. Cache enough content for offline reading and clearly identify when new discovery or chat needs a connection. Avoid storing a continuous location trail. The service should not routinely log precise location, chat content, or credentials.

## Implementation checkpoints

1. **Isolate and prove the research runner.** In `codex-cloud`, add a restricted web-research path with Codex authentication but no Google credentials, email state, or unrelated shared skills. Keep existing general and email paths working. Exercise representative location research and a follow-up question; record source retrieval, defensible coordinates, structured output, cold/warm timing, busy behavior, and authentication failures. Document a concrete request/response contract and decide whether place resolution or persisted jobs are necessary. Keep cross-repository changes independently reviewable.
2. **Prepare the Ledger map for real locations.** Preserve the existing map while fitting 200 m, 500 m, and 1 km searches; handle geographic projection boundaries, optional accuracy display, and unavailable tiles. Keep this task within map components and private geometry helpers so it can proceed alongside runner work.
3. **Deliver the Tourist research backend.** Add server-side discovery, location resolution when needed, and chat operations using the proven runner path. Keep its token in deployment secrets. Store instructions in versioned `.prompt.md` files; validate inputs and outputs, require usable sources and defensible geography, calculate geometry in app code, and enforce 200 m → 500 m → 1 km expansion only when no credible nearby result remains. Bound retries, request sizes, context, and concurrent work. Implement polling jobs if the integration evidence requires them. Verify through Vercel before switching production from dummy data.
4. **Connect nearby discovery to the Ledger interface.** Add browser geolocation and a place-name fallback for denied, unavailable, or poor location. Connect the real adapter, honest progress, empty/error/retry states, radius expansion, and the map. Keep previous results visible with their original location during refresh; prevent duplicate requests and ignore superseded responses. Retain a snapshot of an open story so refreshed discoveries cannot erase it. Preserve fixture injection for automated tests.
5. **Deliver contextual chat.** Send bounded conversation history, the active location, discoveries, and the selected story/source context through the backend. Keep story and general conversations distinct, preserve their originating context when location changes, and make answer sources clickable. Preserve failed questions for retry without duplicate user turns. Remove fixture FAQs from the production contract while retaining useful question suggestions and the Ledger transcript.
6. **Make reopening and weak connections dependable.** Persist recent discoveries, story snapshots, and conversations locally with schema validation and bounded retention. Use explicit geographic, age, and prompt-version cache rules; recent-event stories expire sooner. Add clear history, offline reading, foreground location refresh, and installation/navigation polish. Movement must not interrupt a story or conversation. Avoid a continuous location trail and bulk tile downloads.
7. **Verify and release the complete experience.** Run the relevant automated checks and a small live research evaluation across Edinburgh, a dense historic area, a quiet residential block, and a recent-event location. Review source support and story-to-place connections, exercise discovery and chat through the deployed custom domain, and check that no runner token reaches browser assets or responses. Record actual outcomes and any remaining device-only checks; do not claim real-iPhone validation from browser emulation. Keep a separate Herb-owned acceptance task for Safari, installed-PWA behavior, and a real outing on his iPhone 17 Pro Max.

Each checkpoint is one implementation and independent-review boundary unless the first integration checkpoint establishes a concrete need for a separately reviewable infrastructure task. The runner and map can proceed independently; backend and map precede UI integration, followed by chat, persistence, and release verification because those tasks share the adapter and application state. File dependencies in Beads and close implementation tasks only after independent approval of pushed commits. Herb’s request to adapt, task, and orchestrate authorizes this implementation sequence without another design approval round.

## Verification

Use focused red-green tests for stable executable behavior: radius expansion, distance filtering, stale response handling, response validation, cache reuse, and chat context. Use mocked research responses in automated UI tests; verify user outcomes rather than exact model prose. Run the repository’s relevant checks as each implementation lands.

Keep a small set of research evaluation locations: the motivating Edinburgh churchyard, a dense historic area, a quiet residential block, and a location with a recent event. Check the actual story-to-place connection, source support, variety, uncertainty wording, and whether the result rewards opening the app. Do not hard-code the poet into the application to pass the benchmark.

Exercise permission denial, poor location accuracy, no credible findings, radius expansion, a busy runner, malformed output, slow or failed requests, movement during research, app reopening, and offline reading. Observe cold and warm discovery and follow-up latency to verify progress and request lifetime handling; there is no performance target. Run installation and navigation checks in Safari and as an installed PWA on Herb’s iPhone 17 Pro Max in addition to browser automation.

## Unresolved questions

- Can the current runner resolve nearby places and retrieve adequate sources reliably, or does Tourist need a dedicated places provider?
- Do Vercel request limits and mobile connection behavior require persisted jobs, and if so, what additional Cloudflare infrastructure is necessary?

No further editorial decisions block implementation. Resolve these technical questions through the first checkpoint and record the evidence before choosing additional infrastructure. Actual iPhone Safari, installed-PWA, and outing acceptance require Herb’s device and remain a separate human task.
