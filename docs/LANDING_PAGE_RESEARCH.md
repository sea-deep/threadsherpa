# Landing website research and decision notes

Researched October 23, 2026. Companion to the [landing-page PRD](LANDING_PAGE_PRD.md).

## What the research supports

There are several useful visual approaches in contemporary developer and product websites: authored procedural graphics, interactive product surfaces, atmospheric gradients, and scroll-linked storytelling. They are overlapping techniques, not three formally established market categories. This research does not establish that conventional landing pages have stopped working or that adding 3D improves conversion.

For ThreadSherpa, the strongest choice is an interactive fictional support server, surrounded by a small authored motion system. That recommendation combines the product's actual mechanism with the owner's latest request. It is a design judgment, not a measured conversion result.

## Live website references

| Reference and inspection | Relevant observation | Decision for ThreadSherpa |
| --- | --- | --- |
| [Google Antigravity](https://antigravity.google/), official page and browser viewport | The inspected viewport used a sparse light field, a particle-like brand treatment, a direct download action, and a separately playable introduction. | Borrow the idea of atmosphere that belongs to the product. Build an answer-to-next-person thread instead of reproducing its particles, symbol, copy, or composition. The particle treatment was not verified as ASCII. |
| [Linear](https://linear.app/), official page and browser viewport | Clear large type and a prominent product surface make the software itself part of the first impression. | Keep support conversations readable and concrete. Do not borrow Linear's customer proof, visual identity, or product claims. |
| [Raycast](https://www.raycast.com/), official page and browser viewport | The opening combines a recognizable warm red graphic field, short product explanation, and a direct download action. The page also contains detailed product UI. | Commit to one recognizable visual material while retaining clear actions. ThreadSherpa's amber thread must explain its own workflow. |
| [Shopify Editions Winter '26](https://www.shopify.com/editions/winter2026), official page content | A large themed product release with category navigation, many product examples, and playable media. | Borrow deliberate pacing and inspectable product detail. Its scale and release-catalog structure do not fit a small support bot. This session did not visually inspect the full Shopify animation or verify its implementation stack. |
| [Paper Shaders](https://shaders.paper.design/), official examples | Provides mesh, grain, dithering, and other shader treatments as configurable materials. | Useful evidence that an interactive gradient can be implemented as a controllable graphic, not a stock video. It is an implementation alternative, not a requirement to add another runtime. |

These references are for principles and craft. They are not templates to copy, and no external site's assets belong in the finished ThreadSherpa website.

## Reddit: what people actually said

These are qualitative examples from individual threads. They are not representative surveys, verified agency case studies, or proof of business performance. Vote counts and claims of install rankings were deliberately excluded from the decision.

### Motion attracts attention, but pacing has a cost

A discussion of Shopify's Winter '26 page focused on scroll-synchronized media, pinned scenes, and the difficulty of executing them well. The poster also proposed an implementation stack; that attribution was not independently verified, so the PRD does not repeat it as fact. The useful observation is the level of attention an authored interaction can earn. [Reddit discussion: Shopify Editions](https://www.reddit.com/r/webdesign/comments/1u4l5gl/just_stumbled_upon_shopify_editions_winter_26_and/)

A Three.js studio shared a scroll-animated site and received repeated mobile complaints about orientation, excessive travel, and readability. Some replies appreciated the visual ambition. This is evidence of a recurring usability concern in that thread, not a general rejection of 3D. The PRD keeps native scrolling, a visible channel/thread model, and direct actions; mobile gets a genuinely different layout. [Reddit discussion: scroll-animated 3D website](https://www.reddit.com/r/webdesign/comments/1vd4hcq/we_built_a_scrollanimated_3d_website_in_threejs/)

Another discussion objected to the same fade-and-rise effect repeated on nearly every element. Responses disagreed about how much motion to use. The practical implication is to author motion according to function instead of applying the same reveal class everywhere. [Reddit discussion: excessive scroll animation](https://www.reddit.com/r/webdesign/comments/1rqsygf/what_do_you_think_about_the_excessive_scroll/)

### The polished graphics are often authored assets and systems

In a discussion about animated landing graphics, commenters described collaboration between designers and developers, SVG, video, WebGL, and animation tooling. One commenter identifying themselves as an author of the referenced work described an After Effects plus JavaScript approach. That identity was self-reported. This supports considering several rendering methods; it does not show that one library automatically creates premium work. [Reddit discussion: animated landing graphics](https://www.reddit.com/r/webdev/comments/1vztif4/how_do_people_come_up_with_those_pretty_animated/)

For ThreadSherpa, the real captures already exist, so production effort should go into interaction and a coherent graphic mechanism rather than fabricated UI imagery. An arbitrary background video would add production and loading cost without showing more product behavior.

### Skills people discuss

A frontend-design thread contained both skepticism about skill packs and recommendations for a concrete design system with Impeccable. The useful shared issue was interchangeable output without product-specific constraints. This is why the PRD specifies actual copy, assets, states, and a surface grammar instead of relying on the word premium. [Reddit discussion: frontend-design skills](https://www.reddit.com/r/ClaudeAI/comments/1v1v713/any_good_claude_frontenddesign_skills/)

A comparison thread explicitly discussed Impeccable, Taste, and frontend-design. One participant preferred Taste's appearance and Impeccable's consistency workflow. That is an anecdotal personal test, not a controlled ranking. The handoff gives Impeccable responsibility for process and Taste responsibility for composition judgment, while the brief owns the chosen direction. [Reddit discussion: Impeccable and UI UX Pro Max](https://www.reddit.com/r/ClaudeCode/comments/1syachi/best_skill_for_uxui_impeccable_vs_uxui_pro_max_vs/)

An October design-skill discussion included a report of useful results from references, Impeccable, and repeated revision. Other replies emphasized explicit state colors and framework conventions. The PRD therefore includes a closed token set and required browser checks, rather than assuming skill installation is the quality check. [Reddit discussion: frontend and UI skill sets](https://www.reddit.com/r/ClaudeDesign/comments/1wvfgec/best_claude_frontenddesignuxui_skill_set/)

No reliable conclusion about the most popular or best skill follows from these posts. The installed skills on this machine were checked directly instead of inferred from Reddit.

## Official skill sources and local findings

| Skill | Primary public source | What was verified locally |
| --- | --- | --- |
| Impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `/Users/dipak/.gemini/config/skills/impeccable/SKILL.md` exists and identifies version 4.6.0. Its context command ran. There was no existing PRODUCT.md, DESIGN.md, or frontend visual implementation. Brand assets and actual captures still supply project context. |
| Taste | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | The installed skill identifies itself as design-taste-frontend and includes reference and browser inspection workflows. The installed brief-sensitive rules were read; its build-time direction generator was not run for this PRD-only deliverable. |
| UI UX Pro Max | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md?plain=1) | The skill and local search script exist. Two design-system searches ran without persisting their suggestions. The first classified the product as an FAQ/documentation page; the narrower retry suggested a generic marketing layout. Neither fit the owner's requested experience. Relevant accessibility guidance remains useful. |

The full installed skill responsibility map is in PRD section 11. The receiving builder must read its own installed files. Skill names, versions, and workflows can differ across environments. No new skill was installed, and no global skill configuration was changed.

The DevRelay community-wisdom workflow was consulted, but its gateway search tools were unavailable in this session. No DevRelay article results or citations are claimed. Public Reddit and official technical references supply the research above.

## Technical references behind the decisions

| Topic | Official source | How the PRD uses it |
| --- | --- | --- |
| Static marketing content with selective interactivity | [Astro islands architecture](https://docs.astro.build/en/concepts/islands/) | Recommend a static-first website with client code concentrated in the usable sandbox and visual scene. This is a recommendation, not an existing project dependency. |
| Authored scroll and scene timing | [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) | Available for bounded presentation effects. The existence of pinning and scrub features does not require scroll hijacking or long pinned sections. |
| Real custom shader material | [Three.js ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html) | Provides an implementation path for the thread and interactive light in one renderer. |
| ASCII rendering precedent | [Three.js AsciiEffect](https://threejs.org/docs/pages/AsciiEffect.html) | Confirms an ASCII effect is an available technique. The PRD proposes a bounded glyph-atlas approach if needed for the final visual; it does not assume the addon is performant enough without measurement. |
| Gradient/shader alternative | [Paper Design shader repository](https://github.com/paper-design/shaders) | Offers vanilla and React packages and instructs users to pin dependencies. This is Paper Design, not the project's Paper Instruments model service. |
| React-specific reduced motion | [Motion useReducedMotion](https://motion.dev/docs/react-use-reduced-motion) | If an existing React site is reused, motion must respond to the OS setting. Motion is an alternative tool, not an added requirement on the recommended Astro build. |
| CSS reduced motion | [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | Static first-frame fallback and removal of movement-heavy treatments. |
| WebGL resource behavior | [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) | Limit renderer cost, manage resources, and test actual devices instead of assuming a powerful desktop represents visitors. The particular budgets are project choices. |
| Core Web Vitals | [web.dev Web Vitals](https://web.dev/articles/vitals) | Use LCP, INP, and CLS as measurable loading, interaction, and stability targets. Field percentiles require actual field measurements. |
| Largest Contentful Paint | [web.dev optimize LCP](https://web.dev/articles/optimize-lcp) | Keep essential content available early and avoid deferring the image that becomes the page's LCP element. |
| Dragging alternatives | [W3C Understanding SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) | The evidence explorer supplies visible single-pointer alternatives to dragging, as well as keyboard access. Keyboard access alone does not satisfy the single-pointer alternative. |
| Continuous motion control | [W3C Understanding SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) | Provide Pause motion for ongoing ambient movement beside readable content. An OS media query alone is not the entire control design. |

## Approaches considered

| Approach | Value | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Full-page 3D travel through a support world | Strong spectacle and cinematic control | Makes understanding and setup depend on navigating a scene; costly on mobile | Do not use as the page's navigation system |
| Interactive gradient behind ordinary marketing cards | Lightweight visual polish when bounded | Still fails to demonstrate saving knowledge or tailored help | Use a reactive light field only as a material within the authored scene |
| Scroll-scrubbed background video | Predictable art direction with pre-rendered imagery | Requires a new video asset and can obscure the actual support workflow | Optional later evidence, not the launch foundation |
| Draggable screenshots alone | Real proof and satisfying inspection | Cannot let a visitor post, save, correct knowledge, or ask a follow-up | Keep as the evidence explorer |
| Usable fictional server with real isolated answer logic | Makes the main mechanism tangible; supports visitor-written questions | Requires a new session API, provider reachability, isolation, and usage limits | Preferred launch target |
| Clearly labeled local guided server | Zero model calls and reliable exploration | Prepared scenes cannot prove real freeform synthesis | Required fallback, never labeled live |

## Public-link verification

The GitHub remote returned 404 to a public fetch. The GitLab remote redirected to sign-in. This can indicate private or otherwise inaccessible repositories; it does not prove the source is lost or deleted. The PRD therefore specifies a local `/setup/` route and an anonymous public-link check before launch. No repository permissions were changed.

Product behavior was checked against the local README, package manifest, support orchestrator, in-memory scenario composition, brand assets, and real screenshot gallery. The recommended website and API remain proposed work. This research did not build, deploy, or benchmark them.
