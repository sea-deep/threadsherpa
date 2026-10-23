import type { Db } from 'mongodb';
import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeReview,
  ScoredKnowledgeItem,
  KnowledgeAuthority,
  KnowledgeStatus,
} from '../../domain/knowledge.js';
import { isCurrentKnowledge, lexicalScore, normalizeQuestion, searchTokens } from '../../memory/matching.js';
import { cosineSimilarity } from '../../utils/math.js';
import { logger } from '../../utils/logger.js';

export class KnowledgeRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection('knowledge_items');
  }

  private get versionsCollection() {
    return this.db.collection('knowledge_versions');
  }

  private get reviewsCollection() {
    return this.db.collection('knowledge_reviews');
  }

  async createCandidate(item: {
    knowledge_id: string;
    guild_id: string;
    question_patterns: string[];
    question_context?: string | null;
    canonical_answer: string;
    applies_when?: string | null;
    does_not_apply_when?: string | null;
    authority?: KnowledgeAuthority;
    source_refs?: string[];
    origin_case_id?: string | null;
    embedding?: number[] | null;
    created_by: string;
    expires_at?: string | null;
  }): Promise<KnowledgeItem> {
    const now = new Date().toISOString();
    const candidate: KnowledgeItem = {
      knowledge_id: item.knowledge_id,
      guild_id: item.guild_id,
      current_version: 1,
      question_patterns: item.question_patterns,
      question_context: item.question_context || null,
      canonical_answer: item.canonical_answer,
      applies_when: item.applies_when || null,
      does_not_apply_when: item.does_not_apply_when || null,
      authority: item.authority || 'approved_admin',
      approval_status: 'candidate',
      source_refs: item.source_refs || [],
      origin_case_id: item.origin_case_id || null,
      embedding: item.embedding || null,
      expires_at: item.expires_at || null,
      created_by: item.created_by,
      created_at: now,
      updated_at: now,
    };

    await this.collection.insertOne({ ...candidate });

    // Insert version 1 draft
    const ver1: KnowledgeVersion = {
      version_id: `${candidate.knowledge_id}_v1`,
      knowledge_id: candidate.knowledge_id,
      version: 1,
      canonical_answer: candidate.canonical_answer,
      question_patterns: candidate.question_patterns,
      question_context: candidate.question_context,
      applies_when: candidate.applies_when,
      does_not_apply_when: candidate.does_not_apply_when,
      evidence_refs: candidate.source_refs,
      proposer_id: candidate.created_by,
      approval_state: 'draft',
      created_at: now,
    };
    await this.versionsCollection.insertOne({ ...ver1 });

    return candidate;
  }

  async get(knowledgeId: string): Promise<KnowledgeItem | null> {
    const doc = await this.collection.findOne({ knowledge_id: knowledgeId });
    if (!doc) return null;
    return this.mapDoc(doc as Record<string, unknown>);
  }

  async approve(knowledgeId: string, reviewerId: string, decisionNotes?: string): Promise<KnowledgeItem | null> {
    const existing = await this.get(knowledgeId);
    if (!existing || !['candidate', 'pending_review'].includes(existing.approval_status)) return null;

    const now = new Date().toISOString();
    const claimed = await this.collection.updateOne(
      { knowledge_id: knowledgeId, approval_status: existing.approval_status },
      { $set: { approval_status: 'approved', verified_at: now, updated_at: now } }
    );

    if (!claimed.modifiedCount) return null;
    await this.versionsCollection.updateOne(
      { knowledge_id: knowledgeId, version: existing.current_version },
      { $set: { approval_state: 'approved', reviewer_id: reviewerId } }
    );

    const rev: KnowledgeReview = {
      review_id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      knowledge_id: knowledgeId,
      version: existing.current_version,
      reviewer_id: reviewerId,
      decision: 'approve',
      decision_notes: decisionNotes,
      created_at: now,
    };
    await this.reviewsCollection.insertOne({ ...rev });

    return await this.get(knowledgeId);
  }

  async reject(knowledgeId: string, reviewerId: string, decisionNotes?: string): Promise<KnowledgeItem | null> {
    const existing = await this.get(knowledgeId);
    if (!existing || !['candidate', 'pending_review'].includes(existing.approval_status)) return null;

    const now = new Date().toISOString();
    const claimed = await this.collection.updateOne(
      { knowledge_id: knowledgeId, approval_status: existing.approval_status },
      { $set: { approval_status: 'rejected', updated_at: now } }
    );

    if (!claimed.modifiedCount) return null;
    const rev: KnowledgeReview = {
      review_id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      knowledge_id: knowledgeId,
      version: existing.current_version,
      reviewer_id: reviewerId,
      decision: 'reject',
      decision_notes: decisionNotes,
      created_at: now,
    };
    await this.reviewsCollection.insertOne({ ...rev });

    return await this.get(knowledgeId);
  }

  async correctAndSupersede(
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
  ): Promise<KnowledgeItem | null> {
    const existing = await this.get(knowledgeId);
    if (!existing || existing.approval_status !== 'approved') return null;

    const nextVersion = existing.current_version + 1;
    const now = new Date().toISOString();

    const patterns = correction.question_patterns || existing.question_patterns;
    const applies = correction.applies_when !== undefined ? correction.applies_when : existing.applies_when;
    const doesNotApply = correction.does_not_apply_when !== undefined ? correction.does_not_apply_when : existing.does_not_apply_when;
    const sources = correction.source_refs || existing.source_refs;
    const embedding = correction.embedding ?? null;

    // Mark previous version superseded
    await this.versionsCollection.updateOne(
      { knowledge_id: knowledgeId, version: existing.current_version },
      { $set: { approval_state: 'superseded' } }
    );

    // Update main item
    await this.collection.updateOne(
      { knowledge_id: knowledgeId },
      {
        $set: {
          current_version: nextVersion,
          canonical_answer: correction.canonical_answer,
          question_patterns: patterns,
          applies_when: applies,
          does_not_apply_when: doesNotApply,
          source_refs: sources,
          embedding,
          approval_status: 'approved',
          verified_at: now,
          updated_at: now,
        },
      }
    );

    // Record new version
    const ver: KnowledgeVersion = {
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
    };
    await this.versionsCollection.insertOne({ ...ver });

    return await this.get(knowledgeId);
  }

  async delete(knowledgeId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await this.collection.updateOne(
      { knowledge_id: knowledgeId },
      { $set: { approval_status: 'deleted', updated_at: now } }
    );
    return res.modifiedCount > 0;
  }

  async searchExact(guildId: string, query: string): Promise<ScoredKnowledgeItem[]> {
    const normalized = normalizeQuestion(query);
    if (!normalized) return [];
    return (await this.getApproved(guildId))
      .filter(item => item.question_patterns.some(p => normalizeQuestion(p) === normalized))
      .map(item => ({ ...item, similarity: 1, retrieval_method: 'exact' as const }));
  }

  async searchLexical(guildId: string, query: string, limit: number = 5): Promise<ScoredKnowledgeItem[]> {
    const tokens = searchTokens(query);
    if (!tokens.length) return [];
    let docs;
    try {
      docs = await this.collection.find({
        guild_id: guildId, approval_status: 'approved', $text: { $search: tokens.join(' ') },
      }).toArray();
    } catch {
      // Escaping prevents a member's search from becoming a regular expression.
      const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regex = new RegExp(escaped.join('|'), 'i');
      docs = await this.collection.find({
        guild_id: guildId, approval_status: 'approved',
        $or: [{ question_patterns: { $regex: regex } }, { canonical_answer: { $regex: regex } }],
      }).toArray();
    }
    return docs.map(doc => this.mapDoc(doc as Record<string, unknown>))
      .filter(isCurrentKnowledge)
      .map(item => ({ ...item, similarity: lexicalScore(query, item), retrieval_method: 'lexical' as const }))
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  async searchVector(guildId: string, queryEmbedding: number[], limit: number = 5, minSimilarity: number = 0.5): Promise<ScoredKnowledgeItem[]> {
    if (!queryEmbedding || queryEmbedding.length === 0) return [];

    try {
      // 1. Attempt MongoDB Atlas $vectorSearch aggregation stage if configured on Atlas
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: limit * 10,
            limit: limit,
            filter: {
              guild_id: { $eq: guildId },
              approval_status: { $eq: 'approved' },
            },
          },
        },
        { $set: { score: { $meta: 'vectorSearchScore' } } },
      ];

      const cursor = this.collection.aggregate(pipeline);
      const docs = await cursor.toArray();
      if (docs.length > 0) {
        return docs.map((doc: Record<string, unknown>) => ({
          ...this.mapDoc(doc),
          similarity: Number(doc.score ?? 0),
          retrieval_method: 'vector' as const,
        })).filter(item => item.guild_id === guildId && isCurrentKnowledge(item) && item.similarity >= minSimilarity);
      }
    } catch {
      // Standalone MongoDB or local instance: perform in-memory cosine ranking
      logger.debug('Atlas $vectorSearch not available; executing exact vector similarity ranking');
    }

    // Exact vector cosine ranking fallback
    const docs = await this.collection.find({
      guild_id: guildId,
      approval_status: 'approved',
      embedding: { $ne: null },
    }).toArray();

    const scored: ScoredKnowledgeItem[] = [];
    for (const doc of docs) {
      const item = this.mapDoc(doc as Record<string, unknown>);
      if (!item.embedding || !isCurrentKnowledge(item)) continue;
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

  async searchHybrid(guildId: string, query: string, queryEmbedding?: number[] | null, limit: number = 5): Promise<ScoredKnowledgeItem[]> {
    const lexical = await this.searchLexical(guildId, query, limit);
    const vector = queryEmbedding ? await this.searchVector(guildId, queryEmbedding, limit, 0.45) : [];

    const map = new Map<string, ScoredKnowledgeItem>();

    for (const item of lexical) {
      map.set(item.knowledge_id, {
        ...item,
        similarity: item.similarity,
        retrieval_method: 'lexical',
      });
    }

    for (const item of vector) {
      const existing = map.get(item.knowledge_id);
      if (existing) {
        existing.similarity = Math.max(existing.similarity, item.similarity);
        existing.retrieval_method = 'hybrid';
      } else {
        map.set(item.knowledge_id, {
          ...item,
          similarity: item.similarity,
          retrieval_method: 'vector',
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async getPendingCandidates(guildId: string): Promise<KnowledgeItem[]> {
    const docs = await this.collection.find({
      guild_id: guildId,
      approval_status: { $in: ['candidate', 'pending_review'] },
    }).sort({ created_at: -1 }).toArray();

    return docs.map(d => this.mapDoc(d as Record<string, unknown>));
  }

  async getApproved(guildId: string): Promise<KnowledgeItem[]> {
    const docs = await this.collection.find({
      guild_id: guildId,
      approval_status: 'approved',
    }).sort({ updated_at: -1 }).toArray();

    return docs.map(d => this.mapDoc(d as Record<string, unknown>)).filter(isCurrentKnowledge);
  }

  async getVersions(knowledgeId: string): Promise<KnowledgeVersion[]> {
    const docs = await this.versionsCollection.find({
      knowledge_id: knowledgeId,
    }).sort({ version: -1 }).toArray();

    return docs.map((d: Record<string, unknown>) => ({
      version_id: String(d.version_id),
      knowledge_id: String(d.knowledge_id),
      version: Number(d.version),
      canonical_answer: String(d.canonical_answer),
      question_patterns: Array.isArray(d.question_patterns) ? d.question_patterns.map(String) : [],
      applies_when: d.applies_when ? String(d.applies_when) : null,
      does_not_apply_when: d.does_not_apply_when ? String(d.does_not_apply_when) : null,
      change_reason: d.change_reason ? String(d.change_reason) : null,
      evidence_refs: Array.isArray(d.evidence_refs) ? d.evidence_refs.map(String) : [],
      proposer_id: String(d.proposer_id),
      reviewer_id: d.reviewer_id ? String(d.reviewer_id) : null,
      approval_state: d.approval_state as 'draft' | 'approved' | 'rejected' | 'superseded',
      created_at: String(d.created_at),
    }));
  }

  private mapDoc(doc: Record<string, unknown>): KnowledgeItem {
    return {
      knowledge_id: String(doc.knowledge_id),
      guild_id: String(doc.guild_id),
      current_version: Number(doc.current_version || 1),
      question_context: doc.question_context ? String(doc.question_context) : null,
      question_patterns: Array.isArray(doc.question_patterns) ? doc.question_patterns.map(String) : [],
      canonical_answer: String(doc.canonical_answer),
      applies_when: doc.applies_when ? String(doc.applies_when) : null,
      does_not_apply_when: doc.does_not_apply_when ? String(doc.does_not_apply_when) : null,
      authority: doc.authority as KnowledgeAuthority,
      approval_status: doc.approval_status as KnowledgeStatus,
      origin_case_id: doc.origin_case_id ? String(doc.origin_case_id) : null,
      source_refs: Array.isArray(doc.source_refs) ? doc.source_refs.map(String) : [],
      embedding: Array.isArray(doc.embedding) ? doc.embedding.map(Number) : null,
      created_by: String(doc.created_by),
      created_at: String(doc.created_at),
      updated_at: String(doc.updated_at),
      verified_at: doc.verified_at ? String(doc.verified_at) : null,
      expires_at: doc.expires_at ? String(doc.expires_at) : null,
    };
  }
}
