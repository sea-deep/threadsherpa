# Week 3: make the work saved visible

Official source, checked October 23, 2026: [Hacktoberfest Open-Source AI Challenge: Week 3](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).

The theme is Slow and Steady. Writing quality has the largest judging weight. The overall prize is $250; qualifying for multiple partner categories gives more judging opportunities, but an entry can win only once. Close: October 25 at 11:59 p.m. PDT, which is **October 26 at 12:29 p.m. IST**. The project and repository must fall within the challenge window; verify their creation history before submitting. Do not claim an old project as new or hide post-deadline changes.

## Recommended focus

These are candidate categories, not a certification of eligibility or a promise of winning. The selection is an inference from the published requirements and the current implementation.

| Target | Why it belongs | Evidence still needed |
| --- | --- | --- |
| Overall | Less repeated moderator work is the core product benefit | Strong write-up, real Discord demo, honest observed payoff |
| Gemma | Local duplicate checks and embeddings; local synthesis in Ollama mode | Capture the actual configured model and the live flow; local model demo has passed |
| Ultramarine | Synthesizes support answers from reviewed evidence using the OpenAI SDK | Live SDK demo passed; attach `data/paper-demo-usage.json` and record the Discord flow |
| MongoDB Atlas | Durable reviewed memory and retrieval | Free M0 deployment, separate-process persistence and real vector queries verified in `data/atlas-verification.json`; record the Discord flow |
| Sentry Agent Tracing | Explains grounded synthesis versus withholding | Capture actual model/tool traces and describe a useful finding; remote ingestion has not been verified |

Keep Render as an additional option only if the worker is genuinely deployed with a reachable model endpoint. Adding a service solely to lengthen the category list weakens the story. A free Atlas M0 deployment is configured and verified; see `ATLAS_SETUP.md`. No category entry was submitted, and no Render deployment or remote Sentry ingestion was verified.

## The entry’s argument

“I got this idea from watching MLH members ask the same questions. Nobody should feel bad for asking, and moderators shouldn’t have to repeat themselves. A reviewed answer can do useful work again.”

Open inference matters because a community can run Gemma itself for learning and embeddings, inspect the prompts, and choose fully local synthesis. Paper mode uses Ultramarine for support reasoning and sends that question and evidence to Paper Instruments. A cloud API can also do the reasoning; the open approach gives the operator control over where it runs. Discord still needs the internet.

The strongest demonstration is one moderator reply saved by right-click, a duplicate save skipped, two new questions receiving short tailored replies from that same knowledge, and a correction used by the next member. Show unknown questions staying quiet and the asker confirming a solve. The differentiator to demonstrate is low-friction learning from community answers with context-aware replies and visible corrections. Avoid claims of uniqueness.

## Before publishing

Finish `SUBMISSION_DRAFT.md` using the official template. Add a real demo video, check the public repository and license, disclose AI assistance, and list only categories with actual evidence. The required tags are `devchallenge` and `hf26challenge`. The draft is local and has not been staged or published on DEV.
