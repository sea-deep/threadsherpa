import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { connectDatabase, closeDatabase } from './database/connection.js';
import { KnowledgeRepository } from './database/repositories/knowledge.repo.js';
import { CaseRepository } from './database/repositories/case.repo.js';
import { OllamaProvider } from './integrations/model/ollama.provider.js';
import { ModelProvider } from './integrations/model/model-provider.interface.js';
import { MemoryRetriever } from './memory/retriever.js';

interface Fixture { guildId: string; knowledgeId: string; caseId: string; question: string; answer: string; }
const noInference: ModelProvider = {
  async generateText() { throw new Error('Retrieval must not generate'); },
  async generateStructured() { throw new Error('Retrieval must not generate'); },
  async generateEmbedding() { throw new Error('Retrieval must not embed'); },
  async healthCheck() { return { ok: true, models: [], selectedModelAvailable: false, embeddingModelAvailable: false }; },
};

async function phase(name: string, path: string) {
  if (!process.env.MONGODB_URI?.startsWith('mongodb+srv://')) throw new Error('This check requires a real Atlas connection in .env');
  const f = JSON.parse(await readFile(path, 'utf8')) as Fixture;
  const { db } = await connectDatabase({ uri: process.env.MONGODB_URI, dbName: process.env.MONGODB_DB_NAME || 'threadsherpa' });
  const knowledge = new KnowledgeRepository(db);
  const cases = new CaseRepository(db);
  try {
    if (name === 'write') {
      const collection = db.collection('knowledge_items');
      const indexes = await collection.listSearchIndexes('vector_index').toArray();
      if (!indexes.length) {
        const definition = JSON.parse(await readFile('docs/atlas-vector-index.json', 'utf8'));
        await collection.createSearchIndex({ name: 'vector_index', type: 'vectorSearch', definition });
        console.log('Created vector_index with local embeddings; no auto-embedding service.');
      }
      const local = new OllamaProvider({ baseUrl: process.env.OLLAMA_BASE_URL, embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL });
      const embedding = await local.generateEmbedding(f.question + ' ' + f.answer);
      assert.equal(embedding.length, 768, 'The configured vector index expects 768 dimensions');
      await knowledge.createCandidate({ knowledge_id: f.knowledgeId, guild_id: f.guildId, question_patterns: [f.question],
        canonical_answer: f.answer, embedding, created_by: 'synthetic-setup-check' });
      await knowledge.approve(f.knowledgeId, 'synthetic-setup-check');
      await writeFile(path + '.write', JSON.stringify({ pid: process.pid, approved: true, dimensions: embedding.length, at: new Date().toISOString() }));
      console.log('Process A: wrote and approved synthetic knowledge, then disconnected.');
    } else if (name === 'read') {
      const item = await knowledge.get(f.knowledgeId);
      assert.equal(item?.canonical_answer, f.answer);
      assert.equal(item?.approval_status, 'approved');
      assert.equal((await knowledge.getVersions(f.knowledgeId))[0]?.approval_state, 'approved');
      assert.equal((await knowledge.searchLexical(f.guildId, 'verification schedule'))[0]?.knowledge_id, f.knowledgeId);
      const foundKnowledge = await new MemoryRetriever(knowledge, cases, noInference).search(f.guildId, f.question);
      assert.equal(foundKnowledge.knowledge[0]?.knowledge_id, f.knowledgeId);
      assert.equal(foundKnowledge.knowledge[0]?.canonical_answer, f.answer);
      const collection = db.collection('knowledge_items');
      const deadline = Date.now() + 180_000;
      const query = (guildId: string) => collection.aggregate([
        { $vectorSearch: { index: 'vector_index', path: 'embedding', queryVector: item!.embedding, numCandidates: 50, limit: 5,
          filter: { guild_id: { $eq: guildId }, approval_status: { $eq: 'approved' } } } },
        { $project: { knowledge_id: 1, score: { $meta: 'vectorSearchScore' } } },
      ]).toArray();
      let found = false;
      let lastNotice = 0;
      while (Date.now() < deadline) {
        const indexes = await collection.listSearchIndexes('vector_index').toArray();
        if ((indexes[0] as { queryable?: boolean } | undefined)?.queryable) {
          try { found = (await query(f.guildId)).some(d => d.knowledge_id === f.knowledgeId); }
          catch (err) {
            // New free clusters can report an index ready before its search host is reachable.
            if (![6, 89, 91, 11600].includes(Number((err as { code?: number }).code))) throw err;
          }
        }
        if (found) break;
        if (Date.now() - lastNotice > 30_000) { console.log('Waiting for Atlas search service and synthetic document indexing…'); lastNotice = Date.now(); }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      assert.ok(found, 'Vector index did not become queryable with the document within three minutes');
      assert.equal((await query(f.guildId + '-other')).length, 0, 'Vector query must enforce server isolation');
      await writeFile(path + '.read', JSON.stringify({ pid: process.pid, at: new Date().toISOString(), approvedKnowledgeRead: true,
        approvedVersionRead: true, lexicalSearch: true, exactRetrievalAfterRestart: true, generationCalls: 0,
        realVectorSearch: true, crossGuildVectorIsolation: true }));
      console.log('Process B: read approved knowledge, retrieved it without inference (answer generation checked separately), and passed real Atlas vector queries.');
    } else if (name === 'cleanup') {
      // Only this run's unique synthetic identifiers are removed.
      for (const col of ['knowledge_items', 'knowledge_versions', 'knowledge_reviews']) await db.collection(col).deleteMany({ knowledge_id: f.knowledgeId });
      for (const col of ['support_cases', 'case_evidence', 'investigation_runs']) await db.collection(col).deleteMany({ case_id: f.caseId });
      console.log('Removed this run’s synthetic records. Kept the database and indexes.');
    } else throw new Error('Unknown verification phase');
  } finally { await closeDatabase(); }
}

async function child(name: string, path: string) {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--phase', name, path], {
      stdio: 'inherit', env: { ...process.env, LOG_LEVEL: 'fatal' },
    });
    proc.on('error', reject);
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`Atlas ${name} phase failed`)));
  });
}

