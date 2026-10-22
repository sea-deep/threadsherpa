# ThreadSherpa Memory & Learning Architecture

## 1. Overview

ThreadSherpa rejects the naive pattern of treating raw model conversation history or unverified chat logs as memory. Instead, it structures memory into four distinct, auditable tiers:

```
+-------------------------------------------------------------------------------+
|                             ThreadSherpa Memory                               |
+-------------------------------------------------------------------------------+
|  1. Working Memory     | Short-lived context for active case investigation    |
|  2. Episodic Memory    | Historical case logs, attempted steps, outcomes      |
|  3. Semantic Memory    | Human-approved canonical answers and procedures      |
|  4. Configuration Mem  | Server policies, channel allowlists, admin roles     |
+-------------------------------------------------------------------------------+
```

---

## 2. Memory Categories

### A. Working Memory
- Scope: A single active support ticket / thread.
- Contents: Original user question, thread messages, extracted technical entities, plan steps, and evidence retrieved so far.
- Lifespan: Duration of the investigation until answered or closed.

### B. Episodic Memory
- Scope: Server-wide case history.
- Contents: Past support tickets, root causes, evidence excerpts, resolution notes, and user feedback (`resolved_confirmed`, `reopen`).
- Usage: Allows the agent to query `find_similar_cases` to see if a similar issue was encountered previously and what resolved it.

### C. Semantic Memory (Core Human-Trained Knowledge)
- Scope: Server-wide authoritative guidance.
- Contents:
  - `question_patterns`: Array of phrasing variations representing the problem.
  - `canonical_answer`: Concise, verified instructions.
  - `applies_when`: Preconditions, OS versions, library versions.
  - `does_not_apply_when`: Known exceptions.
  - `authority`: `official_doc` | `maintainer` | `approved_admin` | `community_lead`.
  - `approval_status`: `candidate` | `approved` | `rejected` | `superseded` | `deleted`.
  - `source_refs`: Discord message URLs or external documentation links.
  - `embedding`: 768-dimensional vector generated via local embedding model.

---

## 3. The Human-in-the-Loop Learning Lifecycle

The entire differentiator of ThreadSherpa is its closed learning cycle:

```
   [User Question] ──> [Investigate & Respond]
                                │
                        (Admin corrects)
                                │
                                v
                   [Candidate Extraction Engine]
                                │
                    [Discord Admin Review Card]
                     [Approve]  [Edit]  [Reject]
                                │
                        (Admin Approves)
                                │
                                v
               [Persistent Indexing (SQLite + FTS5)]
                                │
                                v
       [Future Inquiries Automatically Recalled & Cited]
```

### Step 1: Learning Trigger Detection
The bot detects substantive admin resolutions through three pathways:
1. **Explicit Teaching**: Support admin invokes `/teach question: ... solution: ...`.
2. **Contextual Thread Reply**: An authorized admin replies to an active support case with a substantive resolution.
3. **Confirmed Resolution**: An admin marks a case as resolved with confirmed findings.

### Step 2: Knowledge Extraction
The local model extracts structured candidate fields (`KnowledgeCandidateExtractionSchema`), generating multiple phrasing patterns and identifying applicability boundaries.

### Step 3: Conflict & Overlap Check
Before presenting the candidate, the system checks existing approved knowledge items using semantic vector similarity. If a potential contradiction or duplicate is detected, it is flagged on the review card.

### Step 4: Admin Review & Governance
An interactive Discord embed is dispatched to authorized administrators with buttons:
- **`[Approve & Index]`**: Commits the candidate to `knowledge_items`, assigns version 1, indexes it in SQLite FTS5 and vector tables, and logs an audit event.
- **`[Reject]`**: Marks the candidate as `rejected`. It will never be indexed or retrieved as positive guidance.

### Step 5: Versioning and Correction (Supersession)
When an existing procedure changes or an earlier answer was incomplete:
1. The admin supplies the updated instruction.
2. The system creates a new version (e.g. `version: 2`).
3. The previous version is marked `approval_state: 'superseded'`.
4. The FTS5 index and vector embeddings are refreshed with the new canonical answer.
5. The full historical lineage remains preserved in `knowledge_versions` and `knowledge_reviews` for auditability.

---

## 4. Hybrid Retrieval Architecture

When a user asks a question, ThreadSherpa executes hybrid retrieval:

1. **Exact & Error Matching**: Scans for exact error strings and technical identifiers (e.g., `GetPrototype`, `HTTP 503`, `node:sqlite`).
2. **Lexical Full-Text Search**: Queries SQLite FTS5 virtual table (`fts_knowledge`) for keyword matches.
3. **Semantic Vector Search**: Calculates cosine distance between the user query embedding (via `embeddinggemma-2:270m`) and all approved knowledge embeddings.
4. **Hybrid Scoring Fusion**: Combines lexical relevance and vector cosine similarity:
   $$\text{Score} = (\text{LexicalScore} \times 0.5) + (\text{VectorSimilarity} \times 0.7)$$
5. **Precondition & Freshness Filtering**: Excludes expired items and checks `applies_when` constraints against detected environment facts.
