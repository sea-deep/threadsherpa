# ThreadSherpa website

Use Node.js 22.23.4 or newer.

```bash
cd website
npm ci
npm run dev
```

`/` contains the conversation and architecture walkthrough. `/setup/` has bot installation steps. `/security/` documents the boundaries. The separate `/try/` sandbox remains available by direct URL.

```bash
npm run check
npm run build
npm run preview
```

The homepage uses Skyra Discord Components (Lit), GSAP ScrollTrigger, native scrolling, and a small canvas field. It makes no model calls. The five-step conversation, node inspector, and route switch are authored explanations of the actual bot behavior.

The sandbox supports guided mode without a backend. Live mode requires the separately configured `sandbox-api` and reachable model services. Never expose the real bot's credentials or production database to the website.

Current direction: [DESIGN.md](DESIGN.md). Asset credits: [ASSETS.md](ASSETS.md). The real Discord screenshots remain in `public/evidence/` for future use; there is no homepage capture gallery.
