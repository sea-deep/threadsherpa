import { DatabaseSync } from 'node:sqlite';
import { GitHubLink, GitHubLinkStatus } from '../../domain/github.js';

export class GitHubRepository {
  constructor(private db: DatabaseSync) {}

  createDraft(draft: {
    link_id: string;
    case_id: string;
    repo_owner: string;
    repo_name: string;
    draft_title: string;
    draft_body: string;
    created_by: string;
  }): GitHubLink {
    const now = new Date().toISOString();
    const link: GitHubLink = {
      ...draft,
      status: 'draft',
      created_at: now,
    };

    this.db.prepare(`
      INSERT INTO github_links (
        link_id, case_id, repo_owner, repo_name,
        draft_title, draft_body, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      link.link_id,
      link.case_id,
      link.repo_owner,
      link.repo_name,
      link.draft_title,
      link.draft_body,
      link.status,
      link.created_by,
      link.created_at
    );

    return link;
  }

  get(linkId: string): GitHubLink | null {
    const row = this.db.prepare('SELECT * FROM github_links WHERE link_id = ?').get(linkId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  getByCaseId(caseId: string): GitHubLink[] {
    const rows = this.db.prepare('SELECT * FROM github_links WHERE case_id = ? ORDER BY created_at DESC').all(caseId) as Array<Record<string, unknown>>;
    return rows.map(r => this.mapRow(r));
  }

  markCreated(linkId: string, issueNumber: number, issueUrl: string, approvedBy: string): GitHubLink | null {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE github_links SET
        status = 'created',
        issue_number = ?,
        issue_url = ?,
        approved_by = ?,
        synced_at = ?
      WHERE link_id = ?
    `).run(issueNumber, issueUrl, approvedBy, now, linkId);

    return this.get(linkId);
  }

  updateStatus(linkId: string, status: GitHubLinkStatus, approvedBy?: string): GitHubLink | null {
    this.db.prepare(`
      UPDATE github_links SET
        status = ?,
        approved_by = COALESCE(?, approved_by)
      WHERE link_id = ?
    `).run(status, approvedBy || null, linkId);

    return this.get(linkId);
  }

  private mapRow(row: Record<string, unknown>): GitHubLink {
    return {
      link_id: String(row.link_id),
      case_id: String(row.case_id),
      repo_owner: String(row.repo_owner),
      repo_name: String(row.repo_name),
      issue_number: row.issue_number ? Number(row.issue_number) : null,
      issue_url: row.issue_url ? String(row.issue_url) : null,
      draft_title: String(row.draft_title),
      draft_body: String(row.draft_body),
      status: row.status as GitHubLinkStatus,
      created_by: String(row.created_by),
      approved_by: row.approved_by ? String(row.approved_by) : null,
      created_at: String(row.created_at),
      synced_at: row.synced_at ? String(row.synced_at) : null,
    };
  }
}
