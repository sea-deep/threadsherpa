import { DatabaseSync } from 'node:sqlite';
import { Incident, IncidentVerification } from '../../domain/incident.js';

export class IncidentRepository {
  constructor(private db: DatabaseSync) {}

  create(incident: {
    incident_id: string;
    guild_id: string;
    title: string;
    symptom_cluster: string;
    verification_state?: IncidentVerification;
    suspected_cause?: string | null;
  }): Incident {
    const now = new Date().toISOString();
    const item: Incident = {
      incident_id: incident.incident_id,
      guild_id: incident.guild_id,
      title: incident.title,
      symptom_cluster: incident.symptom_cluster,
      verification_state: incident.verification_state || 'suspected',
      affected_case_count: 1,
      suspected_cause: incident.suspected_cause || null,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO incidents (
        incident_id, guild_id, title, symptom_cluster,
        verification_state, affected_case_count, suspected_cause,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.incident_id,
      item.guild_id,
      item.title,
      item.symptom_cluster,
      item.verification_state,
      item.affected_case_count,
      item.suspected_cause ?? null,
      item.created_at,
      item.updated_at
    );

    return item;
  }

  get(incidentId: string): Incident | null {
    const row = this.db.prepare('SELECT * FROM incidents WHERE incident_id = ?').get(incidentId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  linkCase(incidentId: string, caseId: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO incident_cases (incident_id, case_id, linked_at)
      VALUES (?, ?, ?)
    `).run(incidentId, caseId, now);

    // Update affected count
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM incident_cases WHERE incident_id = ?').get(incidentId) as { count: number };
    this.db.prepare('UPDATE incidents SET affected_case_count = ?, updated_at = ? WHERE incident_id = ?')
      .run(countRow.count, now, incidentId);
  }

  getLinkedCases(incidentId: string): string[] {
    const rows = this.db.prepare('SELECT case_id FROM incident_cases WHERE incident_id = ?').all(incidentId) as Array<{ case_id: string }>;
    return rows.map(r => r.case_id);
  }

  updateVerification(incidentId: string, state: IncidentVerification, notes?: string): Incident | null {
    const now = new Date().toISOString();
    const resolvedAt = state === 'resolved' ? now : null;

    this.db.prepare(`
      UPDATE incidents SET
        verification_state = ?,
        resolution_notes = COALESCE(?, resolution_notes),
        resolved_at = COALESCE(?, resolved_at),
        updated_at = ?
      WHERE incident_id = ?
    `).run(state, notes || null, resolvedAt, now, incidentId);

    return this.get(incidentId);
  }

  findActiveIncidents(guildId: string): Incident[] {
    const rows = this.db.prepare(`
      SELECT * FROM incidents
      WHERE guild_id = ? AND verification_state IN ('suspected', 'confirmed')
      ORDER BY updated_at DESC
    `).all(guildId) as Array<Record<string, unknown>>;

    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): Incident {
    return {
      incident_id: String(row.incident_id),
      guild_id: String(row.guild_id),
      title: String(row.title),
      symptom_cluster: String(row.symptom_cluster),
      verification_state: row.verification_state as IncidentVerification,
      affected_case_count: Number(row.affected_case_count || 1),
      suspected_cause: row.suspected_cause ? String(row.suspected_cause) : null,
      resolution_notes: row.resolution_notes ? String(row.resolution_notes) : null,
      github_issue_url: row.github_issue_url ? String(row.github_issue_url) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      resolved_at: row.resolved_at ? String(row.resolved_at) : null,
    };
  }
}
