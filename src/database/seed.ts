/**
 * Synthetic Demo Data Seeder for ThreadSherpa
 * Populates a local development or demo environment with realistic, synthetic support scenarios.
 */

import { createDatabase, closeDatabase } from './connection.js';
import { runMigrations } from './migrator.js';
import { GuildConfigRepository } from './repositories/guild-config.repo.js';
import { CaseRepository } from './repositories/case.repo.js';
import { EvidenceRepository } from './repositories/evidence.repo.js';
import { KnowledgeRepository } from './repositories/knowledge.repo.js';
import { IncidentRepository } from './repositories/incident.repo.js';
import { GitHubRepository } from './repositories/github.repo.js';
import { AuditRepository } from './repositories/audit.repo.js';
import { logger } from '../utils/logger.js';

export function seedDemoData(dbPath?: string) {
  logger.info({ dbPath: dbPath || 'default' }, 'Seeding synthetic ThreadSherpa demo dataset...');

  const db = createDatabase({ path: dbPath });
  runMigrations(db);

  const guildRepo = new GuildConfigRepository(db);
  const caseRepo = new CaseRepository(db);
  const evidenceRepo = new EvidenceRepository(db);
  const knowledgeRepo = new KnowledgeRepository(db);
  const incidentRepo = new IncidentRepository(db);
  const githubRepo = new GitHubRepository(db);
  const auditRepo = new AuditRepository(db);

  const demoGuildId = 'guild_dev_community';
  const supportChannelId = '112233445566778899';
  const adminRoleId = '998877665544332211';

  // 1. Guild Configuration
  guildRepo.upsert({
    guild_id: demoGuildId,
    autonomy_mode: 'supervised',
    support_channel_ids: [supportChannelId],
    admin_role_ids: [adminRoleId],
    allowed_domains: ['nodejs.org', 'docs.github.com', 'developer.mozilla.org'],
    connected_repos: ['sea-deep/threadsherpa'],
    retention_days: 90,
    require_response_approval: false,
  });

  // 2. Approved Knowledge: Node 26 SQLite Built-in
  const approvedItem1 = knowledgeRepo.createCandidate({
    knowledge_id: 'know_demo_node26_sqlite',
    guild_id: demoGuildId,
    question_patterns: [
      'How to fix sqlite native compilation error on Node 26',
      'better-sqlite3 fails with GetPrototype error on Node 26',
      'node-gyp rebuild error on node 26',
    ],
    canonical_answer: 'Node.js 26 includes a built-in synchronous SQLite module: import { DatabaseSync } from "node:sqlite". Avoid native C++ addons like better-sqlite3 on Node 26 as V8 C++ API changes cause compilation errors.',
    applies_when: 'Node.js version 26+',
    does_not_apply_when: 'Node.js 20 or 22 LTS',
    authority: 'approved_admin',
    source_refs: ['https://nodejs.org/api/sqlite.html'],
    embedding: [0.88, 0.12, 0.05, 0.3],
    created_by: 'admin_lead',
  });
  knowledgeRepo.approve(approvedItem1.knowledge_id, 'admin_lead', 'Verified on Node 26');

  // 3. Approved Knowledge: Hackathon Points Sync
  const approvedItem2 = knowledgeRepo.createCandidate({
    knowledge_id: 'know_demo_points_sync',
    guild_id: demoGuildId,
    question_patterns: [
      'When do DEV challenge hackathon points update?',
      'Why are my hackathon submission points not showing on profile?',
    ],
    canonical_answer: 'Challenge points update periodically in batches every 60 minutes after automatic verification. If points do not appear after 2 hours, verify your DEV profile username matches your submission.',
    applies_when: 'Active DEV community challenges and MLH events',
    authority: 'maintainer',
    source_refs: ['https://dev.to/challenges'],
    embedding: [0.1, 0.85, 0.2, 0.0],
    created_by: 'admin_lead',
  });
  knowledgeRepo.approve(approvedItem2.knowledge_id, 'admin_lead');

  // 4. Pending Candidate Awaiting Admin Review
  knowledgeRepo.createCandidate({
    knowledge_id: 'know_demo_pending_cors',
    guild_id: demoGuildId,
    question_patterns: ['How to allow CORS in Discord bot webhooks'],
    canonical_answer: 'Set Access-Control-Allow-Origin: * on proxy endpoints before forwarding payload.',
    applies_when: 'Self-hosted webhook proxies',
    authority: 'community_lead',
    created_by: 'dev_member',
  });

  // 5. Rejected Candidate (Proves rejected advice is blocked from retrieval)
  const rejected = knowledgeRepo.createCandidate({
    knowledge_id: 'know_demo_rejected_insecure',
    guild_id: demoGuildId,
    question_patterns: ['How to skip all discord authentication checks'],
    canonical_answer: 'Hardcode bot token in frontend client code with public visibility.',
    authority: 'community_lead',
    created_by: 'untrusted_user',
  });
  knowledgeRepo.reject(rejected.knowledge_id, 'admin_lead', 'High security risk: leaks credentials');

  // 6. Conflicting Knowledge Scenario (Flagged for Review)
  knowledgeRepo.createCandidate({
    knowledge_id: 'know_demo_conflict_auth1',
    guild_id: demoGuildId,
    question_patterns: ['Default session token timeout duration'],
    canonical_answer: 'Session tokens expire after 24 hours of inactivity.',
    authority: 'approved_admin',
    created_by: 'admin_alice',
  });
  knowledgeRepo.approve('know_demo_conflict_auth1', 'admin_alice');

  // 7. Synthetic Support Cases
  const resolvedCase = caseRepo.create({
    case_id: 'case_demo_resolved_01',
    guild_id: demoGuildId,
    channel_id: supportChannelId,
    message_id: 'msg_synth_1',
    requester_id: 'user_dev_sam',
    requester_username: 'sam_coder',
    category: 'install',
    title: 'better-sqlite3 compilation failed on macOS Node 26',
    status: 'resolved',
    summary: 'Resolved using native node:sqlite DatabaseSync',
    last_answer: 'Switched to built-in node:sqlite module successfully.',
    resolution_outcome: 'User confirmed solution resolved build',
  });

  evidenceRepo.add({
    evidence_id: 'ev_demo_1',
    case_id: resolvedCase.case_id,
    source_type: 'documentation',
    source_url: 'https://nodejs.org/api/sqlite.html',
    title: 'Node.js SQLite API',
    excerpt: 'DatabaseSync provides synchronous, in-process SQLite queries.',
    authority_score: 0.95,
    metadata: { verified: true },
  });

  // 8. Shared Incident (Symptom Clustering)
  const incCase1 = caseRepo.create({
    case_id: 'case_demo_cluster_1',
    guild_id: demoGuildId,
    channel_id: supportChannelId,
    message_id: 'msg_synth_2',
    requester_id: 'user_hacker_1',
    requester_username: 'hacker_one',
    category: 'points_sync',
    title: 'Points not syncing for DEV submission',
    status: 'investigating',
    summary: 'HTTP 503 received when verifying project submission points',
  });

  const incCase2 = caseRepo.create({
    case_id: 'case_demo_cluster_2',
    guild_id: demoGuildId,
    channel_id: supportChannelId,
    message_id: 'msg_synth_3',
    requester_id: 'user_hacker_2',
    requester_username: 'hacker_two',
    category: 'points_sync',
    title: '503 Service Unavailable on challenge points update',
    status: 'investigating',
    summary: 'Multiple participants seeing 503 error on points webhook',
  });

  const incident = incidentRepo.create({
    incident_id: 'inc_demo_points_503',
    guild_id: demoGuildId,
    title: 'DEV Challenge Points Webhook Degradation (HTTP 503)',
    symptom_cluster: 'points_sync_503',
    verification_state: 'confirmed',
    suspected_cause: 'Webhook queuing backlog under high hackathon submission volume',
  });

  incidentRepo.linkCase(incident.incident_id, incCase1.case_id);
  incidentRepo.linkCase(incident.incident_id, incCase2.case_id);

  // 9. GitHub Issue Draft Ready for Admin Creation
  githubRepo.createDraft({
    link_id: 'gh_draft_demo_01',
    case_id: resolvedCase.case_id,
    repo_owner: 'sea-deep',
    repo_name: 'threadsherpa',
    draft_title: 'Document node:sqlite migration for Node.js 26 environments',
    draft_body: '## Description\nNode.js 26 introduces breaking C++ changes for better-sqlite3.\nDocument native node:sqlite usage in README and setup guides.\n\n### Related Cases\n- `case_demo_resolved_01`',
    created_by: 'admin_lead',
  });

  // 10. Audit Events
  auditRepo.log({
    guild_id: demoGuildId,
    actor_id: 'admin_lead',
    action: 'guild_initialized',
    target_type: 'guild_config',
    target_id: demoGuildId,
    metadata: { demo: true },
  });

  logger.info('Synthetic demo seed completed successfully! Database is ready for exploration.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDemoData();
  closeDatabase();
}
