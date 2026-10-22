import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDatabase, closeDatabase } from '../../src/database/connection.js';
import { clearMemoryDatabases } from '../../src/database/memory-db.js';
import { GuildConfigRepository } from '../../src/database/repositories/guild-config.repo.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { EvidenceRepository } from '../../src/database/repositories/evidence.repo.js';
import { KnowledgeRepository } from '../../src/database/repositories/knowledge.repo.js';
import { IncidentRepository } from '../../src/database/repositories/incident.repo.js';
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';
import { GitHubRepository } from '../../src/database/repositories/github.repo.js';
import { OllamaProvider } from '../../src/integrations/model/ollama.provider.js';
import { SafeFetcher } from '../../src/integrations/web/safe-fetcher.js';
import { GitHubClient } from '../../src/integrations/github/github.client.js';
import { MemoryRetriever } from '../../src/memory/retriever.js';
import { LearningPipeline } from '../../src/memory/learner.js';
import { ToolRegistry } from '../../src/agent/tools.js';
import { AgentOrchestrator } from '../../src/agent/orchestrator.js';

describe('INDISPENSABLE E2E RELEASE GATE: Learn -> Approve -> Persist -> Restart -> Recall (MongoDB)', () => {
  const e2eUri = 'memory://test_e2e_threadsherpa_mongo';
  const guildId = 'guild_enterprise_support';
  const supportChannelId = 'chan_tech_support';
  const adminId = 'admin_sarah';

  const modelProvider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'gemma4:e4b-it-qat',
    embeddingModel: 'embeddinggemma-2:270m',
  });

  beforeAll(() => {
    clearMemoryDatabases();
  });

  afterAll(async () => {
    await closeDatabase();
    clearMemoryDatabases();
  });

  it('proves the complete human-trained memory loop survives a full system restart', async () => {
    // =========================================================================
    // STEP 1: INITIAL APPLICATION INSTANTIATION (SESSION 1)
    // =========================================================================
    let conn = await connectDatabase({ uri: e2eUri });
    let db = conn.db;

    let guildRepo = new GuildConfigRepository(db);
    let caseRepo = new CaseRepository(db);
    let evidenceRepo = new EvidenceRepository(db);
    let knowledgeRepo = new KnowledgeRepository(db);
    let incidentRepo = new IncidentRepository(db);
    let auditRepo = new AuditRepository(db);
    let githubRepo = new GitHubRepository(db);

    await guildRepo.upsert({
      guild_id: guildId,
      autonomy_mode: 'supervised',
      support_channel_ids: [supportChannelId],
      admin_role_ids: ['role_support_lead'],
      allowed_domains: ['nodejs.org', 'docs.github.com'],
      connected_repos: ['sea-deep/threadsherpa'],
    });

    let safeFetcher = new SafeFetcher(['nodejs.org', 'docs.github.com']);
    let githubClient = new GitHubClient();
    let memoryRetriever = new MemoryRetriever(knowledgeRepo, caseRepo, modelProvider);
    let learningPipeline = new LearningPipeline(knowledgeRepo, auditRepo, modelProvider);
    let toolRegistry = new ToolRegistry(memoryRetriever, safeFetcher, githubClient, caseRepo, evidenceRepo);

    let orchestrator = new AgentOrchestrator(
      caseRepo,
      evidenceRepo,
      guildRepo,
      toolRegistry,
      modelProvider,
      3,
      6
    );

    // =========================================================================
    // STEP 2: USER 1 ASKS INITIAL QUESTION A (NO KNOWLEDGE EXISTS YET)
    // =========================================================================
    const caseAId = 'case_001_node26_sqlite';
    await caseRepo.create({
      case_id: caseAId,
      guild_id: guildId,
      channel_id: supportChannelId,
      message_id: 'msg_question_a',
      requester_id: 'user_alice',
      requester_username: 'alice',
      category: 'install',
      title: 'How do I fix sqlite native build error on Node 26?',
      status: 'new',
      summary: 'node-gyp rebuild fails with C++ GetPrototype error',
    });

    // Orchestrator investigates (no approved knowledge present)
    const initialInvestigation = await orchestrator.investigateCase(caseAId);
    expect(initialInvestigation.policyResult).toBeDefined();

    // =========================================================================
    // STEP 3: SUPPORT ADMIN SUPPLIES VERIFIED HUMAN RESOLUTION
    // =========================================================================
    const adminMessage = 'On Node.js 26, native V8 bindings in older sqlite packages are broken. Do not use better-sqlite3; import { DatabaseSync } from "node:sqlite" instead which is natively built-in.';

    const candidateResult = await learningPipeline.proposeFromAdminMessage({
      guildId,
      channelId: supportChannelId,
      adminUserId: adminId,
      adminMessage,
      caseContext: {
        title: 'How do I fix sqlite native build error on Node 26?',
        originalQuestion: 'How do I fix sqlite native build error on Node 26?',
      },
    });

    expect(candidateResult.candidate.approval_status).toBe('candidate');
    expect(candidateResult.candidate.canonical_answer.toLowerCase()).toContain('node:sqlite');

    // =========================================================================
    // STEP 4: ADMIN APPROVES KNOWLEDGE CANDIDATE -> INDEXED AND COMMITTED
    // =========================================================================
    const approvedKnowledge = await learningPipeline.approveCandidate(
      candidateResult.candidate.knowledge_id,
      adminId,
      'Verified personally on macOS arm64 Node 26'
    );

    expect(approvedKnowledge).toBeDefined();
    expect(approvedKnowledge?.approval_status).toBe('approved');

    // Mark case A as resolved
    await caseRepo.updateStatus(caseAId, 'resolved', 'Resolved by admin knowledge');

    // =========================================================================
    // STEP 5: FULL APPLICATION REBOOT / RESTART
    // =========================================================================
    // Close the database and destroy all memory references to simulate a cold bot restart
    await closeDatabase();

    // Cold boot from persistent database
    conn = await connectDatabase({ uri: e2eUri });
    db = conn.db;

    guildRepo = new GuildConfigRepository(db);
    caseRepo = new CaseRepository(db);
    evidenceRepo = new EvidenceRepository(db);
    knowledgeRepo = new KnowledgeRepository(db);
    auditRepo = new AuditRepository(db);
    githubRepo = new GitHubRepository(db);

    memoryRetriever = new MemoryRetriever(knowledgeRepo, caseRepo, modelProvider);
    learningPipeline = new LearningPipeline(knowledgeRepo, auditRepo, modelProvider);
    toolRegistry = new ToolRegistry(memoryRetriever, safeFetcher, githubClient, caseRepo, evidenceRepo);

    orchestrator = new AgentOrchestrator(
      caseRepo,
      evidenceRepo,
      guildRepo,
      toolRegistry,
      modelProvider,
      3,
      6
    );

    // Verify knowledge survived restart
    const reloadedApproved = await knowledgeRepo.get(candidateResult.candidate.knowledge_id);
    expect(reloadedApproved).toBeDefined();
    expect(reloadedApproved?.approval_status).toBe('approved');
    expect(reloadedApproved?.canonical_answer.toLowerCase()).toContain('node:sqlite');

    // =========================================================================
    // STEP 6: USER 2 ASKS PARAPHRASED QUESTION B AFTER RESTART
    // =========================================================================
    const caseBId = 'case_002_paraphrased';
    await caseRepo.create({
      case_id: caseBId,
      guild_id: guildId,
      channel_id: supportChannelId,
      message_id: 'msg_question_b',
      requester_id: 'user_bob',
      requester_username: 'bob',
      category: 'install',
      title: 'C++ compilation failure when installing sqlite database in Node 26',
      status: 'new',
      summary: 'gyp rebuild failed with compiler errors',
    });

    // Orchestrator investigates Case B
    const resultB = await orchestrator.investigateCase(caseBId);

    // =========================================================================
    // STEP 7: VERIFY CORRECTED KNOWLEDGE IS RETRIEVED AND USED
    // =========================================================================
    expect(resultB.policyResult.allowed).toBe(true);
    expect(resultB.policyResult.action).toBe('respond');
    expect(resultB.policyResult.finalAnswer.toLowerCase()).toContain('node:sqlite');

    // Check case evidence in Case B contains the approved memory citation
    const caseBEvidence = await evidenceRepo.getByCaseId(caseBId);
    expect(caseBEvidence.length).toBeGreaterThan(0);
    const memoryEvidence = caseBEvidence.find(e => e.source_type === 'memory');
    expect(memoryEvidence).toBeDefined();
    expect(memoryEvidence?.excerpt.toLowerCase()).toContain('node:sqlite');

    // =========================================================================
    // STEP 8: VERIFY SUPERSEDED / REJECTED STATUS DOES NOT POLLUTE FUTURE SEARCH
    // =========================================================================
    // Create a bad candidate and reject it
    const badCandidate = await knowledgeRepo.createCandidate({
      knowledge_id: 'know_wrong_workaround',
      guild_id: guildId,
      question_patterns: ['disable compiler warnings'],
      canonical_answer: 'Run --force --ignore-scripts on everything',
      created_by: 'intern',
    });
    await learningPipeline.rejectCandidate(badCandidate.knowledge_id, adminId, 'Dangerous advice');

    const searchAfterReject = await knowledgeRepo.searchLexical(guildId, 'disable compiler warnings');
    expect(searchAfterReject.some(k => k.knowledge_id === 'know_wrong_workaround')).toBe(false);

    await closeDatabase();
  }, 180000);
});
