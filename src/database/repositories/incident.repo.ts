import type { Db } from 'mongodb';
import { Incident, IncidentVerification } from '../../domain/incident.js';

export class IncidentRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection('incidents');
  }

  private get linksCollection() {
    return this.db.collection('incident_cases');
  }

  async create(incident: {
    incident_id: string;
    guild_id: string;
    title: string;
    symptom_cluster: string;
    verification_state?: IncidentVerification;
    suspected_cause?: string | null;
  }): Promise<Incident> {
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

    await this.collection.insertOne({ ...item });
    return item;
  }

  async get(incidentId: string): Promise<Incident | null> {
    const doc = await this.collection.findOne({ incident_id: incidentId });
    if (!doc) return null;
    return this.mapDoc(doc as Record<string, unknown>);
  }

  async linkCase(incidentId: string, caseId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.linksCollection.updateOne(
      { incident_id: incidentId, case_id: caseId },
      { $setOnInsert: { incident_id: incidentId, case_id: caseId, linked_at: now } },
      { upsert: true }
    );

    const count = await this.linksCollection.countDocuments({ incident_id: incidentId });
    await this.collection.updateOne(
      { incident_id: incidentId },
      { $set: { affected_case_count: count, updated_at: now } }
    );
  }

  async getLinkedCases(incidentId: string): Promise<string[]> {
    const docs = await this.linksCollection.find({ incident_id: incidentId }).toArray();
    return docs.map((d: Record<string, unknown>) => String(d.case_id));
  }

  async updateVerification(incidentId: string, state: IncidentVerification, notes?: string): Promise<Incident | null> {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      verification_state: state,
      updated_at: now,
    };
    if (notes) {
      update.resolution_notes = notes;
    }
    if (state === 'resolved') {
      update.resolved_at = now;
    }

    await this.collection.updateOne({ incident_id: incidentId }, { $set: update });
    return await this.get(incidentId);
  }

  async findActiveIncidents(guildId: string): Promise<Incident[]> {
    const docs = await this.collection
      .find({
        guild_id: guildId,
        verification_state: { $in: ['suspected', 'confirmed'] },
      })
      .sort({ updated_at: -1 })
      .toArray();

    return docs.map(d => this.mapDoc(d as Record<string, unknown>));
  }

  private mapDoc(doc: Record<string, unknown>): Incident {
    return {
      incident_id: String(doc.incident_id),
      guild_id: String(doc.guild_id),
      title: String(doc.title),
      symptom_cluster: String(doc.symptom_cluster),
      verification_state: doc.verification_state as IncidentVerification,
      affected_case_count: Number(doc.affected_case_count || 1),
      suspected_cause: doc.suspected_cause ? String(doc.suspected_cause) : null,
      resolution_notes: doc.resolution_notes ? String(doc.resolution_notes) : null,
      github_issue_url: doc.github_issue_url ? String(doc.github_issue_url) : null,
      created_at: String(doc.created_at),
      updated_at: String(doc.updated_at),
      resolved_at: doc.resolved_at ? String(doc.resolved_at) : null,
    };
  }
}
