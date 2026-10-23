import { describe, it, expect, vi } from 'vitest';
import { createDemoScenario, scriptedDemoModel, demoQuestion, demoAnswer } from '../../src/demo/scenario.js';

const options = { guildId: 'demo-community', channelId: 'demo-support', adminUserId: 'mod',
  adminMessage: demoAnswer, caseContext: { originalQuestion: demoQuestion } };

describe('Save once, answer personally', () => {
  it('approves a deliberate save immediately and coalesces repeated concurrent saves', async () => {
    const s = await createDemoScenario();
    const results = await Promise.all([s.learning.saveAnswer(options), s.learning.saveAnswer(options), s.learning.saveAnswer(options)]);
    expect(results.map(r => r.status)).toEqual(['saved', 'exists', 'exists']);
    expect(new Set(results.map(r => r.item.knowledge_id)).size).toBe(1);
    expect(await s.knowledge.getPendingCandidates(options.guildId)).toHaveLength(0);
    expect(await s.cases.listWaiting(options.guildId)).toHaveLength(0);
  });

  it('skips paraphrased facts already known, without replacing the original evidence', async () => {
    let knownId: string;
    const model = { ...scriptedDemoModel, generateStructured: vi.fn(async (request: any) => request.schemaName === 'KnowledgeDuplicate'
      ? request.schema.parse({ duplicate: true, existing_id: knownId }) : scriptedDemoModel.generateStructured(request)) };
    const s = await createDemoScenario(model);
    const first = await s.learning.saveAnswer({ ...options, sourceUrl: 'https://example.com/original' });
    knownId = first.item.knowledge_id;
    const repeated = await s.learning.saveAnswer({ ...options, adminMessage: 'For the event schedule, see the pinned announcements. Session times follow your local timezone.' });
    expect(repeated.status).toBe('exists');
    expect(repeated.item.source_refs).toEqual(['https://example.com/original']);
    expect(await s.knowledge.getApproved(options.guildId)).toHaveLength(1);
  });

  it('preserves a new numeric fact even if a model would call it a duplicate', async () => {
    let knownId: string;
    const model = { ...scriptedDemoModel, generateStructured: vi.fn(async (request: any) => request.schema.parse({ duplicate: true, existing_id: knownId })) };
    const s = await createDemoScenario(model);
    const first = await s.learning.saveAnswer({ ...options, adminMessage: 'Account must be 30 days old.' });
    knownId = first.item.knowledge_id;
    const next = await s.learning.saveAnswer({ ...options, adminMessage: 'Account must be 60 days old.' });
    expect(next.status).toBe('saved');
    expect(await s.knowledge.getApproved(options.guildId)).toHaveLength(2);
    expect(model.generateStructured).not.toHaveBeenCalled();
  });

  it('keeps different scopes and servers separate', async () => {
    const s = await createDemoScenario();
    await s.learning.saveAnswer({ ...options, appliesWhen: 'October event' });
    expect((await s.learning.saveAnswer({ ...options, appliesWhen: 'November event' })).status).toBe('saved');
    expect((await s.learning.saveAnswer({ ...options, guildId: 'other-server', appliesWhen: 'October event' })).status).toBe('saved');
    expect(await s.knowledge.getApproved(options.guildId)).toHaveLength(2);
  });

  it('never trusts a duplicate ID outside the supplied candidates', async () => {
    const model = { ...scriptedDemoModel, generateStructured: vi.fn(async (request: any) => request.schema.parse({ duplicate: true, existing_id: 'foreign-id' })) };
    const s = await createDemoScenario(model);
    await s.learning.saveAnswer(options);
    expect((await s.learning.saveAnswer({ ...options, adminMessage: 'The schedule also lists a new workshop.' })).status).toBe('saved');
  });

  it('keeps new facts if duplicate detection is unavailable, and still skips exact duplicates', async () => {
    const model = { ...scriptedDemoModel, generateStructured: vi.fn().mockRejectedValue(new Error('offline')), generateEmbedding: vi.fn().mockRejectedValue(new Error('offline')) };
    const s = await createDemoScenario(model);
    expect((await s.learning.saveAnswer(options)).status).toBe('saved');
    expect((await s.learning.saveAnswer(options)).status).toBe('exists');
    expect((await s.learning.saveAnswer({ ...options, adminMessage: 'The schedule now includes a bonus workshop.' })).status).toBe('saved');
  });

  it('uses the LLM for every new supported question including identical repeats', async () => {
    const model = { ...scriptedDemoModel, generateStructured: vi.fn(scriptedDemoModel.generateStructured) };
    const s = await createDemoScenario(model);
    await s.learning.saveAnswer(options);
    for (const question of [demoQuestion, demoQuestion, 'Where can I find the event schedule?']) {
      const reply = await s.ask(question);
      expect(reply.policyResult.action).toBe('respond');
      expect(reply.policyResult.finalAnswer).not.toBe(demoAnswer);
      expect((await s.cases.getInvestigationRuns(reply.caseId))[0].model_calls).toBe(1);
    }
    const calls = model.generateStructured.mock.calls.filter(([request]) => request.schemaName === 'GroundedAnswerDraft');
    expect(calls).toHaveLength(3);
    expect(calls[2][0].prompt).toContain('Where can I find the event schedule?');
    expect(calls[0][0].systemPrompt).toContain('Write a fresh reply');
  });

  it('preserves the original starter context for future synthesis', async () => {
    const model = { ...scriptedDemoModel, generateStructured: vi.fn(scriptedDemoModel.generateStructured) };
    const s = await createDemoScenario(model);
    const saved = await s.learning.saveAnswer({ ...options, caseContext: { originalQuestion: demoQuestion, originalContext: 'Schedule for the October student event only.' } });
    expect(saved.item.question_context).toBe('Schedule for the October student event only.');
    await s.ask(demoQuestion);
    expect(model.generateStructured.mock.calls.find(([request]) => request.schemaName === 'GroundedAnswerDraft')?.[0].prompt)
      .toContain('Schedule for the October student event only.');
    expect((await s.learning.saveAnswer({ ...options, caseContext: { originalQuestion: demoQuestion, originalContext: 'Schedule for a separate January event.' } })).status).toBe('saved');
  });

  it('refreshes semantic embeddings when a saved answer is edited', async () => {
    const model = { ...scriptedDemoModel, generateEmbedding: vi.fn().mockResolvedValue([1, 0]) };
    const s = await createDemoScenario(model);
    const saved = await s.learning.saveAnswer(options);
    model.generateEmbedding.mockResolvedValue([0, 1]);
    const updated = await s.learning.correctAndSupersede(saved.item.knowledge_id, { canonical_answer: 'Schedule moved to #event-info.' }, 'mod');
    expect(updated?.embedding).toEqual([0, 1]);
    expect(updated?.current_version).toBe(2);
  });
});
