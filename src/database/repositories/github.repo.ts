import type { Db } from 'mongodb';
import { GitHubLink, GitHubLinkStatus } from '../../domain/github.js';

export class GitHubRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection('github_links');
  }

  async createDraft(draft: {
    link_id: string;
    case_id: string;
    repo_owner: string;
    repo_name: string;
    draft_title: string;
    draft_body: string;
    created_by: string;
  }): Promise<GitHubLink> {
    const now = new Date().toISOString();
    const link: GitHubLink = {
      ...draft,
      status: 'draft',
      created_at: now,
    };

    await this.collection.insertOne({ ...link });
    return link;
  }

  async get(linkId: string): Promise<GitHubLink | null> {
    const doc = await this.collection.findOne({ link_id: linkId });
    if (!doc) return null;
    return this.mapDoc(doc as Record<string, unknown>);
  }

  async getByCaseId(caseId: string): Promise<GitHubLink[]> {
    const docs = await this.collection
      .find({ case_id: caseId })
      .sort({ created_at: -1 })
      .toArray();

    return docs.map(d => this.mapDoc(d as Record<string, unknown>));
  }

  async markCreated(linkId: string, issueNumber: number, issueUrl: string, approvedBy: string): Promise<GitHubLink | null> {
    const now = new Date().toISOString();
    await this.collection.updateOne(
      { link_id: linkId },
      {
        $set: {
          status: 'created',
          issue_number: issueNumber,
          issue_url: issueUrl,
          approved_by: approvedBy,
          synced_at: now,
        },
      }
    );

    return await this.get(linkId);
  }

  async updateStatus(linkId: string, status: GitHubLinkStatus, approvedBy?: string): Promise<GitHubLink | null> {
    const update: Record<string, unknown> = { status };
    if (approvedBy) {
      update.approved_by = approvedBy;
    }

    await this.collection.updateOne({ link_id: linkId }, { $set: update });
    return await this.get(linkId);
  }

  private mapDoc(doc: Record<string, unknown>): GitHubLink {
    return {
      link_id: String(doc.link_id),
      case_id: String(doc.case_id),
      repo_owner: String(doc.repo_owner),
      repo_name: String(doc.repo_name),
      issue_number: doc.issue_number ? Number(doc.issue_number) : null,
      issue_url: doc.issue_url ? String(doc.issue_url) : null,
      draft_title: String(doc.draft_title),
      draft_body: String(doc.draft_body),
      status: doc.status as GitHubLinkStatus,
      created_by: String(doc.created_by),
      approved_by: doc.approved_by ? String(doc.approved_by) : null,
      created_at: String(doc.created_at),
      synced_at: doc.synced_at ? String(doc.synced_at) : null,
    };
  }
}
