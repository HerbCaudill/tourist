# Live research evaluation

Evaluation date: 9 September 2026. Public deployment: <https://tourist.herbcaudill.com>. This records observed results from the implementation of plan 001; automated checks and actual iPhone acceptance are separate.

## Runtime and deployment checks

The isolated Cloudflare runner uses Codex CLI 0.149.1 and explicitly selects GPT-5.5. The CLI's default model requires Code Mode, which the restricted runtime disables; its first completed request could not search. An exact container probe with GPT-5.5 recorded eight completed native web-search calls while preserving the existing shell, app, browser, skill and private-state restrictions. The reviewed configuration was deployed as worker version `c014f78c-61c7-469c-aa38-a1cc7329776b`.

Existing local ChatGPT authentication was transferred through the private research-only reseed endpoint. The endpoint shares the research ownership lock, returns a busy response while a job is running, and changes only the encrypted research credential object. General and email state were not rotated.

The first Vercel API invocation exposed a TypeScript import-extension packaging error despite a successful build. The root compilation configuration now rewrites relative TypeScript extensions for emitted JavaScript. All four built API modules loaded successfully; deployed location lookup and the complete attributed Google map image both returned HTTP 200.

## Observed research

| Location                                    | Observed result                                                                                            | Checks                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candlemaker Row, Edinburgh                  | Three stories at 200 m; 139 seconds end to end.                                                            | A replay of the initial request returned the same recovery ticket. Polling progressed from queued to running to completed. All attached places were within the search radius.                                                                                                                                   |
| Plaça del Rei, Barcelona – first sample     | Three geographically valid stories at 200 m; 163 seconds. Source-quality failure.                          | Several named article citations linked to publisher homepages. This sample prompted a reviewed schema correction that rejects bare homepages and stronger exact-URL instructions.                                                                                                                               |
| Plaça del Rei, Barcelona – corrected sample | Three stories at 200 m; 361 seconds including queue wait.                                                  | All citations link to specific retrieved articles or place pages. The assassination attempt, relocated Casa Padellàs and Santa Àgata account were checked against the supplied sources.                                                                                                                         |
| Cluny Gardens, Edinburgh                    | Two stories at 200 m, both tied to Morningside Parish Church 179 m away; 320 seconds including queue wait. | The researcher returned fewer than three stories. The proposed-but-unbuilt tower and the union of five churches are supported by the linked institutional pages.                                                                                                                                                |
| Usher Hall, Edinburgh                       | Three historic stories at 200 m; 524 seconds including queue wait.                                         | St Cuthbert's history, Agatha Christie's wedding and the castle water infrastructure have specific linked sources. The sample also revealed that the original type filter omitted the concert venue; a reviewed expansion to cultural venue categories was verified against Google and now includes Usher Hall. |

