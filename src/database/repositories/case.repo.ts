import type { Db } from 'mongodb';
import { SupportCase, CaseStatus } from '../../domain/case.js';

export interface InvestigationRunRecord {
  run_id: string;
  case_id: string;
  status: 'completed' | 'failed';
  rounds_executed: number;
  tools_called: number;
  findings_summary?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at: string;
}

export class CaseRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection('support_cases');
  }

  private get runsCollection() {
    return this.db.collection('investigation_runs');
  }

  async create(caseData: Omit<SupportCase, 'reopen_count' | 'created_at' | 'updated_at'>): Promise<SupportCase> {
    const now = new Date().toISOString();
    const fullCase: SupportCase = {
      ...caseData,
      reopen_count: 0,
      created_at: now,
      updated_at: now,
    };

    await this.collection.insertOne({ ...fullCase });
    return fullCase;
  }

  async get(caseId: string): Promise<SupportCase | null> {
    const doc = await this.collection.findOne({ case_id: caseId });
    if (!doc) return null;
    return this.mapDoc(doc as Record<string, unknown>);
  }

  async getByThreadId(threadId: string): Promise<SupportCase | null> {
    const doc = await this.collection.findOne({ thread_id: threadId });
    if (!doc) return null;
    return this.mapDoc(doc as Record<string, unknown>);
  }

  async findActiveCase(channelId: string, threadId?: string): Promise<SupportCase | null> {
    if (threadId) {
      const doc = await this.collection.findOne({ thread_id: threadId, status: { $ne: 'closed' } });
      if (doc) return this.mapDoc(doc as Record<string, unknown>);
    }
    const doc = await this.collection.findOne(
      { channel_id: channelId, status: { $nin: ['closed', 'resolved'] } },
      { sort: { created_at: -1 } }
    );
    return doc ? this.mapDoc(doc as Record<string, unknown>) : null;
  }

  async updateStatus(caseId: string, status: CaseStatus, outcome?: string): Promise<SupportCase | null> {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status,
      updated_at: now,
    };
    if (status === 'resolved' || status === 'closed') {
      update.resolved_at = now;
    }
    if (outcome) {
      update.resolution_outcome = outcome;
    }

    await this.collection.updateOne({ case_id: caseId }, { $set: update });
    return await this.get(caseId);
  }

  async reopen(caseId: string, reason?: string): Promise<SupportCase | null> {
    const existing = await this.get(caseId);
    if (!existing) return null;
    const now = new Date().toISOString();
    await this.collection.updateOne(
      { case_id: caseId },
      {
        $set: {
          status: 'reopened',
          resolution_outcome: reason || null,
          updated_at: now,
        },
        $inc: { reopen_count: 1 },
      }
    );
    return await this.get(caseId);
  }

  async updateSummary(caseId: string, summary: string, lastAnswer?: string): Promise<SupportCase | null> {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      summary,
      updated_at: now,
    };
    if (lastAnswer) {
      update.last_answer = lastAnswer;
    }

    await this.collection.updateOne({ case_id: caseId }, { $set: update });
    return await this.get(caseId);
  }

  async searchSimilarCases(guildId: string, query: string, limit: number = 5): Promise<SupportCase[]> {
    try {
      const docs = await this.collection.find({
        guild_id: guildId,
        $text: { $search: query },
      })
      .limit(limit)
      .toArray();

      return docs.map(d => this.mapDoc(d as Record<string, unknown>));
    } catch {
      const regex = new RegExp(query.split(/\s+/).slice(0, 3).join('|'), 'i');
      const docs = await this.collection.find({
        guild_id: guildId,
        $or: [{ title: { $regex: regex } }, { summary: { $regex: regex } }],
      }).limit(limit).toArray();

      return docs.map(d => this.mapDoc(d as Record<string, unknown>));
    }
  }

  async recordInvestigationRun(run: InvestigationRunRecord): Promise<void> {
    await this.runsCollection.insertOne({ ...run });
  }

  async getInvestigationRuns(caseId: string): Promise<InvestigationRunRecord[]> {
    const docs = await this.runsCollection.find({ case_id: caseId }).sort({ started_at: -1 }).toArray();
    return docs.map((d: Record<string, unknown>) => ({
      run_id: String(d.run_id),
      case_id: String(d.case_id),
      status: d.status as 'completed' | 'failed',
      rounds_executed: Number(d.rounds_executed || 0),
      tools_called: Number(d.tools_called || 0),
      findings_summary: d.findings_summary ? String(d.findings_summary) : null,
      error_message: d.error_message ? String(d.error_message) : null,
      started_at: String(d.started_at),
      completed_at: String(d.completed_at),
    }));
  }

  private mapDoc(doc: Record<string, unknown>): SupportCase {
    return {
      case_id: String(doc.case_id),
      guild_id: String(doc.guild_id),
      channel_id: String(doc.channel_id),
      thread_id: doc.thread_id ? String(doc.thread_id) : null,
      message_id: String(doc.message_id),
      requester_id: String(doc.requester_id),
      requester_username: String(doc.requester_username),
      category: String(doc.category),
      title: String(doc.title),
      status: doc.status as CaseStatus,
      summary: doc.summary ? String(doc.summary) : null,
      last_answer: doc.last_answer ? String(doc.last_answer) : null,
      resolution_outcome: doc.resolution_outcome ? String(doc.resolution_outcome) : null,
      reopen_count: Number(doc.reopen_count || 0),
      created_at: String(doc.created_at),
      updated_at: String(doc.updated_at),
      resolved_at: doc.resolved_at ? String(doc.resolved_at) : null,
    };
  }
}
