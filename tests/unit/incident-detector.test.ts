import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from '../../src/database/connection.js';
import { runMigrations } from '../../src/database/migrator.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { IncidentRepository } from '../../src/database/repositories/incident.repo.js';
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';
import { IncidentDetector } from '../../src/agent/incident-detector.js';

describe('Shared Incident Detection Engine', () => {
  let db: DatabaseSync;
  let caseRepo: CaseRepository;
  let incidentRepo: IncidentRepository;
  let auditRepo: AuditRepository;
  let detector: IncidentDetector;
  const guildId = 'guild_incident_test';

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    runMigrations(db);

    caseRepo = new CaseRepository(db);
    incidentRepo = new IncidentRepository(db);
    auditRepo = new AuditRepository(db);
    detector = new IncidentDetector(caseRepo, incidentRepo, auditRepo);

    // Seed guild
    db.prepare('INSERT INTO guild_configs (guild_id) VALUES (?)').run(guildId);
  });

  afterEach(() => {
    db.close();
  });

  it('detects no incident on a single isolated report', () => {
    const singleCase = caseRepo.create({
      case_id: 'case_single_1',
      guild_id: guildId,
      channel_id: 'chan_1',
      message_id: 'msg_1',
      requester_id: 'u1',
      requester_username: 'u1',
      category: 'general',
      title: 'How do I change avatar?',
      status: 'new',
    });

    const result = detector.detectCluster(singleCase);
    expect(result.clusterFound).toBe(false);
  });

  it('forms a candidate incident when multiple reports share symptoms', () => {
    // First report
    caseRepo.create({
      case_id: 'case_outage_1',
      guild_id: guildId,
      channel_id: 'chan_1',
      message_id: 'msg_10',
      requester_id: 'u10',
      requester_username: 'alice',
      category: 'points_sync',
      title: 'Points not synchronizing after DEV hackathon submission',
      status: 'new',
    });

    // Second report with similar symptom
    const secondCase = caseRepo.create({
      case_id: 'case_outage_2',
      guild_id: guildId,
      channel_id: 'chan_1',
      message_id: 'msg_11',
      requester_id: 'u11',
      requester_username: 'bob',
      category: 'points_sync',
      title: 'DEV challenge submission points missing from profile',
      status: 'new',
    });

    const result = detector.detectCluster(secondCase);
    expect(result.clusterFound).toBe(true);
    expect(result.isNewIncident).toBe(true);
    expect(result.incident).toBeDefined();
    expect(result.incident?.verification_state).toBe('suspected');

    // Confirm incident by admin
    const confirmed = detector.confirmIncident(result.incident!.incident_id, 'admin_dave', 'Backend sync queue backlog');
    expect(confirmed?.verification_state).toBe('confirmed');

    // Third report arrives
    const thirdCase = caseRepo.create({
      case_id: 'case_outage_3',
      guild_id: guildId,
      channel_id: 'chan_1',
      message_id: 'msg_12',
      requester_id: 'u12',
      requester_username: 'charlie',
      category: 'points_sync',
      title: 'Points not updated on DEV dashboard',
      status: 'new',
    });

    const result3 = detector.detectCluster(thirdCase);
    expect(result3.clusterFound).toBe(true);
    expect(result3.isNewIncident).toBe(false);
    expect(result3.incident?.incident_id).toBe(result.incident!.incident_id);
    expect(result3.affectedCasesCount).toBe(3);
  });
});
