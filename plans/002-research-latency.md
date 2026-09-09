# Research latency investigation

Measured on September 9, 2026 against the live Tourist and Codex Cloud services. The main cost of a successful discovery is the Codex model/web loop. Google Places and submission are small by comparison. There is also measurable CLI shutdown and sandbox cleanup time. Queueing and interrupted attempts can add minutes, so they must be separated from successful execution when comparing prompts or thinking levels.

## Who runs the loop

Tourist resolves nearby Google place candidates and submits one bounded prompt. Our Cloudflare queue starts an isolated container running Codex CLI 0.149.1. Inside that CLI, GPT-5.5 chooses searches and page opens, reads their results, and decides whether to continue or return JSON. Our application does not script each search or verification step. It manages the queue, timeout, retries, encrypted persistence, polling, JSON validation, and geography. An empty discovery can cause a separate full research job at a larger radius: 200, 500, then 1,000 metres.

The runtime model catalog confirmed that GPT-5.5's default reasoning effort is **medium**. The original application did not set an explicit effort. A temporary low-effort experiment was restored to the original default before the lighter-prompt experiment.

## Original prompt measurements

The following table uses only the successful CLI execution of each evaluation. Values are seconds, rounded to one decimal. The post-turn interval runs from the CLI's `turn.completed` event to the supervisor's aggregate output; it includes CLI shutdown and the supervisor's final catalog read. It is included within CLI total and the non-web remainder, rather than added on top.

| Location and effort   | CLI total | Web active | Other, before turn completion | After turn completion | Web calls | Client elapsed              |
| --------------------- | --------: | ---------: | ----------------------------: | --------------------: | --------: | --------------------------- |
| Barcelona, medium     |     137.0 |       78.0 |                          52.5 |                   6.5 |        14 | 231 s, retry affected       |
| Edinburgh, medium     |     105.6 |       37.1 |                          56.1 |                  12.4 |        13 | 140 s, first attempt        |
| Edinburgh, low        |      61.6 |       29.0 |                          28.6 |                   4.0 |        10 | 263 s, retry affected       |
| Barcelona, low        |      82.5 |       43.8 |                          29.2 |                   9.5 |         7 | 265 s, queue/retry affected |
| Edinburgh, low repeat |      88.6 |       20.8 |                          42.9 |                  24.9 |         7 | 120 s, first attempt        |

The two medium-effort samples spent 37–78 seconds with web calls active and another 52–56 seconds outside those intervals before the turn completed. Across those two samples, the pre-completion model/web loop occupied about 76% of successful attempt time. We cannot label the non-web interval “thinking time”: it includes startup, provider/network waits, reasoning, and answer production. After the last web completion, the final message arrived another 23–38 seconds later at medium effort. CLI shutdown then added 6–12 seconds in these samples; a separate live request showed a 27-second post-turn interval.

