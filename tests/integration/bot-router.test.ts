import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Db } from 'mongodb';
import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  Message,
  PermissionsBitField,
} from 'discord.js';
import { connectDatabase, closeDatabase } from '../../src/database/connection.js';
import { clearMemoryDatabases } from '../../src/database/memory-db.js';
import { GuildConfigRepository } from '../../src/database/repositories/guild-config.repo.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { EvidenceRepository } from '../../src/database/repositories/evidence.repo.js';
import { KnowledgeRepository } from '../../src/database/repositories/knowledge.repo.js';
import { IncidentRepository } from '../../src/database/repositories/incident.repo.js';
import { GitHubRepository } from '../../src/database/repositories/github.repo.js';
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';
import { ModelProvider } from '../../src/integrations/model/model-provider.interface.js';
import { SafeFetcher } from '../../src/integrations/web/safe-fetcher.js';
import { GitHubClient } from '../../src/integrations/github/github.client.js';
import { MemoryRetriever } from '../../src/memory/retriever.js';
import { LearningPipeline } from '../../src/memory/learner.js';
import { ToolRegistry } from '../../src/agent/tools.js';
import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { GitHubCopilot } from '../../src/agent/github-copilot.js';
import { IncidentDetector } from '../../src/agent/incident-detector.js';
import { BotInteractionRouter } from '../../src/bot/handlers/router.js';

