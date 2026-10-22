import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Db } from 'mongodb';
import { connectDatabase, closeDatabase } from '../../src/database/connection.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { EvidenceRepository } from '../../src/database/repositories/evidence.repo.js';
import { GitHubRepository } from '../../src/database/repositories/github.repo.js';
import { GuildConfigRepository } from '../../src/database/repositories/guild-config.repo.js';
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';
import { GitHubCopilot } from '../../src/agent/github-copilot.js';
import { GitHubClient } from '../../src/integrations/github/github.client.js';
import { ModelProvider } from '../../src/integrations/model/model-provider.interface.js';

describe('GitHub Issue Copilot (MongoDB)', () => {
  let db: Db;
  let caseRepo: CaseRepository;
  let evidenceRepo: EvidenceRepository;
  let githubRepo: GitHubRepository;
  let guildRepo: GuildConfigRepository;
  let auditRepo: AuditRepository;
  let copilot: GitHubCopilot;
  const guildId = 'guild_gh_test';

  const mockModelProvider: ModelProvider = {
    generateText: vi.fn(),
    generateStructured: vi.fn().mockResolvedValue({
      title: 'Fix SQLite compilation crash on Node 26',
      problem_summary: 'Native bindings fail to compile on Node 26 due to V8 API changes.',
      expected_behavior: 'Package installs cleanly without errors',
      actual_behavior: 'node-gyp rebuild fails with error code 1',
      reproduction_steps: ['Install Node 26', 'Run npm install better-sqlite3'],
      environment: 'macOS Darwin arm64, Node 26.12.0',
      error_messages: ['no member named GetPrototype in v8::Object'],
      tried_workarounds: ['npm install --build-from-source'],
      potential_duplicate_issue_numbers: [101],
      missing_information: [],
    }),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
    healthCheck: vi.fn().mockResolvedValue({ ok: true, models: [], selectedModelAvailable: true, embeddingModelAvailable: true }),
  };

  const mockGithubClient = new GitHubClient('dummy_token');
  vi.spyOn(mockGithubClient, 'searchIssues').mockResolvedValue([
    {
      number: 101,
      title: 'Node 26 compilation support',
      url: 'https://github.com/sea-deep/threadsherpa/issues/101',
      state: 'open',
      bodyExcerpt: 'Need to update V8 headers',
      createdAt: new Date().toISOString(),
      labels: ['bug'],
    },
  ]);
  vi.spyOn(mockGithubClient, 'createIssue').mockResolvedValue({
    number: 102,
    url: 'https://api.github.com/repos/sea-deep/threadsherpa/issues/102',
    htmlUrl: 'https://github.com/sea-deep/threadsherpa/issues/102',
    title: 'Fix SQLite compilation crash on Node 26',
  });

  beforeEach(async () => {
    const conn = await connectDatabase({ inMemory: true });
    db = conn.db;

    caseRepo = new CaseRepository(db);
    evidenceRepo = new EvidenceRepository(db);
    githubRepo = new GitHubRepository(db);
    guildRepo = new GuildConfigRepository(db);
    auditRepo = new AuditRepository(db);

    await guildRepo.upsert({
      guild_id: guildId,
      connected_repos: ['sea-deep/threadsherpa'],
    });

    copilot = new GitHubCopilot(
      caseRepo,
      evidenceRepo,
      githubRepo,
      guildRepo,
      auditRepo,
      mockGithubClient,
      mockModelProvider
    );
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('prepares structured duplicate-checked GitHub issue draft', async () => {
    await caseRepo.create({
      case_id: 'case_gh_1',
      guild_id: guildId,
      channel_id: 'chan_1',
      message_id: 'msg_1',
      requester_id: 'u1',
      requester_username: 'alice',
      category: 'bug',
      title: 'SQLite compilation failure',
      status: 'new',
    });

    const { link, draft } = await copilot.prepareDraft('case_gh_1', 'u1');

    expect(link.status).toBe('draft');
    expect(link.draft_title).toContain('SQLite compilation crash');
    expect(draft.potential_duplicate_issue_numbers).toContain(101);
    expect(link.draft_body).toContain('Steps to Reproduce');
  });

  it('publishes issue after approval and records API issue number', async () => {
    await caseRepo.create({
      case_id: 'case_gh_2',
      guild_id: guildId,
      channel_id: 'chan_1',
      message_id: 'msg_2',
      requester_id: 'u2',
      requester_username: 'bob',
      category: 'bug',
      title: 'Build failure',
      status: 'new',
    });

    const { link } = await copilot.prepareDraft('case_gh_2', 'u2');
    const published = await copilot.publishIssue(link.link_id, 'admin_sarah');

    expect(published.status).toBe('created');
    expect(published.issue_number).toBe(102);
    expect(published.issue_url).toBe('https://github.com/sea-deep/threadsherpa/issues/102');
  });

  it('rejects publishing if repo is not on guild allowlist', async () => {
    await caseRepo.create({
      case_id: 'case_gh_3',
      guild_id: guildId,
      channel_id: 'chan_1',
      message_id: 'msg_3',
      requester_id: 'u3',
      requester_username: 'carol',
      category: 'bug',
      title: 'Build failure',
      status: 'new',
    });

    const draft = await githubRepo.createDraft({
      link_id: 'link_unauthorized_repo',
      case_id: 'case_gh_3',
      repo_owner: 'unauthorized-org',
      repo_name: 'private-repo',
      draft_title: 'Unallowed repo issue',
      draft_body: 'Body',
      status: 'draft',
      created_by: 'u3',
    });

    await expect(copilot.publishIssue(draft.link_id, 'admin_sarah')).rejects.toThrow('not on the server allowlist');
  });
});
