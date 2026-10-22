import { DatabaseSync } from 'node:sqlite';
import { SupportCase, CaseStatus } from '../../domain/case.js';

export class CaseRepository {
  constructor(private db: DatabaseSync) {}

  create(caseData: Omit<SupportCase, 'reopen_count' | 'created_at' | 'updated_at'>): SupportCase {
    const now = new Date().toISOString();
    const fullCase: SupportCase = {
      ...caseData,
      reopen_count: 0,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO support_cases (
        case_id, guild_id, channel_id, thread_id, message_id,
        requester_id, requester_username, category, title, status,
        summary, last_answer, resolution_outcome, reopen_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullCase.case_id,
      fullCase.guild_id,
      fullCase.channel_id,
      fullCase.thread_id || null,
      fullCase.message_id,
      fullCase.requester_id,
      fullCase.requester_username,
      fullCase.category,
      fullCase.title,
      fullCase.status,
      fullCase.summary || null,
      fullCase.last_answer || null,
      fullCase.resolution_outcome || null,
      fullCase.reopen_count,
      fullCase.created_at,
      fullCase.updated_at
    );

    // Update FTS index
    this.db.prepare(`
      INSERT INTO fts_cases (case_id, guild_id, title, summary)
      VALUES (?, ?, ?, ?)
    `).run(fullCase.case_id, fullCase.guild_id, fullCase.title, fullCase.summary || '');

    return fullCase;
  }

  get(caseId: string): SupportCase | null {
    const row = this.db.prepare('SELECT * FROM support_cases WHERE case_id = ?').get(caseId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  getByThreadId(threadId: string): SupportCase | null {
    const row = this.db.prepare('SELECT * FROM support_cases WHERE thread_id = ?').get(threadId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  getByMessageId(messageId: string): SupportCase | null {
    const row = this.db.prepare('SELECT * FROM support_cases WHERE message_id = ?').get(messageId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  findActiveCase(channelId: string, threadId?: string): SupportCase | null {
    if (threadId) {
      const caseInThread = this.getByThreadId(threadId);
      if (caseInThread && caseInThread.status !== 'closed') return caseInThread;
    }
    const row = this.db.prepare(`
      SELECT * FROM support_cases
      WHERE channel_id = ? AND status NOT IN ('closed', 'resolved')
      ORDER BY created_at DESC LIMIT 1
    `).get(channelId) as Record<string, unknown> | undefined;

    return row ? this.mapRow(row) : null;
  }

  updateStatus(caseId: string, status: CaseStatus, outcome?: string): SupportCase | null {
    const existing = this.get(caseId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const resolvedAt = (status === 'resolved' || status === 'closed') ? now : existing.resolved_at;

    this.db.prepare(`
      UPDATE support_cases SET
        status = ?,
        resolution_outcome = COALESCE(?, resolution_outcome),
        resolved_at = ?,
        updated_at = ?
      WHERE case_id = ?
    `).run(status, outcome || null, resolvedAt || null, now, caseId);

    return this.get(caseId);
  }

  updateSummary(caseId: string, summary: string, lastAnswer?: string): SupportCase | null {
    const existing = this.get(caseId);
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE support_cases SET
        summary = ?,
        last_answer = COALESCE(?, last_answer),
        updated_at = ?
      WHERE case_id = ?
    `).run(summary, lastAnswer || null, now, caseId);

    // Update FTS index
    this.db.prepare('DELETE FROM fts_cases WHERE case_id = ?').run(caseId);
    this.db.prepare(`
      INSERT INTO fts_cases (case_id, guild_id, title, summary)
      VALUES (?, ?, ?, ?)
    `).run(caseId, existing.guild_id, existing.title, summary);

    return this.get(caseId);
  }

  reopen(caseId: string, reason?: string): SupportCase | null {
    const existing = this.get(caseId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const newCount = existing.reopen_count + 1;

    this.db.prepare(`
      UPDATE support_cases SET
        status = 'reopened',
        reopen_count = ?,
        resolved_at = NULL,
        resolution_outcome = COALESCE(?, resolution_outcome),
        updated_at = ?
      WHERE case_id = ?
    `).run(newCount, reason ? `Reopened: ${reason}` : null, now, caseId);

    return this.get(caseId);
  }

  searchSimilarCases(guildId: string, query: string, limit: number = 5): SupportCase[] {
    // Sanitize query for FTS5
    const sanitized = query.replace(/[^\w\s]/gi, ' ').trim().split(/\s+/).slice(0, 8).join(' OR ');
    if (!sanitized) return [];

    try {
      const rows = this.db.prepare(`
        SELECT c.* FROM fts_cases f
        JOIN support_cases c ON f.case_id = c.case_id
        WHERE f.guild_id = ? AND fts_cases MATCH ?
        LIMIT ?
      `).all(guildId, sanitized, limit) as Array<Record<string, unknown>>;

      return rows.map(r => this.mapRow(r));
    } catch {
      return [];
    }
  }

  private mapRow(row: Record<string, unknown>): SupportCase {
    return {
      case_id: String(row.case_id),
      guild_id: String(row.guild_id),
      channel_id: String(row.channel_id),
      thread_id: row.thread_id ? String(row.thread_id) : null,
      message_id: String(row.message_id),
      requester_id: String(row.requester_id),
      requester_username: String(row.requester_username),
      category: String(row.category),
      title: String(row.title),
      status: row.status as CaseStatus,
      summary: row.summary ? String(row.summary) : null,
      last_answer: row.last_answer ? String(row.last_answer) : null,
      resolution_outcome: row.resolution_outcome ? String(row.resolution_outcome) : null,
      reopen_count: Number(row.reopen_count || 0),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      resolved_at: row.resolved_at ? String(row.resolved_at) : null,
    };
  }
}
