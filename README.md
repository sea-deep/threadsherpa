# ThreadSherpa 🧭

> *"Investigate once. Remember the resolution. Stop solving the same problem twice."*

ThreadSherpa is an open-source, self-hostable Discord support copilot with **persistent, human-trained memory**. Built for technical communities, developer Discord servers, hackathons, open-source projects, and engineering support teams.

Unlike generic FAQ bots or chat wrappers that blindly treat every message as memory or hallucinate unverified answers, ThreadSherpa operates like an experienced tier-2 support engineer: it investigates technical issues using permitted tools, validates evidence against official documentation and GitHub repositories, asks targeted questions when details are missing, escalates sensitive cases, and continuously learns from human support administrator corrections through an auditable approval workflow.

---

## 🌟 Key Differentiators

| Standard Chatbot | ThreadSherpa Copilot |
|---|---|
| Blindly treats every chat message as memory | Human-in-the-loop review cards for approved, versioned knowledge |
| Hallucinates solutions when information is missing | Enforces deterministic response policy and asks targeted follow-ups |
| Single-turn prompt-response loop | Bounded autonomous investigation loop (Plan -> Act -> Evaluate -> Stop) |
| Relies exclusively on expensive proprietary APIs | Hybrid: Local open-weights (`gemma4` via Ollama) OR cloud APIs (Gemini, Groq, OpenAI) |
| Ephemeral in-memory context lost on restart | Durable persistence: SQLite (`node:sqlite` + FTS5) or MongoDB Atlas (Vector Search) |
| Ignores developer tools and repositories | Searches connected GitHub repos, checks duplicates, and drafts issues |
| Treats repeated complaints as isolated tickets | Detects shared incident clusters and alerts administrators to outages |
| Unmonitored execution | Sentry Agent Tracing instrumenting tool calls, inference, and spans |

---

## 🔄 The Closed Learning Loop

The fundamental differentiator of ThreadSherpa is its closed feedback loop:

```
  [1. OBSERVE] ──────> Member posts technical question in #support
         │
  [2. INVESTIGATE] ──> Searches approved memory, docs (SSRF-safe), & GitHub
         │
  [3. RESPOND] ──────> Posts evidence-backed guidance or asks clarifying questions
         │
  [4. LEARN] ────────> Support Admin posts correction or verified workaround
         │
  [5. EXTRACT] ──────> Agent extracts reusable question patterns & canonical answer
         │
  [6. APPROVE] ──────> Admin reviews Discord Review Card: [Approve] [Reject]
         │
  [7. REMEMBER] ─────> Versioned record committed to SQLite/Atlas + Vector index
         │
  [8. RECALL] ───────> Next member asks paraphrased question: immediate recall!
```

---

## 🏗️ Architecture & Integrations

ThreadSherpa is designed as a modular monolith with strict separation between deterministic control flow and open-weight model reasoning.

