import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Db } from 'mongodb';
import { connectDatabase, closeDatabase } from '../../src/database/connection.js';
import { GuildConfigRepository } from '../../src/database/repositories/guild-config.repo.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { EvidenceRepository } from '../../src/database/repositories/evidence.repo.js';
import { KnowledgeRepository } from '../../src/database/repositories/knowledge.repo.js';
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';

describe('Data Repositories & State Machine (MongoDB)', () => {
  let db: Db;
  let guildRepo: GuildConfigRepository;
  let caseRepo: CaseRepository;
  let evidenceRepo: EvidenceRepository;
  let knowledgeRepo: KnowledgeRepository;
  let auditRepo: AuditRepository;

  beforeEach(async () => {
    const conn = await connectDatabase({ inMemory: true });
    db = conn.db;

    guildRepo = new GuildConfigRepository(db);
    caseRepo = new CaseRepository(db);
    evidenceRepo = new EvidenceRepository(db);
    knowledgeRepo = new KnowledgeRepository(db);
    auditRepo = new AuditRepository(db);

    // Setup test guild
    await guildRepo.upsert({
      guild_id: 'guild_123',
      autonomy_mode: 'supervised',
      admin_role_ids: ['role_admin'],
      support_channel_ids: ['chan_support'],
    });
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('GuildConfigRepository', () => {
    it('retrieves and checks support channel and admin roles', async () => {
      expect(await guildRepo.isSupportChannel('guild_123', 'chan_support')).toBe(true);
      expect(await guildRepo.isSupportChannel('guild_123', 'chan_general')).toBe(false);
      expect(await guildRepo.isAdmin('guild_123', ['role_admin'])).toBe(true);
      expect(await guildRepo.isAdmin('guild_123', ['role_user'])).toBe(false);
    });
  });

  describe('CaseRepository & State Transitions', () => {
    it('creates and updates a case with full state transitions', async () => {
      const created = await caseRepo.create({
        case_id: 'case_001',
        guild_id: 'guild_123',
        channel_id: 'chan_support',
        message_id: 'msg_001',
        requester_id: 'user_1',
        requester_username: 'alice',
        category: 'install',
        title: 'Cannot install dependencies on Node 26',
        status: 'new',
        summary: 'Error installing native bindings',
      });

      expect(created.status).toBe('new');

      // Transition to investigating
      const investigating = await caseRepo.updateStatus('case_001', 'investigating');
      expect(investigating?.status).toBe('investigating');

      // Transition to answered
      const answered = await caseRepo.updateStatus('case_001', 'answered', 'Provided workaround');
      expect(answered?.status).toBe('answered');

      // Transition to resolved
      const resolved = await caseRepo.updateStatus('case_001', 'resolved', 'User confirmed fix');
      expect(resolved?.status).toBe('resolved');
      expect(resolved?.resolved_at).toBeTruthy();

      // Reopening case
      const reopened = await caseRepo.reopen('case_001', 'Error still happens on Windows');
      expect(reopened?.status).toBe('reopened');
      expect(reopened?.reopen_count).toBe(1);
    });

    it('searches cases via full-text search', async () => {
      await caseRepo.create({
        case_id: 'case_101',
        guild_id: 'guild_123',
        channel_id: 'chan_support',
        message_id: 'msg_101',
        requester_id: 'user_2',
        requester_username: 'bob',
        category: 'auth',
        title: 'OAuth callback 401 unauthorized',
        status: 'new',
        summary: 'Discord oauth token renewal failed',
      });

      const results = await caseRepo.searchSimilarCases('guild_123', 'OAuth token');
      expect(results.length).toBe(1);
      expect(results[0].case_id).toBe('case_101');
    });
  });

  describe('KnowledgeRepository — Lifecycle, Versioning, and Hybrid Retrieval', () => {
    it('creates candidate, approves it, and makes it retrievable', async () => {
      const candidate = await knowledgeRepo.createCandidate({
        knowledge_id: 'know_001',
        guild_id: 'guild_123',
        question_patterns: ['How do I fix sqlite native build error?', 'node-gyp rebuild failed'],
        canonical_answer: 'Use node:sqlite built into Node.js 26 instead of native addons.',
        applies_when: 'Node.js 26+ environment',
        created_by: 'admin_1',
        embedding: [0.9, 0.1, 0.0],
      });

      expect(candidate.approval_status).toBe('candidate');

      // Not retrievable yet because it is only a candidate
      const beforeApproval = await knowledgeRepo.searchLexical('guild_123', 'sqlite build error');
      expect(beforeApproval.length).toBe(0);

      // Approve candidate
      const approved = await knowledgeRepo.approve('know_001', 'admin_1', 'Verified on Node 26');
      expect(approved?.approval_status).toBe('approved');

      // Now retrievable via lexical search
      const afterApproval = await knowledgeRepo.searchLexical('guild_123', 'sqlite build');
      expect(afterApproval.length).toBe(1);
      expect(afterApproval[0].canonical_answer).toContain('node:sqlite');

      // Retrievable via vector search
      const vectorResults = await knowledgeRepo.searchVector('guild_123', [0.85, 0.15, 0.0], 5, 0.8);
      expect(vectorResults.length).toBe(1);
      expect(vectorResults[0].knowledge_id).toBe('know_001');

      // Retrievable via hybrid search
      const hybridResults = await knowledgeRepo.searchHybrid('guild_123', 'sqlite build', [0.85, 0.15, 0.0]);
      expect(hybridResults.length).toBe(1);
      expect(hybridResults[0].retrieval_method).toBe('hybrid');
    });

    it('handles correction and superseding with version tracking', async () => {
      await knowledgeRepo.createCandidate({
        knowledge_id: 'know_002',
        guild_id: 'guild_123',
        question_patterns: ['How to reset password'],
        canonical_answer: 'Click forgot password on web.',
        created_by: 'admin_1',
      });
      await knowledgeRepo.approve('know_002', 'admin_1');

      // Now correct and supersede
      const updated = await knowledgeRepo.correctAndSupersede(
        'know_002',
        {
          canonical_answer: 'Use /reset-password command in Discord directly.',
          change_reason: 'Updated auth flow in v2',
        },
        'admin_2'
      );

      expect(updated?.current_version).toBe(2);
      expect(updated?.canonical_answer).toBe('Use /reset-password command in Discord directly.');

      // Check version history
      const versions = await knowledgeRepo.getVersions('know_002');
      expect(versions.length).toBe(2);
      expect(versions[0].version).toBe(2);
      expect(versions[0].approval_state).toBe('approved');
      expect(versions[1].version).toBe(1);
      expect(versions[1].approval_state).toBe('superseded');
    });

    it('enforces server isolation so other guilds cannot retrieve knowledge', async () => {
      await knowledgeRepo.createCandidate({
        knowledge_id: 'know_guild1',
        guild_id: 'guild_123',
        question_patterns: ['Internal secret key procedure'],
        canonical_answer: 'Internal doc for guild 123 only.',
        created_by: 'admin_1',
      });
      await knowledgeRepo.approve('know_guild1', 'admin_1');

      // Guild 999 searches
      const searchOtherGuild = await knowledgeRepo.searchLexical('guild_999', 'Internal secret key');
      expect(searchOtherGuild.length).toBe(0);
    });

    it('rejects candidate and prevents retrieval', async () => {
      await knowledgeRepo.createCandidate({
        knowledge_id: 'know_bad',
        guild_id: 'guild_123',
        question_patterns: ['Disable all firewalls'],
        canonical_answer: 'Run sudo rm -rf /',
        created_by: 'hacker',
      });

      await knowledgeRepo.reject('know_bad', 'admin_1', 'Dangerous instruction');
      const item = await knowledgeRepo.get('know_bad');
      expect(item?.approval_status).toBe('rejected');

      const lexical = await knowledgeRepo.searchLexical('guild_123', 'Disable firewalls');
      expect(lexical.length).toBe(0);
    });
  });

});
