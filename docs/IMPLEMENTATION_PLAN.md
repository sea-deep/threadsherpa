# ThreadSherpa Implementation Plan

## 1. Repository Assessment

- **Current Repository State**: Clean, robust TypeScript service connected to dual remotes:
  - GitHub: `https://github.com/sea-deep/threadsherpa.git`
  - GitLab: `https://gitlab.com/wdipak/threadsherpa.git`
- **Host Environment**: macOS (Darwin arm64)
  - Node.js `v26.12.0`, npm `11.20.0`
  - MongoDB Atlas unified database layer (`mongodb` package) with Atlas Vector Search, text indexes, and zero-dependency in-memory store for local testing
  - Local Ollama running at `http://localhost:11434` with `gemma4:e4b-it-qat` (7.5B Q4_0, context 131k, tool-capable) and `embeddinggemma-2:270m` (768-dim embeddings)
  - GitHub CLI (`gh`) and GitLab CLI (`glab`) configured and authenticated
- **Obsolete Product Functionality**: None. Starting from clean slate; zero legacy artifacts or dead dependencies.

---

## 2. Core MVP Boundary vs. Deferred Features

### Core MVP Boundary (P0 - Mandatory)
1. **Discord Bot Gateway**: Slash commands (`/setup`, `/ask`, `/investigate`, `/case`, `/teach`, `/memory`, `/issue`, `/sources`), support channel monitoring, and interactive UI components (buttons, review cards).
2. **Persistent Case State Machine**: `new`, `triaging`, `investigating`, `awaiting_user`, `awaiting_admin`, `answered`, `resolved`, `reopened`, `escalated`, `closed`.
3. **Database Architecture**: Unified MongoDB Atlas document store with declarative indexing, Atlas Vector Search, text indexes, and in-memory development adapter.
4. **Local Open-Weight Model Provider**: Ollama adapter supporting `gemma4:e4b-it-qat` and `embeddinggemma-2:270m`, Zod structured output validation, bounded repair, timeouts, and health checks.
5. **Controlled Evidence Fetching**: SSRF-protected HTTP web fetcher, documentation retriever, and evidence provenance tracking.
6. **Persistent Memory & Hybrid Retrieval**: Working, episodic, semantic, and procedural memory with lexical (FTS5) + vector (embeddings) search and server isolation.
7. **Human-in-the-Loop Admin Learning Pipeline**: Extraction of knowledge candidates from admin corrections or `/teach`, Discord interactive review cards (Approve / Edit / Reject), versioned persistence, and regression indexing.
8. **Bounded Autonomous Investigation Agent**: Plan-Act-Evaluate loop with tool budgets (max 3 rounds, max 6 tool calls), response policy, and citation enforcement.
9. **GitHub Issue Copilot**: Search issues/releases, generate structured duplicate-checked drafts, require admin approval for issue creation.
10. **Shared Incident Detection**: Cluster similar symptoms and error messages into candidate incidents with admin verification controls.
11. **Security, Privacy & Audit Trail**: Role-based permissions, secret redaction, audit log, prompt-injection defense.
12. **End-to-End Evaluation Suite**: Repeatable test suite including the release-gate "Learn-Restart-Recall" test proving that admin corrections persist and correctly answer future paraphrased questions.

### Explicitly Deferred Features (P2)
- Autonomous destructive Discord moderation actions (kicking/banning users).
- Cross-server shared memory (violates multi-tenant isolation).
- Voice support / audio streaming.
- Enterprise ticketing systems (Jira, ServiceNow, Zendesk).
- Model fine-tuning pipeline.

---

## 3. Implementation Phases & Status Checklist

