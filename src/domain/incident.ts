export type IncidentVerification = 'suspected' | 'confirmed' | 'rejected' | 'resolved';

export interface Incident {
  incident_id: string;
  guild_id: string;
  title: string;
  symptom_cluster: string;
  verification_state: IncidentVerification;
  affected_case_count: number;
  suspected_cause?: string | null;
  resolution_notes?: string | null;
  github_issue_url?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}
