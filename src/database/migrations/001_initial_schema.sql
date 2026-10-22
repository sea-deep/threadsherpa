-- ThreadSherpa Schema Migration 001: Initial Core Schema

-- Guild (Server) Settings
CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    autonomy_mode TEXT NOT NULL DEFAULT 'supervised' CHECK(autonomy_mode IN ('observe', 'supervised', 'auto')),
    admin_role_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of Discord role IDs
    support_channel_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of channel IDs
    allowed_domains TEXT NOT NULL DEFAULT '[]', -- JSON array of permitted doc domains
    connected_repos TEXT NOT NULL DEFAULT '[]', -- JSON array of 'owner/repo' strings
    retention_days INTEGER NOT NULL DEFAULT 90,
    require_response_approval INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Explicit Support Channel Configurations
CREATE TABLE IF NOT EXISTS channel_configs (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_type TEXT NOT NULL DEFAULT 'text',
    monitoring_enabled INTEGER NOT NULL DEFAULT 1,
    auto_thread INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
);

-- Support Cases
CREATE TABLE IF NOT EXISTS support_cases (
    case_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    thread_id TEXT,
    message_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    requester_username TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN (
        'new', 'triaging', 'investigating', 'awaiting_user',
        'awaiting_admin', 'answered', 'resolved', 'reopened',
        'escalated', 'closed'
    )),
    summary TEXT,
    last_answer TEXT,
    resolution_outcome TEXT,
    reopen_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cases_guild_status ON support_cases(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_thread_id ON support_cases(thread_id);
CREATE INDEX IF NOT EXISTS idx_cases_channel_id ON support_cases(channel_id);

-- Case Evidence
CREATE TABLE IF NOT EXISTS case_evidence (
    evidence_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('memory', 'documentation', 'web', 'github_issue', 'github_release', 'discord_message')),
    source_url TEXT,
    title TEXT,
    excerpt TEXT NOT NULL,
    authority_score REAL NOT NULL DEFAULT 0.5,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (case_id) REFERENCES support_cases(case_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON case_evidence(case_id);

-- Investigation Runs
CREATE TABLE IF NOT EXISTS investigation_runs (
    run_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'timeout', 'escalated')),
    rounds_executed INTEGER NOT NULL DEFAULT 0,
    tools_called INTEGER NOT NULL DEFAULT 0,
    findings_summary TEXT,
    error_message TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (case_id) REFERENCES support_cases(case_id) ON DELETE CASCADE
);

-- Versioned Knowledge Items
CREATE TABLE IF NOT EXISTS knowledge_items (
    knowledge_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 1,
    question_patterns TEXT NOT NULL, -- JSON array of question strings
    canonical_answer TEXT NOT NULL,
    applies_when TEXT,
    does_not_apply_when TEXT,
    authority TEXT NOT NULL DEFAULT 'approved_admin' CHECK(authority IN ('official_doc', 'maintainer', 'approved_admin', 'community_lead')),
    approval_status TEXT NOT NULL DEFAULT 'candidate' CHECK(approval_status IN ('candidate', 'pending_review', 'approved', 'rejected', 'stale', 'superseded', 'deleted')),
    source_refs TEXT NOT NULL DEFAULT '[]', -- JSON array of URLs or references
    embedding TEXT, -- JSON array of float vector
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    verified_at TEXT,
    expires_at TEXT,
    FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_guild_status ON knowledge_items(guild_id, approval_status);

-- Knowledge Historical Versions
CREATE TABLE IF NOT EXISTS knowledge_versions (
    version_id TEXT PRIMARY KEY,
    knowledge_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    canonical_answer TEXT NOT NULL,
    question_patterns TEXT NOT NULL,
    applies_when TEXT,
    does_not_apply_when TEXT,
    change_reason TEXT,
    evidence_refs TEXT NOT NULL DEFAULT '[]',
    proposer_id TEXT NOT NULL,
    reviewer_id TEXT,
    approval_state TEXT NOT NULL CHECK(approval_state IN ('draft', 'approved', 'rejected', 'superseded')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_id) REFERENCES knowledge_items(knowledge_id) ON DELETE CASCADE
);

-- Knowledge Reviews / Audit Decisions
CREATE TABLE IF NOT EXISTS knowledge_reviews (
    review_id TEXT PRIMARY KEY,
    knowledge_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    reviewer_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('approve', 'edit', 'reject', 'mark_temporary', 'supersede')),
    decision_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_id) REFERENCES knowledge_items(knowledge_id) ON DELETE CASCADE
);

-- User / Admin Feedback
CREATE TABLE IF NOT EXISTS case_feedback (
    feedback_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK(feedback_type IN ('thumbs_up', 'thumbs_down', 'resolved_confirmed', 'correction', 'reopen')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (case_id) REFERENCES support_cases(case_id) ON DELETE CASCADE
);

-- Shared Incidents
CREATE TABLE IF NOT EXISTS incidents (
    incident_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    symptom_cluster TEXT NOT NULL,
    verification_state TEXT NOT NULL DEFAULT 'suspected' CHECK(verification_state IN ('suspected', 'confirmed', 'rejected', 'resolved')),
    affected_case_count INTEGER NOT NULL DEFAULT 1,
    suspected_cause TEXT,
    resolution_notes TEXT,
    github_issue_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
);

-- Incident to Case Junction
CREATE TABLE IF NOT EXISTS incident_cases (
    incident_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    linked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (incident_id, case_id),
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES support_cases(case_id) ON DELETE CASCADE
);

-- GitHub Issue Linkages
CREATE TABLE IF NOT EXISTS github_links (
    link_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    issue_number INTEGER,
    issue_url TEXT,
    draft_title TEXT NOT NULL,
    draft_body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'created', 'rejected', 'failed')),
    created_by TEXT NOT NULL,
    approved_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at TEXT,
    FOREIGN KEY (case_id) REFERENCES support_cases(case_id) ON DELETE CASCADE
);

-- Security and Operational Audit Log
CREATE TABLE IF NOT EXISTS audit_events (
    event_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_guild_created ON audit_events(guild_id, created_at);

-- Schema Migrations Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Full-Text Search (FTS5) for Knowledge Items
CREATE VIRTUAL TABLE IF NOT EXISTS fts_knowledge USING fts5(
    knowledge_id UNINDEXED,
    guild_id UNINDEXED,
    question_patterns,
    canonical_answer,
    applies_when
);

-- Full-Text Search (FTS5) for Support Cases
CREATE VIRTUAL TABLE IF NOT EXISTS fts_cases USING fts5(
    case_id UNINDEXED,
    guild_id UNINDEXED,
    title,
    summary
);
