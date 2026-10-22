import type { Db } from 'mongodb';
import { CaseEvidence, EvidenceSourceType } from '../../domain/case.js';

export class EvidenceRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection('case_evidence');
  }

  async add(evidence: Omit<CaseEvidence, 'created_at'>): Promise<CaseEvidence> {
    const now = new Date().toISOString();
    const fullEvidence: CaseEvidence = {
      ...evidence,
      created_at: now,
    };

    await this.collection.insertOne({ ...fullEvidence });
    return fullEvidence;
  }

  async getByCaseId(caseId: string): Promise<CaseEvidence[]> {
    const docs = await this.collection
      .find({ case_id: caseId })
      .sort({ authority_score: -1, created_at: -1 })
      .toArray();

    return docs.map(d => this.mapDoc(d as Record<string, unknown>));
  }

  private mapDoc(doc: Record<string, unknown>): CaseEvidence {
    return {
      evidence_id: String(doc.evidence_id),
      case_id: String(doc.case_id),
      source_type: doc.source_type as EvidenceSourceType,
      source_url: doc.source_url ? String(doc.source_url) : null,
      title: doc.title ? String(doc.title) : null,
      excerpt: String(doc.excerpt),
      authority_score: Number(doc.authority_score || 0.5),
      metadata: (doc.metadata && typeof doc.metadata === 'object') ? doc.metadata as Record<string, unknown> : {},
      created_at: String(doc.created_at),
    };
  }
}
