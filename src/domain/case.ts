export type CaseStatus =
  | 'new'
  | 'triaging'
  | 'investigating'
  | 'awaiting_user'
  | 'awaiting_admin'
  | 'answered'
  | 'resolved'
  | 'reopened'
  | 'escalated'
  | 'closed';

export interface SupportCase {
  case_id: string;
  guild_id: string;
  channel_id: string;
  thread_id?: string | null;
  message_id: string;
  requester_id: string;
  requester_username: string;
  category: string;
  title: string;
  status: CaseStatus;
  summary?: string | null;
  last_answer?: string | null;
  resolution_outcome?: string | null;
  reopen_count: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export type EvidenceSourceType =
  | 'memory'
  | 'documentation'
  | 'web'
  | 'github_issue'
  | 'github_release'
  | 'discord_message';

export interface CaseEvidence {
  evidence_id: string;
  case_id: string;
  source_type: EvidenceSourceType;
  source_url?: string | null;
  title?: string | null;
  excerpt: string;
  authority_score: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type InvestigationStatus = 'running' | 'completed' | 'failed' | 'timeout' | 'escalated';

export interface InvestigationRun {
  run_id: string;
  case_id: string;
  status: InvestigationStatus;
  rounds_executed: number;
  tools_called: number;
  findings_summary?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
}
