export type KnowledgeAuthority =
  | 'official_doc'
  | 'maintainer'
  | 'approved_admin'
  | 'community_lead';

export type KnowledgeStatus =
  | 'candidate'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'stale'
  | 'superseded'
  | 'deleted';

export interface KnowledgeItem {
  knowledge_id: string;
  guild_id: string;
  current_version: number;
  question_patterns: string[];
  canonical_answer: string;
  applies_when?: string | null;
  does_not_apply_when?: string | null;
  authority: KnowledgeAuthority;
  approval_status: KnowledgeStatus;
  source_refs: string[];
  embedding?: number[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  verified_at?: string | null;
  expires_at?: string | null;
}

export interface KnowledgeVersion {
  version_id: string;
  knowledge_id: string;
  version: number;
  canonical_answer: string;
  question_patterns: string[];
  applies_when?: string | null;
  does_not_apply_when?: string | null;
  change_reason?: string | null;
  evidence_refs: string[];
  proposer_id: string;
  reviewer_id?: string | null;
  approval_state: 'draft' | 'approved' | 'rejected' | 'superseded';
  created_at: string;
}

export interface KnowledgeReview {
  review_id: string;
  knowledge_id: string;
  version: number;
  reviewer_id: string;
  decision: 'approve' | 'edit' | 'reject' | 'mark_temporary' | 'supersede';
  decision_notes?: string | null;
  created_at: string;
}

export interface ScoredKnowledgeItem extends KnowledgeItem {
  similarity: number;
  retrieval_method: 'exact' | 'lexical' | 'vector' | 'hybrid';
}
