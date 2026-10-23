import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryMongoDb } from '../../src/database/memory-db.js';
import { KnowledgeRepository } from '../../src/database/repositories/knowledge.repo.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { GuildConfigRepository } from '../../src/database/repositories/guild-config.repo.js';
import { ResponsePolicy } from '../../src/agent/policy.js';
import { GroundedAnswerDraft } from '../../src/agent/schemas.js';
import { CaseEvidence } from '../../src/domain/case.js';
import { MemoryRetriever } from '../../src/memory/retriever.js';
import { ModelProvider } from '../../src/integrations/model/model-provider.interface.js';
import { buildCaseEmbed } from '../../src/bot/ui/embeds.js';
import { allCommands } from '../../src/bot/commands/definitions.js';

const draft: GroundedAnswerDraft = { can_answer_confidently: true, answer: 'A made-up promise of free credits.',
  citations: [], requires_clarification: false, clarification_question: null, escalate_to_human: false, escalation_reason: null };
const context: CaseEvidence = { evidence_id: 'ctx', case_id: 'c', source_type: 'discord_message',
  source_url: 'https://discord.com/channels/1/2/3', excerpt: 'Someone promised me free credits.',
  authority_score: 0.8, metadata: { subtype: 'user_context' }, created_at: new Date().toISOString() };

describe('Answer trust boundaries', () => {
  const policy = new ResponsePolicy();
  it.each([true, false])('withholds unsupported claims even when model confidence is %s', confidence => {
    const result = policy.evaluate({ ...draft, can_answer_confidently: confidence }, 'Where are my credits?', []);
    expect(result.action).toBe('queue');
    expect(result.finalAnswer).not.toContain('made-up');
  });
  it('does not promote a member’s follow-up into verified evidence', () => {
    const result = policy.evaluate({ ...draft, citations: [{ source_url: context.source_url!, excerpt: 'credits', relevance: '' }] }, 'Where are credits?', [context]);
    expect(result.action).toBe('queue');
  });
  it('withholds answers whose only citation is fabricated', () => {
    const evidence = { ...context, source_type: 'documentation' as const, metadata: {} };
    expect(policy.evaluate({ ...draft, citations: [{ source_url: 'https://invented.example', excerpt: '', relevance: '' }] }, 'Question', [evidence]).action).toBe('queue');
  });
  it('does not leak raw draft answers during a private account handoff', () => {
    const result = policy.evaluate({ ...draft, escalate_to_human: true, answer: 'Your token is secret-value' }, 'Please reset my 2FA', []);
    expect(result.finalAnswer).not.toContain('secret-value');
    expect(result.finalAnswer).not.toContain('alerted');
  });
});

describe('Retrieval and forum isolation', () => {
  let db = createMemoryMongoDb();
  let repo = new KnowledgeRepository(db);
  beforeEach(() => { db = createMemoryMongoDb(); repo = new KnowledgeRepository(db); });
  const save = async (id: string, patterns: string[], extra = {}) => {
    await repo.createCandidate({ knowledge_id: id, guild_id: 'g', question_patterns: patterns,
      canonical_answer: 'A reviewed community answer.', created_by: 'mod', ...extra });
    await repo.approve(id, 'mod');
  };
  it('keeps an exact approved question useful when the model is down', async () => {
    await save('exact', ['Where is the event schedule?']);
    const generateEmbedding = vi.fn().mockRejectedValue(new Error('offline'));
    const retriever = new MemoryRetriever(repo, new CaseRepository(db), { generateEmbedding } as unknown as ModelProvider);
    const result = await retriever.search('g', 'WHERE is the event schedule!');
    expect(result.knowledge[0].retrieval_method).toBe('exact');
    expect(generateEmbedding).not.toHaveBeenCalled();
  });
  it('never converts first position in keyword results into high confidence', async () => {
    await save('schedule', ['Where is the event schedule?']);
    const results = await repo.searchLexical('g', 'event cancelled refund today');
    expect(results[0].similarity).toBeLessThan(0.7);
  });
  it('filters expired, rejected, deleted, and other-server answers from exact and vector search', async () => {
    await save('expired', ['event schedule'], { expires_at: '2020-01-01T00:00:00Z', embedding: [1, 0] });
    await save('deleted', ['event schedule'], { embedding: [1, 0] });
    await repo.delete('deleted');
    await save('other', ['event schedule'], { guild_id: 'other', embedding: [1, 0] });
    expect(await repo.searchExact('g', 'event schedule')).toHaveLength(0);
    expect(await repo.searchVector('g', [1, 0])).toHaveLength(0);
    expect(await repo.approve('deleted', 'mod')).toBeNull();
  });
  it('does not match embedding vectors from incompatible dimensions', async () => {
    await save('dim', ['event schedule'], { embedding: [1, 0, 0] });
    expect(await repo.searchVector('g', [1, 0])).toHaveLength(0);
  });
  it('uses real Atlas scores and applies the requested threshold', async () => {
    await save('atlas', ['event schedule']);
    const item = await repo.get('atlas');
    const collection = db.collection('knowledge_items');
    const aggregate = vi.spyOn(collection, 'aggregate').mockReturnValue({ toArray: async () => [{ ...item, score: 0.2 }] } as any);
    expect(await repo.searchVector('g', [1, 0], 5, 0.8)).toHaveLength(0);
    expect(JSON.stringify(aggregate.mock.calls[0][0])).toContain('vectorSearchScore');
  });
  it('never borrows a case from a sibling forum post', async () => {
    const cases = new CaseRepository(db);
    await cases.create({ case_id: 'old', guild_id: 'g', channel_id: 'forum', thread_id: 'thread-a',
      message_id: 'm', requester_id: 'alice', requester_username: 'alice', category: 'general', title: 'A', status: 'awaiting_user' });
    expect(await cases.findActiveCase('forum', 'thread-b')).toBeNull();
    expect(await cases.findActiveCase('forum')).toBeNull();
    expect((await cases.findActiveCase('forum', 'thread-a'))?.case_id).toBe('old');
  });
  it('requires explicit Discord admin permission when no moderator roles exist', async () => {
    const guilds = new GuildConfigRepository(db);
    await guilds.upsert({ guild_id: 'g', admin_role_ids: [] });
    expect(await guilds.isAdmin('g', [])).toBe(false);
  });
  it('renders long questions and answers within Discord embed limits', async () => {
    const c = await new CaseRepository(db).create({ case_id: 'long', guild_id: 'g', channel_id: 'ch', message_id: 'm',
      requester_id: 'a', requester_username: 'a', category: 'general', title: 'q'.repeat(2000), status: 'answered', last_answer: 'x'.repeat(5000) });
    const json = buildCaseEmbed(c).toJSON();
    expect(json.title).toBeUndefined();
    expect(json.description!.length).toBeLessThanOrEqual(4096);
    expect(json.fields?.some(f => f.name === 'Investigation Summary')).toBeFalsy();
  });
  it('registers valid commands including correction and impact', () => {
    const commands = allCommands.map(c => c.toJSON());
    expect(commands.map(c => c.name)).toContain('stats');
    expect(commands.map(c => c.name)).toEqual(expect.arrayContaining(['answers', 'queue', 'Save this answer']));
    expect(commands.map(c => c.name)).not.toEqual(expect.arrayContaining(['case', 'memory', 'issue']));
  });
});