The pinned CLI source confirms that completion is followed by thread unsubscribe and an awaited in-process app-server shutdown before final output handling. This supports treating the post-turn interval as a separate harness cost, although it does not establish which shutdown operation accounts for every millisecond. See [Codex exec at rust-v0.149.1](https://github.com/openai/codex/blob/rust-v0.149.1/codex-rs/exec/src/lib.rs#L1108-L1136). The numerical observations are retained in [research-latency-samples.json](research-latency-samples.json), without prompts or results.

Low effort reduced CLI elapsed time by 40–42% in the first location comparisons, but a clean Edinburgh repeat improved it by only 16%. The clean client comparison was 140 seconds at medium versus 120 seconds at low, a 14% improvement. The low-effort runs also used fewer web calls and reasoning tokens. These are small, nondeterministic samples with different story selections, not a reliable average speedup or a controlled quality benchmark.

The earlier boundary-only [instrumented sample](001-live-evaluation.md#instrumented-latency-sample) measured Google Places at 0.177 seconds, complete submission at 2.140 seconds, and Codex execution at 130.244 seconds out of 157 seconds client elapsed. In the detailed samples, successful sandbox cleanup took approximately 4–11 seconds. Five-second polling and other transport/storage work add further delay. These nested intervals must not be summed indiscriminately.

## Interruptions and queueing

The queue deliberately runs one research attempt at a time. A slow job therefore delays other users. A retry adds at least the configured 60-second delay as well as another attempt. Several evaluations overlapped worker/container deployments and subsequent ownership-lock failures, which contaminated their end-to-end timing. Those totals are retained above but excluded from effort-speed comparisons.

One execution also failed when no deployment was happening. Its cleanup failed immediately and subsequent work encountered ownership trouble before the container recovered. The exact runtime cause was not established. We did not delete a lock or manually restart an active job. The new instrumentation classifies failed boundaries into controlled categories so a future interruption can distinguish deployment reset, resource limits, request-context errors, timeout, connection/container reset, and an unclassified failure without logging raw errors.

Safe deployment now pauses queue delivery, waits for the active attempt to finish, deploys, waits for any container rollout to finish, and resumes delivery. A successful Wrangler deploy can precede image rollout completion. A first rollout in this investigation included a roughly 79-second image pull, which is not ordinary model latency.

## Lighter editorial direction

Herb clarified during this investigation that Tourist is for fun and that the prompts and evaluation were too concerned with sourcing and historical precision. Discovery now aims for about 4–6 web-tool calls, usually one useful source per story, and 100–180 words per account. Tourism and local-history pages are sufficient. The researcher should stop once it has a few interesting stories, omit uncertain minor details, and welcome naturally labeled legends. Chat should reuse existing story context and search only for new information. The tool-call budget is a prompt instruction, not an application-enforced limit.

Source links are still HTTP(S) without embedded credentials, but homepages are no longer categorically rejected. The obsolete homepage-rejection test was removed. Geographic validation, structured output limits, isolated execution, and link safety remain. Prompt/cache version is now `ledger-2`, with matching test fixtures. The live-evaluation criteria now emphasize interesting, readable, nearby stories and obvious-error spot checks rather than scholarly corroboration or exact-date audits.

The first lighter-prompt Edinburgh discovery completed on its first attempt in **78.5 seconds**, compared with **140.1 seconds** for the original medium-effort sample. Both used GPT-5.5 at medium. Web calls fell from 13 to 5, CLI elapsed from 105.6 to 56.7 seconds, and the model/web interval before completion from 93.2 to 51.1 seconds. The result contained three short stories, each with one source, including a naturally qualified Bobby legend. The 44% client improvement is an observed comparison, not a guaranteed latency reduction.

Barcelona completed in **105.3 seconds** with three short stories at the same medium setting. That entire client duration is shorter than the original Barcelona sample's 137-second CLI execution alone, so the result is consistent with an improvement despite the old sample's retry contamination. The live Wrangler tail connection dropped around this completion, so its internal web/model breakdown was not captured; no per-phase values are inferred for it. The result included the disputed Columbus reception, the relocated mansion and Roman remains, and the executioner's house. These casual spot checks focus on useful, readable stories rather than an exhaustive historical audit.

The deployed choice is therefore **lighter prompts with medium effort**. Lower effort remains an optional later experiment; it is not necessary to obtain the measured prompt improvement. The next independent latency target is harness shutdown and sandbox cleanup. Queue/retry reliability needs separate diagnosis if the intermittent execution failure recurs. None of these observations establishes an exact split between provider waiting and model computation.

## Instrumentation and verification

`codex-cloud/container/researchExec.ts` consumes the CLI's JSON stream in memory. `ResearchTrace` retains only numeric usage, fixed event labels, elapsed times, and web-call counts. Web-active time is the union of overlapping call intervals. All measured successful traces had zero missing start/end events. Client event buffering can still affect the split; these are observed intervals, not server-internal timings. Raw prompts, queries, source contents, answers, credentials, and stderr are not exported. The original research result continues through its existing private output file.

Codex Cloud passed typechecking and all 79 tests, including overlapping-call timing, missing-event accounting, private-output exclusion, exit-code preservation, and failure classification. Its required `pnpm check` stopped at a pre-existing formatting issue in untracked `.vscode/settings.json`; changed-source formatting, typecheck, and tests passed separately. Tourist passed typechecking, 86 unit tests, five browser tests, the production build, and the production offline/service-worker test. The first browser run caught two fixtures still using the old prompt version; updating those fixtures resolved it. Lint passed.

The final runner deployment is `204dccd3-5aa4-426f-9882-bc026ec0ece3`, container application version 16, image digest `sha256:57a692cef01fe2988cf0e9cd1086a04b9b9a7c72ed48794fbb147c5d342d4bfb`. Tourist's lighter prompts were deployed as `tourist-30kgyxest-herb-caudills-projects.vercel.app`; the custom domain served its matching application asset. Queue delivery was resumed after the new image was healthy and the rollout cleared. The build VM was stopped. The runtime remains GPT-5.5 with its medium default; the temporary low setting is gone.
