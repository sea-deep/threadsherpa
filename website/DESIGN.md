# ThreadSherpa website

Current direction, October 23: a small project walkthrough, not a SaaS pitch.

The first sentence says what it is: **A Discord bot for repeat questions.** The rest shows the mechanism, then explains the code. No screenshot gallery, signup funnel, browser CTA, customer claims, or repeated scenario disclaimers.

## Appearance

Use Uncut Sans throughout. It comes directly from Kasper Nordkvist's GitHub repository, is self-hosted, and includes its OFL license. Keep mono labels sparingly for source paths and step numbers. The palette is fig-black, warm ivory, acid pear, dusty lilac, and occasional coral for the quiet route. Keep the existing ThreadSherpa mark.

## Sequence

1. Plain description and an animated character field.
2. Five scroll-led conversation states: first question, moderator answer and save, repeated question with a sourced reply, follow-up, unsupported question with no bot message.
3. A longer architecture walkthrough. The diagram follows the scroll and lets visitors inspect each node. A route switch shows supported output versus a quiet queue. Code links point to the actual files.
4. The save path explains explicit approval, duplicate checks, MongoDB storage, context, and source retention.
5. Brief expandable limits, a first-person project note, and setup with GitHub, GitLab, and quick-start links.

## Motion and controls

GSAP is the animation system. Scrolling stays native. Chapter buttons seek to each conversation state. The source preview, save action, outcome control, architecture nodes, route buttons, disclosure rows, and motion toggle have working local state. Follow-ups stay in the same thread. The unknown-question scene contains no bot response.

Use small hover shifts, focus states, progressive route drawing, active node changes, and message arrivals. Avoid constant spinning, large pointer tilts, forced cursor effects, and decorative counters. Pause the canvas offscreen, on hidden tabs, or when motion is disabled. Reduced-motion and short screens get the complete static conversation. The content is readable before scripts run.

The home conversation is an authored walkthrough, with no network generation calls. The separate `/try/` sandbox retains truthful guided/live runtime labeling. Actual Discord captures remain in the repository for the author's future blog; they are not displayed on the homepage.
