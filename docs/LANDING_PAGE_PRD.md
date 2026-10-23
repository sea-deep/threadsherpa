# ThreadSherpa landing website PRD

Status: original expanded brief, superseded for the current website by the owner's October 23 request for a minimal tool-like page. See `website/DESIGN.md` for the implemented direction. Retain this document as background; do not restore its marketing sections. Updated October 23, 2026, including the request for a usable Discord-style server inside the page.

Audience for this document: Deepak, the designer, and the implementation agent. This specifies a new marketing website and its sandbox. It does not authorize publishing, change the running Discord bot, or claim the proposed website already exists.

Read alongside [research and references](LANDING_PAGE_RESEARCH.md), the [builder handoff](LANDING_PAGE_HANDOFF.md), [current product behavior](../README.md), and [verified screenshots](screenshots/2026-10-23/README.md).

Quick navigation: [exact page copy](#4-page-structure-and-exact-copy), [interactive server](#5-interactive-campfire-server-specification), [microcopy and motion](#6-interaction-details-and-microcopy), [technical handoff](#9-implementation-architecture), [installed skills](#11-installed-design-skills-and-build-workflow), [acceptance checks](#12-acceptance-and-release-checklist).

## 1. The decision

Build a product you can try before you install it.

The page opens into a small, fictional Discord-style community called **Campfire**. Visitors can browse its forum, post a question, write a moderator reply, save that reply, and ask a differently worded question. They can inspect the source and confirm a solve. The surrounding website explains why that loop matters and how to run ThreadSherpa in their own server.

The visual idea is **one answer finding its next person**. A dimensional amber thread connects the original human answer to saved knowledge and then to a new conversation. A restrained ASCII rendering and a pointer-reactive light field give this mechanism physical presence. The website has one authored visual world, not a collection of unrelated effects.

The primary artifact is an actual interactive interface. Real Discord screenshots provide evidence further down the page. They are not the entire experience.

### What success means

A new visitor should understand, without reading documentation:

1. This is a Discord support bot.
2. A moderator chooses which answers it remembers.
3. It uses those facts to write for the next asker.
4. When it cannot help, it leaves the question for a human.

Then the visitor should be able to start setup or inspect the source without creating an account on this website.

Primary conversion: open the setup guide. Secondary conversion: complete the save-to-new-answer interaction. Source visits are a separate developer-interest signal. No numerical conversion lift is promised; there is no measured baseline yet.

### Who the page serves

The primary visitor runs or moderates a developer community, project Discord, student club, or event support forum. They already answer recurring questions and care about noise, control, and effort. A technical maintainer may do the installation. Hackathon judges and potential contributors are secondary visitors, so the mechanism and the real implementation need to be easy to inspect.

## 2. Product truth and copy boundaries

The current README and code outrank older brand prose about investigations, review cards, or GitHub features.

| Safe claim | Required qualification or boundary |
| --- | --- |
| Save a moderator answer from its context menu | The Discord action is Apps > Save this answer. Saving is explicit and immediate, with duplicate detection. |
| Fresh replies from saved knowledge | The model writes each supported reply. Do not imply that the stored message is copied into every thread. |
| Short answers with a source | Normally one to three short sentences. Source validation does not guarantee every generated claim is correct. |
| Quiet when an answer is unsupported | Unknown questions and failed background checks go to the moderator queue without a public filler reply. |
| Follow-ups and resolution | Clear success feedback can resolve a case quietly. A simple thanks does not always mean solved. |
| Corrections affect future answers | Existing posted messages are not silently rewritten or broadcast again. |
| Moderators control memory | Normal chat does not automatically become approved knowledge. |
| Open source and self-hosted | Apache-2.0 code. This is not a hosted SaaS signup or a public one-click bot service. |
| Local inference is available | Ollama inference can run locally. Discord, optional services, and hosted model providers have their own network and cost implications. |

Do not invent customers, testimonials, Discord endorsements, adoption counts, prizes won, hours saved, uptime, accuracy percentages, or model speed guarantees. The fictional Campfire server is not a customer. Provider logos are not customer logos. Model evaluation results are small synthetic checks, not independent performance studies.

## 3. One coherent art direction

### The living thread

Use ink, warm paper, amber, and the existing chevron mark. Keep the product's warmth while making the landing page more expressive than the bot interface.

The opening scene contains readable HTML messages and controls, with an amber thread passing behind them. At rest the thread resembles a folded strip of fine characters. Its depth comes from a real small 3D scene, not a looped video of an unrelated orb. On a save action, the strip settles into an anchor at the selected answer. On a supported new question, a branch reaches the new reply. The movement explains causality.

The light field responds gently to the pointer inside the stage. The nearest warm region shifts by at most 24 CSS pixels; do not flash a spotlight under every cursor movement. At least 80% of the surrounding field remains ink. The field never sits directly behind unprotected body copy.

Prefer a single WebGL scene for the thread and its light field. Real UI stays in the DOM above it. A low-resolution glyph atlas or point sprites can produce the ASCII character treatment without building thousands of text nodes. Do not animate random text, command output, or the actual logo. The logo remains the supplied SVG.

### Token contract

| Role | Starting value | Application |
| --- | --- | --- |
| Ink | `#0B1017` | Opening, sandbox surround, closing section |
| Raised ink | `#16202B` | Supporting surfaces and subtle depth |
| Paper | `#F5F2EC` | Main text on ink; calm setup and explanation sections |
| Muted on ink | `#A7B4BF` | Secondary copy, subject to measured contrast |
| Amber | `#F2A03D` | Primary action, memory thread, selected moment |
| Deep amber | `#8A5209` | Amber-related text on paper when contrast permits |
| Pine | `#2FA36B` | A confirmed outcome, never a generic decoration |

Use ink text on amber buttons. Validate actual composited colors, especially over gradients. Normal text must meet 4.5:1 and large text 3:1; visible control boundaries and focus states need their own checks.

Use **Space Grotesk** for display and **Inter** for readable UI and body text, carrying the established identity intentionally. Use a compact subset of **JetBrains Mono** only for ASCII art and actual commands. Do not scatter terminal typography through marketing labels. Self-host licensed WOFF2 subsets and use `font-display: swap`.

Desktop H1: approximately 80 to 104px, weight 500, line height 0.98 to 1.04. Mobile H1: 42 to 56px. Section headings: 40 to 64px desktop, 30 to 38px mobile. Body: 18px with 1.55 line height; sandbox UI: 15 to 16px. Essential captions: at least 14px. Set line lengths around 55 to 70 characters.

Use a 12-column desktop grid within a maximum 1440px content width, 48 to 64px desktop gutters, 24px tablet gutters, and 20px mobile gutters. Spacing scale: 4, 8, 12, 16, 24, 32, 48, 72, 104, 144. Give sections different density according to their content rather than identical padding and card grids.

Radii: 8px controls, 12px panels, 18px outer sandbox. Depth belongs mainly to the interactive stage and evidence explorer. Ordinary paragraphs and feature explanations do not need cards.

**Brand precedence:** this brief extends the older landing-page gradient and motion restrictions in `brand/BRAND.md`, as requested by the project owner. Preserve the mark, name, and recognizable palette. Document the richer website motion in a surface-specific design file. Do not silently rewrite the bot's visual system or revive stale product claims from the brand document.

### Exclude from the direction

No stock astronaut, robot mascot, mountain illustration, glowing brain, unrelated glass orb, fake terminal, rotating logo cloud, typewriter paragraphs, animated statistics, or endless marquee. Do not adopt Antigravity's identity. Its role is a reference for authored atmosphere, not a benchmark to reproduce.

No mandatory preloader. No cursor replacement. No magnetic primary CTA that moves its hit target. No forced horizontal page navigation. Video is optional evidence, not a background behind the headline.

## 4. Page structure and exact copy

Quoted strings and copy tables below are finished website copy. Implementation notes are not visitor-facing text. Use sentence case. Write no new copy with an em dash. Captured screenshots are historical artifacts and must retain their original text.

### A. Header

Keep a narrow, quiet header visible while scrolling. Use the supplied reversed horizontal logo on ink and the appropriate original on paper. Avoid a thick floating pill.

| Element | Exact copy | Destination |
| --- | --- | --- |
| Logo accessible name | `ThreadSherpa home` | `/#top` |
| Link | `Try it` | `/#playground` |
| Link | `How it works` | `/#how-it-works` |
| Link | `Setup` | `/setup/` |
| Source link | `Source code` | Verified public repository, see launch gate |
| Primary action | `Set up ThreadSherpa` | `/setup/` |
| Global motion control | `Pause motion` / `Resume motion` | Local visual preference |
| Mobile menu | `Open menu` / `Close menu` | Accessible disclosure |

At small widths show the logo, setup action, and menu. Put the motion control in the menu as well as beside the stage. Preserve the browser cursor and normal navigation behavior.

### B. Opening: the product is already on stage

Use a broad composition rather than a centered text stack over a mock laptop. The headline occupies the upper left of the stage's framing band, explanatory copy and the setup action occupy the upper right, and the usable Campfire interface spans the width below. The living thread occupies depth behind the interface, not a separate generic image column.

**H1, with this intentional line break:**

> Answer once.
> Help the next person.

**Supporting copy:**

> ThreadSherpa turns a moderator's answer into short, personal replies for your Discord community. Save the useful facts. Let the next question arrive.

**Primary CTA:** `Set up ThreadSherpa`

**Secondary CTA:** `Try a support thread`

**Setup reassurance:** `Open source. Self-hosted. Start with one channel.`

**Stage heading:** `Meet Campfire.`

**Stage introduction:** `A fictional community with a familiar support problem. Open a thread and try the whole flow.`

**Persistent sandbox disclosure:** `Campfire is fictional. Nothing here posts to Discord.`

The first viewport should reveal the headline, what the bot does, the setup action, and a useful portion of the sandbox. On a 1440 by 900 viewport, aim for a 72px header, roughly 170px opening text band, and a 480 to 560px stage. At shorter heights, allow ordinary scrolling instead of shrinking the UI below readable size.

```text
ThreadSherpa       Try it   How it works   Setup   Source code    Set up ThreadSherpa

Answer once.                           ThreadSherpa turns a moderator's answer...
Help the next person.                  [Set up ThreadSherpa] [Try a support thread]

        a dimensional thread behind a working HTML interface
  +------------------------------------------------------------------------+
  | Campfire                              Member | Moderator    Restart    |
  | announcements | ask-campfire forum             | selected thread       |
  |               | real selectable posts         | messages + composer   |
  |               | [New post]                    | [message actions]     |
  +------------------------------------------------------------------------+
  Campfire is fictional. Nothing here posts to Discord.       Pause motion
```

### C. The interactive server: `#playground`

This is part of the opening composition, not a second giant widget further down. Full behavior appears in sections 5 and 6.

The default view opens an existing support thread with a member question and a human moderator answer. Start in the moderator perspective with one clear prompt outside the message transcript:

> Save this answer, then ask the same thing in your own words.

Primary helper action: `Show me where`

The action focuses and briefly highlights the answer's message-actions button; it does not save for the visitor. The user can also discover Save this answer through right-click.

When saved, replace the helper with:

> That answer is now in memory. Ask a new question to see what it can help with.

Action: `Ask a new question`

This opens the new-post form in member perspective. Do not open an account flow or another website.

After a supported reply, show an external caption:

> Same facts. A reply for this question.

Action: `See the original answer`

After a solve, show:

> One human answer. Another person helped.

Action: `Set up ThreadSherpa`

These captions are the website's narration. Do not inject them as bot messages.

### D. The explanation: `#how-it-works`

Transition into a warm paper section with strong typography and a source-to-reply diagram. Do not repeat the whole sandbox. Keep the three steps because the workflow actually has three moves.

**Heading:** `Good support should leave something behind.`

**Body:**

> Your community already has useful answers. ThreadSherpa gives moderators a way to keep them working after the original conversation ends.

| Step heading | Exact body copy | Visual |
| --- | --- | --- |
| `Answer normally.` | `Help someone in their Discord thread, just as you do today.` | Human-answer detail from the real capture |
| `Save the answer.` | `Right-click the reply, open Apps, and choose Save this answer. You decide what becomes knowledge.` | Native Saved confirmation |
| `Help the next person.` | `When a new question matches, ThreadSherpa writes a short reply from those facts and links back to the source.` | New question and linked reply |

**Section link:** `Try that flow in Campfire`

The diagram's amber path can trace into place once as the section enters view. Readable copy and all nodes remain visible before JavaScript loads. No long pin is needed for this explanation.

### E. The useful difference: `#support`

Use an editorial comparison area, not a uniform grid of icon cards. One broad conversation panel sits beside an uneven stack of short explanations. The visitor can select a behavior to update the panel. Selection does not automatically move the page.

**Heading:** `Keep the conversation. Lose the repeat work.`

| Selectable heading | Exact body copy | Illustrated behavior |
| --- | --- | --- |
| `A reply for the person asking.` | `New wording gets a fresh response from saved facts. The original answer stays one click away.` | Two differently worded questions with distinct supported replies |
| `Quiet when it doesn't know.` | `Unsupported questions wait for a moderator. No public filler message to scroll past.` | A member post remains unchanged; moderator queue updates separately |
| `Help that follows the thread.` | `Follow-up questions keep their context. A clear “that worked” can close the case without another bot message.` | Follow-up plus quiet resolution |
| `Corrections that carry forward.` | `Edit saved knowledge when guidance changes. Future questions use the update, while earlier conversations stay as they were.` | Memory revision alongside a new response |

Panel label: `Example conversation`

The second through fourth illustrations can be handcrafted HTML scenes from the sandbox's fixtures. Label them as examples. Do not present invented captures as unedited Discord evidence. Include a plain-text equivalent beneath each active scene.

### F. Real evidence: `#in-discord`

**Heading:** `Here it is in Discord.`

**Body:**

> These captures show the working bot saving an answer, helping with a new question, and following the conversation. Campfire is a fictional scenario posted for this walkthrough.

Use the interactive evidence explorer specified in section 7. This is where the real screenshots earn trust. Keep the initial image face-on and legible. Do not hide the entire section behind perspective effects.

| Evidence tab | Exact caption |
| --- | --- |
| `The human answer` | `A moderator answers the original question.` |
| `Saved once` | `The native action confirms the answer was saved.` |
| `The next question` | `ThreadSherpa responds to different wording using saved guidance.` |
| `The follow-up` | `The conversation continues with the original context.` |
| `A confirmed solve` | `The member says it worked. The case was recorded as resolved.` |

Utility labels: `Drag to inspect`, `Previous capture`, `Next capture`, `Reset view`, `View full capture`, `Zoom in`, `Zoom out`, `Close capture`.

Evidence note: `Captured in Discord on October 23, 2026. Message content was not edited.`

### G. Ownership and setup: `#setup`

Return to paper. Show a short setup path with a real configuration excerpt and a clear link into the complete guide. No pricing cards or fictional hosting tiers.

**Heading:** `Start with one support channel.`

**Body:**

> Run ThreadSherpa yourself, connect your Discord bot and database, then choose where it can help. Use a local model with Ollama or configure Paper Instruments for replies.

| Step | Exact text |
| --- | --- |
| `Connect your bot.` | `Create a Discord application and add its bot token to your local environment.` |
| `Choose storage and a model.` | `Connect MongoDB, then choose Ollama or Paper Instruments. The setup guide includes the links and required values.` |
| `Pick a channel. Save an answer.` | `Run setup from a text channel, select your support forum, and save the first useful moderator reply.` |

Show only this command excerpt, with a `Copy commands` button:

```bash
npm ci
npm run setup
npm run dev
```

Place the excerpt after the explanation that the reader first needs the project checkout and configuration. It is not a complete installation recipe by itself.

**Cost note:** `The code is free. Hosting, model providers, and local hardware can have costs.`

**Privacy note:** `Local inference is available. Hosted model providers receive the questions and evidence used for replies.`

**Primary action:** `Open the setup guide`

**Secondary link:** `Read the source`

### H. Questions before setup: `#questions`

Use native details disclosures or accessible disclosure buttons. Keep answers in rendered HTML. The first question may start open. Do not force visitors to open each question to understand the basic product.

| Question | Exact answer |
| --- | --- |
| `Does it learn from every message?` | `No. A moderator explicitly saves an answer, or adds knowledge with /teach. Ordinary chat does not automatically become approved knowledge.` |
| `What happens when it can't answer?` | `In automatic support channels, the question waits quietly in the moderator queue. A member can also choose Need help on a reply. That marks the case for review; it does not page a staffed help desk.` |
| `Does it work in forum channels?` | `Yes. Run /setup from a regular text channel and select the support forum. ThreadSherpa can then help in its posts.` |
| `Can moderators update or remove knowledge?` | `Yes. Use /answers to edit or remove saved knowledge. New questions use the current facts. Earlier posted replies stay in place.` |
| `Is this a hosted bot?` | `ThreadSherpa is currently self-hosted. The setup guide walks through the Discord token, database, model, and channel configuration.` |
| `Will it always get the answer right?` | `No. Replies use saved knowledge and selected sources, but generated answers can still be wrong. Members can inspect the source and ask for human help.` |
| `Is the Campfire server connected to Discord?` | `No. Campfire is an isolated website sandbox. It does not join your server, post to Discord, or change the real bot's knowledge.` |

### I. Closing and footer

The amber thread returns as a settled, almost still line. Echo the name and core action, not another feature list.

**Heading:** `Keep the next answer from starting at zero.`

**Body:** `Give one good reply somewhere to stay.`

**Primary action:** `Set up ThreadSherpa`

**Secondary action:** `Try a support thread`

**Footer line:** `ThreadSherpa. Answer once. Help the next person.`

**Footer links:** `Setup guide`, `Source code`, `Security`, `Apache-2.0 license`

**Independence note:** `Independent open-source project. Not affiliated with or endorsed by Discord, MLH, or DEV.`

**Build disclosure:** `Built with AI assistance. Reviewed by the project author.`

## 5. Interactive Campfire server specification

This is a focused support interface inspired by familiar Discord conventions. It is not an attempt to reproduce every Discord feature or impersonate a connected Discord client.

### Scope and navigation

| Surface | Required behavior |
| --- | --- |
| Server identity | One fictional Campfire server, a simple original flame-free letter or geometric mark, no fake server count. Clicking its icon returns to the support forum. |
| `#announcements` | Readable event information: submit a public repository with a short description; README needs screenshots and setup steps; videos optional; solo projects welcome. No external submission link is invented. |
| `#ask-campfire` | Forum list, usable search, selectable posts, new-post composer, thread reader, member follow-ups. Search filters the session's thread titles and messages. |
| `Moderator queue` | Moderator view only. Shows unsupported cases and failed-advice handoffs. Clicking an item opens that exact thread. Similar cases may share a visual group but remain separate cases. |
| `Saved answers` | Moderator view only. Lists actual session knowledge, opens the source, supports editing and removal. |
| Perspective control | `Member` and `Moderator` switch the sandbox role. Make it clear this is a website role switch, not authentication or a product permission bypass. |
| Reset | `Restart` clears this visitor's sandbox and restores the starting fixture after a confirmation. It never affects another visitor. |

Do not add mute, deafen, Nitro, voice calls, account settings, friends, billing, or decoration that looks actionable but does nothing. Use recognizable channel and thread patterns without copying Discord branding as the website's identity.

### Starting fixture

Use fictional display names **Alex** for the member and **Sam** for the moderator. The visitor may play either role. Include one initial thread:

**Title:** `Can I update my project after submitting?`

**Alex:** `I spotted a bug after sharing my repo. Can I push a fix, or is the submitted version locked?`

**Sam:** `Yes. Keep the same repo link and push your fixes before submissions close. Add a short “Latest changes” section to your README so reviewers can see what changed.`

This answer starts **unsaved**. The initial approved knowledge collection is empty. No background bot reply appears in that thread, and saving it never inserts a reply into the old question.

The announcements channel supplies atmosphere and readable context, but it does not secretly count as approved memory. Do not configure automatic documentation fetching for the sandbox.

### Member actions

Create a post with a title and body. Title required, 100 characters maximum; body optional, 1,000 characters maximum. Allow normal punctuation and multiline text. Show errors beside fields. Keep user input when a request fails.

Offer optional example chips outside the composer, alongside free text:

- `I pushed a fix. Do I need a new submission?`
- `What should my README say about the update?`
- `What time does judging start?`

Each chip fills the composer; it does not submit or silently incur a model call. Provide `Post question` as an explicit action. Do not treat the examples as the only supported input in live mode.

Members can reply in their thread, inspect Original answer, use Solved or Need help, and post clear success or failure feedback in ordinary language. A normal Enter submits a single-line reply; Shift+Enter makes a newline. During IME composition, Enter must not submit. Allow pressing the submit button on every platform.

Plain message text renders safely as text or a tightly restricted Markdown subset. Never run arbitrary HTML, links as actions, or instructions embedded in visitor messages.

### Moderator actions

The moderator can write a reply, save a selected human reply, save it again to test duplicate detection, edit saved knowledge, remove it, and open a queued question. Provide a visible message-actions button in addition to context-menu access.

The menu contains `Apps`, then `Save this answer`, reflecting the actual bot workflow. Right-click is a shortcut to the same menu. On touch, the visible actions button is the primary path. Do not require a long press.

Saving is one explicit action. The UI returns `Saved.` only after the server confirms success. A duplicate returns `Already saved.` without a second memory item. Do not add an approval modal after Save this answer.

For a visitor-written moderator reply, live mode must actually save that reply as session knowledge and use it as evidence. It cannot continue responding from the initial hidden fixture. The original question and source message travel with the saved answer.

### What runs for real

The interactive UI is required in every build. The preferred launch experience uses an **isolated instance of the actual ThreadSherpa support engine**, with real synthesis for visitor-written questions. This is new website integration work, not an existing endpoint.

There are two explicit runtime states:

| State | Behavior | Visible label |
| --- | --- | --- |
| Live sandbox, provider available | The visitor's posts, saved answers, corrections, and follow-ups run through the real policy and model adapter using isolated memory. | `Live sandbox` plus `Questions and saved replies are sent to the configured model provider. Use fictional details.` |
| Guided fallback, provider absent or unavailable | The same interface lets the visitor explore prepared local scenes and source links. Do not accept arbitrary text and pretend a canned response is live AI. If a live request fails, offer an explicit switch; never replace it silently with a scripted answer. | `Guided example` plus `Prepared conversations. No live AI replies.` |

Default to the guided mode until the sandbox API is configured. The live experience is the acceptance target for the fully interactive launch. A polished guided fallback does not prove the live integration works.

Use real source links within the sandbox to open the source message in that session. Do not send public visitors to a private Discord channel for the source of an illustrated reply. Live answers use validated sandbox source URLs mapped to the corresponding original message, not invented Discord URLs.

### Required scenario matrix

| Scenario | Expected public thread behavior | Expected internal or moderator behavior |
| --- | --- | --- |
| Ask about updating before any save | Member post only; no bot fallback bubble | Queued |
| Save Sam's initial answer | Existing thread does not get a new bot answer | One approved item; confirmation appears outside transcript |
| Ask the same topic with new wording | A newly generated, short answer with source and outcome actions | Uses saved evidence; one case for this question |
| Ask what judging time is | Member post remains unanswered | Queued; no time invented from submission guidance |
| Ask a README follow-up | Supported answer uses the conversation and saved guidance | Same case context retained |
| Say `That worked, thanks!` | No extra bot message | Case resolves |
| Say `Thanks` only | No extra bot message | Do not force a solve solely from that word |
| Say `That didn't work` | No automatic repeat of failed advice | Preserve attempted advice and feedback; queue for moderator |
| Edit saved guidance | No broadcast or rewrite of old messages | Subsequent questions use the edited facts |
| Remove the only relevant saved answer | Old conversations remain visible | New unsupported questions wait quietly |
| Switch browser sessions | No visibility into the other session | Fully isolated knowledge and questions |
| Model timeout or exhausted budget | Preserve the post, show a website-level status outside the transcript | No fake bot apology or canned answer in live mode |

### Prepared scenes for the guided fallback

These are authored example transcripts for the website, not additional captures or model results. Use the starting question and Sam's answer above as the source. Guided mode lets visitors navigate and advance these scenes explicitly; its composer offers prepared questions instead of pretending to synthesize arbitrary text.

| Scene | Member input | Prepared response or state |
| --- | --- | --- |
| Before saving | `I pushed a fix. Do I need a new submission?` | No bot message. Show the question in Moderator queue. |
| After saving | `I pushed a fix. Do I need a new submission?` | `Keep the original repo link and push the fix before submissions close. Add a short “Latest changes” section to your README so reviewers can see the update.` |
| README follow-up | `Do I need to explain the fix anywhere?` | `Yes. Add a short “Latest changes” section to your README describing what changed.` |
| Unknown detail | `What time does judging start?` | No bot message. Show the question in Moderator queue without inventing a schedule. |
| Success | `That worked, thanks!` | No bot message. Mark the case resolved in session state. |
| Failed advice | `That didn't work.` | No repeated bot message. Preserve the attempted answer and add the case to Moderator queue. |
| Corrected knowledge | Moderator selects `Try a correction`, which fills the edit field with `Submission updates are now closed. Keep your original repo link; further changes will not be reviewed.` | The visitor must choose Save changes. Existing conversation messages remain unchanged. |
| A later question | `Can I still push a fix to my submission?` | After that correction: `Submission updates are closed, so further changes won't be reviewed. Keep the original repo link.` |

Guided answers show a functional Original answer link to the corresponding local source and working outcome controls. They do not display Live sandbox. In live mode these prepared responses are not used as a fallback or imposed as the model's exact wording. The accepted behavior is correct evidence use, short relevant replies, and quiet handling when unsupported.

## 6. Interaction details and microcopy

### Core controls

| Control or state | Exact copy |
| --- | --- |
| Forum search label | `Search Campfire threads` |
| Search placeholder | `Find a question` |
| Empty search | `No matching threads. Try another word or start a post.` |
| New-post action | `New post` |
| Title label | `Question` |
| Title placeholder | `What do you need help with?` |
| Body label | `Details` |
| Body placeholder | `Add a little context. Use fictional details.` |
| Missing title | `Add a question before posting.` |
| Length error | `Keep the question under 100 characters.` |
| Body length error | `Keep the details under 1,000 characters.` |
| Submit action | `Post question` |
| Member reply placeholder | `Reply in this thread` |
| Moderator reply placeholder | `Write a reusable answer` |
| Send action | `Send reply` |
| Actions button | `Message actions` |
| Save action | `Save this answer` |
| Pending save, outside transcript | `Saving answer...` |
| Success | `Saved.` |
| Duplicate | `Already saved.` |
| Source | `Original answer` |
| Outcomes | `Solved` and `Need help` |
| Moderator queue empty | `No questions waiting.` |
| Knowledge empty | `No saved answers yet. Save a moderator reply to get started.` |
| Edit action | `Edit answer` |
| Remove action | `Remove from memory` |
| Remove explanation | `Future replies will stop using this answer. Existing messages stay in place.` |
| Remove buttons | `Keep answer` and `Remove answer` |
| Correction success | `Updated for future questions.` |
| Knowledge editor labels | `Original question` and `Saved guidance` |
| Knowledge editor actions | `Cancel` and `Save changes` |
| Guided correction action | `Try a correction` |
| Generic request failure | `This action couldn't finish. Your text is still here. Try again.` |
| Live timeout, outside transcript | `The live check couldn't finish. Your question is still here.` |
| Budget or rate limit | `Live replies are paused for now. You can still explore the guided example.` |
| Guided switch action | `Explore the guided example` |
| Reset dialog | `Restart Campfire? This clears only your sandbox conversations and saved answers.` |
| Reset buttons | `Keep exploring` and `Restart Campfire` |
| Mobile thread return | `Back to threads` |
| Copy confirmation | `Commands copied.` |
| Clipboard failure | `Couldn't copy. Select the commands and copy them manually.` |

Live mode should show a factual activity label such as `Checking saved answers...` outside the transcript while a request is pending. Do not show a fake timed typing indicator that resolves to a canned response. Do not display raw prompts, confidence scores, token costs, case IDs, or moderation implementation details inside member conversations.

### State and focus rules

Navigation state, perspective, selected thread, conversation state, knowledge state, and motion preference must be separate. Changing perspective does not restart the fixture. Selecting another thread does not cancel or duplicate an in-flight save. Each write has an idempotency key.

Only show successful mutations after server confirmation. Keep member drafts when a request fails. Stop duplicate submission while that same request is pending, but allow cancellation or navigation. A reset cancels outstanding presentation updates from the previous session and invalidates its identifiers.

Use a stable polite status region for confirmations. Do not announce every decorative character or pretend typing event. Menus follow normal keyboard behavior; Escape closes, focus returns to the trigger, and selecting a thread moves focus to its heading where appropriate.

### Motion choreography

| Interaction | Treatment | Reduced-motion treatment |
| --- | --- | --- |
| First paint | All readable UI already present; thread settles over 700 to 900ms | Static thread poster |
| Pointer in stage | Small light and thread response; one throttled pointer handler | No pointer movement |
| Open a forum thread | Shared-panel transition, 180 to 240ms; selected thread stays obvious | Immediate content change |
| Save answer | An amber path connects the answer to its memory anchor, at most 550ms after real success | Static saved indicator and status text |
| New supported answer | Source branch reaches the new message as the real response arrives | Message appears with source, no travel animation |
| Button hover | Color or border feedback, 120 to 160ms; icon can move 2px | Color feedback only |
| Button press | Up to 1px visual compression, 80ms | No movement |
| Evidence drag | Direct tracking within bounds; settle under 220ms, no large overshoot | Buttons and flat image view |
| Open image | 180 to 240ms transition with a stable reading surface | Immediate dialog |
| FAQ disclosure | Modest 160 to 220ms opening if it causes no layout instability | Immediate disclosure |

The page has native scrolling. No Lenis or alternative scroll engine by default. A skill recipe suggesting one does not override this decision. At most one short desktop sticky presentation may connect the opening stage to the explanation, with no more than 140svh of extra travel. All content and actions remain accessible without completing that travel. Remove pinning on mobile, at short viewport heights, and under reduced motion.

Scroll may move the decorative thread, but it must never post a question, save knowledge, switch roles, or advance a conversation. User actions own the sandbox state. Hover cannot trigger model calls.

## 7. Screenshot evidence explorer

Use actual assets from `docs/screenshots/2026-10-23/`. Preserve originals. Generate responsive presentation derivatives separately, retaining text quality and without modifying content.

| Source asset | Dimensions | Use |
| --- | --- | --- |
| `human-answer.png` | 1710 x 1080 | Original moderator guidance |
| `answer-saved.png` | 1710 x 1280 | Native Save confirmation |
| `tailored-reply.png` | 1710 x 1080 | New wording with generated answer |
| `landing-hero.png` | 1710 x 960 | Compact alternate crop for social preview and evidence overview |
| `follow-up.png` | 1710 x 1700 | Follow-up context |
| `conversation-confirmed.png` | 1710 x 1700 | Member feedback and resolved-case evidence |
| `forum-overview.png` | 2750 x 2088 | Optional wide forum view, loaded only on selection |

The explorer presents an initial face-on capture and the five evidence tabs from section 4. Dragging moves the selected capture within a bounded inspection area; it never drags the whole page. A dedicated drag handle separates inspect gestures from image zoom and text controls. Optional tilt is limited to 3 degrees and switches off while the image is being read or zoomed.

Provide Previous capture, Next capture, Reset view, and View full capture as visible buttons. If panning a zoomed image requires dragging, also provide directional pan buttons. Keyboard and single-click controls must reach every equivalent result. Changing captures resets its view unless the visitor explicitly chooses otherwise.

Use HTML annotation buttons **outside** the image for `Saved answer`, `Source link`, and `Member confirmation`. Selecting one opens a caption and focuses the relevant area in a separate full-image view. These annotations describe pixels; they do not pretend to activate actual Discord buttons in the screenshot.

Keep Solved and Need help pixels in the capture intact. The separate browser sandbox has working buttons; the screenshot's buttons are historical UI. The confirmed-conversation capture does not itself prove the older card's buttons changed. Its caption accurately states the recorded case status.

Do not replace screenshots with AI-generated Discord images, rewrite names, invent members, alter timestamps, remove inconvenient message text, or generate fabricated customer activity. The sandbox uses fictional names; real captures retain the author's real test account and explain their origin.

Images should have concise meaningful alt text and an adjacent readable transcript or summary. Example alt: `A member asks about a bug fix. ThreadSherpa answers from the saved moderator guidance and links to the original reply.`

## 8. Responsive and accessible behavior

At 1200px and above, use the full server rail, forum list, and thread reader. Between 768px and 1199px, collapse the rail to a channel selector while preserving the list and thread when space permits. Below 768px, show one pane at a time: channels, thread list, then selected thread. Back to threads must preserve scroll, draft, and selection. Do not squeeze a full desktop Discord view into a tiny phone frame.

On mobile, make the first activity a clearly visible Open thread or New post action, with Member / Moderator still reachable in the top toolbar. No hover dependency, compulsory drag, device-orientation input, or bottom CTA covering the composer. Keep vertical touch scrolling native. Touch targets should be at least 44 by 44 CSS pixels as a project design target, with adequate separation.

Use semantic headings, landmarks, native buttons, labeled inputs, and a visible skip link. Maintain visible focus on every control. The site must reflow at 320 CSS pixels and remain usable at 200% text scaling. Avoid fixed text container heights.

Honor OS reduced motion on first paint and when the setting changes. In this mode, omit the WebGL animation, parallax, tilt, autoplay, sticky storytelling, and smooth scrolling. Use a composed static poster and the complete DOM interface. A visible Pause motion control also freezes ambient motion for visitors who have not set an OS preference. Persist only that preference locally; it does not opt a reduced-motion visitor into animation.

Dialogs need focus containment, Escape dismissal, a named close button, and focus restoration. The evidence explorer needs single-pointer alternatives to dragging, not just arrow-key support. Motion running automatically alongside content for more than five seconds needs a persistent pause mechanism. These requirements follow [W3C dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) and [pause guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide).

## 9. Implementation architecture

### Website

The repository currently has a Node/TypeScript Discord application and no frontend framework. Build the marketing site in a separate `website/` package so the existing bot build and deployment remain stable.

Recommended baseline: **Astro static pages, TypeScript, plain CSS tokens, and small DOM controllers**. Astro keeps the marketing content in HTML and reserves client JavaScript for interaction. Use **GSAP** for the authored scene transitions and **Three.js** for the bounded thread renderer, loaded progressively. Do not add React, Next.js, Motion, Rive, Spline, Lenis, and a shader library together to satisfy a style checklist.

If the eventual website already lives in a React host, reuse it instead of migrating solely for this brief. Motion is then an alternative for component interactions, not another owner of the same transforms as GSAP. The output and accessibility requirements remain fixed.

Paper Design shaders are a researched alternative for a standalone gradient implementation; they are **unrelated to Paper Instruments**, the model provider. Do not add a second canvas merely to use that package. The preferred thread renderer supplies its own light field in the same scene. Pin dependencies to tested versions rather than copying version numbers from this document.

### Live sandbox adapter

Build a small separate Node API using the current code's repositories, `LearningPipeline`, `MemoryRetriever`, `AgentOrchestrator`, and support-case behavior through an adapter. `src/demo/scenario.ts` demonstrates in-memory composition, but its hardcoded fixture and `teach()` function are not a public API or suitable for arbitrary visitor content. Extend or extract the composition carefully rather than copying its scripted provider into live mode.

Use a unique synthetic guild and isolated in-memory database per session. Keep each session's cases, evidence, messages, and saved knowledge together. Disable documentation fetching and real Discord clients. Never give the sandbox production Atlas collections, guild IDs, Discord credentials, or the production knowledge store. Session source links resolve to this sandbox's own messages.

Proposed API contract, not currently implemented:

| Endpoint | Purpose and response requirements |
| --- | --- |
| `POST /api/sandbox/sessions` | Create one ephemeral session; return capability status, initial fixture, and expiry. Set an opaque secure session cookie. |
| `GET /api/sandbox/state` | Return only this session's threads, messages, approved knowledge summary, queue, and statuses. |
| `POST /api/sandbox/posts` | Validate title/body, create a case, run the real policy, and return case state plus a public bot message only when policy permits one. |
| `POST /api/sandbox/threads/:id/messages` | Add a member or sandbox moderator message; process follow-up behavior for the selected role. |
| `POST /api/sandbox/messages/:id/save` | Save that human moderator message with its original question and source; return saved or duplicate. |
| `PATCH /api/sandbox/knowledge/:id` | Correct session knowledge through the actual learning path; affect future answers. |
| `DELETE /api/sandbox/knowledge/:id` | Remove session knowledge; preserve prior conversations. |
| `POST /api/sandbox/cases/:id/outcome` | Record Solved or Need help in this session. |
| `DELETE /api/sandbox/session` | End this session and release its resources; a new session restores the fixture. |

Requests should return the authoritative state or revision. Use bounded timeouts and idempotency for mutations. Session identity comes from the server, never a visitor-supplied real guild ID. Website role switching authorizes only fictional session actions; it grants no Discord permissions.

Live synthesis may use the existing Paper provider and local duplicate/embedding services when those services are reachable from the sandbox host. A hosted API cannot reach a developer's laptop Ollama endpoint by assumption. If choosing Ollama-only operation, run it on a reachable host and measure actual latency. Model cost is a separate operating decision; no inference is free merely because the website is static.

Live mode starts only after explicit visitor interaction. Do not make inference requests on page load, scroll, hover, or opening the evidence gallery. Enforce server-side session expiry, a small configured concurrent-session limit, input limits, per-session request limits, a global inference budget, and a bounded model queue. Suggested starting limits: 20-minute session lifetime, 10 live questions and 5 saves per session; tune from observed costs. If no global budget is configured, live capability stays off. Browser clients cannot override it.

Do not log raw visitor questions or answers by default. The UI asks for fictional details before the first send. Expire in-memory records and explain that a process restart also clears them. Avoid web search, uploaded files, remote URL fetching, Discord OAuth, or account creation in this sandbox. Provider credentials stay in server environment variables and must not appear in browser bundles or public content.

Use a separate sandbox environment file and explicit adapter configuration. Do not load the bot's root `.env` or require its Discord token to start this API. Proposed non-secret configuration names:

```dotenv
SANDBOX_MODE=guided
SANDBOX_ALLOWED_ORIGIN=http://localhost:4321
SANDBOX_SESSION_TTL_SECONDS=1200
SANDBOX_MAX_ACTIVE_SESSIONS=20
SANDBOX_MAX_CONCURRENT_REQUESTS=2
SANDBOX_DAILY_MODEL_CALL_LIMIT=0
```

These are a new website contract, not variables already supported by the bot. Live mode additionally selects a supported provider and supplies its server-only credentials and reachable model endpoints. Count all model calls required by saving, duplicate checks, and synthesis against the relevant configured budgets; a question can cause more than one operation. Resetting a browser session must not reset the global daily allowance. A single-process deployment can keep ephemeral counters in that process, but public scaling or restarts require a durable shared budget counter before enabling paid inference. Keep live mode unavailable when that guarantee cannot be enforced. Health checks must not generate paid inference.

### Content and link routing

Create `/setup/` from the current minimum setup guide, preserving its actual links, steps, and forum setup guidance. A local website route avoids sending the primary CTA to a repository page that may not yet be public. Also create a readable `/security/` page from the security document. Link the license to a bundled copy or a verified public source.

**Known launch issue:** the configured GitHub URL `https://github.com/sea-deep/threadsherpa` returned a public 404 during this research. The GitLab remote `https://gitlab.com/wdipak/threadsherpa` led to sign-in. The builder must verify the intended public repository anonymously before enabling Source code or a checkout instruction. Do not change repository visibility as a side effect. Local preview may identify an unverified source link in its build report, but the public release must resolve it or omit the link honestly. No `href="#"` placeholders.

Set canonical URLs and sitemap entries from the actual deployment domain. There is no assumed ThreadSherpa domain in this document. Do not invent one for metadata.

### Suggested structure

```text
website/
  src/pages/index.astro
  src/pages/setup.astro
  src/pages/security.astro
  src/components/CampfireServer.astro
  src/components/EvidenceExplorer.astro
  src/components/ThreadScene.astro
  src/content/landing-copy.ts
  src/content/campfire-fixtures.ts
  src/scripts/campfire-controller.ts
  src/scripts/evidence-controller.ts
  src/styles/tokens.css
  public/evidence/
sandbox-api/
  session-store.ts
  support-adapter.ts
  routes.ts
```

These are proposed boundaries, not instructions to create empty files. Keep fixture data, live adapter, and rendering separate. Use the existing domain and policy logic where practical; a visual sandbox must not become a second, divergent support bot.

## 10. Performance, SEO, and measurement

These are build budgets and validation targets, not achieved measurements:

| Area | Target |
| --- | --- |
| Initial HTML and critical CSS | Readable and actionable before optional stage code |
| Initial JavaScript | At most 100KB gzip before optional 3D and live sandbox activation |
| Deferred animation and sandbox code | At most 250KB gzip additional, measured from the production build; simplify if exceeded |
| Initial visible media | At most 700KB combined, excluding user-requested full captures |
| Web Vitals | Target LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 at the 75th percentile when field data exists |
| Prelaunch lab checks | Report mobile Lighthouse conditions and results separately; do not call lab results field percentiles |
| Rendering | One scene, device pixel ratio capped around 1.5, no shadows or postprocessing unless the measured budget allows them |
| Mobile motion | Static first view or materially simplified scene; no continuous GPU work offscreen |

Keep the headline and initial sandbox content in rendered HTML. Reserve image and stage dimensions. Prioritize the actual LCP image if the browser selects one; do not lazy-load that image. Lazy-load offscreen evidence and only fetch full-resolution images after selection. Stop render loops offscreen and in hidden tabs; release resources on teardown and handle WebGL context loss with the static poster.

Video is not a launch dependency. If added later, use a real capture with a poster and explicit Play / Pause controls. Do not download it automatically under reduced motion or data-saving conditions. Supply captions and a transcript for narration. Do not extract imaginary cinematic footage from static screenshots.

**Page title:** `ThreadSherpa | Discord answers that keep helping`

**Meta description:** `Save a moderator's answer once. ThreadSherpa uses those facts to write short, sourced replies for the next Discord question. Open source and self-hosted.`

**Social card headline:** `Answer once. Help the next person.`

Use the real mark and an honest cropped capture for the social image. Do not add invented statistics. Any structured data should describe the software accurately, with no fabricated ratings or reviews.

If analytics is enabled, record only coarse events: `playground_opened`, `sandbox_answer_saved`, `sandbox_new_question_posted`, `sandbox_supported_reply_received`, `sandbox_solve_confirmed`, `source_opened`, and `setup_guide_opened`. Record guided versus live mode separately. Do not include message text, personal display names, credentials, or session transcripts in analytics. Without analytics configuration, all interactions still work.

## 11. Installed design skills and build workflow

Verified local skill root on this machine: `/Users/dipak/.gemini/config/skills/`. The builder must locate the equivalent root in its own environment and read the actual `SKILL.md` files before applying them. Names alone do not prove the receiving agent has loaded a skill. Do not install replacements or change global agent settings as part of the website build.

Apply all relevant installed UI/UX skills by responsibility. Do not combine every skill's favorite layout, font, or animation into one website. The user's brief and confirmed product facts win conflicts. The PRD fixes the proposed direction; design tools may improve execution without silently switching it to a generic template.

| Installed skill folder | Responsibility in this build |
| --- | --- |
| `impeccable` | Primary design workflow, surface context, critique, audit, adaptation, and final polish. Follow its actual version's process when implementation begins. |
| `taste-skill` | Product-specific composition and reference judgment. Keep this brief's palette and identity; avoid blindly accepting random defaults. |
| `frontend-design` | Visual hierarchy, art direction, and a deliberate opening composition. |
| `ui-ux-pro-max` | Focused interaction, accessibility, and responsive guidance. Its local search returned generic FAQ and marketing patterns during research; those are not this page's art direction. |
| `build-awwwards-quality-sites` | Carry the authored scene into finished browser work, with performance and mobile verification. |
| `frontend-ui-engineering` | Robust responsive components and interaction state. |
| `animation-systems` | One coherent motion vocabulary and lifecycle. |
| `cinematic-gsap-lenis-motion-system` | GSAP sequencing expertise. Use the native-scroll constraint here instead of automatically adding Lenis. |
| `micro-interactions` | Menu, button, save, source, outcome, gallery, and composer feedback. |
| `better-typography` | Type scale, line breaks, font loading, and readable UI. |
| `better-ui` | Component hierarchy and visual consistency. |
| `better-accessibility` | Keyboard, focus, motion, touch, zoom, and assistive-technology checks. |
| `beautiful-shadows` | Depth in the stage and evidence explorer; no blanket shadows. |
| `css-border-gradient` | Only a purposeful source or saved-state boundary, if needed. No animated border on every panel. |
| `progressive-blur` | Optional small edge treatment outside readable UI. Remove if it hurts clarity or frame time. |
| `minimalist-skill` | Remove redundant chrome, repeated copy, and unnecessary effects after the core experience works. |
| `no-ai-design-slop` | Passive product-specific quality gate. |
| `anti-ai-slop-writing` | Plain, specific, accurate copy. This brief's zero-em-dash rule is stricter than its general allowance. |
| `interface-review` | Final usable-interface inspection across required sizes and states. |
| `code-review-and-quality` | Review state isolation, cleanup, implementation quality, and failure handling. |
| `output-skill` | Deliver complete files, working controls, and a concrete verification report. |

Conditional skills, present but not forced: `brandkit` only for a newly requested brand board; `redesign-skill` if adapting an existing website; `image-to-code-skill` for an approved visual reference; `stitch-skill`, `stitch-generate-design`, `stitch-manage-design-system`, `stitch-code-to-design`, and `stitch-react-components` only if the build actually uses the corresponding Stitch workflow and tools. These are not reasons to upload project material or add React unnecessarily.

### Execution order

1. Read product evidence, this brief, current screenshots, and relevant skills. Record the chosen visual world and conflicts resolved. Treat the audience and conversion goal here as settled context, not a reason to ask the owner to repeat the brief.
2. Produce a desktop and mobile composition with the actual copy. Establish an interactive static shell before expensive visual work. The initial thread, save action, new post, and source inspection must already be understandable.
3. Build isolated session state and the live support adapter. Keep a clearly labeled guided fallback. Verify the whole scenario matrix before claiming the live sandbox works.
4. Add the living thread, interactive light, and evidence explorer. The functional DOM experience stays usable if every decorative effect disappears.
5. Review in the browser, repair visible issues, then run focused accessibility, performance, isolation, and link checks. Capture the final site at the required sizes and report exactly what was verified.

## 12. Acceptance and release checklist

The final website must satisfy these checks, with concrete screenshots or test results where appropriate:

| Area | Pass condition |
| --- | --- |
| First impression | A visitor can identify Discord, moderator-controlled memory, and the setup action in the first viewport. |
| Product experience | The server has working navigation, forum search, thread selection, posting, replies, role switching, save, source, outcomes, knowledge edits, and reset. |
| Freeform live input | A visitor can write a new question and a custom moderator answer; subsequent replies use that session's real saved content. No hidden canonical response overrides it. |
| Quiet behavior | Unsupported questions and failed background checks add no public bot filler message. |
| Truthful modes | Guided scenes and live model output are visibly distinguished. No fake connected status, timed canned AI, or silent fallback. |
| Isolation | Two independent sessions cannot read or change one another's knowledge or cases. No request reaches the real Discord guild or production Atlas data. |
| Corrections | Updated facts affect a later question; previous posted messages remain unchanged. |
| Evidence | Real captures remain unmodified and readable; image controls and annotations work. |
| Accessibility | Complete keyboard flow, visible focus, single-pointer drag alternatives, reduced motion, pause, accessible dialogs, and no loss at 320px or 200% text scaling. |
| Responsive design | Review at 390x844, 768x1024, 1440x900, and 1920x1080; also check 320px reflow and a short desktop viewport. |
| Performance | Production bundle report, repeatable mobile lab result, offscreen pause, no blocked text rendering, and stable layout. |
| Copy | Exact approved copy, no new em dashes, no fake social proof, no contradictory SaaS or free-hosting claims. |
| Setup | `/setup/` contains the minimum working guide and forum-channel steps. Every public source and checkout link works anonymously. |
| Delivery | Finished source, build/run instructions for website and sandbox API, environment variable names without secrets, browser captures, and a report of remaining limitations. |

A suitable live test goes through the actual adapter and model provider with synthetic content; DOM-only tests cannot prove synthesis or session knowledge works. Use a small deterministic suite for mutation order, ownership, and quiet rendering, plus a few opt-in live checks. Avoid snapshot tests that merely repeat the markup. Do not change the running bot or overwrite existing project work to make a website check pass.

The design can be ambitious. The visitor should never have to understand the animation before they can understand the product.
