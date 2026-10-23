# Boundaries that matter

- Only opted-in support channels are monitored. `/ask` is an explicit request and works elsewhere in the server. Forum posts use their parent channel configuration.
- Saving, correcting, removing, setup and `/queue` require Discord Administrator or a configured moderator role. An empty role list does not authorize ordinary members. Every record action checks the server. Outcome buttons require the asker or a moderator.
- No ordinary conversation automatically becomes approved knowledge. An explicit moderator save approves the selected facts immediately. Save public reusable guidance: approved knowledge is shared across its server, without reproducing the original channel’s visibility restrictions.
- Models and fetched text cannot execute arbitrary tools. The only lookup tools are reviewed knowledge and exact moderator-selected source pages. The fetcher enforces domain and SSRF checks, redirect limits and response limits. Broad web search, GitHub publishing and incident actions were removed.
- Sensitive account operations, payments and visible credential assignments take the private human-support path before model or web calls. This is a bounded pattern check, not a guarantee of detecting every secret or sensitive request.
- Questions are never automatically merged, closed or marked solved. **Need help** and the quiet queue do not DM or page staff or promise a response time.
- Citation validation establishes retrieved provenance, not factual entailment. Model reasoning and semantic duplicate detection can still be wrong. Prompt injection checks are bounded heuristics, not a complete defense.

Paper mode sends synthesis questions and supporting evidence to Paper Instruments; local learning/embeddings run through Ollama. Ollama mode keeps inference local, but Discord, selected documentation pages, Atlas and optional Sentry still use network services. Review any provider’s data handling before operating with real community data.

The bot stores support text, requester IDs, evidence, reviewed answers, versions, reviews and audit records (legacy sharing records are retained but unused) in MongoDB. There is no automatic retention or privacy-erasure job. The legacy `retention_days` field is not enforced. Removing a saved answer does not erase historical records or posted messages.

Sentry spans intentionally contain operation metadata and numeric usage rather than message bodies. Logs and SDK error behavior still require review before production use. `.env` is ignored; never paste keys into screenshots, commits or submissions.
