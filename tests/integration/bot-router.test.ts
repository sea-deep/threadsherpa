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
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';
import { ModelProvider } from '../../src/integrations/model/model-provider.interface.js';
import { SafeFetcher } from '../../src/integrations/web/safe-fetcher.js';
import { MemoryRetriever } from '../../src/memory/retriever.js';
import { LearningPipeline } from '../../src/memory/learner.js';
import { ToolRegistry } from '../../src/agent/tools.js';
import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { BotInteractionRouter } from '../../src/bot/handlers/router.js';

describe('BotInteractionRouter & Discord Gateway Integration (MongoDB)', () => {
  let db: Db;
  let guildRepo: GuildConfigRepository;
  let caseRepo: CaseRepository;
  let evidenceRepo: EvidenceRepository;
  let knowledgeRepo: KnowledgeRepository;
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
    auditRepo = new AuditRepository(db);

    await guildRepo.upsert({
      guild_id: guildId,
      autonomy_mode: 'supervised',
      support_channel_ids: [supportChannelId],
      admin_role_ids: ['role_support_lead'],
      allowed_domains: ['discord.com'],
      documentation_urls: [],
    });

    const safeFetcher = new SafeFetcher(['discord.com']);
    const memoryRetriever = new MemoryRetriever(knowledgeRepo, caseRepo, mockModelProvider);
    learningPipeline = new LearningPipeline(knowledgeRepo, auditRepo, mockModelProvider);
    const toolRegistry = new ToolRegistry(memoryRetriever, safeFetcher, caseRepo, evidenceRepo);

    const orchestrator = new AgentOrchestrator(
      caseRepo,
      evidenceRepo,
      guildRepo,
      toolRegistry,
      mockModelProvider,
      3,
      6
    );

    router = new BotInteractionRouter(
      guildRepo,
      caseRepo,
      evidenceRepo,
      knowledgeRepo,
      orchestrator,
      learningPipeline
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
          if (name === 'source_url') return 'https://docs.discord.com/developers/intro';
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
    expect(config?.allowed_domains).toContain('docs.discord.com');
    expect(config?.documentation_urls).toContain('https://docs.discord.com/developers/intro');
    expect(config?.autonomy_mode).toBe('auto');
  });

  it('handles /ask command, creates case, and returns embed response', async () => {
    const deferReplyMock = vi.fn();
    const editReplyMock = vi.fn();

    const interaction = {
      guildId,
      channelId: supportChannelId,
      id: 'msg_ask_interaction',
      fetchReply: vi.fn().mockResolvedValue({ id: 'actual-reply-message' }),
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
    expect(activeCase?.message_id).toBe('actual-reply-message');
    expect(['answered', 'awaiting_user', 'awaiting_admin']).toContain(activeCase?.status);
  });

  it('saves /teach immediately without a second review', async () => {
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

    const pending = await knowledgeRepo.getApproved(guildId);
    expect(pending.length).toBe(1);
    expect(await knowledgeRepo.getPendingCandidates(guildId)).toHaveLength(0);
    expect(editReplyMock).toHaveBeenCalledWith({ content: 'Saved.' });
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
      editReply: updateMock, deferUpdate: vi.fn(), followUp: vi.fn(),
    } as unknown as ButtonInteraction;

    await router.handleButton(btnInteraction);

    expect(updateMock).toHaveBeenCalled();
    const approved = await knowledgeRepo.get('know_btn_test');
    expect(approved?.approval_status).toBe('rejected');
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(1);
  });

  it('does not turn ordinary moderator conversation into saved answers', async () => {
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

    expect(replyMock).not.toHaveBeenCalled();
    expect(await knowledgeRepo.getPendingCandidates(guildId)).toHaveLength(0);
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
      autonomy_mode: 'auto',
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

    expect(threadSendMock).not.toHaveBeenCalled();
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
      channel: { id: activeThreadId, isThread: () => true, parentId: supportChannelId },
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
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('blocks an administrator in another server from approving this server’s answer', async () => {
    await knowledgeRepo.createCandidate({ knowledge_id: 'foreign', guild_id: 'other-server', question_patterns: ['Private question'], canonical_answer: 'Private answer', created_by: 'other-mod' });
    const reply = vi.fn();
    await router.handleButton({ guildId, customId: 'approve_know:foreign', user: { id: adminUserId },
      member: { permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator), roles: { cache: new Map() } }, reply } as any);
    expect((await knowledgeRepo.get('foreign'))?.approval_status).toBe('candidate');
    expect(reply).toHaveBeenCalled();
  });

  it('allows only the asker or moderator to mark a question solved', async () => {
    await caseRepo.create({ case_id: 'mine', guild_id: guildId, channel_id: supportChannelId, message_id: 'm', requester_id: 'asker', requester_username: 'asker', category: 'general', title: 'Question', status: 'answered' });
    const interaction = { guildId, customId: 'solve_case:mine', user: { id: 'stranger' },
      member: { permissions: new PermissionsBitField(), roles: { cache: new Map() } }, reply: vi.fn(), editReply: vi.fn(), deferUpdate: vi.fn() };
    await router.handleButton(interaction as any);
    expect((await caseRepo.get('mine'))?.status).toBe('answered');
    interaction.user.id = 'asker';
    await router.handleButton(interaction as any);
    expect((await caseRepo.get('mine'))?.status).toBe('resolved');
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('does not send unsolicited answers in supervised mode', async () => {
    const send = vi.fn();
    await router.handleThreadCreate({ id: 'quiet-thread', guildId, parentId: supportChannelId, ownerId: 'asker', name: 'Question',
      fetchStarterMessage: vi.fn().mockResolvedValue({ id: 'm', content: 'Question', author: { id: 'asker', username: 'asker' } }), send } as any);
    expect(send).not.toHaveBeenCalled();
  });

  it('uses the current channel on first setup without requiring IDs or a moderator role', async () => {
    const newGuild = 'brand-new-server';
    const interaction = { guildId: newGuild, channelId: 'first-support', commandName: 'setup',
      channel: { type: 0, isThread: () => false },
      user: { id: 'owner', tag: 'owner' },
      member: { permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator), roles: { cache: new Map() } },
      options: { getChannel: vi.fn().mockReturnValue(null), getRole: vi.fn().mockReturnValue(null), getString: vi.fn((key: string) => key === 'autonomy_mode' ? 'auto' : null) },
      reply: vi.fn() };
    await router.handleCommand(interaction as any);
    expect((await guildRepo.get(newGuild))?.support_channel_ids).toEqual(['first-support']);
    expect((await guildRepo.get(newGuild))?.autonomy_mode).toBe('auto');
    expect((await guildRepo.get(newGuild))?.admin_role_ids).toEqual([]);
  });

  it('does not add a channel as a side effect of only changing a moderator role', async () => {
    const newGuild = 'roles-only';
    const interaction = { guildId: newGuild, channelId: 'general', commandName: 'setup',
      channel: { type: 0, isThread: () => false }, user: { id: 'owner', tag: 'owner' },
      member: { permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator), roles: { cache: new Map() } },
      options: { getChannel: vi.fn().mockReturnValue(null), getRole: vi.fn().mockReturnValue({ id: 'mods' }), getString: vi.fn().mockReturnValue(null) }, reply: vi.fn() };
    await router.handleCommand(interaction as any);
    expect((await guildRepo.get(newGuild))?.support_channel_ids).toEqual([]);
  });

  it.each([
    { name: 'an empty forum selected from a text channel', guild: 'empty-forum-server', explicit: true },
    { name: 'the parent forum from inside its first post', guild: 'post-forum-server', explicit: false },
  ])('configures $name and monitors its future posts', async ({ guild, explicit }) => {
    const forumId = 'support-forum';
    const interaction = { guildId: guild, channelId: explicit ? 'bot-commands' : 'setup-post', commandName: 'setup',
      channel: explicit ? { type: 0, isThread: () => false } : { isThread: () => true, parentId: forumId },
      user: { id: 'owner', tag: 'owner' },
      member: { permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator), roles: { cache: new Map() } },
      options: { getChannel: vi.fn((key: string) => explicit && key === 'channel' ? { id: forumId, type: 15 } : null),
        getRole: vi.fn().mockReturnValue(null), getString: vi.fn((key: string) => key === 'autonomy_mode' ? 'auto' : null) }, reply: vi.fn() };
    await router.handleCommand(interaction as any);
    expect((await guildRepo.get(guild))?.support_channel_ids).toEqual([forumId]);
    expect(await guildRepo.isSupportChannel(guild, 'future-post', forumId)).toBe(true);
    expect(await guildRepo.isSupportChannel(guild, 'bot-commands')).toBe(false);
  });

  const moderator = { permissions: new PermissionsBitField(PermissionsBitField.Flags.Administrator), roles: { cache: new Map() } };
  it('saves the selected human answer verbatim with its precise message link and original question', async () => {
    await caseRepo.create({ case_id: 'origin', guild_id: guildId, channel_id: supportChannelId, thread_id: 'forum-post', message_id: 'question-message', requester_id: 'asker', requester_username: 'asker', category: 'question', title: 'Where is the event schedule?', status: 'awaiting_admin' });
    const interaction = { guildId, channelId: 'forum-post', commandName: 'Save this answer', member: moderator,
      user: { id: adminUserId }, channel: { id: 'forum-post', parentId: supportChannelId, isThread: () => true },
      targetMessage: { id: 'answer-message', content: '  The schedule is pinned in #announcements.\nUse Discord timestamps.\n', author: { bot: false }, url: 'https://discord.com/channels/server/forum-post/answer-message' },
      deferReply: vi.fn(), editReply: vi.fn(), reply: vi.fn() };
    await router.handleContextMenu(interaction as any);
    const [draft] = await knowledgeRepo.getApproved(guildId);
    expect(draft.canonical_answer).toBe(interaction.targetMessage.content);
    expect(draft.question_patterns[0]).toBe('Where is the event schedule?');
    expect(draft.source_refs).toEqual([interaction.targetMessage.url]);
    expect(draft.origin_case_id).toBe('origin');
    expect(draft.approval_status).toBe('approved');
    expect((await caseRepo.get('origin'))?.status).toBe('answered');
  });
  it('infers the question from a selected existing forum post that predates installation', async () => {
    const interaction = { guildId, channelId: 'old-post', commandName: 'Save this answer', member: moderator,
      user: { id: adminUserId }, channel: { id: 'old-post', parentId: supportChannelId, name: 'An older question', isThread: () => true,
        fetchStarterMessage: vi.fn().mockResolvedValue({ id: 'original', content: 'Original question body', author: { bot: false, id: 'asker', username: 'asker' } }) },
      targetMessage: { id: 'answer', content: 'The moderator’s original answer.', author: { bot: false }, url: 'https://discord.com/channels/server/old-post/answer' },
      deferReply: vi.fn(), editReply: vi.fn(), reply: vi.fn() };
    await router.handleContextMenu(interaction as any);
    expect((await caseRepo.getByThreadId('old-post'))?.message_id).toBe('original');
    expect((await knowledgeRepo.getApproved(guildId))[0].question_patterns[0]).toBe('An older question');
  });
  it('rejects bot-generated answers and unauthorized context-menu saves', async () => {
    const interaction = { guildId, commandName: 'Save this answer', member: moderator, user: { id: adminUserId },
      targetMessage: { content: 'A generated reply', author: { bot: true } }, reply: vi.fn() };
    await router.handleContextMenu(interaction as any);
    expect(await knowledgeRepo.getPendingCandidates(guildId)).toHaveLength(0);
    expect(interaction.reply).toHaveBeenCalled();
    interaction.member = { permissions: new PermissionsBitField(), roles: { cache: new Map() } };
    interaction.targetMessage.author.bot = false;
    await router.handleContextMenu(interaction as any);
    expect(await knowledgeRepo.getPendingCandidates(guildId)).toHaveLength(0);
  });
  it('lets moderators remove incorrect AI question variants without regenerating them', async () => {
    await knowledgeRepo.createCandidate({ knowledge_id: 'edit-me', guild_id: guildId, question_patterns: ['Schedule?', 'Incorrect suggested question'], canonical_answer: 'Check the announcements channel.', created_by: adminUserId });
    const interaction = { guildId, channelId: supportChannelId, customId: 'edit_draft:edit-me:v1', member: moderator,
      user: { id: adminUserId }, fields: { getTextInputValue: (field: string) => ({ question: 'Where is the schedule?', answer: 'Check the announcements channel.', scope: '', days: '7' })[field] },
      reply: vi.fn(), deferReply: vi.fn(), editReply: vi.fn() };
    await router.handleModal(interaction as any);
    const [draft] = await knowledgeRepo.getApproved(guildId);
    expect(draft.question_patterns).toEqual(['Where is the schedule?']);
    expect(draft.expires_at).toBeTruthy();
    expect((await knowledgeRepo.get('edit-me'))?.approval_status).toBe('rejected');
  });
  it('quietly queues unsupported text-channel questions without creating empty threads', async () => {
    await guildRepo.upsert({ guild_id: guildId, autonomy_mode: 'auto' });
    const message = { id: 'unanswered', guildId, channelId: supportChannelId, content: 'Where do I get a mystery certificate?',
      author: { id: 'asker', bot: false, username: 'asker' }, channel: { isThread: () => false }, reply: vi.fn(), startThread: vi.fn() };
    await router.handleMessage(message as any);
    expect((await caseRepo.getByMessageId('unanswered'))?.status).toBe('awaiting_admin');
    expect(message.reply).not.toHaveBeenCalled(); expect(message.startThread).not.toHaveBeenCalled();
  });

  it('quietly queues model failures for new forum posts, text questions, and follow-ups', async () => {
    await guildRepo.upsert({ guild_id: guildId, autonomy_mode: 'auto' });
    await knowledgeRepo.createCandidate({ knowledge_id: 'known-failure', guild_id: guildId, question_patterns: ['Where is the schedule?'], canonical_answer: 'The schedule is pinned in announcements.', created_by: adminUserId });
    await knowledgeRepo.approve('known-failure', adminUserId);
    const generate = vi.mocked(mockModelProvider.generateStructured);
    generate.mockRejectedValueOnce(new Error('Model timed out'));
    const send = vi.fn();
    await router.handleThreadCreate({ id: 'failed-post', guildId, parentId: supportChannelId, ownerId: 'asker', name: 'Where is the schedule?',
      fetchStarterMessage: vi.fn().mockResolvedValue({ id: 'failed-starter', content: 'Where is the schedule?', author: { id: 'asker', username: 'asker', bot: false } }), send } as any);
    const c = (await caseRepo.getByThreadId('failed-post'))!;
    expect(c.status).toBe('awaiting_admin');
    expect(send).not.toHaveBeenCalled();
    expect((await caseRepo.getInvestigationRuns(c.case_id))[0]).toMatchObject({ status: 'failed', error_message: 'Model timed out' });

    const reply = vi.fn();
    generate.mockRejectedValueOnce(new Error('Model timed out'));
    await router.handleMessage({ id: 'failed-text', guildId, channelId: supportChannelId, content: 'Where is the schedule?',
      author: { id: 'asker', username: 'asker', bot: false }, channel: { isThread: () => false }, reply } as any);
    expect((await caseRepo.getByMessageId('failed-text'))?.status).toBe('awaiting_admin');
    expect(reply).not.toHaveBeenCalled();

    generate.mockRejectedValueOnce(new Error('Model timed out'));
    await router.handleMessage({ id: 'failed-followup', guildId, channelId: 'failed-post', content: 'Is that the schedule for today?',
      url: 'https://discord.com/channels/server/failed-post/failed-followup', author: { id: 'asker', username: 'asker', bot: false },
      channel: { isThread: () => true, id: 'failed-post', parentId: supportChannelId }, reply } as any);
    expect((await caseRepo.get(c.case_id))?.status).toBe('awaiting_admin');
    expect(reply).not.toHaveBeenCalled();
  });

  it('still acknowledges a failed explicit /ask', async () => {
    await knowledgeRepo.createCandidate({ knowledge_id: 'explicit-failure', guild_id: guildId, question_patterns: ['Where is the schedule?'], canonical_answer: 'Check announcements for the schedule.', created_by: adminUserId });
    await knowledgeRepo.approve('explicit-failure', adminUserId);
    vi.mocked(mockModelProvider.generateStructured).mockRejectedValueOnce(new Error('Model timed out'));
    const editReply = vi.fn();
    await router.handleCommand({ guildId, channelId: supportChannelId, commandName: 'ask',
      user: { id: 'asker', username: 'asker' }, options: { getString: () => 'Where is the schedule?' },
      fetchReply: vi.fn().mockResolvedValue({ id: 'explicit-reply' }), deferReply: vi.fn(), editReply } as any);
    expect(editReply).toHaveBeenCalledOnce();
    expect(editReply.mock.calls[0][0].embeds[0].toJSON().description).toContain('I couldn’t check this.');
  });

  it('accepts explicit success from the asker without another bot reply or model call', async () => {
    await caseRepo.create({ case_id: 'conversation-solved', guild_id: guildId, channel_id: supportChannelId, thread_id: 'solved-post', message_id: 'original', requester_id: 'asker', requester_username: 'asker', category: 'question', title: 'Where is the schedule?', status: 'answered', last_answer: 'Read announcements.' });
    const reply = vi.fn();
    vi.mocked(mockModelProvider.generateStructured).mockClear();
    const message = { id: 'confirmation', guildId, channelId: 'solved-post', content: 'That worked, thanks!',
      author: { id: 'stranger', username: 'stranger' }, channel: { isThread: () => true, parentId: supportChannelId, id: 'solved-post' }, reply };
    await router.handleMessage(message as any);
    expect((await caseRepo.get('conversation-solved'))?.status).toBe('answered');
    message.author.id = 'asker';
    await router.handleMessage(message as any);
    expect((await caseRepo.get('conversation-solved'))?.status).toBe('resolved');
    expect(reply).not.toHaveBeenCalled();
    expect(mockModelProvider.generateStructured).not.toHaveBeenCalled();
  });

  it('reopens unhelpful answers quietly and preserves the attempted advice for a moderator', async () => {
    await guildRepo.upsert({ guild_id: guildId, autonomy_mode: 'auto' });
    await caseRepo.create({ case_id: 'conversation-failed', guild_id: guildId, channel_id: supportChannelId, thread_id: 'failed-advice-post', message_id: 'original', requester_id: 'asker', requester_username: 'asker', category: 'question', title: 'My project will not start', status: 'resolved', last_answer: 'Install the dependencies and restart.' });
    vi.mocked(mockModelProvider.generateStructured).mockClear();
    const reply = vi.fn();
    await router.handleMessage({ id: 'negative-feedback', guildId, channelId: 'failed-advice-post', content: "That didn't work. I still get an error.", url: 'https://discord.com/channels/server/post/negative-feedback',
      author: { id: 'asker', username: 'asker' }, channel: { isThread: () => true, parentId: supportChannelId, id: 'failed-advice-post' }, reply } as any);
    const c = await caseRepo.get('conversation-failed');
    expect(c?.status).toBe('awaiting_admin');
    expect(c?.reopen_count).toBe(1);
    const feedback = (await evidenceRepo.getByCaseId('conversation-failed')).find(e => e.metadata.feedback === 'failed');
    expect(feedback?.metadata.failed_answer).toBe('Install the dependencies and restart.');
    expect(reply).not.toHaveBeenCalled();
    expect(mockModelProvider.generateStructured).not.toHaveBeenCalled();
  });

  it('groups repeated visible questions and rechecks access when a topic is opened', async () => {
    for (let n = 0; n < 2; n++) await caseRepo.create({ case_id: `topic-${n}`, guild_id: guildId, channel_id: supportChannelId, thread_id: `topic-post-${n}`, message_id: `topic-msg-${n}`, requester_id: `asker-${n}`, requester_username: `asker-${n}`, category: 'question', title: 'Where is the project submission form?', status: 'awaiting_admin' });
    const permissions = new PermissionsBitField(PermissionsBitField.Flags.ViewChannel);
    const fetch = vi.fn().mockResolvedValue({ type: 11, isTextBased: () => true, permissionsFor: () => permissions, send: vi.fn() });
    const guild = { channels: { fetch }, members: { fetch: vi.fn().mockResolvedValue(moderator), me: moderator } };
    const command = { guildId, guild, commandName: 'queue', user: { id: adminUserId }, member: moderator, deferReply: vi.fn(), editReply: vi.fn() };
    await router.handleCommand(command as any);
    const payload = command.editReply.mock.calls[0][0];
    expect(payload.content).toBe('2 questions · 1 topic need help.');
    const menu = payload.components[0].toJSON().components[0];
    expect(menu.custom_id).toBe('open_queue_topic'); expect(menu.options).toHaveLength(1);
    const select = { ...command, customId: 'open_queue_topic', values: ['topic-0'], deferReply: vi.fn(), editReply: vi.fn() };
    await router.handleSelect(select as any);
    expect(select.editReply.mock.calls[0][0].components[0].toJSON().components[0].options).toHaveLength(2);
    fetch.mockResolvedValue(null);
    await router.handleSelect(select as any);
    expect(select.editReply.mock.calls[1][0].content).toContain('Already handled');
  });

  it('does not broadcast saved knowledge through old sharing buttons or menus', async () => {
    await knowledgeRepo.createCandidate({ knowledge_id: 'old-share', guild_id: guildId, question_patterns: ['Schedule?'], canonical_answer: 'Read the pinned post.', created_by: adminUserId });
    await knowledgeRepo.approve('old-share', adminUserId);
    const send = vi.fn();
    const interaction = { guildId, guild: { channels: { fetch: vi.fn().mockResolvedValue({ send }) } }, customId: 'share_know:old-share',
      user: { id: adminUserId }, member: moderator, reply: vi.fn() };
    await router.handleButton(interaction as any);
    await router.handleSelect({ ...interaction, customId: 'share_answers:old-preview', values: ['old-question'] } as any);
    expect(send).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(2);
  });

  it('opens a valid editable form, including optional empty scope and expiry', async () => {
    await knowledgeRepo.createCandidate({ knowledge_id: 'modal-open', guild_id: guildId, question_patterns: ['Where is the schedule?'], canonical_answer: 'Read the pinned post.', created_by: adminUserId });
    const showModal = vi.fn((modal: any) => {
      const data = modal.toJSON();
      expect(data.components).toHaveLength(5);
      expect(data.custom_id).toBe('edit_draft:modal-open:v1');
    });
    await router.handleButton({ guildId, customId: 'edit_draft:modal-open', user: { id: adminUserId }, member: moderator, showModal } as any);
    expect(showModal).toHaveBeenCalledOnce();
  });

  it('lets a moderator clear one-off queue questions without saving them as reusable knowledge', async () => {
    await caseRepo.create({ case_id: 'one-off', guild_id: guildId, channel_id: supportChannelId, thread_id: 'post-one-off', message_id: 'original', requester_id: 'asker', requester_username: 'asker', category: 'question', title: 'One-off question', status: 'awaiting_admin' });
    const permissions = new PermissionsBitField(PermissionsBitField.Flags.ViewChannel);
    const guild = { channels: { fetch: vi.fn().mockResolvedValue({ type: 11, isTextBased: () => true, isThread: () => true, permissionsFor: () => permissions, send: vi.fn() }) }, members: { fetch: vi.fn().mockResolvedValue(moderator), me: moderator } };
    const command = { guildId, guild, commandName: 'queue', user: { id: adminUserId }, member: moderator, deferReply: vi.fn(), editReply: vi.fn() };
    await router.handleCommand(command as any);
    const select = { guildId, guild, customId: 'open_queue', values: ['one-off'], user: command.user, member: moderator, reply: vi.fn() };
    await router.handleSelect(select as any);
    const button = select.reply.mock.calls[0][0].components[0].toJSON().components[1];
    const interaction = { guildId, guild, customId: button.custom_id, user: command.user, member: moderator, deferUpdate: vi.fn(), editReply: vi.fn() };
    await router.handleButton(interaction as any);
    expect((await caseRepo.get('one-off'))?.status).toBe('resolved');
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(0);
  });

  const memoryInteraction = (extra: Record<string, unknown> = {}) => ({
    guildId, channelId: supportChannelId, commandName: 'memory', user: { id: adminUserId }, member: moderator,
    options: { getString: vi.fn().mockReturnValue(null) }, reply: vi.fn(), deferReply: vi.fn(), editReply: vi.fn(),
    deferUpdate: vi.fn(), update: vi.fn(), showModal: vi.fn((modal: any) => modal.toJSON()), ...extra,
  });
  async function openMemory() {
    const command = memoryInteraction(); await router.handleCommand(command as any);
    const payload = command.editReply.mock.calls[0][0];
    const token = payload.components.at(-1).toJSON().components.find((button: any) => button.label === 'Add answer').custom_id.split(':')[1];
    return { command, payload, token };
  }
  async function previewImport(token: string, faq: string) {
    const modal = memoryInteraction({ customId: `memory_import_form:${token}`,
      fields: { getTextInputValue: (key: string) => key === 'faq' ? faq : '' } });
    await router.handleModal(modal as any);
    return modal;
  }

  it('shows a private, paginated library including expired answers but excludes deleted answers and other servers', async () => {
    for (let n = 0; n < 7; n++) {
      await knowledgeRepo.createCandidate({ knowledge_id: `library-${n}`, guild_id: guildId, question_patterns: [`Question ${n}?`], canonical_answer: `Answer ${n}`, created_by: adminUserId, expires_at: n === 0 ? '2020-01-01T00:00:00Z' : null });
      await knowledgeRepo.approve(`library-${n}`, adminUserId);
    }
    await knowledgeRepo.delete('library-6');
    await knowledgeRepo.createCandidate({ knowledge_id: 'foreign-library', guild_id: 'foreign', question_patterns: ['Private elsewhere'], canonical_answer: 'Foreign answer', created_by: adminUserId });
    await knowledgeRepo.approve('foreign-library', adminUserId);
    const { command, payload, token } = await openMemory();
    expect(command.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(payload.embeds[0].toJSON().description).toContain('6 saved answers');
    expect(payload.components[0].toJSON().components[0].options).toHaveLength(5);
    const next = memoryInteraction({ customId: `memory_page:${token}:1` });await router.handleButton(next as any);
    expect(next.editReply.mock.calls[0][0].components[0].toJSON().components[0].options).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain('Foreign answer');
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(5);
    const search = await knowledgeRepo.listSaved(guildId, 'Answer 0');
    expect(search.items[0].knowledge_id).toBe('library-0');
  });

  it('blocks regular members and binds the private buttons to their administrator and server', async () => {
    const member = memoryInteraction({ member: { permissions: new PermissionsBitField(), roles: { cache: new Map() } } });
    await router.handleCommand(member as any);
    expect(member.reply).toHaveBeenCalledWith({ content: 'Moderators only.', ephemeral: true });
    expect(member.deferReply).not.toHaveBeenCalled();
    const { token } = await openMemory();
    for (const identity of [{ user: { id: 'another-admin' } }, { guildId: 'foreign' }]) {
      const button = memoryInteraction({ customId: `memory_add:${token}`, ...identity });
      await router.handleButton(button as any);expect(button.showModal).not.toHaveBeenCalled();expect(button.reply).toHaveBeenCalled();
    }
  });

  it('opens valid add and import modals and saves a new answer through the normal memory pipeline', async () => {
    const { token } = await openMemory();
    for (const action of ['add', 'import']) {
      const button = memoryInteraction({ customId: `memory_${action}:${token}` });await router.handleButton(button as any);
      expect(button.showModal).toHaveBeenCalledOnce();
    }
    const modal = memoryInteraction({ customId: `memory_add_form:${token}`, fields: { getTextInputValue: (key: string) => ({ question: 'Where do I submit?', answer: 'Use #submissions.', source: 'https://example.com/faq', scope: '', days: '' }[key] || '') } });
    await router.handleModal(modal as any);
    expect((await knowledgeRepo.searchExact(guildId, 'Where do I submit?'))[0].canonical_answer).toBe('Use #submissions.');
    expect(modal.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('previews full FAQ text without writes, requires confirmation, and skips duplicate saves on re-import', async () => {
    const { token } = await openMemory();
    const faq = '## Can I work alone?\nYes.\n\n## Do I need a video?\nNo.';
    const preview = await previewImport(token, faq);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(0);
    expect(preview.editReply.mock.calls[0][0].embeds[0].toJSON().description).toContain('Do I need a video?');
    const confirmId = preview.editReply.mock.calls[0][0].components[0].toJSON().components[0].custom_id;
    const confirm = memoryInteraction({ customId: confirmId });await router.handleButton(confirm as any);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(2);
    expect(confirm.editReply.mock.calls[0][0].content).toContain('2 saved');
    await router.handleButton(memoryInteraction({ customId: confirmId }) as any);
    const again = await previewImport(token, faq);
    const duplicate = memoryInteraction({ customId: again.editReply.mock.calls[0][0].components[0].toJSON().components[0].custom_id });
    await router.handleButton(duplicate as any);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(2);
    expect(duplicate.editReply.mock.calls[0][0].content).toContain('2 already saved');
  });

  it('does not allow an old preview to approve a replacement import', async () => {
    const { token } = await openMemory();
    const old = await previewImport(token, '## Old question?\nOld answer.');
    const oldId = old.editReply.mock.calls[0][0].components[0].toJSON().components[0].custom_id;
    await previewImport(token, '## New question?\nNew answer.');
    const confirm = memoryInteraction({ customId: oldId });await router.handleButton(confirm as any);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(0);
    expect(confirm.reply).toHaveBeenCalled();
  });

  it('lets a moderator update the source and expiry of an expired saved answer', async () => {
    await knowledgeRepo.createCandidate({ knowledge_id: 'expired-edit', guild_id: guildId, question_patterns: ['Deadline?'], canonical_answer: 'Old deadline.', created_by: adminUserId, expires_at: '2020-01-01T00:00:00Z' });
    await knowledgeRepo.approve('expired-edit', adminUserId);
    const modal = memoryInteraction({ customId: 'correct_answer:expired-edit:v1', fields: { getTextInputValue: (key: string) => ({ question: 'Deadline?', answer: 'New deadline.', scope: '', expiry: '2030-01-01', source: 'https://example.com/deadline' }[key] || '') } });
    await router.handleModal(modal as any);
    const updated = await knowledgeRepo.get('expired-edit');
    expect(updated?.current_version).toBe(2);expect(updated?.expires_at).toBe('2030-01-01T23:59:59.999Z');
    expect(updated?.source_refs).toEqual(['https://example.com/deadline']);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(1);
  });

  it('accepts only one concurrent edit of a version and refuses an older form', async () => {
    await knowledgeRepo.createCandidate({ knowledge_id: 'concurrent-edit', guild_id: guildId,
      question_patterns: ['Deadline?'], canonical_answer: 'Original.', created_by: adminUserId });
    await knowledgeRepo.approve('concurrent-edit', adminUserId);
    const results = await Promise.all([
      knowledgeRepo.correctAndSupersede('concurrent-edit', { canonical_answer: 'Monday.' }, adminUserId, 1),
      knowledgeRepo.correctAndSupersede('concurrent-edit', { canonical_answer: 'Tuesday.' }, 'other-admin', 1),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await knowledgeRepo.get('concurrent-edit'))?.current_version).toBe(2);
    expect(await db.collection('knowledge_versions').countDocuments({ knowledge_id: 'concurrent-edit' })).toBe(2);
    const stale = memoryInteraction({ customId: 'correct_answer:concurrent-edit:v1' });
    await router.handleModal(stale as any);
    expect(stale.reply.mock.calls[0][0].content).toContain('Answer changed');
    expect((await knowledgeRepo.get('concurrent-edit'))?.current_version).toBe(2);
  });

  it('keeps successful imports and retries only unfinished answers after a failure', async () => {
    const { token } = await openMemory();
    const preview = await previewImport(token, '## First?\nOne.\n## Second?\nTwo.');
    const confirmId = preview.editReply.mock.calls[0][0].components[0].toJSON().components[0].custom_id;
    const originalSave = learningPipeline.saveAnswer.bind(learningPipeline);
    let calls = 0;
    const spy = vi.spyOn(learningPipeline, 'saveAnswer').mockImplementation(async options => {
      calls++; if (calls === 2) throw new Error('Temporary database failure'); return originalSave(options);
    });
    const confirm = memoryInteraction({ customId: confirmId }); await router.handleButton(confirm as any);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(1);
    expect(confirm.editReply.mock.calls[0][0].content).toContain('Retry');
    await router.handleButton(memoryInteraction({ customId: confirmId }) as any);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(2); expect(calls).toBe(3);
    spy.mockRestore();
  });

  it('cancels imports without saving and rejects expired sessions', async () => {
    const { token } = await openMemory();
    const preview = await previewImport(token, '## Cancelled?\nNot saved.');
    const cancelId = preview.editReply.mock.calls[0][0].components[0].toJSON().components[1].custom_id;
    await router.handleButton(memoryInteraction({ customId: cancelId }) as any);
    expect(await knowledgeRepo.getApproved(guildId)).toHaveLength(0);
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60_000);
    try {
      const expired = memoryInteraction({ customId: `memory_add:${token}` }); await router.handleButton(expired as any);
      expect(expired.showModal).not.toHaveBeenCalled(); expect(expired.reply).toHaveBeenCalled();
    } finally { now.mockRestore(); }
  });

});
