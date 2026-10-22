export type GitHubLinkStatus = 'draft' | 'approved' | 'created' | 'rejected' | 'failed';

export interface GitHubLink {
  link_id: string;
  case_id: string;
  repo_owner: string;
  repo_name: string;
  issue_number?: number | null;
  issue_url?: string | null;
  draft_title: string;
  draft_body: string;
  status: GitHubLinkStatus;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
  synced_at?: string | null;
}

export interface GitHubIssueCandidate {
  title: string;
  problem_summary: string;
  expected_behavior: string;
  actual_behavior: string;
  reproduction_steps: string[];
  environment: string;
  error_messages: string[];
  tried_workarounds: string[];
  evidence_links: string[];
  discord_case_id: string;
  potential_duplicate_issue_numbers: number[];
  missing_information: string[];
}