try {
  if (process.argv[2] === '--phase') await phase(process.argv[3], process.argv[4]);
  else {
    const folder = await mkdtemp(join(tmpdir(), 'threadsherpa-atlas-check-'));
    const path = join(folder, 'fixture.json');
    const token = randomUUID();
    await writeFile(path, JSON.stringify({ guildId: `setup-check-${token}`, knowledgeId: `setup-knowledge-${token}`, caseId: `setup-case-${token}`,
      question: 'Where is the setup verification schedule?', answer: 'Synthetic verification answer: the schedule is in #setup-test. This is not a community policy.' } satisfies Fixture));
    try {
      await child('write', path);
      await child('read', path);
      const write = JSON.parse(await readFile(path + '.write', 'utf8'));
      const read = JSON.parse(await readFile(path + '.read', 'utf8'));
      assert.notEqual(write.pid, read.pid);
      await child('cleanup', path);
      const report = { recordedAt: new Date().toISOString(), synthetic: true, complete: true, separateNodeProcesses: true,
        write, read, syntheticRecordsRemoved: true, paidModelCalls: 0,
        limitations: 'Real Atlas persistence and vector-query check using synthetic records. Does not connect to Discord or measure production traffic. Cluster billing tier is verified separately through the Atlas CLI.' };
      await mkdir('data', { recursive: true });
      await writeFile('data/atlas-verification.json', JSON.stringify(report, null, 2) + '\n');
      console.log('Atlas verification passed. Saved data/atlas-verification.json. No Discord messages or paid model requests.');
    } catch (err) { await child('cleanup', path).catch(() => {}); throw err; }
    finally { await rm(folder, { recursive: true, force: true }); }
  }
} catch (err) {
  const error = err as Error & { code?: string | number };
  // No connection strings, passwords or raw driver error objects in setup output.
  console.error(`Atlas check failed (${error.name}${error.code ? ' ' + error.code : ''}). Check cluster readiness, network access and credentials; rerun npm run verify:atlas.`);
  process.exitCode = 1;
}
