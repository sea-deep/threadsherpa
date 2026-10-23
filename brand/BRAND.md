# ThreadSherpa — Brand System & Mascot Guidelines

**Version 2.0 · 2026**  
*Answer once. Help the next person.*

---

## 1. The Core Philosophy

### The problem we name

Every technical community has an institutional memory problem. The same configuration error, the same missing environment variable, the same broken dependency version — answered in March, answered again in July, answered again tonight by a different person at 1 a.m. The knowledge was solved, but it never stayed where the next person could reach it.

Generic bots make this worse. They ingest every casual chat message as truth, compounding noise, or they fabricate plausible advice without a source, destroying trust.

### The brand in one sentence

**ThreadSherpa is the guide who goes ahead, carries the community's verified answers, and leaves a cairn for the next person.**

### The four pillars

| Pillar | What it means | How it shows up |
|---|---|---|
| **Evidence over confidence** | An answer without a verifiable source is a guess. | Direct documentation links, commit SHA references, exact error messages. |
| **Memory with consent** | Nothing becomes truth simply because someone said it. | Moderator right-click save, explicit review cards, versioned knowledge. |
| **Guide, not oracle** | A sherpa walks beside you; they do not lecture from the clouds. | Focused clarification, short responses, escalation instead of hallucination. |
| **Quietly relentless** | The work is disciplined; the manner is calm. | Bounded tool loops, zero theatrics, silence when answers are missing. |

### Tagline hierarchy

- **Promise**: Stop solving the same problem twice.
- **Product tagline**: Answer once. Help the next person.
- **Descriptor**: Evidence-backed support memory for Discord communities.

---

## 2. The Mascot — *The Trail Guide*

The ThreadSherpa mascot is **The Trail Guide**: a compact, resilient mountain navigator outfitted for high alpine trails.

```
       [   /\   ]       Amber weatherproof hood & brow stitches
      [ (•)   (•) ]     Dark visor with calm cream eyes
     [    =====    ]    Cream trail scarf
    [===]       [#]     Sage & lime trail pack carrying the saved answer note
    |   |=======| |     Amber parka
    (---)       (---)   Sturdy trail boots
```

The Trail Guide embodies the spirit of an experienced community maintainer: observant, prepared, carrying only what is essential, and focused on helping others reach the pass safely.

### Mascot Anatomy & Elements

| Element | Asset | Palette | Role & Meaning |
|---|---|---|---|
| **The Trail Guide** | `brand/svg/mascot.svg`<br>`brand/png/mascot-512.png` | Amber, Pear, Sage, Boot, Visor, Cream | The primary character. Appears standing, packed, and holding the saved answer note. |
| **The Trail Pack** | `brand/svg/backpack.svg`<br>`brand/png/backpack-512.png` | Sage (`#A8BF79`), Pear (`#D7F59C`), Deep Sage (`#6D8245`) | The gear pack that physically holds moderator-approved answers. Represents saved community memory. |
| **The Saved Answer Note** | `brand/svg/answer-note.svg`<br>`brand/png/answer-note-512.png` | Cream (`#F2EDE3`), Pear (`#D7F59C`), Sage (`#A8BF79`) | The physical card marked "Answer packed". Denotes human sign-off and verifiable knowledge. |
| **The Trail Cairn** | `brand/svg/cairn.svg`<br>`brand/png/cairn-512.png` | Obsidian (`#24212C`), Amber (`#DB8C3A`), Sage (`#A8BF79`), Pear (`#D7F59C`) | Three balanced stones marking a solved fork in the trail. Placed where repeated questions converge. |
| **The Visor Badge** | `brand/svg/mascot-face.svg`<br>`brand/png/mascot-face-512.png` | Amber (`#F2A74B`), Visor (`#24212C`), Cream (`#F2EDE3`) | Compact icon representation for favicons, notifications, and micro-avatars. |
| **The Project Avatar** | `brand/svg/avatar.svg`<br>`brand/png/project-avatar-512.png` | Obsidian container (`#100F15`), Trail Guide | Official profile icon for GitHub, GitLab, and Discord bots. |

### Mascot Rules

1. **Always carrying the pack or note**: The Guide is on duty. They are never rendered empty-handed or without their pack unless in a designated resting state.
2. **Never aggressive or frantic**: The Guide moves at an even, deliberate pace. No panic expressions, sweating droplets, or hyperactive cartoon tropes.
3. **Calm eyes**: The eyes are soft rounded oblongs (`rx="4.5"`). They squint during quiet listening and brighten upon finding an approved match.
4. **Physicality**: The mascot interacts with physical artifacts — placing a stone on a cairn, tucking a note into the pack, pointing with a gloved hand.

---

## 3. The Core Marks — *The Switchback & Wordmark*

