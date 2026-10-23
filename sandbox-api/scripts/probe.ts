/** One-off live probe: does the real pipeline answer a reworded question from a saved answer? */
import { createMemoryMongoDb } from '../../src/database/memory-db.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { EvidenceRepository } from '../../src/database/repositories/evidence.repo.js';
import { GuildConfigRepository } from '../../src/database/repositories/guild-config.repo.js';
import { KnowledgeRepository } from '../../src/database/repositories/knowledge.repo.js';
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';
import { MemoryRetriever } from '../../src/memory/retriever.js';
import { LearningPipeline } from '../../src/memory/learner.js';
import { ToolRegistry } from '../../src/agent/tools.js';
import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { SafeFetcher } from '../../src/integrations/web/safe-fetcher.js';
import { OllamaProvider } from '../../src/integrations/model/ollama.provider.js';

const provider = new OllamaProvider({
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'gemma4:e4b-it-qat',
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'embeddinggemma-2:270m',
  defaultTimeoutMs: 90000,
});

const t0 = Date.now();
console.log('health', await provider.healthCheck());

const db = createMemoryMongoDb();
const cases = new CaseRepository(db);
const evidence = new EvidenceRepository(db);
const guilds = new GuildConfigRepository(db);
const knowledge = new KnowledgeRepository(db);
const learning = new LearningPipeline(knowledge, new AuditRepository(db), provider);
const guildId = 'sandbox-probe';

await guilds.upsert({ guild_id: guildId, autonomy_mode: 'supervised', support_channel_ids: ['ask-campfire'] });
const tools = new ToolRegistry(new MemoryRetriever(knowledge, cases, provider), new SafeFetcher([]), cases, evidence);
const agent = new AgentOrchestrator(cases, evidence, guilds, tools, provider);

const saveT = Date.now();
const saved = await learning.saveAnswer({
  guildId,
  channelId: 'ask-campfire',
  adminUserId: 'mod-sam',
  adminMessage:
    'Yes. Keep the same repo link and push your fixes before submissions close. Add a short "Latest changes" section to your README so reviewers can see what changed.',
  sourceUrl: 'campfire://thread/thread-1/message/msg-2',
  originCaseId: 'case-1',
  caseContext: {
    title: 'Can I update my project after submitting?',
    originalQuestion: 'Can I update my project after submitting?',
    originalContext: 'I spotted a bug after sharing my repo. Can I push a fix, or is the submitted version locked?',
  },
});
console.log('save', saved.status, saved.item.knowledge_id, Date.now() - saveT, 'ms');

const ask = async (title: string, summary: string) => {
  const id = `case-${Date.now()}`;
  await cases.create({
    case_id: id, guild_id: guildId, channel_id: 'ask-campfire', thread_id: null,
    message_id: `msg-${Date.now()}`, requester_id: 'member-alex', requester_username: 'Alex',
    category: 'question', title, summary, status: 'new',
  });
  const t = Date.now();
  const result = await agent.investigateCase(id);
  console.log('\nASK:', title, '\n', JSON.stringify(result.policyResult, null, 2), '\n', Date.now() - t, 'ms');
  const c = await cases.get(id);
  console.log('case status:', c?.status);
};

await ask('I pushed a fix. Do I need a new submission?', 'I already submitted. Can I push a bug fix to the same repo?');
await ask('What time does judging start?', 'I want to plan my demo.');
console.log('\ntotal', Date.now() - t0, 'ms');
