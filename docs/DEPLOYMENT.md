# Deploy on Render

## Website

[Deploy the website to Render](https://render.com/deploy?repo=https://github.com/sea-deep/threadsherpa) using the root [render.yaml](../render.yaml).

The blueprint creates a static site. It does not upload Discord credentials, run the bot, or provision a database.

For manual setup:

| Setting | Value |
| --- | --- |
| Service type | Static Site |
| Repository | Your accessible ThreadSherpa repository |
| Branch | `main` |
| Build command | `npm ci --prefix website && npm run build --prefix website` |
| Publish directory | `website/dist` |
| `NODE_VERSION` | `24.22.1` |
| `SKIP_INSTALL_DEPS` | `true` |

Private repositories need Render's Git provider integration to have access. Static hosting has no compute charge; bandwidth and build usage count toward the workspace's included allowances. [Render's Astro guide](https://render.com/docs/deploy-astro).

The blueprint leaves automatic deployment off for copies created by the README button. Enable it for your own linked service if you want every push to deploy.

## Discord bot

The bot maintains a Discord Gateway connection and needs a continuously running process. A free static site cannot run it.

An optional [background-worker blueprint](../deploy/render-worker.yaml) is included. It uses a paid worker plan and must be deployed separately. Before deploying, configure the bot token, MongoDB URI, and model settings in Render's environment editor.

Paper mode still needs a reachable Ollama endpoint for local embedding and duplicate operations. A Render worker cannot reach Ollama on your laptop at `localhost`; provide a private reachable model service or run the bot on the same machine as Ollama. Do not expose an unauthenticated Ollama endpoint to the internet.

Do not run two bot processes against the same production server while testing a replacement deployment. Start in a separate Discord test server.

## Challenge context

The [Week 3 Render category](https://dev.to/challenges/hacktoberfest-week3-2026-10-19) includes hosting an agent's front end. Document exactly which part of this project is deployed. A website deployment is not evidence that the Discord Gateway worker or model is running on Render.
