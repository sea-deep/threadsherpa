import { DatabaseSync } from 'node:sqlite';
import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeReview,
  KnowledgeStatus,
  KnowledgeAuthority,
  ScoredKnowledgeItem
} from '../../domain/knowledge.js';
import { cosineSimilarity, parseVector } from '../../utils/math.js';

export class KnowledgeRepository {
  constructor(private db: DatabaseSync) {}

  createCandidate(item: {
    knowledge_id: string;
    guild_id: string;
    question_patterns: string[];
    canonical_answer: string;
    applies_when?: string | null;
    does_not_apply_when?: string | null;
    authority?: KnowledgeAuthority;
    source_refs?: string[];
    embedding?: number[] | null;
    created_by: string;
  }): KnowledgeItem {
    const now = new Date().toISOString();
    const candidate: KnowledgeItem = {
      knowledge_id: item.knowledge_id,
      guild_id: item.guild_id,
      current_version: 1,
      question_patterns: item.question_patterns,
      canonical_answer: item.canonical_answer,
      applies_when: item.applies_when || null,
      does_not_apply_when: item.does_not_apply_when || null,
      authority: item.authority || 'approved_admin',
      approval_status: 'candidate',
      source_refs: item.source_refs || [],
      embedding: item.embedding || null,
      created_by: item.created_by,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO knowledge_items (
        knowledge_id, guild_id, current_version, question_patterns,
        canonical_answer, applies_when, does_not_apply_when, authority,
        approval_status, source_refs, embedding, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.knowledge_id,
      candidate.guild_id,
      candidate.current_version,
      JSON.stringify(candidate.question_patterns),
      candidate.canonical_answer,
      candidate.applies_when ?? null,
      candidate.does_not_apply_when ?? null,
      candidate.authority,
      candidate.approval_status,
      JSON.stringify(candidate.source_refs),
      candidate.embedding ? JSON.stringify(candidate.embedding) : null,
      candidate.created_by,
      candidate.created_at,
      candidate.updated_at
    );

    // Record initial draft version
    this.recordVersion({
      version_id: `${candidate.knowledge_id}_v1`,
      knowledge_id: candidate.knowledge_id,
      version: 1,
      canonical_answer: candidate.canonical_answer,
      question_patterns: candidate.question_patterns,
      applies_when: candidate.applies_when,
      does_not_apply_when: candidate.does_not_apply_when,
      evidence_refs: candidate.source_refs,
      proposer_id: candidate.created_by,
      approval_state: 'draft',
      created_at: now,
    });

    return candidate;
  }

  get(knowledgeId: string): KnowledgeItem | null {
    const row = this.db.prepare('SELECT * FROM knowledge_items WHERE knowledge_id = ?').get(knowledgeId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  approve(knowledgeId: string, reviewerId: string, decisionNotes?: string): KnowledgeItem | null {
    const existing = this.get(knowledgeId);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE knowledge_items SET
        approval_status = 'approved',
        verified_at = ?,
        updated_at = ?
      WHERE knowledge_id = ?
    `).run(now, now, knowledgeId);

    // Record approval in version history
    this.db.prepare(`
      UPDATE knowledge_versions SET
        approval_state = 'approved',
        reviewer_id = ?
      WHERE knowledge_id = ? AND version = ?
    `).run(reviewerId, knowledgeId, existing.current_version);

    // Record review decision
    this.recordReview({
      review_id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      knowledge_id: knowledgeId,
      version: existing.current_version,
      reviewer_id: reviewerId,
      decision: 'approve',
      decision_notes: decisionNotes,
      created_at: now,
    });

    // Add to FTS5 index
    this.syncFts(existing.knowledge_id, existing.guild_id, existing.question_patterns, existing.canonical_answer, existing.applies_when);

    return this.get(knowledgeId);
  }

  reject(knowledgeId: string, reviewerId: string, decisionNotes?: string): KnowledgeItem | null {
    const existing = this.get(knowledgeId);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE knowledge_items SET
        approval_status = 'rejected',
        updated_at = ?
      WHERE knowledge_id = ?
    `).run(now, knowledgeId);

    this.recordReview({
      review_id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      knowledge_id: knowledgeId,
      version: existing.current_version,
      reviewer_id: reviewerId,
      decision: 'reject',
      decision_notes: decisionNotes,
      created_at: now,
    });

    // Remove from FTS5 index so it is never retrieved
    this.removeFts(knowledgeId);

    return this.get(knowledgeId);
  }

  correctAndSupersede(
    knowledgeId: string,
    correction: {
      canonical_answer: string;
      question_patterns?: string[];
      applies_when?: string | null;
      does_not_apply_when?: string | null;
      change_reason?: string;
      source_refs?: string[];
      embedding?: number[] | null;
    },
    reviewerId: string
  ): KnowledgeItem | null {
    const existing = this.get(knowledgeId);
    if (!existing) return null;

    const nextVersion = existing.current_version + 1;
    const now = new Date().toISOString();

    const patterns = correction.question_patterns || existing.question_patterns;
    const applies = correction.applies_when !== undefined ? correction.applies_when : existing.applies_when;
    const doesNotApply = correction.does_not_apply_when !== undefined ? correction.does_not_apply_when : existing.does_not_apply_when;
    const sources = correction.source_refs || existing.source_refs;
    const embedding = correction.embedding !== undefined ? correction.embedding : existing.embedding;

    // Mark previous version superseded
    this.db.prepare(`
      UPDATE knowledge_versions SET approval_state = 'superseded'
      WHERE knowledge_id = ? AND version = ?
    `).run(knowledgeId, existing.current_version);

    // Update main item
    this.db.prepare(`
      UPDATE knowledge_items SET
        current_version = ?,
        canonical_answer = ?,
        question_patterns = ?,
        applies_when = ?,
        does_not_apply_when = ?,
        source_refs = ?,
        embedding = ?,
        approval_status = 'approved',
        verified_at = ?,
        updated_at = ?
      WHERE knowledge_id = ?
    `).run(
      nextVersion,
      correction.canonical_answer,
      JSON.stringify(patterns),
      applies ?? null,
      doesNotApply ?? null,
      JSON.stringify(sources),
      embedding ? JSON.stringify(embedding) : null,
      now,
      now,
      knowledgeId
    );

    // Record new version
    this.recordVersion({
      version_id: `${knowledgeId}_v${nextVersion}`,
      knowledge_id: knowledgeId,
      version: nextVersion,
      canonical_answer: correction.canonical_answer,
      question_patterns: patterns,
      applies_when: applies,
      does_not_apply_when: doesNotApply,
      change_reason: correction.change_reason || 'Admin correction',
      evidence_refs: sources,
      proposer_id: reviewerId,
      reviewer_id: reviewerId,
      approval_state: 'approved',
      created_at: now,
    });

    // Record review action
    this.recordReview({
      review_id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      knowledge_id: knowledgeId,
      version: nextVersion,
      reviewer_id: reviewerId,
      decision: 'supersede',
      decision_notes: correction.change_reason,
      created_at: now,
    });

    // Sync FTS
    this.syncFts(knowledgeId, existing.guild_id, patterns, correction.canonical_answer, applies);

    return this.get(knowledgeId);
  }

  delete(knowledgeId: string): boolean {
    const existing = this.get(knowledgeId);
    if (!existing) return false;

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE knowledge_items SET
        approval_status = 'deleted',
        updated_at = ?
      WHERE knowledge_id = ?
    `).run(now, knowledgeId);

    this.removeFts(knowledgeId);
    return true;
  }

  searchLexical(guildId: string, query: string, limit: number = 5): ScoredKnowledgeItem[] {
    const sanitized = query.replace(/[^\w\s]/gi, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' OR ');
    if (!sanitized) return [];

    try {
      const rows = this.db.prepare(`
        SELECT k.* FROM fts_knowledge f
        JOIN knowledge_items k ON f.knowledge_id = k.knowledge_id
        WHERE k.guild_id = ? AND k.approval_status = 'approved' AND fts_knowledge MATCH ?
        LIMIT ?
      `).all(guildId, sanitized, limit) as Array<Record<string, unknown>>;

      return rows.map((r, idx) => ({
        ...this.mapRow(r),
        similarity: Math.max(0.1, 1 - idx * 0.15),
        retrieval_method: 'lexical',
      }));
    } catch {
      return [];
    }
  }

  searchVector(guildId: string, queryEmbedding: number[], limit: number = 5, minSimilarity: number = 0.5): ScoredKnowledgeItem[] {
    if (!queryEmbedding || queryEmbedding.length === 0) return [];

    const rows = this.db.prepare(`
      SELECT * FROM knowledge_items
      WHERE guild_id = ? AND approval_status = 'approved' AND embedding IS NOT NULL
    `).all(guildId) as Array<Record<string, unknown>>;

    const scored: ScoredKnowledgeItem[] = [];

    for (const row of rows) {
      const item = this.mapRow(row);
      if (!item.embedding) continue;
      const sim = cosineSimilarity(queryEmbedding, item.embedding);
      if (sim >= minSimilarity) {
        scored.push({
          ...item,
          similarity: sim,
          retrieval_method: 'vector',
        });
      }
    }

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  searchHybrid(guildId: string, query: string, queryEmbedding?: number[] | null, limit: number = 5): ScoredKnowledgeItem[] {
    const lexicalResults = this.searchLexical(guildId, query, limit);
    const vectorResults = queryEmbedding ? this.searchVector(guildId, queryEmbedding, limit, 0.45) : [];

    const map = new Map<string, ScoredKnowledgeItem>();

    for (const item of lexicalResults) {
      map.set(item.knowledge_id, {
        ...item,
        similarity: item.similarity * 0.5,
        retrieval_method: 'lexical',
      });
    }

    for (const item of vectorResults) {
      const existing = map.get(item.knowledge_id);
      if (existing) {
        existing.similarity += item.similarity * 0.7;
        existing.retrieval_method = 'hybrid';
      } else {
        map.set(item.knowledge_id, {
          ...item,
          similarity: item.similarity * 0.7,
          retrieval_method: 'vector',
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  getPendingCandidates(guildId: string): KnowledgeItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM knowledge_items
      WHERE guild_id = ? AND approval_status IN ('candidate', 'pending_review')
      ORDER BY created_at DESC
    `).all(guildId) as Array<Record<string, unknown>>;

    return rows.map(r => this.mapRow(r));
  }

  getApproved(guildId: string): KnowledgeItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM knowledge_items
      WHERE guild_id = ? AND approval_status = 'approved'
      ORDER BY updated_at DESC
    `).all(guildId) as Array<Record<string, unknown>>;

    return rows.map(r => this.mapRow(r));
  }

  getVersions(knowledgeId: string): KnowledgeVersion[] {
    const rows = this.db.prepare(`
      SELECT * FROM knowledge_versions
      WHERE knowledge_id = ?
      ORDER BY version DESC
    `).all(knowledgeId) as Array<Record<string, unknown>>;

    return rows.map(r => ({
      version_id: String(r.version_id),
      knowledge_id: String(r.knowledge_id),
      version: Number(r.version),
      canonical_answer: String(r.canonical_answer),
      question_patterns: JSON.parse((r.question_patterns as string) || '[]'),
      applies_when: r.applies_when ? String(r.applies_when) : null,
      does_not_apply_when: r.does_not_apply_when ? String(r.does_not_apply_when) : null,
      change_reason: r.change_reason ? String(r.change_reason) : null,
      evidence_refs: JSON.parse((r.evidence_refs as string) || '[]'),
      proposer_id: String(r.proposer_id),
      reviewer_id: r.reviewer_id ? String(r.reviewer_id) : null,
      approval_state: r.approval_state as 'draft' | 'approved' | 'rejected' | 'superseded',
      created_at: String(r.created_at),
    }));
  }

  private recordVersion(ver: KnowledgeVersion): void {
    this.db.prepare(`
      INSERT INTO knowledge_versions (
        version_id, knowledge_id, version, canonical_answer,
        question_patterns, applies_when, does_not_apply_when,
        change_reason, evidence_refs, proposer_id, reviewer_id,
        approval_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ver.version_id,
      ver.knowledge_id,
      ver.version,
      ver.canonical_answer,
      JSON.stringify(ver.question_patterns),
      ver.applies_when || null,
      ver.does_not_apply_when || null,
      ver.change_reason || null,
      JSON.stringify(ver.evidence_refs),
      ver.proposer_id,
      ver.reviewer_id || null,
      ver.approval_state,
      ver.created_at
    );
  }

