import { DatabaseSync } from 'node:sqlite';
import { CaseEvidence, EvidenceSourceType } from '../../domain/case.js';

export class EvidenceRepository {
  constructor(private db: DatabaseSync) {}

  add(evidence: Omit<CaseEvidence, 'created_at'>): CaseEvidence {
    const now = new Date().toISOString();
    const fullEvidence: CaseEvidence = {
      ...evidence,
      created_at: now,
    };

    this.db.prepare(`
      INSERT INTO case_evidence (
        evidence_id, case_id, source_type, source_url, title,
        excerpt, authority_score, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullEvidence.evidence_id,
      fullEvidence.case_id,
      fullEvidence.source_type,
      fullEvidence.source_url || null,
      fullEvidence.title || null,
      fullEvidence.excerpt,
      fullEvidence.authority_score,
      JSON.stringify(fullEvidence.metadata),
      fullEvidence.created_at
    );

    return fullEvidence;
  }

  getByCaseId(caseId: string): CaseEvidence[] {
    const rows = this.db.prepare(`
      SELECT * FROM case_evidence
      WHERE case_id = ?
      ORDER BY authority_score DESC, created_at DESC
    `).all(caseId) as Array<Record<string, unknown>>;

    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): CaseEvidence {
    return {
      evidence_id: String(row.evidence_id),
      case_id: String(row.case_id),
      source_type: row.source_type as EvidenceSourceType,
      source_url: row.source_url ? String(row.source_url) : null,
      title: row.title ? String(row.title) : null,
      excerpt: String(row.excerpt),
      authority_score: Number(row.authority_score || 0.5),
      metadata: JSON.parse((row.metadata as string) || '{}'),
      created_at: String(row.created_at),
    };
  }
}
