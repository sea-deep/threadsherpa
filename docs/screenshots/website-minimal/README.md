# Minimal website captures

Captured from the local website on October 23, 2026 at desktop 1440 x 900 and mobile 390 x 844. These are website captures, separate from the original Discord screenshots.

- `desktop.png`: typography-led opening with the decorative character ribbon.
- `mobile.png`: opening at phone width.
- `scroll-0.png`, `scroll-1.png`, `scroll-2.png`: the scroll-controlled answer, save, and new-question sequence.
- `sandbox.png`: the retained usable Campfire sandbox at `/try/`.
- `verification.json`: browser checks actually completed, with limitations.

Verified all scroll phases, pause and reduced-motion fallback, no horizontal overflow at 1440px, 390px and 320px, and the guided save-to-new-question-to-source flow. No live model inference or Discord writes ran during these checks.

The embedded browser crashed during preview attempts. Captures came from an isolated Chromium instance through the installed design skill's browser helper. The existing local preview at port 4321 serves the updated page.
