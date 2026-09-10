# Direct API comparison and cutover

On September 10, 2026, direct OpenAI API generation reduced backend waiting by 56–75% in three clean paired discovery samples. Tourist now uses that API path inside its existing Cloudflare job worker. The encrypted job store, idempotent submission, reconnect tickets, geographic validation, and public endpoint contract remain in place. Generation no longer starts Codex CLI, restores authentication files, waits for CLI shutdown, or acquires the shared research sandbox lock.

## Comparison

Both arms used `gpt-6-astra` at low reasoning effort, the same application prompt and nearby-place context, no web tools, and the same custom research instructions. Prompt hashes match within each pair. The API arm used standard processing, `store: false`, streaming for timing, and a 6,000-token output ceiling. The CLI added its own internal context: its reported input count was 3,961 tokens larger in each fully traced pair. This measures the complete execution-path change, not a controlled comparison of provider inference alone.

| Location      | Direct API | Previous CLI path | Reduction | Accepted stories, API / CLI | API first text | Estimated API cost |
| ------------- | ---------: | ----------------: | --------: | --------------------------: | -------------: | -----------------: |
| Edinburgh     |     28.1 s |            93.7 s |       70% |                       3 / 2 |          8.2 s |             $0.064 |
| Barcelona     |     28.5 s |           113.0 s |       75% |                       2 / 2 |          4.8 s |             $0.063 |
| Paris, repeat |     27.1 s |            61.2 s |       56% |                       2 / 2 |          5.8 s |             $0.035 |

Times include backend schema/geographic validation and, for the CLI arm, the deployed five-second polling interval. The initial nearby-place lookup was shared by each pair and measured separately: 0.24–0.51 seconds. These were local backend-path measurements against live services, not mobile interface measurements. All accepted stories passed the existing schema and geographic checks; this was not a historical-accuracy or editorial-quality evaluation. First text can be incomplete JSON and is not yet a usable story.

The original Paris API request took 70.0 seconds, with its first text observed at 68.8 seconds. The paired benchmark failed without retaining its exact failure stage, while the live Cloudflare tail also disconnected. Although initially described as a polling failure, the retained evidence cannot distinguish polling from a later provider-validation failure. The cloud job completed its first attempt in 97.6 seconds; later authenticated retrieval and independent validation recovered two geographically valid stories. No clean end-to-end cloud duration is inferred for that run. The repeat is shown separately, and the original slow API sample remains in the raw data. The Paris repeat had 1,708 cached input tokens out of 1,711, which accounts for part of its lower cost.

The four API calls cost an estimated $0.215 in total. Estimates use [published Astra pricing](https://developers.openai.com/api/docs/models/gpt-6-astra): $10 per million uncached input tokens, $1 cached input, and $50 output, including reasoning. Google, hosting, and subscription charges are excluded. These few nondeterministic samples establish a useful improvement but do not guarantee a 30-second response.

## Where the earlier time went

| Previous CLI path phase                                     | Edinburgh | Barcelona | Paris repeat |
| ----------------------------------------------------------- | --------: | --------: | -----------: |
| Queue                                                       |     7.2 s |     1.9 s |        2.3 s |
| CLI launch to turn start                                    |     1.4 s |    25.3 s |        1.3 s |
| Turn start to completed answer                              |    47.2 s |    43.6 s |       33.9 s |
| Completed answer to CLI exit                                |    15.7 s |    17.4 s |        6.9 s |
| Other runner, transport, polling, and geographic validation |    22.3 s |    24.8 s |       16.9 s |

The model-turn interval includes provider waiting and output generation. The residual includes sandbox setup, RPC overhead, credential persistence, result reading, cleanup, and application delivery. These rows partition observed elapsed time; individual runner phase values in the trace file are nested and should not be added again. Earlier in the session, a separate request waited 135 seconds in the single-consumer queue, demonstrating how overlapping work could multiply the delay.

## Production implementation

`codex-cloud/src/runApiResearch.ts` calls the Responses API directly with Astra at low effort, standard processing, no tools, a three-minute request timeout, and a 6,000-token output limit. Its bounded response reader exports only model text into the existing encrypted result store. Prompts, answers, credentials, and raw provider errors are excluded from timing logs. `research_api_trace` records numeric usage; the `openai` timing phase measures the full API call.

Each job schedules its own immediate Durable Object alarm. The alarm claims the job durably, runs the API call outside the short state lock, and persists its result. Independent jobs can start together, with no shared queue or sandbox. The old queue remains provisioned for earlier deliveries, but new jobs never enter it. Uncertain network execution ends as `research_interrupted` without automatic regeneration. Existing idempotency and terminal-job rules prevent duplicate queue deliveries from repeating completed work.

The final Worker-only deployment is `2781ffa1-9f44-45f4-964a-7c8543b131db`. An initial API deployment, `e3e9b4f5-9fd8-4a29-b49f-52ec669b161f`, kept the shared queue and raised its maximum concurrency to four. Its live test still made the second discovery wait 32.6 seconds for dispatch because consumer autoscaling did not immediately use that capacity. This led to replacing queue submission with independent job alarms. Queue delivery was paused after a known deployment probe began, and deployment waited for that probe to finish. The Worker was deployed with `--containers-rollout none` and the API key supplied through a temporary owner-only secret file, which was then removed. Queue delivery resumed afterward. No Vercel or frontend deployment was necessary because the public job contract is unchanged.

## Evidence and verification

The [benchmark script](../scripts/benchmarkResearch.ts) and its [run instructions](../scripts/README.md) retain the comparison workflow. Original measurements are in [api-latency-samples.json](api-latency-samples.json), the separate repeat in [api-latency-paris-repeat.json](api-latency-paris-repeat.json), and correlated CLI observations in [api-cloud-traces.json](api-cloud-traces.json). After cutover, the script's cloud arm measures the deployed API worker; it no longer reproduces the previous CLI path.

The final worker passed typechecking, all 92 tests, and Wrangler's deployment dry run. Focused alarm tests verify concurrent generation, status access during generation, duplicate-delivery safety, known-failure retry scheduling, and terminal uncertain execution. Changed-file formatting passed. The repository-wide `pnpm check` stops on a pre-existing formatting issue in untracked `.vscode/settings.json`; that unrelated file was left untouched. Tourist's existing 23 research/geography tests, benchmark typecheck, and lint passed. The initial queue-based production measurements are in [api-production-verification.json](api-production-verification.json). Its ad hoc chat verification stopped on an incorrect test assumption: chat replays intentionally mint different encrypted tickets for the same job. The runner trace confirmed only one completed chat execution. Final production discovery, replay, concurrency, and chat checks are recorded separately in [api-production-alarm-verification.json](api-production-alarm-verification.json), with the old queue paused during the test to prove that new work bypasses it.

## Final live result

With the old queue paused, simultaneous Edinburgh and Barcelona discoveries completed through the public Tourist endpoints in 35.6 and 37.1 seconds, returning two geographically accepted stories each. Replaying each initial discovery reused its original recovery ticket. A subsequent public chat completed in 13.9 seconds. The two discovery alarms were claimed after 0.84 and 1.04 seconds; their API calls took 27.8 and 31.8 seconds. Chat dispatch took 1.29 seconds and its API call took 5.75 seconds. All three completed on their first attempt. The end-to-end values include Vercel requests, the discovery replay check, five-second polling, and geographic validation. The old queue was resumed after verification.
