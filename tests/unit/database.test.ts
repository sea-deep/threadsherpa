import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from '../../src/database/connection.js';
import { runMigrations } from '../../src/database/migrator.js';
import { cosineSimilarity } from '../../src/utils/math.js';

describe('Database and Migrations', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
  });

  afterEach(() => {
    db.close();
  });

  it('runs initial migrations cleanly', () => {
    const applied = runMigrations(db);
    expect(applied).toBe(1);

    // Verify tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('guild_configs');
    expect(tableNames).toContain('support_cases');
    expect(tableNames).toContain('case_evidence');
    expect(tableNames).toContain('knowledge_items');
    expect(tableNames).toContain('knowledge_versions');
    expect(tableNames).toContain('incidents');
    expect(tableNames).toContain('github_links');
    expect(tableNames).toContain('audit_events');
    expect(tableNames).toContain('fts_knowledge');
    expect(tableNames).toContain('fts_cases');
  });

  it('is idempotent when running migrations multiple times', () => {
    runMigrations(db);
    const appliedSecond = runMigrations(db);
    expect(appliedSecond).toBe(0);
  });

  it('evaluates cosine_similarity scalar function in SQL', () => {
    runMigrations(db);
    const vecA = JSON.stringify([1, 0, 0]);
    const vecB = JSON.stringify([1, 0, 0]);
    const vecC = JSON.stringify([0, 1, 0]);

    const res1 = db.prepare('SELECT cosine_similarity(?, ?) AS sim').get(vecA, vecB) as { sim: number };
    expect(res1.sim).toBeCloseTo(1.0);

    const res2 = db.prepare('SELECT cosine_similarity(?, ?) AS sim').get(vecA, vecC) as { sim: number };
    expect(res2.sim).toBeCloseTo(0.0);
  });

  it('supports FTS5 full-text indexing and retrieval', () => {
    runMigrations(db);
    db.prepare(`
      INSERT INTO fts_knowledge (knowledge_id, guild_id, question_patterns, canonical_answer, applies_when)
      VALUES (?, ?, ?, ?, ?)
    `).run('k1', 'g1', 'How to reset token auth error', 'Run the auth refresh command', 'When auth token expires');

    const results = db.prepare('SELECT knowledge_id FROM fts_knowledge WHERE fts_knowledge MATCH ?').all('token') as Array<{ knowledge_id: string }>;
    expect(results.length).toBe(1);
    expect(results[0].knowledge_id).toBe('k1');
  });
});
