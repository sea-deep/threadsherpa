import { DatabaseSync } from 'node:sqlite';
import { AuditEvent } from '../../domain/audit.js';

export class AuditRepository {
  constructor(private db: DatabaseSync) {}

  log(event: {
    guild_id: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    metadata?: Record<string, unknown>;
  }): AuditEvent {
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

    this.db.prepare(`
      INSERT INTO audit_events (
        event_id, guild_id, actor_id, action, target_type, target_id, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditEvent.event_id,
      auditEvent.guild_id,
      auditEvent.actor_id,
      auditEvent.action,
      auditEvent.target_type,
      auditEvent.target_id,
      JSON.stringify(auditEvent.metadata),
      auditEvent.created_at
    );

    return auditEvent;
  }

  getByGuild(guildId: string, limit: number = 50): AuditEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_events
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(guildId, limit) as Array<Record<string, unknown>>;

    return rows.map(r => ({
      event_id: String(r.event_id),
      guild_id: String(r.guild_id),
      actor_id: String(r.actor_id),
      action: String(r.action),
      target_type: String(r.target_type),
      target_id: String(r.target_id),
      metadata: JSON.parse((r.metadata as string) || '{}'),
      created_at: String(r.created_at),
    }));
  }
}
