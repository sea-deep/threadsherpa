# Ultramarine answers, Gemma remembers

The Paper mode gives each model one role:

| Work | Model |
| --- | --- |
| Related saved facts → duplicate check | Local Gemma |
| Knowledge embeddings and query embeddings | Local EmbeddingGemma |
| Every supported question → tailored, source-grounded answer | Ultramarine 1 Flash |

Set these in `.env`:

```env
MODEL_PROVIDER=paper
PAPER_INSTRUMENTS_API_KEY=your_key_here
PAPER_MODEL=ultramarine-1-flash
PAPER_REASONING_EFFORT=low
PAPER_MAX_COMPLETION_TOKENS=4096
```

`PAPERINSTRUMENTS_API_KEY` is accepted too. Unrelated `OPENAI_API_KEY`, base URL, and embedding settings do not override the Paper connection. Start Ollama with the Gemma models listed in the README. Use `MODEL_PROVIDER=ollama` for the fully local alternative.

The adapter uses the OpenAI SDK against Paper’s endpoint. It uses system instructions, JSON output, and a bounded completion budget including reasoning. It rejects truncated output and validates structured responses. No automatic paid retry, repair, or cloud-provider fallback is performed. If duplicate comparison is unavailable, uncertain new facts are saved; exact duplicates are still skipped.

## Record the category evidence

```bash
npm run demo:paper -- --report data/paper-demo-usage.json
```

This makes real Paper requests using synthetic evidence. It does not connect to Discord. The key must already be configured; there is no automatic credit claim or purchase.

The saved report includes request count, calls with returned usage, input tokens, cached input tokens, output tokens, reasoning tokens, and estimated cost in USD. Input already includes cached tokens; output already includes reasoning. Estimated cost is:

```text
((input - cached) × input_rate + cached × cached_rate + output × output_rate) / 1,000,000
```

Rates were checked against the public pricing endpoint on October 23, 2026: $0.15 / million input, $0.03 / million cached input, $0.50 / million output. Confirm the rate card before submitting. Missing usage is excluded, not guessed; partial runs are marked incomplete and can still have costs. This estimate is not the provider’s invoice.

After a successful run, include the actual usage report and observed cost in the DEV write-up. The Ultramarine category requires meaningful SDK use and a run cost; having a configuration switch alone does not establish eligibility. The following historical report predates per-question synthesis and does not measure the current flow. A synthetic live run was verified on October 23, 2026 after the author configured a key. The saved `data/paper-demo-usage.json` records one completed request with 311 input tokens, 129 output tokens (including 1 reasoning token), and an estimated cost of $0.00011115 at the checked rates. No real member data was used and no Discord messages were posted.

[API reference](https://docs.paperinstruments.com/docs/ultramarine/chat-completions) · [Billing](https://docs.paperinstruments.com/docs/ultramarine/billing) · [Public pricing](https://api.paperinstruments.com/v1/pricing) · [Challenge](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)

The current personalized-answer flow was rechecked after the author selected Paper for live replies. [evaluation-paper-current.json](../data/evaluation-paper-current.json) records 12/12 synthetic checks and returned usage/cost estimates. It posts no Discord messages. Historical direct-copy timings above do not describe this run.