describe('BotInteractionRouter & Discord Gateway Integration (MongoDB)', () => {
  let db: Db;
  let guildRepo: GuildConfigRepository;
  let caseRepo: CaseRepository;
  let evidenceRepo: EvidenceRepository;
  let knowledgeRepo: KnowledgeRepository;
  let incidentRepo: IncidentRepository;
  let githubRepo: GitHubRepository;
  let auditRepo: AuditRepository;
  let router: BotInteractionRouter;
  let learningPipeline: LearningPipeline;

  const guildId = 'guild_router_test';
  const supportChannelId = 'chan_support_router';
  const adminUserId = 'admin_alex';

  const mockModelProvider: ModelProvider = {
    generateText: vi.fn(),
    generateStructured: vi.fn().mockImplementation(async ({ schemaName }) => {
      if (schemaName === 'KnowledgeCandidateExtraction') {
        return {
          question_patterns: ['How to handle rate limits in Discord bot'],
          canonical_answer: 'Implement exponential backoff with jitter on HTTP 429.',
          applies_when: 'All Discord bot API calls',
          does_not_apply_when: null,
          authority: 'approved_admin',
          change_reason: 'Admin verified best practice',
        };
      }
      if (schemaName === 'InvestigationPlan') {
        return {
          initial_assessment: 'Investigating Discord 429 rate limit issue',
          missing_facts: [],
          planned_actions: [
            { tool: 'search_knowledge', args: { query: 'Discord rate limit' }, rationale: 'Check knowledge' },
          ],
        };
      }
      return {
        can_answer_confidently: true,
        answer: 'Use exponential backoff when encountering rate limits.',
        citations: [],
        requires_clarification: false,
        clarification_question: null,
        escalate_to_human: false,
        escalation_reason: null,
      };
    }),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.05)),
    healthCheck: vi.fn().mockResolvedValue({ ok: true, models: [], selectedModelAvailable: true, embeddingModelAvailable: true }),
  };

  beforeEach(async () => {
    clearMemoryDatabases();
    const conn = await connectDatabase({ inMemory: true });
    db = conn.db;

    guildRepo = new GuildConfigRepository(db);
    caseRepo = new CaseRepository(db);
    evidenceRepo = new EvidenceRepository(db);
    knowledgeRepo = new KnowledgeRepository(db);
    incidentRepo = new IncidentRepository(db);
    githubRepo = new GitHubRepository(db);
    auditRepo = new AuditRepository(db);

    await guildRepo.upsert({
      guild_id: guildId,
      autonomy_mode: 'supervised',
      support_channel_ids: [supportChannelId],
      admin_role_ids: ['role_support_lead'],
      allowed_domains: ['discord.com'],
      connected_repos: ['sea-deep/threadsherpa'],
    });

    const safeFetcher = new SafeFetcher(['discord.com']);
    const githubClient = new GitHubClient();
    const memoryRetriever = new MemoryRetriever(knowledgeRepo, caseRepo, mockModelProvider);
    learningPipeline = new LearningPipeline(knowledgeRepo, auditRepo, mockModelProvider);
    const toolRegistry = new ToolRegistry(memoryRetriever, safeFetcher, githubClient, caseRepo, evidenceRepo);

    const orchestrator = new AgentOrchestrator(
      caseRepo,
      evidenceRepo,
      guildRepo,
      toolRegistry,
      mockModelProvider,
      3,
      6
    );

    const githubCopilot = new GitHubCopilot(
      caseRepo,
      evidenceRepo,
      githubRepo,
      guildRepo,
      auditRepo,
      githubClient,
      mockModelProvider
    );

    const incidentDetector = new IncidentDetector(caseRepo, incidentRepo, auditRepo);

    router = new BotInteractionRouter(
      guildRepo,
      caseRepo,
      evidenceRepo,
      knowledgeRepo,
      orchestrator,
      learningPipeline,
      githubCopilot,
      incidentDetector
    );
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('handles /setup command and updates server configuration', async () => {
    const replyMock = vi.fn();
    const interaction = {
      guildId,
      channelId: supportChannelId,
      commandName: 'setup',
      user: { id: adminUserId, username: 'alex', tag: 'alex#0001' },
      member: {
        permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator),
        roles: { cache: new Map() },
      },
      options: {
        getChannel: vi.fn((name: string) => {
          if (name === 'channel') return { id: 'chan_new_support' };
          return null;
        }),
        getRole: vi.fn().mockReturnValue({ id: 'role_new_admin' }),
        getString: vi.fn((name: string) => {
          if (name === 'allowed_domain') return 'api.github.com';
          if (name === 'repo') return 'facebook/react';
          if (name === 'autonomy_mode') return 'auto';
          return null;
        }),
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await router.handleCommand(interaction);

    expect(replyMock).toHaveBeenCalled();
    const config = await guildRepo.get(guildId);
    expect(config?.support_channel_ids).toContain('chan_new_support');
    expect(config?.admin_role_ids).toContain('role_new_admin');
    expect(config?.allowed_domains).toContain('api.github.com');
    expect(config?.connected_repos).toContain('facebook/react');
    expect(config?.autonomy_mode).toBe('auto');
  });

  it('handles /ask command, creates case, and returns embed response', async () => {
    const deferReplyMock = vi.fn();
    const editReplyMock = vi.fn();

    const interaction = {
      guildId,
      channelId: supportChannelId,
      id: 'msg_ask_interaction',
      commandName: 'ask',
      user: { id: 'user_david', username: 'david', tag: 'david#0002' },
      member: {
        permissions: new PermissionsBitField(),
        roles: { cache: new Map() },
      },
      options: {
        getString: vi.fn().mockReturnValue('How to handle rate limits in Discord bot'),
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    } as unknown as ChatInputCommandInteraction;

    await router.handleCommand(interaction);

    expect(deferReplyMock).toHaveBeenCalled();
    expect(editReplyMock).toHaveBeenCalled();

    // Verify support case was created in MongoDB
    const activeCase = await caseRepo.findActiveCase(supportChannelId);
    expect(activeCase).toBeDefined();
    expect(activeCase?.requester_id).toBe('user_david');
    expect(['answered', 'awaiting_user']).toContain(activeCase?.status);
  });

  it('handles /teach command and creates candidate review card', async () => {
    const deferReplyMock = vi.fn();
    const editReplyMock = vi.fn();

    const interaction = {
      guildId,
      channelId: supportChannelId,
      commandName: 'teach',
      user: { id: adminUserId, username: 'alex', tag: 'alex#0001' },
      member: {
        permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator),
        roles: { cache: new Map() },
      },
      options: {
        getString: vi.fn((name: string) => {
          if (name === 'question') return 'How to fix 429 rate limit';
          if (name === 'solution') return 'Use exponential backoff with jitter on HTTP 429.';
          return null;
        }),
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    } as unknown as ChatInputCommandInteraction;

    await router.handleCommand(interaction);

    expect(deferReplyMock).toHaveBeenCalledWith({ ephemeral: true });
    expect(editReplyMock).toHaveBeenCalled();

    const pending = await knowledgeRepo.getPendingCandidates(guildId);
    expect(pending.length).toBe(1);
    expect(pending[0].canonical_answer).toContain('exponential backoff');
  });

  it('handles button clicks for approving and rejecting knowledge candidates', async () => {
    // Propose candidate
    const candidate = await knowledgeRepo.createCandidate({
      knowledge_id: 'know_btn_test',
      guild_id: guildId,
      question_patterns: ['Test question'],
      canonical_answer: 'Test answer',
      created_by: adminUserId,
    });

    const updateMock = vi.fn();
    const btnInteraction = {
      guildId,
      customId: `approve_know:${candidate.knowledge_id}`,
      user: { id: adminUserId, tag: 'alex#0001' },
      member: {
        permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator),
        roles: { cache: new Map() },
      },
      update: updateMock,
    } as unknown as ButtonInteraction;

    await router.handleButton(btnInteraction);

    expect(updateMock).toHaveBeenCalled();
    const approved = await knowledgeRepo.get('know_btn_test');
    expect(approved?.approval_status).toBe('approved');
  });

  it('triggers admin learning when an admin replies to an active case in a support channel', async () => {
    // Create open case
    await caseRepo.create({
      case_id: 'case_user_help',
      guild_id: guildId,
      channel_id: supportChannelId,
      message_id: 'msg_user_q',
      requester_id: 'user_norm',
      requester_username: 'norm',
      category: 'general',
      title: 'How do I avoid getting rate limited?',
      status: 'new',
    });

    const replyMock = vi.fn();
    const adminMsg = {
      guildId,
      channelId: supportChannelId,
      content: 'Always add exponential backoff when catching DiscordAPIError 429.',
      author: { id: adminUserId, bot: false, tag: 'alex#0001' },
      system: false,
      channel: { isThread: () => false, parentId: null },
      member: {
        permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator),
        roles: { cache: new Map() },
      },
      reply: replyMock,
    } as unknown as Message;

    await router.handleMessage(adminMsg);

    expect(replyMock).toHaveBeenCalled();
    const pending = await knowledgeRepo.getPendingCandidates(guildId);
    expect(pending.length).toBe(1);
    expect(pending[0].canonical_answer).toContain('exponential backoff');
  });

  it('ignores messages in channels before one-time setup designates them as support channels', async () => {
    const unconfiguredChannelId = 'chan_general_chat';
    const replyMock = vi.fn();
    const msg = {
      guildId,
      channelId: unconfiguredChannelId,
      content: 'Can someone help me with my database connection?',
      author: { id: 'user_rando', bot: false, username: 'rando', tag: 'rando#1234' },
      system: false,
      channel: { isThread: () => false, parentId: null },
      member: {
        permissions: new PermissionsBitField(),
        roles: { cache: new Map() },
      },
      reply: replyMock,
    } as unknown as Message;

    await router.handleMessage(msg);

    // Should not reply and should not create any support case
    expect(replyMock).not.toHaveBeenCalled();
    const activeCase = await caseRepo.findActiveCase(unconfiguredChannelId);
    expect(activeCase).toBeNull();
  });

  it('scans and responds to new forum posts and threads inside configured channels', async () => {
    const forumChannelId = 'forum_troubleshooting';
    // Add forum to configured support channels
    await guildRepo.upsert({
      guild_id: guildId,
      support_channel_ids: [supportChannelId, forumChannelId],
    });

    const threadSendMock = vi.fn().mockResolvedValue(true);
    const forumThread = {
      id: 'thread_forum_post_1',
      guildId,
      parentId: forumChannelId,
      name: 'V8 compilation failure with node 26',
      ownerId: 'user_coder',
      fetchStarterMessage: vi.fn().mockResolvedValue({
        id: 'msg_starter_1',
        content: 'I get C++ syntax errors when running npm install better-sqlite3 on Node 26',
        author: { id: 'user_coder', username: 'coder' },
      }),
      send: threadSendMock,
    } as any;

    await router.handleThreadCreate(forumThread);

    expect(threadSendMock).toHaveBeenCalled();
    const createdCase = await caseRepo.getByThreadId('thread_forum_post_1');
    expect(createdCase).toBeDefined();
    expect(createdCase?.title).toBe('V8 compilation failure with node 26');
    expect(createdCase?.summary).toContain('better-sqlite3');
  });

  it('updates case context when user provides follow-up logs in an active thread', async () => {
    const activeThreadId = 'thread_user_context_test';
    const initialCase = await caseRepo.create({
      case_id: 'case_context_tracking',
      guild_id: guildId,
      channel_id: supportChannelId,
      thread_id: activeThreadId,
      message_id: 'msg_init',
      requester_id: 'user_dev',
      requester_username: 'dev',
      category: 'general',
      title: 'Port collision error',
      status: 'awaiting_user',
      summary: 'Port 3000 is already in use',
    });

    const reactMock = vi.fn().mockResolvedValue(true);
    const replyMock = vi.fn();
    const followUpMsg = {
      guildId,
      channelId: activeThreadId,
      content: 'Here is lsof output: node process 5821 is occupying port 3000',
      author: { id: 'user_dev', bot: false, username: 'dev', tag: 'dev#0001' },
      system: false,
      channel: { isThread: () => true, parentId: supportChannelId },
      member: {
        permissions: new PermissionsBitField(),
        roles: { cache: new Map() },
      },
      react: reactMock,
      reply: replyMock,
      url: 'https://discord.com/channels/123/456/789',
    } as unknown as Message;

    await router.handleMessage(followUpMsg);

    // Verify context was appended to case summary
    const updated = await caseRepo.get(initialCase.case_id);
    expect(updated?.summary).toContain('lsof output');
    expect(updated?.summary).toContain('node process 5821');

    // Verify evidence record was appended
    const evidenceList = await evidenceRepo.getByCaseId(initialCase.case_id);
    const contextEv = evidenceList.find(e => e.source_type === 'discord_message' && e.metadata?.subtype === 'user_context');
    expect(contextEv).toBeDefined();
    expect(contextEv?.excerpt).toContain('node process 5821');
    expect(reactMock).toHaveBeenCalledWith('📝');
  });

  it('allows manual context updates via /case update_context', async () => {
    const c = await caseRepo.create({
      case_id: 'case_manual_update',
      guild_id: guildId,
      channel_id: supportChannelId,
      message_id: 'msg_manual',
      requester_id: 'user_mark',
      requester_username: 'mark',
      category: 'general',
      title: 'Intermittent 502 bad gateway',
      status: 'new',
      summary: 'Getting 502 on nginx',
    });

    const replyMock = vi.fn();
    const interaction = {
      guildId,
      channelId: supportChannelId,
      commandName: 'case',
      user: { id: 'user_mark', username: 'mark', tag: 'mark#0003' },
      channel: { isThread: () => false, parentId: null },
      options: {
        getString: vi.fn((name: string) => {
          if (name === 'case_id') return c.case_id;
          if (name === 'update_context') return 'Found out backend service was OOM killed by kernel';
          return null;
        }),
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await router.handleCommand(interaction);

    expect(replyMock).toHaveBeenCalled();
    const updated = await caseRepo.get(c.case_id);
    expect(updated?.summary).toContain('OOM killed by kernel');
  });
});
