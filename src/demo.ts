import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createModelProvider } from './integrations/model/factory.js';
import { loadConfig } from './config/env.js';
import { PaperProvider } from './integrations/model/paper.provider.js';
import { createDemoScenario, demoQuestion, demoCorrection } from './demo/scenario.js';
import { OllamaProvider } from './integrations/model/ollama.provider.js';
import 'dotenv/config';

const paper = process.argv.includes('--paper');
const live = paper || process.argv.includes('--live');
const model = paper ? createModelProvider(loadConfig({ MODEL_PROVIDER: 'paper' })) : live ? new OllamaProvider({ baseUrl: process.env.OLLAMA_BASE_URL, model: process.env.OLLAMA_MODEL, embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL }) : undefined;
if (model) {
  const health = await model.healthCheck();
  if (!health.ok || !health.selectedModelAvailable || !health.embeddingModelAvailable) {
    throw new Error(health.error || 'Models are not ready. Check the key and local Ollama models.');
  }
}
const scenario = await createDemoScenario(model);
console.log(`\nThreadSherpa — Answer once. Help the next person.\n${paper ? 'LIVE: Paper Instruments answers; local Gemma learning and embeddings.' : live ? 'LIVE: local Ollama reasoning and embeddings.' : 'SCRIPTED: fixture model, real repositories and answer policy. No AI performance claims.'}\nSynthetic community, temporary memory, no Discord messages or real member data.\n`);
async function show(label: string, question: string) {
  const result = await scenario.ask(question);
  const [run] = await scenario.cases.getInvestigationRuns(result.caseId);
  console.log(`${label}\nMember: ${question}\nSherpa: ${result.policyResult.finalAnswer}\n[${result.policyResult.action} · ${run.route} · ${run.model_calls} generation calls · ${run.duration_ms} ms]\n`);
  if (/^(4|5|6)\./.test(label)) assert.equal(result.policyResult.action, 'respond', 'Demo could not complete the answer; check local model availability and load.');
  return result;
}
let complete = false;
try {
const origin = await show('1. Before a moderator has answered', demoQuestion);
const saved = await scenario.teach(origin.caseId);
console.log('2. Moderator saves the answer. Ready immediately. No broadcast to older posts.\n');
const duplicate = await scenario.teach(origin.caseId);
assert.equal(duplicate.status, 'exists');
assert.equal((await scenario.knowledge.getApproved('demo-community')).length, 1);
console.log('3. Saving the same knowledge again: already saved.\n');
const answered = await show('4. A new question gets a grounded LLM reply', demoQuestion);
assert.equal((await scenario.cases.getInvestigationRuns(answered.caseId))[0].model_calls, 1);
await scenario.cases.updateStatus(answered.caseId, 'resolved', 'Demo member confirmed this helped');
await show('5. Different wording, answered from the same knowledge', 'Where can I find the event agenda and schedule for sessions?');
await scenario.learning.correctAndSupersede(saved.item.knowledge_id, { canonical_answer: demoCorrection }, 'demo-moderator');
await show('6. New questions use the corrected facts', demoQuestion);
await show('7. Account changes go to a human', 'Please reset my 2FA');
console.log('Observed counts for this run:', await scenario.cases.getImpact('demo-community'));

complete = true;
} finally {
  if (model instanceof PaperProvider) {
    const report = { recordedAt: new Date().toISOString(), complete, provider: 'paperinstruments', model: 'ultramarine-1-flash',
      synthetic: true, usage: model.getUsage(), costNote: 'USD estimate from returned token usage and published rates; not an invoice. Calls without usage are excluded.' };
    console.log('Paper Instruments usage and estimated cost:', JSON.stringify(report, null, 2));
    const index = process.argv.indexOf('--report');
    if (index >= 0) {
      const path = process.argv[index + 1];
      if (!path || path.startsWith('--')) throw new Error('--report requires a file path');
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(report, null, 2) + '\n');
    }
  }
}