```
                             +-------------------------+
                             |   Discord Community     |
                             |  (Members & Moderators) |
                             +------------+------------+
                                          |
                                    Discord API
                               (Slash / Events / UI)
                                          |
                                          v
+------------------------------------------------------------------------------------+
|                                ThreadSherpa Core                                   |
|                                                                                    |
|  +------------------------------------------------------------------------------+  |
|  |                             Bot Gateway Layer                                |  |
|  |   - Slash Command Registry (/ask, /case, /teach, /memory, /issue, /setup)    |  |
|  |   - Channel & Event Monitoring (Filter bot loops, thread scope)              |  |
|  |   - Interactive UI Handlers (Buttons, Select Menus, Modals)                  |  |
|  +--------------------------------------+---------------------------------------+  |
|                                         |                                          |
|                                         v                                          |
|  +------------------------------------------------------------------------------+  |
|  |                           Support Orchestrator                               |  |
|  |   - Case State Machine (new -> investigating -> awaiting -> resolved)        |  |
|  |   - Bounded Autonomous Investigation Loop (Plan -> Act -> Evaluate -> Stop)  |  |
|  |   - Response Policy & Confidence Calibration                                 |  |
|  |   - Incident Detection Engine (Clustering symptoms & error codes)            |  |
|  |   - GitHub Issue Drafter & Copilot                                           |  |
|  |   - Sentry Agent Tracing (`traceAgentAction` spans for tools & inference)     |  |
|  +----+----------------------+---------------------+----------------------+-----+  |
|       |                      |                     |                      |        |
|       v                      v                     v                      v        |
|  +---------+           +------------+        +------------+         +-----------+  |
|  | Storage |           | Model      |        | Tool & Web |         | Security  |  |
|  | Layer   |           | Provider   |        | Access     |         | & Sentry  |  |
|  +----+----+           +-----+------+        +-----+------+         +-----+-----+  |
|       |                      |                     |                      |        |
+-------|----------------------|---------------------|----------------------|--------+
        |                      |                     |                      |
        v                      v                     v                      v
+---------------+      +---------------+     +---------------+      +---------------+
| Dual DB:      |      | Ollama Local  |     | Web Fetcher   |      | Sentry Spans  |
| - SQLite/FTS5 |      | Gemma 4 /     |     | (SSRF Guard)  |      | Audit Trail   |
| - Mongo Atlas |      | EmbeddingGem. |     | SerpApi Web   |      | Role Controls |
|   Vector Srch |      | 768-dim Vecs  |     | GitHub API    |      | Auth Defense  |
+---------------+      +---------------+     +---------------+      +---------------+
```

---

## 🏆 Supported Platforms & Challenge Integrations

- **MongoDB Atlas**: Native database backend support (`DATABASE_PROVIDER=mongodb`). Uses Atlas Vector Search (`$vectorSearch`), Atlas Full-Text indexes, and versioned collections (`knowledge_items`, `knowledge_versions`, `knowledge_reviews`, `support_cases`).
- **Flexible AI Inference (Local & Cloud)**:
  - **Local Open-Weight**: `gemma4:e4b-it-qat` (7.5B, context 131k) and `embeddinggemma-2:270m` (768 dimensions) via local Ollama.
  - **Cloud Ready**: Standard OpenAI-compatible client connecting to Google Gemini (`gemini-2.0-flash`), Groq (`llama-3.3-70b-versatile`), OpenRouter, or OpenAI (`gpt-4o-mini`).
- **Sentry Agent Tracing**: Distributed tracing using `@sentry/node` to measure latency, tool execution, model prompt repairs, and investigation spans.
- **SerpApi**: Real-time Google Web Search tool for unblocking investigations on third-party libraries, GitHub issues, and compiler errors.
- **Render**: Production cloud deployment ready via `render.yaml` blueprint.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v22.0.0 or higher (tested on Node.js v26.12.0)
- **Ollama**: Running locally with required models
- **Discord Bot Token**: With Message Content and Server Members intents

### 2. Local Model Setup (Ollama)
Install Ollama and pull the lightweight instruction and embedding models:

```bash
# Pull reasoning model (7.5B Q4_0, context 131k, tool-capable)
ollama pull gemma4:e4b-it-qat

# Pull 768-dim semantic embedding model
ollama pull embeddinggemma-2:270m
```

### 3. Clone and Install
```bash
git clone https://github.com/sea-deep/threadsherpa.git
cd threadsherpa
npm install
```

### 4. Configure Environment
Copy the example environment configuration:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_DEV_GUILD_ID=your_test_guild_id_here

# AI Model Provider: 'ollama' (default) | 'gemini' | 'groq' | 'openai' | 'openrouter'
MODEL_PROVIDER=ollama

# Option A: Local Ollama (Zero cost, runs locally)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b-it-qat
OLLAMA_EMBEDDING_MODEL=embeddinggemma-2:270m

# Option B: Cloud AI Inference (Render / Serverless)
# MODEL_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_api_key
# OPENAI_MODEL=gemini-2.0-flash
# (Or Groq: GROQ_API_KEY=your_groq_key, or OpenAI: OPENAI_API_KEY=your_key)

# Database Provider: 'sqlite' (default) or 'mongodb'
DATABASE_PROVIDER=sqlite
DATABASE_PATH=./data/threadsherpa.sqlite

