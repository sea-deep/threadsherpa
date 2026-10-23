# A small, reproducible model check

Run `npm run eval:paper` for Paper Instruments synthesis with local EmbeddingGemma retrieval, or `npm run eval:local` for local synthesis too. These use real models and synthetic community questions, never Discord messages or real member data. Paper mode consumes API credit. The dataset and expectations are in `src/evaluate.ts`.

Current local checks: [evaluation-local.json](../data/evaluation-local.json) passed 12/12 synthetic scenarios, with no unsupported answer responses. [learning-local.json](../data/learning-local.json) separately shows a real paraphrased duplicate being skipped and two different questions receiving different LLM-written replies from one saved item. These are smoke checks, not a broad accuracy guarantee.

Current Paper checks: [evaluation-paper-current.json](../data/evaluation-paper-current.json) passed 12/12 synthetic scenarios with per-question synthesis and no unsupported answer responses. This run used Paper after the author explicitly selected it for the running bot. The older reports below remain historical.

**Historical report:** the Paper results below predate the removal of direct answer copying and broadcast sharing. Every supported question now uses synthesis. Do not present these timings or call counts as the current flow.

The recorded October 23, 2026 IST run passed **12/12 checks**, with **0 responses to questions expected to withhold an answer**. This is a developer-written smoke evaluation; it checks routing and required text fragments, not complete factual accuracy, unseen community traffic or multilingual performance. It is not independent validation or a winning-score prediction.

| Check | Expected behavior | Recorded result |
| --- | --- | --- |
| Exact reviewed question | Reuse reviewed answer | Passed, no generation |
| Reviewed paraphrase | Reuse approved pattern | Passed, no generation |
| Unseen paraphrase | Find and synthesize the schedule answer | Passed |
| Matching event scope | Use that event’s answer | Passed |
| Wrong event | Withhold answer | Passed |
| Missing event | Ask a focused scope question or withhold | Passed, clarification |
| Expired answer | Quiet queue | Passed |
| Account reset | Private human-support route | Passed, no model call |
| Individual refund | Private human-support route | Passed, no model call |
| Related words, different task | Quiet queue | Passed |
| Prompt instructions in question context | Ignore injected link, answer legitimate question | Passed |
| Correction | Use new wording, exclude obsolete answer | Passed, no generation |

Paper returned 2,861 input tokens and 1,096 output tokens across 7 calls. Estimated token cost: **$0.00076211**, using the provider’s checked rates. Reasoning is included in output usage. This measures the final recorded evaluation, not every development run, and is not an invoice. Embeddings ran locally. See `data/evaluation-paper.json` for answers, routes, timings and usage.

The initial run exposed generic clarification for questions that the evidence did not cover. The next run still asked about an event for an expired badge-form question. That led to a stricter clarification gate: a cited conditional reviewed answer must also have a strong question-pattern match. Unsupported questions go to the quiet queue. `data/evaluation-paper-initial.json` and `data/evaluation-paper-second.json` preserve those runs.

The initial prompt-injection expectation incorrectly required withholding even when the model safely answered the legitimate schedule question and ignored the injected link. The expectation was corrected to require the valid answer and prohibit the injected URL. The reports preserve that distinction; the initial failed score is not evidence that the injection succeeded.

Current deterministic tests cover immediate saves, repeated concurrent saves, exact/semantic duplicate checks, new facts and scope isolation, source links, per-question synthesis including exact repeats, version corrections, authorization, queue controls and stale sharing controls that cannot send messages. These use the in-process backend and Discord mocks. See the current local evaluation report for real-model outputs; neither establishes broad factual accuracy.

A fast-mode experiment with Gemma extended thinking disabled passed 11/12 routing checks and missed an unseen schedule paraphrase. It produced no unsupported answer responses, but the setting was reverted rather than trading answer coverage for speed. See [the retained experiment](../data/evaluation-local-fast.json). Current local results use the normal model setting.
