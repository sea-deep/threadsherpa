# Builder handoff

Status: archived expanded brief. The current implementation follows [website/DESIGN.md](../website/DESIGN.md), including the October 23 dark redesign, restrained copy, scroll-led Discord conversation and technical architecture. The latest owner request removes the screenshot gallery and replaces the headline and fonts with plain project copy and Uncut Sans. Do not restore the old palette, marketing sections, browser CTA, or repeated scenario disclaimers from the brief below.

Give this file to Deepak or the implementation agent together with the repository. The complete specification is [LANDING_PAGE_PRD.md](LANDING_PAGE_PRD.md); the sources and design reasoning are in [LANDING_PAGE_RESEARCH.md](LANDING_PAGE_RESEARCH.md).

## Paste-ready task

Build ThreadSherpa's landing website from `docs/LANDING_PAGE_PRD.md`. Read the full document before writing interface code. It contains the final copy, layout, interaction states, product boundaries, asset paths, runtime behavior, and acceptance checks. Use `docs/LANDING_PAGE_RESEARCH.md` for references and reasons behind the decisions.

Make the main experience a usable, fictional Discord-style community called Campfire. Visitors should open threads, post questions, switch between member and moderator perspectives, write and save an answer, then ask a differently worded question. Include source inspection, follow-ups, Solved / Need help, saved-answer edits, and a moderator queue. Make every visible control work within this scope. Do not build a full Discord clone or fill it with dead controls.

The preferred live version must use the actual ThreadSherpa support engine in an isolated session. Custom moderator answers must genuinely become that session's evidence. Unsupported questions stay quiet. Never connect the website to the real Discord server, production knowledge, or production Atlas data. If a live provider is not configured, use the explicitly labeled Guided example fallback. Prepared text must never masquerade as live model output.

Use the visual direction in the PRD: one answer finding its next person, with an amber dimensional thread, a purposeful ASCII treatment, a gently interactive light field, readable real UI, and a calm paper section rhythm. Keep the current ThreadSherpa mark and palette. Spend visual ambition on the mechanism, typography, and direct interaction. Do not reproduce Antigravity or paste together fashionable effects.

Use the real captures in `docs/screenshots/2026-10-23/` for an interactive evidence explorer. Let visitors inspect, drag, zoom, reset, and select relevant details, with visible button alternatives. Preserve image content. Keep these actual Discord captures distinct from the website's fictional server UI.

Read and apply the installed UI/UX skills by responsibility, as mapped in PRD section 11. On this machine they live under `/Users/dipak/.gemini/config/skills/`. Discover the equivalent paths in your own environment. Specifically use Impeccable for design workflow and quality passes, Taste for composition judgment, frontend-design for hierarchy, UI UX Pro Max for targeted guidance, and the installed motion, micro-interaction, typography, accessibility, interface-review, and code-quality skills for their respective checks. Read their actual instructions; do not merely name them in a progress report. Resolve conflicting defaults in favor of this brief and real product facts. Conditional Stitch and image skills are not a reason to introduce an unnecessary workflow or upload assets.

Build the static site separately from the existing bot. The recommended starting point is Astro, TypeScript, CSS tokens, small DOM controllers, GSAP, and a progressively loaded Three.js scene. Avoid stacking frameworks and motion engines. Keep native scrolling. The proposed sandbox API reuses the existing Node support logic through a new adapter. The current repository does not already contain that web API.

Use the exact marketing copy and microcopy in the PRD. Write no new em dashes. Do not invent customer proof, adoption numbers, testimonials, performance guarantees, a hosted bot signup, or a one-click public invite. ThreadSherpa is currently self-hosted. Render the minimum setup guide at `/setup/` with working links and correct forum-channel instructions.

Do not overwrite unrelated changes in this working tree. Do not change the running bot or repository visibility. Public repository links were inaccessible during research; verify the intended destination anonymously before launch. Keep all credentials server-side. Do not add a model call to page load, scrolling, or hovering.

Finish the functional, static, keyboard-accessible experience first. Then add the signature visual scene and evidence interactions. Test the real live adapter with synthetic content when configured, while clearly reporting any unverified provider or hosting dependency. A polished browser fixture does not prove real synthesis works.

Deliver the finished site and API source, local run and production-build instructions, environment variable names without secrets, a clear statement of guided versus live capabilities, final browser captures, and the PRD acceptance report. Review desktop, mobile, reduced motion, touch, keyboard, short viewport heights, and 320px reflow. Measure the production bundle and loading behavior. Repair what the browser shows before presenting the result as finished.

## Starting material

| Material | Repository path |
| --- | --- |
| Complete build specification and copy | `docs/LANDING_PAGE_PRD.md` |
| Research sources and choices | `docs/LANDING_PAGE_RESEARCH.md` |
| Current product behavior | `README.md` |
| Minimal setup guide | `docs/START_HERE.md` |
| Discord setup details | `docs/SETUP_DISCORD.md` |
| Brand and supplied logo assets | `brand/BRAND.md`, `brand/svg/` |
| Actual screenshots and provenance | `docs/screenshots/2026-10-23/README.md` |
| In-memory engine composition example | `src/demo/scenario.ts` |
| Actual answer orchestration and policy | `src/agent/orchestrator.ts`, `src/agent/policy.ts` |
| Learning and corrections | `src/memory/learner.ts` |
| Current support behavior | `src/support/` |

The deliverable should feel like a product someone can understand by using it. The animation earns its place when it makes that understanding easier.
