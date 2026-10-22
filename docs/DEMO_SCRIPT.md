# ThreadSherpa Demo Walkthrough Script

This script provides a reproducible, step-by-step walkthrough to demonstrate ThreadSherpa's core capabilities in a live Discord server or local test environment.

---

## Scenario: The "Investigate Once, Remember Forever" Journey

### Act 1: Initial Question & Evidence Investigation
1. **User (Alice)** posts in `#support`:
   > *"How do I fix sqlite native build error on Node 26? node-gyp rebuild fails with C++ GetPrototype error."*
2. **ThreadSherpa**:
   - Creates Support Case `#A1B2C3`.
   - Searches approved memory (initially empty for this query).
   - Formulates an investigation plan and searches documentation/GitHub.
   - Responds:
     > *"Investigating: Observed C++ compilation errors on Node 26. Could you confirm which SQLite library and architecture you are targeting?"*
   - Status updates to `AWAITING_USER`.

---

### Act 2: Human-in-the-Loop Admin Resolution & Knowledge Capture
1. **Support Administrator (Sarah)** replies in the thread:
   > *"On Node.js 26, avoid using older sqlite packages like better-sqlite3; use built-in node:sqlite module via `import { DatabaseSync } from 'node:sqlite'` instead."*
2. **ThreadSherpa Learning Pipeline**:
   - Detects authorized administrator resolution.
   - Extracts structured `KnowledgeCandidate`:
     - **Patterns**: `["How to fix sqlite native compilation error on Node 26", "better-sqlite3 fails on Node 26"]`
     - **Canonical Answer**: `"Node.js 26 includes a built-in synchronous SQLite module: import { DatabaseSync } from 'node:sqlite'. Avoid native C++ addons."`
     - **Applies When**: `Node.js 26+`
   - Posts Discord Admin Review Card:
     > **[Approve & Index]**  **[Reject]**
3. **Sarah** clicks **`[Approve & Index]`**.
   - ThreadSherpa commits the item to versioned memory, indexes it in SQLite FTS5 and vector tables, and confirms:
     > *"✅ Knowledge Approved & Indexed by @Sarah. This resolution is now part of ThreadSherpa's persistent memory."*

---

### Act 3: Simulated Restart (Cold Reboot)
1. Stop the bot: `Ctrl+C` (or terminate process).
2. Start the bot: `npm start`.
   - ThreadSherpa loads SQLite database from disk.
   - Performs startup diagnostics and confirms 0 data loss.

---

### Act 4: Future Recall with Paraphrased Inquiry
1. **Different User (Bob)** posts in `#support`:
   > *"Getting C++ compilation failure when installing sqlite database in Node 26."*
2. **ThreadSherpa**:
   - Searches hybrid memory (FTS5 + vector similarity).
   - Finds high-confidence match with approved knowledge (`node:sqlite`).
   - Immediately replies with the human-approved solution:
     > *"Node.js 26 includes a built-in synchronous SQLite module: `import { DatabaseSync } from 'node:sqlite'`. Avoid native C++ addons like better-sqlite3 as V8 C++ API changes cause compilation errors.*
     > *Source: Approved Knowledge `#know_...` • Verified by @Sarah"*
   - **Result**: No moderator intervention required; problem solved instantly from persistent memory.

---

### Act 5: Converting a Support Case to a GitHub Issue
1. In another complex troubleshooting thread, run:
   > `/issue`
2. **ThreadSherpa**:
   - Searches `owner/repo` for duplicate issues on GitHub.
   - Synthesizes clean Markdown issue draft containing environment details, error messages, and steps to reproduce.
   - Shows preview card with **`[Approve & Create Issue]`**.
3. Admin clicks **`[Approve & Create Issue]`**:
   - Issue created via GitHub API.
   - Returns real GitHub issue link: `https://github.com/owner/repo/issues/42`.
