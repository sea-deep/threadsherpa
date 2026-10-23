import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Db } from 'mongodb';
import { connectDatabase, closeDatabase, ensureMongoIndexes } from '../../src/database/connection.js';
import { cosineSimilarity } from '../../src/utils/math.js';

describe('MongoDB Unified Database Engine', () => {
  let db: Db;

  beforeEach(async () => {
    const conn = await connectDatabase({ inMemory: true });
    db = conn.db;
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('initializes MongoDB collections and indexes cleanly', async () => {
    await ensureMongoIndexes(db);

    // Verify collections can be accessed and indexed
    const guildConfigCol = db.collection('guild_configs');
    const casesCol = db.collection('support_cases');
    const knowledgeCol = db.collection('knowledge_items');
    const evidenceCol = db.collection('case_evidence');
    const previewsCol = db.collection('share_previews');
    const deliveryCol = db.collection('answer_deliveries');
    const auditCol = db.collection('audit_events');

    expect(guildConfigCol).toBeDefined();
    expect(casesCol).toBeDefined();
    expect(knowledgeCol).toBeDefined();
    expect(evidenceCol).toBeDefined();
    expect(previewsCol).toBeDefined();
    expect(deliveryCol).toBeDefined();
    expect(auditCol).toBeDefined();
  });

  it('is idempotent when verifying indexes multiple times', async () => {
    await ensureMongoIndexes(db);
    // Running a second time should not throw
    await expect(ensureMongoIndexes(db)).resolves.not.toThrow();
  });

  it('evaluates cosine_similarity for vector search correctly', () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];

    const sim1 = cosineSimilarity(vecA, vecB);
    expect(sim1).toBeCloseTo(1.0);

    const sim2 = cosineSimilarity(vecA, vecC);
    expect(sim2).toBeCloseTo(0.0);
  });

  it('supports text indexing and text search filter matching', async () => {
    const knowledgeCol = db.collection('knowledge_items');
    await knowledgeCol.insertOne({
      knowledge_id: 'k1',
      guild_id: 'g1',
      question_patterns: ['How to reset token auth error'],
      canonical_answer: 'Run the auth refresh command',
      applies_when: 'When auth token expires',
      approval_status: 'approved',
    });

    const results = await knowledgeCol.find({
      guild_id: 'g1',
      $text: { $search: 'token' },
    }).toArray();

    expect(results.length).toBe(1);
    expect(results[0].knowledge_id).toBe('k1');
  });
});