Alongside the mascot, the geometric brand mark is **The Switchback**: three ascending chevrons tapering upward.

```
        ╱╲            three nested chevrons, tapering upward
      ╱    ╲          stroke 50 · 42 · 34 (round caps, round joins)
    ╱        ╲        62% rise, optically centered
  ╱            ╲
```

1. **Investigate → Verify → Remember**: Each chevron is one step of an honest support case.
2. **Ascent**: Each layer sits nested within the one below it, reflecting how knowledge builds.
3. **Open trail**: The base never closes into a box or triangle. There is always a next question.

### Wordmark

Write the product name as **ThreadSherpa**, single word, camel-cased, with an optional trailing period in Pear (`#D7F59C`):

```
ThreadSherpa.
```

---

## 4. Color System

| Token | Name | HEX | Role |
|---|---|---|---|
| `--ts-obsidian` | Obsidian Night | `#100F15` | Default page and surface background |
| `--ts-night` | Deep Canvas | `#0B1017` | Canvas recesses, terminal wells, shadows |
| `--ts-panel` | Panel Tint | `#191722` | Card backgrounds, elevated components |
| `--ts-mascot-amber` | Trail Amber | `#F2A74B` | Parka body, primary brand warmth |
| `--ts-mascot-amber-deep` | Deep Amber | `#DB8C3A` | Shaded parka folds, middle cairn stone |
| `--ts-mascot-pear` | Pack Pear | `#D7F59C` | Accent highlight, pack lid, verification tags |
| `--ts-mascot-sage` | Alpine Sage | `#A8BF79` | Backpack body, top cairn stone, note rules |
| `--ts-mascot-sage-deep` | Deep Sage | `#6D8245` | Pack straps, buckles, dark accents |
| `--ts-mascot-boot` | Trail Leather | `#B46A29` | Boots, knit brow stitch marks |
| `--ts-mascot-visor` | Visor Glass | `#24212C` | Face plate, base cairn stone |
| `--ts-mascot-cream` | Trail Cream | `#F2EDE3` | Eyes, scarf, note paper, display text |
| `--ts-text-muted` | Muted Trail | `#9D95A5` | Secondary copy, descriptors |
| `--ts-text-faint` | Faint Mist | `#6E6777` | Captions, subtle metadata |

---

## 5. Typography

- **Display**: Waschkueche / Space Grotesk. Used for headlines and title lockups. Tight negative tracking (-1.5% to -2%).
- **Body**: Uncut / Inter. High legibility at small sizes, optical neutral character.
- **Code & Tokens**: JetBrains Mono. Used for shell snippets, parameters, and commit references.

---

## 6. Voice Standards

ThreadSherpa communicates like an experienced systems engineer: unhurried, specific, and direct.

- **Banned AI tropes**: No "delve", "tapestry", "seamless", "cutting-edge", "robust", "revolutionize", or "game-changer".
- **Concrete specifics**: State the exact environment variable, file path, or configuration key rather than an abstraction.
- **Uncertainty is honest**: When no approved answer matches, the bot states: *"No approved answer for this yet. Leaving this for a moderator."*

---

## 7. Asset Inventory

```
brand/
├── BRAND.md                                 ← Brand specification
├── tokens.json, tokens.css                  ← Design tokens
├── favicon.ico                              ← Multi-size icon
├── svg/
│   ├── mascot.svg, guide.svg                ← Complete Trail Guide mascot
│   ├── backpack.svg                         ← Trail pack element
│   ├── answer-note.svg                      ← Saved answer note element
│   ├── cairn.svg                            ← Trail cairn marker element
│   ├── mascot-face.svg                      ← Visor badge element
│   ├── avatar.svg, mascot-avatar.svg        ← 512x512 project avatar
│   ├── mark.svg, mark-mono.svg              ← Switchback chevron mark
│   ├── wordmark.svg, wordmark-reverse.svg   ← Typographic wordmark
│   ├── logo-horizontal.svg, -reverse.svg    ← Standard lockups
│   └── readme-header.svg                    ← 1200x340 vector hero banner
└── png/
    ├── repository-thumbnail-1280x640.png    ← 1280x640 repository cover
    ├── project-avatar-512.png               ← 512x512 avatar for GitHub & GitLab
    ├── mascot-512.png, mascot-1024.png      ← High-res mascot exports
    ├── backpack-512.png                     ← 512x512 trail pack
    ├── answer-note-512.png                  ← 512x512 answer note
    ├── cairn-512.png                        ← 512x512 trail cairn
    ├── mascot-face-512.png                  ← 512x512 visor icon
    ├── readme-banner-1200x300.png           ← 1200x340 header banner
    ├── social-card-1280x630.png             ← 1280x630 open graph preview
    └── brand-sheet.png                      ← 1600x1200 complete brand board
```
