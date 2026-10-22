import { logger } from '../../utils/logger.js';

export interface GitHubIssueResult {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  bodyExcerpt: string;
  createdAt: string;
  labels: string[];
}

export interface GitHubIssueDetail extends GitHubIssueResult {
  fullBody: string;
  commentsCount: number;
  author: string;
}

export interface GitHubReleaseResult {
  tagName: string;
  name: string;
  publishedAt: string;
  body: string;
}

export interface GitHubCreatedIssue {
  number: number;
  url: string;
  htmlUrl: string;
  title: string;
}

export class GitHubClient {
  private token?: string;

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ThreadSherpa-Copilot',
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    return headers;
  }

  async searchIssues(owner: string, repo: string, query: string): Promise<GitHubIssueResult[]> {
    const cleanTerms = query.replace(/[^\w\s-]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
    if (!cleanTerms) return [];

    const q = encodeURIComponent(`repo:${owner}/${repo} is:issue ${cleanTerms}`);
    const url = `https://api.github.com/search/issues?q=${q}&per_page=5`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        logger.warn({ status: response.status, owner, repo }, 'GitHub search issues request failed');
        return [];
      }

      const data = await response.json() as { items?: Array<Record<string, unknown>> };
      const items = data.items || [];

      return items.map(item => ({
        number: Number(item.number),
        title: String(item.title),
        url: String(item.html_url),
        state: item.state === 'closed' ? 'closed' : 'open',
        bodyExcerpt: String(item.body || '').slice(0, 300),
        createdAt: String(item.created_at),
        labels: Array.isArray(item.labels) ? (item.labels as Array<{ name: string }>).map(l => l.name) : [],
      }));
    } catch (err) {
      logger.error({ err, owner, repo }, 'Error searching GitHub issues');
      return [];
    }
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueDetail | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return null;

      const item = await response.json() as Record<string, unknown>;
      return {
        number: Number(item.number),
        title: String(item.title),
        url: String(item.html_url),
        state: item.state === 'closed' ? 'closed' : 'open',
        bodyExcerpt: String(item.body || '').slice(0, 300),
        fullBody: String(item.body || '').slice(0, 5000),
        createdAt: String(item.created_at),
        labels: Array.isArray(item.labels) ? (item.labels as Array<{ name: string }>).map(l => l.name) : [],
        commentsCount: Number(item.comments || 0),
        author: typeof item.user === 'object' && item.user ? String((item.user as Record<string, unknown>).login) : 'unknown',
      };
    } catch (err) {
      logger.error({ err, owner, repo, issueNumber }, 'Error fetching GitHub issue detail');
      return null;
    }
  }

  async searchReleases(owner: string, repo: string): Promise<GitHubReleaseResult[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=3`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];

      const items = await response.json() as Array<Record<string, unknown>>;
      return items.map(r => ({
        tagName: String(r.tag_name || ''),
        name: String(r.name || r.tag_name || ''),
        publishedAt: String(r.published_at || ''),
        body: String(r.body || '').slice(0, 1000),
      }));
    } catch (err) {
      logger.error({ err, owner, repo }, 'Error fetching GitHub releases');
      return [];
    }
  }

  async createIssue(owner: string, repo: string, title: string, body: string): Promise<GitHubCreatedIssue> {
    if (!this.token) {
      throw new Error('GITHUB_TOKEN is required to create an issue on GitHub');
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/issues`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub issue creation failed (HTTP ${response.status}): ${text}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return {
      number: Number(data.number),
      url: String(data.url),
      htmlUrl: String(data.html_url),
      title: String(data.title),
    };
  }
}
