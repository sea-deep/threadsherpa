import type { Db } from 'mongodb';
import { AuditEvent } from '../../domain/audit.js';

export class AuditRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection('audit_events');
  }

  async log(event: {
    guild_id: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEvent> {
    const event_id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const created_at = new Date().toISOString();

    const auditEvent: AuditEvent = {
      event_id,
      guild_id: event.guild_id,
      actor_id: event.actor_id,
      action: event.action,
      target_type: event.target_type,
      target_id: event.target_id,
      metadata: event.metadata || {},
      created_at,
    };

    await this.collection.insertOne({ ...auditEvent });
    return auditEvent;
  }

  async getByGuild(guildId: string, limit: number = 50): Promise<AuditEvent[]> {
    const docs = await this.collection
      .find({ guild_id: guildId })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    return docs.map((r: Record<string, unknown>) => ({
      event_id: String(r.event_id),
      guild_id: String(r.guild_id),
      actor_id: String(r.actor_id),
      action: String(r.action),
      target_type: String(r.target_type),
      target_id: String(r.target_id),
      metadata: (r.metadata && typeof r.metadata === 'object') ? r.metadata as Record<string, unknown> : {},
      created_at: String(r.created_at),
    }));
  }
}