| Phase | Description | Deliverables | Status |
|---|---|---|---|
| **Phase 0** | Repo Audit & Architecture Setup | Dual remotes, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md` | **COMPLETED** |
| **Phase 1** | Working Application Foundation | TypeScript project config, package.json, Zod env validation, structured logger, DB connection & migrations | **COMPLETED** |
| **Phase 2** | Discord Integration & UX | Discord.js client, slash commands (`/setup`, `/ask`, `/case`, `/teach`, `/memory`, `/issue`, `/sources`), button & modal interaction routing | **COMPLETED** |
| **Phase 3** | Case State Machine & Data Model | Unified MongoDB Atlas collections, declarative indexes, repositories for cases, evidence, knowledge, reviews, incidents, and audit logs | **COMPLETED** |
| **Phase 4** | Open-Weight Model Provider | Ollama client, structured output parser, health check, tool schemas, embedding generator | **COMPLETED** |
| **Phase 5** | Source Retrieval & Evidence Management | SSRF-safe fetcher, documentation adapter, evidence validation and ranking | **COMPLETED** |
| **Phase 6** | Persistent Memory & Hybrid Retrieval | Working, episodic, semantic memory, FTS5 lexical search, vector similarity search, versioning | **COMPLETED** |
| **Phase 7** | Learning from Support Admins | Admin trigger listener, knowledge candidate extractor, Discord review card, approval workflow, conflict detection | **COMPLETED** |
| **Phase 8** | Bounded Autonomous Investigation Agent | Orchestrator, investigation loop, tool budgets, response policy, citation checks | **COMPLETED** |
| **Phase 9** | GitHub Issue Copilot | Issue search, duplicate detection, draft generation, approval-gated issue creation | **COMPLETED** |
| **Phase 10** | Shared Incident Detection | Symptom clustering, time window grouping, candidate incidents, admin verification | **COMPLETED** |
| **Phase 11** | Admin UX, Auditability & Memory Controls | Interactive Discord components, memory management subcommands, audit logger | **COMPLETED** |
| **Phase 12** | Security, Privacy & Failure Handling | SSRF guard, role authorization, secret redactor, prompt injection guard, rate limiters | **COMPLETED** |
| **Phase 13** | Evaluation & End-to-End Proof | Automated test suite, synthetic support cases, indispensable "Learn-Restart-Recall" test | **COMPLETED** |
| **Phase 14** | Documentation, Setup & Demo Experience | Full README, setup guides, synthetic demo seed script, demo walkthrough | **COMPLETED** |
| **Phase 15** | Release Hardening & Verification | Production build, clean DB migration test, end-to-end verification, dual remote git push | **COMPLETED** |

---

## 4. Verification & Testing Matrix

- **Unit Tests**:
  - `tests/unit/database.test.ts`: Migrations, idempotency, custom vector scalar function, FTS5 indexing.
  - `tests/unit/repositories.test.ts`: Case state transitions, evidence storage, knowledge versioning, incident grouping, audit logging.
  - `tests/unit/ssrf.test.ts`: Private IP checks, loopback protection, AWS/GCP metadata blocks, domain allowlists.
  - `tests/unit/model-provider.test.ts`: Ollama health check, 768-dim embeddings, Zod structured generation with self-repair.
  - `tests/unit/policy.test.ts`: Response policy, sensitive account escalation, ungrounded hallucination prevention, citation validation.
  - `tests/unit/incident-detector.test.ts`: Symptom clustering, existing incident linkage, admin confirmation.
  - `tests/unit/github-copilot.test.ts`: Duplicate issue search, structured Markdown draft generation, allowlist gating.
  - `tests/unit/sentry.test.ts`: Distributed tracing spans (`traceAgentAction`), error propagation, and context enrichment.
  - `tests/unit/partner-integrations.test.ts`: Real-time Google web search via SerpApi for finding upstream GitHub issues and technical documentation.
  - `tests/unit/mongo-repositories.test.ts`: MongoDB Atlas repository mappings, document versioning, approval workflows, and vector search fallback ranking.
- **Integration Tests**:
  - `tests/integration/bot-router.test.ts`: Slash command routing (`/setup`, `/ask`, `/teach`), button actions (`approve_know`, `reject_know`), message monitoring in support channels.
- **Indispensable E2E Release Gate**:
  - `tests/e2e/learning-restart-recall.test.ts`: Full lifecycle proving Question A -> Investigation -> Admin correction -> Candidate review -> Approval -> Disk persistence -> Cold reboot -> Question B paraphrase -> Hybrid recall -> Grounded response.
