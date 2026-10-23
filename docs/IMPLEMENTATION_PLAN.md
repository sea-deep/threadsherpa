# Current implementation

The core loop is **moderator answer → save once → grounded LLM replies to new questions**. Saving is immediate, duplicate knowledge is skipped, and command responses stay short.

Implemented: one-action answer capture, original source links, exact and semantic duplicate checks, short per-question synthesis, scoped and expiring knowledge, versioned editing with embedding refresh, quiet unknown-question queue, member-confirmed solves, observed counts, exact documentation sources, free local inference and Atlas M0 persistence.

Removed: copy-and-broadcast sharing, draft-review menus, exact-answer copying, GitHub issue drafting, incident detection, open web search, investigation planning, `/case` and `/memory` command trees. Historical database records are retained.

Validation: repository, learning, policy and router tests; typecheck and build; scripted demo; local model checks; separate-process Atlas retrieval and vector-query verification. Historical Paper reports describe the earlier flow; data/evaluation-paper-current.json verifies the current synthesis flow after an explicitly authorized Paper run. Remote Sentry ingestion remains unverified.

Recent additions: quiet background failures, explicit conversational solve confirmation, failed-advice handoff context and grouped unanswered topics. Existing answer text is never treated as proof that a question was solved.
