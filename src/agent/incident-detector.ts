import { CaseRepository } from '../database/repositories/case.repo.js';
import { IncidentRepository } from '../database/repositories/incident.repo.js';
import { AuditRepository } from '../database/repositories/audit.repo.js';
import { Incident } from '../domain/incident.js';
import { SupportCase } from '../domain/case.js';
import { logger } from '../utils/logger.js';

export interface IncidentDetectionResult {
  clusterFound: boolean;
  incident?: Incident;
  isNewIncident: boolean;
  affectedCasesCount: number;
}

export class IncidentDetector {
  constructor(
    private caseRepo: CaseRepository,
    private incidentRepo: IncidentRepository,
    private auditRepo: AuditRepository
  ) {}

  detectCluster(currentCase: SupportCase): IncidentDetectionResult {
    // 1. Search for similar open cases in the same guild
    const similarCases = this.caseRepo.searchSimilarCases(currentCase.guild_id, currentCase.title, 6)
      .filter(c => c.case_id !== currentCase.case_id && c.status !== 'closed');

    if (similarCases.length === 0) {
      return { clusterFound: false, isNewIncident: false, affectedCasesCount: 1 };
    }

    // 2. Check if any similar case is already linked to an active incident
    const activeIncidents = this.incidentRepo.findActiveIncidents(currentCase.guild_id);

    for (const incident of activeIncidents) {
      const linkedCaseIds = this.incidentRepo.getLinkedCases(incident.incident_id);
      const isRelated = similarCases.some(c => linkedCaseIds.includes(c.case_id));

      if (isRelated) {
        // Link to existing incident
        this.incidentRepo.linkCase(incident.incident_id, currentCase.case_id);
        const updated = this.incidentRepo.get(incident.incident_id);

        logger.info({ incidentId: incident.incident_id, caseId: currentCase.case_id }, 'Linked case to existing incident');

        return {
          clusterFound: true,
          incident: updated || incident,
          isNewIncident: false,
          affectedCasesCount: updated?.affected_case_count || linkedCaseIds.length + 1,
        };
      }
    }

    // 3. If there are 2 or more similar cases, form a new suspected candidate incident
    if (similarCases.length >= 1) {
      const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const symptomClusterKey = currentCase.category || 'general_cluster';

      const newIncident = this.incidentRepo.create({
        incident_id: incidentId,
        guild_id: currentCase.guild_id,
        title: `Possible Incident: ${currentCase.title.slice(0, 80)}`,
        symptom_cluster: symptomClusterKey,
        verification_state: 'suspected',
        suspected_cause: 'Multiple similar reports detected',
      });

      // Link current case and the matching similar cases
      this.incidentRepo.linkCase(incidentId, currentCase.case_id);
      for (const simCase of similarCases.slice(0, 3)) {
        this.incidentRepo.linkCase(incidentId, simCase.case_id);
      }

      this.auditRepo.log({
        guild_id: currentCase.guild_id,
        actor_id: 'system',
        action: 'incident_candidate_created',
        target_type: 'incident',
        target_id: incidentId,
        metadata: { title: newIncident.title, cluster: symptomClusterKey },
      });

      logger.info({ incidentId, guildId: currentCase.guild_id }, 'Formed new candidate incident cluster');

      return {
        clusterFound: true,
        incident: newIncident,
        isNewIncident: true,
        affectedCasesCount: 1 + similarCases.length,
      };
    }

    return { clusterFound: false, isNewIncident: false, affectedCasesCount: 1 };
  }

  confirmIncident(incidentId: string, adminUserId: string, notes?: string): Incident | null {
    const updated = this.incidentRepo.updateVerification(incidentId, 'confirmed', notes);
    if (updated) {
      this.auditRepo.log({
        guild_id: updated.guild_id,
        actor_id: adminUserId,
        action: 'incident_confirmed',
        target_type: 'incident',
        target_id: incidentId,
        metadata: { notes },
      });
    }
    return updated;
  }

  resolveIncident(incidentId: string, adminUserId: string, resolutionNotes?: string): Incident | null {
    const updated = this.incidentRepo.updateVerification(incidentId, 'resolved', resolutionNotes);
    if (updated) {
      this.auditRepo.log({
        guild_id: updated.guild_id,
        actor_id: adminUserId,
        action: 'incident_resolved',
        target_type: 'incident',
        target_id: incidentId,
        metadata: { resolutionNotes },
      });
    }
    return updated;
  }
}