The Edinburgh result covered the Covenanters' Prison, Magdalen Chapel and the disputed Greyfriars Bobby story. The prison account's location, confinement dates and distinction between the 1679 prison and later burials are supported by the [Scottish Covenanter Memorials Association's plaque transcription](https://www.covenanter.org.uk/greyfriars_prison.html). The chapel account's glass and qualified Assembly history are supported by the [Scottish Reformation Society's account](https://scottishreformationsociety.org/magdalen-chapel/). Bobby's traditional account links to [Forever Edinburgh](https://edinburgh.org/blog/the-tale-of-greyfriars-bobby/), and the result explicitly labels it disputed. These checks establish support for the sampled claims, not exhaustive historical verification.

The first discovery is live research, not the prototype's fixed poet fixture. It also confirms that Vercel packaged and loaded the research prompt, private service credentials reached the intended backend, and a queued result survived separate HTTP requests.

The residential sample's architectural details agree with [Historic Environment Scotland's building record](https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,LB26770). The account of five predecessor churches joining the current congregation agrees with [the church's own history](https://www.morningsideparishchurch.org.uk/about/history/). Both stories use specific evidence pages.

The deployed chat received the original Greyfriars discovery and the question about whether the burial vaults predated the prisoners. It correctly distinguished confinement in 1679 from the burial area laid out in 1705 and returned the direct plaque-transcription source. Completion took 217 seconds including time queued behind another evaluation. The intentionally serial research queue means concurrent evaluations measure waiting time as well as execution time.

The corrected Barcelona links resolve to [betevé's article about the attack](https://beteve.cat/va-passar-aqui/atemptat-ferran-catolic/), [Spain.info's Casa Padellàs page](https://www.spain.info/en/places-of-interest/casa-padellas/) and [its Santa Àgata page](https://www.spain.info/en/places-of-interest/santa-agata-chapel/). These pages support the principal place and historical connections. The returned prose also acknowledges limits in its reconstruction of the excavation sequence.

A separate recent-event question asked for two verified Usher Hall performances during the August 2026 Edinburgh International Festival. The answer returned the [Berliner Philharmoniker's Elgar and Tchaikovsky concert](https://www.eif.co.uk/events/berliner-philharmoniker-elgar-tchaikovsky) on 29 August and [its closing concert](https://www.eif.co.uk/events/berliner-philharmoniker-closing-concert) on 30 August. Both official pages resolve, identify the venue, and include explicit 2026 event dates in their HTML. Completion took 284 seconds including queue wait. This checks current-date research separately from the historical discovery sample.

## Interface and release checks

The live adapter is the production default. Implementation through `2c16dd8` passed independent review, including corrections that preserve GPS versus manually selected locations when research resumes and prevent a superseded request from replacing a newer cached selection. The interface now preserves the researcher's inline citations; the prototype's fabricated paragraph-index references were removed after live content exposed incorrect attribution.

Final `pnpm test:all` passed typecheck, 78 unit tests, two browser tests, the production build and one production service-worker browser test. `pnpm lint` also passed. The built-app test covers offline reopening, full-story reading, reconnecting a saved pending chat UUID, cache reuse and durable clearing. Its content is mocked, so it establishes behavior rather than historical accuracy.

The final production deployment was Ready at `https://tourist-btv580zxp-herb-caudills-projects.vercel.app`, with the custom domain serving it. A 430 × 932 mobile Chromium check loaded the actual saved Greyfriars API result into the deployed app, fetched the attributed Google map with HTTP 200, opened the full account and verified the exact research paragraph and direct source link. There were no page errors. A fresh browser context also exposed the typed street-or-landmark fallback. This check reuses a real result to assess rendering and cache reuse; the separate API evaluations above establish live generation. Screenshots are retained locally in `/tmp/tourist-evidence/ledger-live.png` and `/tmp/tourist-evidence/ledger-live-story.png`.

The final 11 client build files were scanned for the actual private Google Maps key and research-runner bearer token; neither appeared. Credentials remain on the server side. Fresh research took minutes in these samples, and the serial queue adds waiting time when several requests overlap. Saved reading is available immediately and remains readable offline.

## Remaining acceptance

Safari, installed-PWA behavior and an actual outing on Herb's iPhone 17 Pro Max require real-device acceptance; browser emulation does not establish those outcomes. That acceptance remains assigned to Herb in the task tracker.

## Instrumented latency sample

On 9 September 2026, a fresh Candlemaker Row discovery completed in 157 seconds and returned three stories at 200 metres. It completed on attempt 1 with no radius expansion. Instrumentation was deployed in Cloudflare worker version `b4e46b6c-40ca-491c-a79a-252e1ba3f7e3` and Vercel deployment `tourist-knbpws41a-herb-caudills-projects.vercel.app`. The model remained GPT-5.5 with reasoning effort unspecified.

| Measurement                                                                       | Seconds |
| --------------------------------------------------------------------------------- | ------: |
| Google Places, within submission                                                  |   0.177 |
| Complete app-side submission                                                      |   2.140 |
| Queue wait                                                                        |   6.060 |
| Sandbox readiness, including any startup                                          |   2.448 |
| Read credentials                                                                  |   0.224 |
| Write runtime configuration and prompt                                            |   0.739 |
| Codex execution                                                                   | 130.244 |
| Save refreshed credentials                                                        |   0.952 |
| Read result                                                                       |   3.329 |
| Cleanup                                                                           |   9.492 |
| Complete attempt, containing runner phases and internal dispatch/storage overhead | 148.618 |
| Persist completion                                                                |   0.474 |

Codex execution accounts for about 83% of client elapsed time in this sample. That phase includes CLI startup, model/provider waits, reasoning, web searches, and output generation; it does not isolate thinking time from tool latency. Cleanup and result reading together took 12.8 seconds. Queueing and sandbox readiness were smaller contributors. These are one request's observations, not averages or evidence of steady-state cold/warm behavior. Places is included in submission, and the runner phases are included in attempt duration; do not add these overlapping measurements. Submission can also overlap initial queueing. The remaining client overhead includes HTTP transport and the five-second polling cadence.

The diagnostic events use opaque request and job identifiers and fixed phase labels. They do not contain prompts, credentials, research text, source pages, tickets, or coordinates. See `server/README.md` and the codex-cloud README for retrieval and interpretation.