  private recordReview(rev: KnowledgeReview): void {
    this.db.prepare(`
      INSERT INTO knowledge_reviews (
        review_id, knowledge_id, version, reviewer_id,
        decision, decision_notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      rev.review_id,
      rev.knowledge_id,
      rev.version,
      rev.reviewer_id,
      rev.decision,
      rev.decision_notes || null,
      rev.created_at
    );
  }

  private syncFts(id: string, guildId: string, patterns: string[], answer: string, applies?: string | null): void {
    this.removeFts(id);
    this.db.prepare(`
      INSERT INTO fts_knowledge (knowledge_id, guild_id, question_patterns, canonical_answer, applies_when)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, guildId, patterns.join(' '), answer, applies || '');
  }

  private removeFts(id: string): void {
    this.db.prepare('DELETE FROM fts_knowledge WHERE knowledge_id = ?').run(id);
  }

  private mapRow(row: Record<string, unknown>): KnowledgeItem {
    return {
      knowledge_id: String(row.knowledge_id),
      guild_id: String(row.guild_id),
      current_version: Number(row.current_version || 1),
      question_patterns: JSON.parse((row.question_patterns as string) || '[]'),
      canonical_answer: String(row.canonical_answer),
      applies_when: row.applies_when ? String(row.applies_when) : null,
      does_not_apply_when: row.does_not_apply_when ? String(row.does_not_apply_when) : null,
      authority: row.authority as KnowledgeAuthority,
      approval_status: row.approval_status as KnowledgeStatus,
      source_refs: JSON.parse((row.source_refs as string) || '[]'),
      embedding: row.embedding ? parseVector(row.embedding as string) : null,
      created_by: String(row.created_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      verified_at: row.verified_at ? String(row.verified_at) : null,
      expires_at: row.expires_at ? String(row.expires_at) : null,
    };
  }
}