# If using MongoDB Atlas:
# DATABASE_PROVIDER=mongodb
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/threadsherpa?retryWrites=true&w=majority

# Optional Partner Tooling:
# SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
# SERPAPI_API_KEY=your_serpapi_key
# GITHUB_TOKEN=your_github_pat
```

### 5. Seed Synthetic Demo Data (Optional)
To explore ThreadSherpa with pre-populated synthetic support cases, approved knowledge, and incident clusters:

```bash
npm run seed
```

### 6. Build and Run
```bash
# Development mode with hot-reloading
npm run dev

# Production build and run
npm run build
npm start
```

---

## ☁️ Deployment on Render

ThreadSherpa includes a native `render.yaml` specification for deploying as a persistent background worker:

1. Connect your repository to [Render](https://render.com).
2. Create a Blueprint deployment using `render.yaml`.
3. Set your `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, and `MONGODB_URI` environment variables in the Render Dashboard.
4. Render deploys the Node.js service with zero-downtime health monitoring.

---

## 🎮 Discord Slash Commands

| Command | Permission | Description |
|---|---|---|
| `/setup` | Administrator | Configure official support channels, admin roles, allowed doc domains, and repos |
| `/ask [question]` | Public | Submit a question for evidence-backed autonomous investigation |
| `/case [case_id]` | Public | Inspect a support case's status, evidence links, and investigation history |
| `/teach [question] [solution]` | Admin Role | Explicitly teach ThreadSherpa a canonical answer or troubleshooting procedure |
| `/memory search [query]` | Public | Search approved server knowledge using hybrid lexical + vector search |
| `/memory list` | Public | List active approved knowledge items |
| `/memory pending` | Admin Role | View knowledge candidates awaiting review |
| `/memory delete [id]` | Admin Role | Purge an entry from memory and active search indexes |
| `/issue [case_id]` | Admin Role | Draft a deduplicated, structured GitHub issue from a support discussion |
| `/sources` | Public | View permitted documentation domains and connected GitHub repositories |

---

## 🧪 Testing & Verification

ThreadSherpa includes a comprehensive test suite covering unit tests, SSRF guards, response policies, MongoDB Atlas repositories, partner modules, and the indispensable end-to-end "Learn -> Restart -> Recall" test:

```bash
# Run complete test suite (48 tests across 12 files)
npm test

# Run unit tests only
npx vitest run tests/unit/

# Run type-checking
npm run typecheck

# Run indispensable end-to-end release gate test
npx vitest run tests/e2e/learning-restart-recall.test.ts
```

---

## 📚 Documentation Directory

- [Architecture Design](docs/ARCHITECTURE.md) — System boundaries and component interactions
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — Phased milestones, deliverables, and progress
- [Security & Privacy](docs/SECURITY.md) — SSRF defenses, prompt injection mitigations, and RBAC
- [Memory & Learning](docs/MEMORY_AND_LEARNING.md) — Deep dive into the human-approved knowledge loop
- [Discord Setup Guide](docs/SETUP_DISCORD.md) — Step-by-step bot registration and permissions
- [Ollama Setup Guide](docs/SETUP_OLLAMA.md) — Local model pull and healthcheck guide
- [GitHub Setup Guide](docs/SETUP_GITHUB.md) — Configuring repository access for issue drafting
- [Demo Walkthrough Script](docs/DEMO_SCRIPT.md) — Step-by-step reproducible scenario walkthrough

---

## 🔒 Security & Privacy

- **SSRF Protection**: All outbound URL fetching resolves DNS and blocks private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`), loopbacks, and cloud metadata endpoints.
- **Tenant Isolation**: Every database query, vector search, and memory recall strictly enforces `guild_id` boundaries.
- **Secret Redaction**: Pino logging and GitHub issue drafters automatically mask API keys, auth headers, and tokens.
- **Deterministic Response Policy**: The AI model cannot autonomously execute external write operations. External writes (like publishing GitHub issues) require explicit administrator confirmation buttons.

---

## 📄 License

ThreadSherpa is licensed under the [Apache License 2.0](LICENSE).
