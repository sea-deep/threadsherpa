# ThreadSherpa — Brand System

**Version 1.0 · 2026**
*Investigate once. Remember the resolution.*

---

## 1. The idea

### The problem we name

Every technical community has a memory problem. The same error, the same missing env var, the
same broken install — solved in March, solved again in July, solved again tonight, by a different
person, at 1 a.m. The knowledge existed. It just never stayed.

Most bots make this worse. They treat every message as memory, so the noise compounds. Or they
answer from nothing, so trust collapses. Either way the community keeps climbing the same face of
the same mountain.

### The brand in one sentence

**ThreadSherpa is the guide who goes ahead, marks the route, and leaves a cairn for the next person.**

### Positioning

ThreadSherpa is a **support copilot with human-trained memory** for developer communities. It is not
a general assistant dropped into a server, and it is not an FAQ bot with a vector index bolted on.
It investigates with permitted tools, shows its evidence, asks when it doesn't know, and only
remembers what a human has signed off on.

> For teams who are tired of re-solving solved problems, ThreadSherpa is the support copilot that
> turns one good answer into permanent shared memory.

### The four pillars

| Pillar | What it means | How it shows up |
|---|---|---|
| **Evidence over confidence** | An answer without a source is a guess wearing a uniform. | Links, repo refs, exact error strings, "I checked X and Y." |
| **Memory with consent** | Nothing becomes truth because it was said. | Review cards, approve/reject, versioned knowledge. |
| **Guide, not oracle** | A sherpa walks with you; it doesn't lecture from the summit. | Targeted follow-up questions, escalation instead of invention. |
| **Quietly relentless** | The work is thorough; the manner is calm. | Bounded investigation loops, no theatrics, no emoji confetti. |

### What we are / what we are not

| We are | We are not |
|---|---|
| A route-marker for repeated questions | A personality that answers everything |
| Auditable and versioned | Confident and unverifiable |
| Self-hostable and open source | A black box behind a paywall |
| Calm, precise, warm | Chatty, jokey, hype-driven |
| A tier-2 engineer's habits, automated | A search box with a greeting |

### Tagline hierarchy

| Level | Line | Use |
|---|---|---|
| Promise | **Stop solving the same problem twice.** | Website, social card, talks |
| Product line | **Investigate once. Remember the resolution.** | README, banner, docs |
| Descriptor | Evidence-backed support memory | Lockups, metadata |
| Category | Discord support copilot | Search, directories |

---

## 2. The name

**Thread** — the conversation, the unbroken line between a question and its resolution.
**Sherpa** — the guide who knows the route, carries the load, and waits at the pass for the people
behind them.

Write it as **ThreadSherpa**, one word, camel case.

| Do | Don't |
|---|---|
| ThreadSherpa | Thread Sherpa, ThreadSherpa™, thread-sherpa |
| the ThreadSherpa bot | the Sherpa, TS, Sherpabot |
| ThreadSherpa's memory | the AI's brain, the hive mind |

*Note on the word itself:* "Sherpa" names a Himalayan people, and the word is used here in its
long-standing sense of *guide*. Keep the usage respectful: it is the product's name, not a costume.
Never use it to imply a person, ethnicity, or accent.

---

## 3. The mark — *The Switchback*

```
        ╱╲            three nested chevrons, tapering upward
      ╱    ╲          stroke 50 · 42 · 34  (round caps, round joins)
    ╱        ╲        62% rise, optically centred
  ╱            ╲
```

A switchback is the shortest honest way up a steep face: you don't invent a straight line, you take
the turn the mountain gives you. That is the whole method of the product, drawn in one gesture.

Every part of the mark carries meaning:

1. **Three chevrons = the three moves of every case.** Investigate → Verify → Remember. A case that
   skips the middle chevron is a guess.
2. **Rising, nested, narrowing = ascent.** Each layer sits inside the one below it. That is how
   knowledge actually accumulates: a broad field of raw reports, a narrower band of candidates, a
   single approved answer at the top.
3. **Open at the bottom = never a closed answer.** The strokes don't form a triangle or a box. The
   trail continues past the last marker — there is always a next question.
4. **Three strands, one direction = the thread.** Each chevron is a conversation pulled taut. Separate
   threads, aligned, become a route.
5. **The taper = perspective.** Heavier at the base, lighter at the summit: the close, noisy ground of
   the support channel, and the quiet, verified answer at the top.

### Construction

- Three chevrons on a 512 grid, 62 % rise (≈ 32° from horizontal).
- Stroke weights **50 / 42 / 34** so the mark loses weight as it climbs.
- Round caps and joins only — no sharp corners anywhere in the system.
- Optically centred: the bounding box is centred, then nudged so the mass sits level.
- At avatar sizes the mark occupies **52 % of the field height** and stays inside an 88 % safe circle.

### Clear space & minimum size

```
   ┌─────────────────────────────┐
   │        ↕ 0.5 × mark height  │
   │      ┌───────────────┐      │
   │  ↔   │     MARK      │   ↔  │   ← keep 0.5 × the mark's height free on all sides
   │      └───────────────┘      │
   │        ↕                    │
   └─────────────────────────────┘
```

