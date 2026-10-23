import { describe, it, expect, vi } from 'vitest';
import { createDemoScenario, demoQuestion, demoAnswer, demoCorrection, scriptedDemoModel } from '../../src/demo/scenario.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { KnowledgeRepository } from '../../src/database/repositories/knowledge.repo.js';

describe('Save → synthesize → correct (in-process fixture, not a persistence proof)', () => {
  it('saves once, generates even exact-question replies, and replaces obsolete facts', async () => {
    const s = await createDemoScenario();
    expect((await s.ask(demoQuestion)).policyResult.action).toBe('queue');
    const { item: candidate } = await s.teach();
    expect(candidate.canonical_answer).toBe(demoAnswer);
    expect((await s.teach()).status).toBe('exists');
    expect(await s.knowledge.getApproved('demo-community')).toHaveLength(1);
    const result = await s.ask(demoQuestion);
    expect(result.policyResult.action).toBe('respond');
    expect(result.policyResult.finalAnswer).toContain(demoAnswer[0].toLowerCase() + demoAnswer.slice(1));
    expect(result.policyResult.finalAnswer).not.toBe(demoAnswer);
    expect(result.policyResult.verifiedCitations[0].source_url).toBe(`memory:${candidate.knowledge_id}`);
    expect((await s.cases.getInvestigationRuns(result.caseId))[0].model_calls).toBe(1);
    // Reconstructing a repository proves API reusability, not durability across process exits.
    expect((await new KnowledgeRepository(s.db).get(candidate.knowledge_id))?.approval_status).toBe('approved');
    await s.knowledge.correctAndSupersede(candidate.knowledge_id, { canonical_answer: demoCorrection }, 'mod');
    await s.agent.investigateCase(result.caseId);
    const updated = await s.cases.get(result.caseId);
    expect(updated?.last_answer).toContain(demoCorrection[0].toLowerCase() + demoCorrection.slice(1));
    expect((await s.evidence.getByCaseId(result.caseId)).some(e => e.excerpt === demoAnswer)).toBe(false);
    expect((await s.knowledge.getVersions(candidate.knowledge_id)).map(v => v.approval_state)).toEqual(['approved', 'superseded']);
  });
  it('does not call a model or web tool for sensitive account requests', async () => {
    const model = { ...scriptedDemoModel, generateStructured: vi.fn(scriptedDemoModel.generateStructured), generateEmbedding: vi.fn(scriptedDemoModel.generateEmbedding) };
    const s = await createDemoScenario(model);
    expect((await s.ask('reset my 2fa')).policyResult.action).toBe('escalate');
    expect(model.generateStructured).not.toHaveBeenCalled();
    expect(model.generateEmbedding).not.toHaveBeenCalled();
  });
  it('checks full forum context instead of bypassing scope based on the title', async () => {
    const model = { ...scriptedDemoModel, generateStructured: vi.fn(scriptedDemoModel.generateStructured) };
    const s = await createDemoScenario(model);
    const { item: candidate } = await s.teach();
    await s.learning.approveCandidate(candidate.knowledge_id, 'mod');
    model.generateStructured.mockClear();
    const result = await s.ask(demoQuestion, 'I mean the sessions for next month, not this event.');
    expect(model.generateStructured).toHaveBeenCalled();
    expect(model.generateStructured.mock.calls[0][0].prompt).toContain('next month');
    expect((await s.cases.getInvestigationRuns(result.caseId))[0].route).toBe('memory');
  });
  it('coalesces simultaneous investigations and counts distinct reuses', async () => {
    const s = await createDemoScenario();
    const { item: candidate } = await s.teach();
    await s.learning.approveCandidate(candidate.knowledge_id, 'mod');
    const result = await s.ask(demoQuestion);
    await Promise.all([s.agent.investigateCase(result.caseId), s.agent.investigateCase(result.caseId)]);
    expect(await s.cases.getInvestigationRuns(result.caseId)).toHaveLength(2);
    expect((await new CaseRepository(s.db).getImpact('demo-community')).reused).toBe(1);
  });  it('does not repeat a suggestion the asker already reported as unsuccessful', async () => {
    const s = await createDemoScenario();
    await s.teach();
    const first = await s.ask(demoQuestion);
    await s.evidence.add({ evidence_id: 'negative-feedback', case_id: first.caseId, source_type: 'discord_message', source_url: 'https://discord.com/channels/g/t/m',
      excerpt: 'That did not work.', authority_score: 0.7, metadata: { subtype: 'user_context', feedback: 'failed', failed_answer: first.policyResult.finalAnswer } });
    const next = await s.agent.investigateCase(first.caseId);
    expect(next.policyResult.action).toBe('queue');
    expect(next.policyResult.reason).toBe('Repeated unsuccessful advice');
  });

});
