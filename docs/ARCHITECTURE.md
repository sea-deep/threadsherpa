# ThreadSherpa — Architecture Design Document

## 1. System Overview

ThreadSherpa is an open-source, self-hostable, autonomous Discord support copilot with persistent, human-trained memory. It observes configured technical support channels, investigates questions and bug reports using approved tools and sources, formulates evidence-backed answers or escalates, learns from admin corrections via structured knowledge candidate approvals, and applies that validated knowledge to future inquiries.

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
|  +----+----------------------+---------------------+----------------------+-----+  |
|       |                      |                     |                      |        |
|       v                      v                     v                      v        |
|  +---------+           +------------+        +------------+         +-----------+  |
|  | Memory  |           | Model      |        | Tool & Web |         | Security  |  |
|  | Manager |           | Provider   |        | Access     |         | & Audit   |  |
|  +----+----+           +-----+------+        +-----+------+         +-----+-----+  |
|       |                      |                     |                      |        |
+-------|----------------------|---------------------|----------------------|--------+
        |                      |                     |                      |
        v                      v                     v                      v
+---------------+      +---------------+     +---------------+      +---------------+
| SQLite / FTS5 |      | Ollama Local  |     | Web Fetcher   |      | Audit Log     |
| Embeddings DB |      | Gemma 4 /     |     | (SSRF Guard)  |      | Role-Based    |
| Schema Migr.  |      | EmbeddingGem. |     | GitHub API    |      | Auth Controls |
+---------------+      +---------------+     +---------------+      +---------------+
```

---

## 2. Component Boundaries & Directory Layout

The application is structured as a modular TypeScript service with strict separation of concerns:

### `src/config/`
- **Environment Schema (`src/config/env.ts`)**: Zod-validated environment configuration. Validates Discord tokens, Ollama URLs, model names, GitHub tokens, and server defaults.
- **Runtime Defaults**: Safe fallback budgets, rate limits, timeouts, and retention settings.

### `src/bot/`
- **Discord Gateway (`src/bot/client.ts`)**: Initializes Discord.js client with required intents (`Guilds`, `GuildMessages`, `MessageContent`, `GuildMessageReactions`).
- **Command Registry (`src/bot/commands/`)**:
  - `/ask`: Explicitly triggers case creation and investigation.
  - `/investigate`: Investigates a thread or message context.
  - `/case`: Inspects case status, findings, and evidence.
  - `/teach`: Initiates structured knowledge extraction from a message or thread.
  - `/memory`: Admin interface to search, inspect, review, correct, supersede, or delete memory.
  - `/issue`: Prepares a deduplicated GitHub issue draft.
  - `/sources`: Lists configured documentation domains and connected repositories.
  - `/setup`: Ephemeral configuration wizard for support channels, admin roles, and autonomy modes.
- **Event Handlers (`src/bot/events/`)**:
  - `messageCreate`: Monitors allowlisted support channels, associates replies with active cases, ignores bot loops.
  - `interactionCreate`: Routes commands, button interactions, select menus, and modals.
- **UI Components (`src/bot/components/`)**:
  - Embed builders for case reviews, knowledge candidate approvals, GitHub draft confirmations, and incident notices.

### `src/domain/`
- **Case Entities (`src/domain/case.ts`)**: Lifecycle states (`new`, `triaging`, `investigating`, `awaiting_user`, `awaiting_admin`, `answered`, `resolved`, `reopened`, `escalated`, `closed`).
- **Knowledge Entities (`src/domain/knowledge.ts`)**: Versioned knowledge models with `question_patterns`, `canonical_answer`, `applies_when`, `does_not_apply_when`, `authority`, `approval_status`, and source citations.
- **Evidence Entities (`src/domain/evidence.ts`)**: Structured evidence containing provenance URL, excerpt, retrieval timestamp, authority rank, and status.
- **Incident Entities (`src/domain/incident.ts`)**: Shared symptom clusters linking multiple cases.
- **GitHub Link Entities (`src/domain/github.ts`)**: Drafts, duplicate search results, and API linkage records.

### `src/database/`
- **Connection & Engine (`src/database/connection.ts`)**: SQLite with WAL mode, foreign keys, and custom vector similarity extension function.
- **Migration Runner (`src/database/migrator.ts`)**: Version-controlled SQL migrations.
- **Repositories (`src/database/repositories/`)**:
  - `GuildConfigRepository`: Server settings, channel configs, admin roles.
  - `CaseRepository`: Support cases and state transitions.
  - `EvidenceRepository`: Evidence linked to cases.
  - `KnowledgeRepository`: Knowledge items, versions, and review decisions.
  - `IncidentRepository`: Incidents and case linkages.
  - `GitHubRepository`: Linked GitHub issues and drafts.
  - `AuditRepository`: Structured audit trail with actor, action, and target.

### `src/integrations/`
- **Model Provider (`src/integrations/ollama/`)**:
  - `OllamaClient`: Direct HTTP client for Ollama API (`/api/chat`, `/api/embeddings`, `/api/tags`).
  - `StructuredOutputParser`: Zod-validated JSON extraction with bounded repair.
  - `EmbeddingService`: Generates vector embeddings using `embeddinggemma-2:270m` or fallback vectorizer.
- **Web Adapter (`src/integrations/web/`)**:
  - `SafeFetcher`: SSRF-protected HTTP client blocking RFC 1918 private IPs, AWS/GCP metadata endpoints (`169.254.169.254`), and localhost.
- **GitHub Adapter (`src/integrations/github/`)**:
  - `GitHubClient`: Octokit / REST client for searching issues/releases and creating issues after admin authorization.

### `src/agent/`
- **Orchestrator (`src/agent/orchestrator.ts`)**: Coordinates investigation loop.
- **Investigation Loop (`src/agent/investigator.ts`)**:
  1. Parse problem & extract technical entities.
  2. Search internal approved memory (hybrid lexical + vector).
  3. Formulate investigation plan.
  4. Execute bounded tool calls (max 3 rounds, max 6 tool calls).
  5. Evaluate evidence & detect conflicts.
  6. Apply Response Policy.
  7. Produce grounded answer, targeted clarification question, or escalation.
- **Tool Registry (`src/agent/tools/`)**:
  - `search_knowledge`, `find_similar_cases`, `search_docs`, `fetch_url`, `search_github_issues`, `get_github_issue`, `search_github_releases`, `create_github_issue_draft`.

### `src/memory/`
- **Hybrid Retrieval (`src/memory/retriever.ts`)**:
  - Lexical full-text search via SQLite FTS5.
  - Semantic vector search via cosine distance on embeddings.
  - Exact keyword and error-string matching.
  - Metadata filtering (server isolation, approval status, freshness, product scope).
- **Learning Pipeline (`src/memory/learner.ts`)**:
  - Triggers on admin corrections, `/teach` commands, or resolved cases.
  - Generates structured `KnowledgeCandidate`.
  - Presents Discord Review Card with Approve / Edit / Reject / Temporary buttons.
  - Creates new `KnowledgeVersion` on approval and updates search index.
  - Flags conflicting prior knowledge.

### `src/security/`
- **SSRF Guard**: Enforces IP restrictions on URLs.
- **Secret Redactor**: Masks API tokens, private keys, authorization headers.
- **Permission Guard**: Validates Discord roles before administrative and write actions.
- **Prompt Sanitizer**: Prevents prompt injection in retrieved content from overriding system instructions.

---

## 3. Human-in-the-Loop Learning Cycle

The core innovation of ThreadSherpa is its closed feedback loop:

1. **Observe**: Member posts a problem in `#support`.
2. **Investigate**: Agent searches approved memory and documentation; executes tools.
3. **Respond or Escalate**: Agent posts evidence-backed response or escalates if unconfirmed.
4. **Learn**: Support admin steps in with a correction or verified solution.
5. **Extract**: Agent extracts reusable problem pattern, canonical answer, and scope constraints.
6. **Review**: Interactive review card sent to admins: `[Approve]` `[Edit]` `[Reject]`.
7. **Remember**: On approval, versioned knowledge item stored and indexed persistently.
8. **Recall**: Subsequent user with a paraphrased question receives the human-approved answer immediately.