| Asset | Minimum size |
|---|---|
| Mark alone (digital) | 24 px |
| Avatar | 64 px (32 px works, 16 px is not the mark's job) |
| Horizontal lockup | 120 px wide |
| Stacked lockup | 80 px wide |
| Print | 8 mm mark height |

---

## 4. Logo system

All files live in [`svg/`](svg) with raster exports in [`png/`](png). Text is converted to outlines, so
no fonts are required to open them.

| Variant | File | When |
|---|---|---|
| Horizontal, ink | `logo-horizontal.svg` | Default on light surfaces |
| Horizontal, amber mark | `logo-horizontal-accent.svg` | When the mark should carry the accent |
| Horizontal, reversed | `logo-horizontal-reverse.svg` | Default on ink/dark photography |
| Horizontal + descriptor | `logo-horizontal-descriptor.svg` | Website header, slides, README at ≥ 480 px wide |
| Stacked | `logo-stacked.svg` | Square-ish spaces, merch, avatars of projects |
| Stacked, reversed | `logo-stacked-reverse.svg` | Dark square spaces |
| Wordmark only | `wordmark.svg` | Footers, co-branding, legal lines |
| Mark only | `mark.svg` / `mark-ink.svg` | Icons, favicon, watermark, loading states |
| Monochrome | `logo-horizontal-mono-black.svg` / `-mono-white.svg` | Single-colour print, embroidery, stamps |
| Avatar | `avatar.svg` | Discord bot profile, GitHub org, social |
| Favicon | `favicon.svg` | Browser tab, `.ico` included |

### Which one, at a glance

```
need text? ──no──► mark.svg  (or avatar.svg when the field must be filled)
    │
   yes
    │
square-ish space? ──yes──► stacked
    │
    no
    │
dark background? ──yes──► logo-horizontal-reverse.svg
    │
    no ──► logo-horizontal.svg
```

### Please don't

- Stretch, squash, rotate, outline, or add a shadow/glow to any element.
- Re-colour the mark outside Lantern / Ink / Paper.
- Put the amber mark on a light background without the ink wordmark (amber on paper is 1.9:1).
- Re-typeset the wordmark. It is Space Grotesk Bold, tracked −1.5 %, already outlined.
- Rebuild the mark from separate arrows or chevron glyphs. The taper and spacing are the mark.
- Place the logo on a busy photo without a solid ink field behind it.

---

## 5. Colour

Two colours do the work: **Glacier Ink** (the mountain at night, patience, authority) and
**Lantern Amber** (the light the guide carries — human judgement). Amber is never decoration. It
marks the moment a human is in the loop.

### Core

| Token | Hex | Role |
|---|---|---|
| `ink-900` **Glacier Ink** | `#0B1017` | Primary dark surface, avatar field, reversed logo |
| `ink-700` **Asphalt** | `#16202B` | Raised surfaces, watermark marks, cards on ink |
| `slate-500` **Scree** | `#5F7183` | Secondary text on light (4.5:1) |
| `mist-300` **Mist** | `#A7B4BF` | Secondary text on ink (9.0:1) |
| `paper-050` **Snowfield** | `#F5F2EC` | Primary light surface — warm, never pure white |
| `lantern-500` **Lantern** | `#F2A03D` | The mark, accents, human-in-the-loop moments (9.0:1 on ink) |
| `lantern-700` | `#B96F12` | Amber **large** text on light (3.5:1) |
| `lantern-800` | `#8A5209` | Amber body text on light (5.7:1) |
| `lantern-100` | `#FBE3BE` | Tints, review-card wash, highlight fills |

### Case status

The bot already colours its embeds by case state. The brand refines those hues so an embed reads as
part of the product, and so **"waiting for a human" is always amber**.

| State | Token | Hex | Replaces |
|---|---|---|---|
| `new`, `investigating` | `trailhead` | `#3D8BD4` | `0x3498db` |
| `awaiting_user`, awaiting review | `lantern` | `#F2A03D` | `0x9b59b6` (purple) |
| `answered` | `pine` | `#2FA36B` | `0x2ecc71` |
| `resolved` | `pine` (deep) | `#25875A` | `0x27ae60` |
| `escalated` | `beacon` | `#E0483C` | `0xe74c3c` |
| `closed` | `ash` | `#7C8A99` | `0x7f8c8d` |

Swap-in point: [`src/bot/ui/embeds.ts`](../src/bot/ui/embeds.ts) → `statusColors`.

### Rules

- Ink and Paper are surfaces. Lantern is an interrupt: use it for one thing per screen.
- Never set body text in `lantern-500` on light. Use `lantern-800`.
- Neutrals are warm (Paper) or blue-cool (Ink/Slate); never mix with pure `#000`/`#FFF` greys.
- Gradients are allowed only as ink → ink-raised. No amber-to-pink, no glow.

---

## 6. Typography

| Role | Typeface | Why |
|---|---|---|
| Display, wordmark, headings | **Space Grotesk** | Geometric with human quirks — the 'S' and 'a' keep it from looking like a template |
| UI, body, docs | **Inter** | Neutral, legible at 13 px in Discord |
| Code, IDs, metadata, command names | **JetBrains Mono** | Exact strings matter: error codes, paths, `/memory pending` |

All three are open source (SIL OFL), so self-hosters and contributors are never blocked.

### Scale

| Token | Size / line | Use |
|---|---|---|
| `display` | 64 / 1.05, −2 % tracking | Social card, landing hero |
| `h1` | 40 / 1.1, −1.5 % | Section titles |
| `h2` | 24 / 1.25 | Docs headings |
| `body` | 16 / 1.6 | Prose, Discord long answers |
| `small` | 14 / 1.5 | Metadata, embed fields |
| `label` | 12 / 1.2, +19 % tracking, uppercase, mono | Descriptors, status chips |

Wordmark rule: Space Grotesk **Bold**, tracking **−1.5 %**. Never letter-space the wordmark wider than
−1 %.

---

## 7. Voice

ThreadSherpa sounds like the senior engineer everyone asks in the channel: unhurried, specific, and
comfortable saying "I don't know yet".

### Principles

1. **Lead with the finding, not the process.** "The SDK needs Node 22 — you're on 18" beats
   "I have analysed your question".
2. **Name the evidence.** Link the doc, quote the error, cite the commit.
3. **Be exact about uncertainty.** "I found nothing approved for this" is a complete sentence.
4. **Never perform enthusiasm.** No "Great question!", no confetti, no emoji as punctuation.
5. **Blame the system, never the asker.** "That step is easy to miss" not "you skipped a step".
6. **One question at a time.** If you need three details, ask for the one that unblocks.

### Rewrites

| Instead of | Write |
|---|---|
| "Sorry, I couldn't find an answer 😅 Please try again!" | "No approved answer for this yet. I checked the docs and two open issues — nothing matches. Paste the full error output and I'll keep going." |
| "Great question! Here's what I found:" | "This is a known bug in `v0.9.2`. Upgrade to `0.9.4` or pin `0.9.1`." |
| "I'm not sure, but it might be your config." | "I can't verify that without your config. Which provider are you using — Ollama or Gemini?" |
| "I have learned this for next time." | "Saved as a draft. An admin needs to approve it before I use it." |

### Say / avoid

| Say | Avoid |
|---|---|
| evidence, approved, versioned, recalled, investigated | magic, smart, AI-powered, brain, hallucination |
| "I checked…", "I couldn't verify…" | "I think…", "probably", "trust me" |
| member, maintainer, support admin | user, customer, end user (in community copy) |

---

## 8. Motion

One gesture: **a rise**. Elements enter by translating up 8 px and fading in over 240 ms
(`cubic-bezier(0.2, 0.7, 0.2, 1)`). Nothing bounces, nothing spins. Loading states draw the three
chevrons in sequence, bottom to top, once every 1.6 s — a route being marked, not a spinner.
Respect `prefers-reduced-motion`: show the static mark instead.

---

## 9. Applications

**Discord bot profile** — `avatar.svg` / `avatar-1024.png`. Bio:

> Evidence-backed support memory for developer communities. Investigate once. Remember the resolution.

**GitHub org / repo avatar** — the same square; Discord and GitHub both crop to a circle, and the mark
is designed inside an 88 % safe circle.

**Social preview** — `social-card-1280x630.png` (GitHub repo settings → Social preview).

**README header** — `readme-banner-1200x300.png`, or the SVG lockup for crisp rendering:

```html
<img src="brand/svg/logo-horizontal-reverse.svg" alt="ThreadSherpa" height="56">
```

**Docs site** — `logo-horizontal.svg` on Paper, `logo-horizontal-reverse.svg` on Ink; favicon from
`favicon.svg`.

**Chat surfaces** — embeds keep Paper text on Discords's dark theme and use the status palette for the
left bar. The bot's own messages never use the mark as decoration; one amber accent per message is
enough.

---

## 10. Assets

```
brand/
├── BRAND.md                     ← this document
├── tokens.json, tokens.css      ← colour / type / radius tokens
├── favicon.ico                  ← 16–256 px multi-size icon
├── svg/                         ← master artwork, text outlined
│   ├── mark.svg · mark-ink.svg · mark-mono.svg
│   ├── wordmark.svg · wordmark-reverse.svg
│   ├── logo-horizontal.svg · -accent · -reverse · -descriptor · -mono-*
│   ├── logo-stacked.svg · -reverse · -descriptor
│   ├── avatar.svg · avatar-light.svg · avatar-knockout.svg
│   └── favicon.svg
└── png/                         ← exports at working sizes
    ├── avatar-1024/512/256/128/64/32.png
    ├── logo-*.png, wordmark-*.png, mark-*.png
    ├── favicon-16/32.png, apple-touch-icon-180.png
    ├── social-card-1280x630.png
    ├── readme-banner-1200x300.png
    └── brand-sheet.png
```

Typefaces: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk),
[Inter](https://fonts.google.com/specimen/Inter),
[JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — all SIL Open Font License.

Logo, mark and wordmark are part of the ThreadSherpa project. The Apache-2.0 licence covers the
code; the marks may be used to refer to the project, not to imply endorsement.
