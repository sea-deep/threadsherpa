import { createMemoryMongoDb } from '../database/memory-db.js';
import { CaseRepository } from '../database/repositories/case.repo.js';
import { EvidenceRepository } from '../database/repositories/evidence.repo.js';
import { GuildConfigRepository } from '../database/repositories/guild-config.repo.js';
import { KnowledgeRepository } from '../database/repositories/knowledge.repo.js';
import { AuditRepository } from '../database/repositories/audit.repo.js';
import { MemoryRetriever } from '../memory/retriever.js';
import { LearningPipeline } from '../memory/learner.js';
import { ToolRegistry } from '../agent/tools.js';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import { SafeFetcher } from '../integrations/web/safe-fetcher.js';
import { ModelProvider } from '../integrations/model/model-provider.interface.js';

export const demoQuestion = 'Where is the event schedule?';
export const demoAnswer = 'The schedule is pinned in #announcements. Discord event timestamps display in your local timezone.';
export const demoCorrection = 'The schedule has moved to #event-info. Check the pinned post there for the latest sessions.';

/** Scripted provider for reproducible plumbing demos. This is not an AI model or model benchmark. */
export const scriptedDemoModel: ModelProvider = {
  async generateText() { throw new Error('No text generation in the scripted demo'); },
  async generateEmbedding() { return []; },
  async healthCheck() { return { ok: true, models: ['scripted-fixture'], selectedModelAvailable: true, embeddingModelAvailable: false }; },
  async generateStructured(options) {
    let output: unknown;
    if (options.schemaName === 'KnowledgeCandidateExtraction') {
      output = { question_patterns: [demoQuestion, 'Where can I find session times?'], canonical_answer: demoAnswer,
        applies_when: null, does_not_apply_when: null, authority: 'approved_admin', change_reason: null };
    } else if (options.schemaName === 'KnowledgeDuplicate') {
      output = { duplicate: false, existing_id: '' };
    } else {
      // Exercise per-question synthesis, using the real evidence supplied by the orchestrator.
      const json = options.prompt.split('Evidence (JSON):\n')[1]?.split('\n\nReturn')[0];
      const evidence = json ? JSON.parse(json) as Array<{ url: string; text: string }> : [];
      output = { can_answer_confidently: evidence.length > 0, answer: evidence[0]?.text ? `For the schedule, ${evidence[0].text[0].toLowerCase()}${evidence[0].text.slice(1)}` : '',
        citations: evidence[0] ? [{ source_url: evidence[0].url, excerpt: evidence[0].text, relevance: 'Fixture only' }] : [],
        requires_clarification: false, clarification_question: null, escalate_to_human: false, escalation_reason: null };
    }
    return options.schema.parse(output);
  },
};

export async function createDemoScenario(model: ModelProvider = scriptedDemoModel) {
  const db = createMemoryMongoDb();
  const cases = new CaseRepository(db);
  const evidence = new EvidenceRepository(db);
  const guilds = new GuildConfigRepository(db);
  const knowledge = new KnowledgeRepository(db);
  const learning = new LearningPipeline(knowledge, new AuditRepository(db), model);
  await guilds.upsert({ guild_id: 'demo-community', autonomy_mode: 'supervised', support_channel_ids: ['demo-support'] });
  const tools = new ToolRegistry(new MemoryRetriever(knowledge, cases, model), new SafeFetcher([]), cases, evidence);
  const agent = new AgentOrchestrator(cases, evidence, guilds, tools, model);
  let number = 0;
  const ask = async (title: string, summary = title) => {
    const id = `demo-question-${++number}`;
    await cases.create({ case_id: id, guild_id: 'demo-community', channel_id: 'demo-support', thread_id: `thread-${number}`,
      message_id: `message-${number}`, requester_id: `member-${number}`, requester_username: `member-${number}`,
      category: 'question', title, summary, status: 'new' });
    const result = await agent.investigateCase(id);
    return { ...result, supportCase: (await cases.get(id))!, evidence: await evidence.getByCaseId(id) };
  };
  const teach = (originCaseId?: string) => learning.saveAnswer({ guildId: 'demo-community', channelId: 'demo-support',
    adminUserId: 'demo-moderator', adminMessage: demoAnswer, originCaseId, caseContext: { originalQuestion: demoQuestion } });
  return { db, cases, evidence, guilds, knowledge, learning, tools, agent, ask, teach };
}
