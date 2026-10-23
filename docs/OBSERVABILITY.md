# Show why an answer happened

Set `SENTRY_DSN` to enable tracing in the running bot. Without a DSN, all wrappers execute normally and send nothing to Sentry.

The app creates an investigation span (`gen_ai.invoke_agent`) with child model requests (`gen_ai.request`) and tool spans (`gen_ai.execute_tool`). The model decorator wraps raw HTTP providers; built-in SDK auto-instrumentation is not required. The provider reports numeric input/output token counts when the service includes them. Missing token counts remain missing; costs are not estimated.

Investigation metadata includes `support.route` (`memory`, `research`, or `handoff`), generation call count, and tool count. MongoDB run records also store duration in milliseconds. Generation counts are logical orchestration calls, not underlying repair attempts or embedding requests. Model request spans include provider/model names; embedding spans omit the model name rather than incorrectly name the reasoning model.

For a submission, capture two traces using your test server:

1. An exact reviewed question taking the memory route with one synthesis request.
2. An unsupported or sensitive question taking the queue or human route without synthesis.

Explain what you learned from the difference. Do not claim the category merely because a DSN option exists. No Sentry dashboard or remote ingestion was verified during the local refactor.

Reference: [Sentry’s guide to agent tracing](https://blog.sentry.io/ai-agent-observability-developers-guide-to-agent-monitoring/).

Paper mode instruments its SDK calls and local model calls separately, so the trace names the provider actually used. `demo:paper -- --report …` saves synthetic-run usage and a rate-based cost estimate. SDK retries are disabled; calls with no returned usage remain explicitly unmetered.
