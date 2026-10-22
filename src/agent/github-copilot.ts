import { CaseRepository } from '../database/repositories/case.repo.js';
import { EvidenceRepository } from '../database/repositories/evidence.repo.js';
import { GitHubRepository } from '../database/repositories/github.repo.js';
import { GuildConfigRepository } from '../database/repositories/guild-config.repo.js';
import { AuditRepository } from '../database/repositories/audit.repo.js';
import { GitHubClient } from '../integrations/github/github.client.js';
import { ModelProvider } from '../integrations/model/model-provider.interface.js';
import { GitHubIssueDraftSchema, GitHubIssueDraft } from './schemas.js';
import { GitHubLink } from '../domain/github.js';
import { logger } from '../utils/logger.js';

export class GitHubCopilot {
  constructor(
    private caseRepo: CaseRepository,
    private evidenceRepo: EvidenceRepository,
    private githubRepo: GitHubRepository,
    private guildRepo: GuildConfigRepository,
    private auditRepo: AuditRepository,
    private githubClient: GitHubClient,
    private modelProvider: ModelProvider
  ) {}

  async prepareDraft(caseId: string, creatorId: string): Promise<{ link: GitHubLink; draft: GitHubIssueDraft }> {
    const supportCase = this.caseRepo.get(caseId);
    if (!supportCase) {
      throw new Error(`Case ${caseId} not found`);
    }

    const guildConfig = this.guildRepo.get(supportCase.guild_id);
    const connectedRepos = guildConfig?.connected_repos || [];
    if (connectedRepos.length === 0) {
      throw new Error(`No connected GitHub repository configured for this server. Use /setup to configure a repository.`);
    }

    const defaultRepo = connectedRepos[0];
    const [owner, name] = defaultRepo.split('/');

    // 1. Search for potential duplicates
    const searchResults = await this.githubClient.searchIssues(owner, name, supportCase.title);
    const potentialDuplicates = searchResults.map(r => r.number);

    // 2. Collect case evidence
    const evidence = this.evidenceRepo.getByCaseId(caseId);
    const evidenceText = evidence.map(e => `- [${e.source_type}] ${e.title || e.source_url || 'ref'}: ${e.excerpt}`).join('\n');

    // 3. Draft structured issue
    const draftPrompt = `You are ThreadSherpa GitHub Issue Copilot.
Convert this Discord technical support case into a high-quality, professional GitHub issue draft.

Case Title: "${supportCase.title}"
Case Summary: "${supportCase.summary || supportCase.title}"
Case Category: "${supportCase.category}"
Potential Duplicate Issue Numbers: ${potentialDuplicates.join(', ') || 'None'}

Evidence & Discussion Findings:
${evidenceText || 'None recorded'}

Output requirements:
- Clean title summarizing the bug
- Problem summary
- Expected vs actual behavior
- Reproduction steps (do NOT invent fake steps if absent)
- Environment details
- Error messages
- Tried workarounds
- Missing information`;

    const draft = await this.modelProvider.generateStructured({
      prompt: draftPrompt,
      schema: GitHubIssueDraftSchema,
      schemaName: 'GitHubIssueDraft',
      timeoutMs: 40000,
    });

    const safeSteps = draft.reproduction_steps || [];
    const safeErrors = draft.error_messages || [];
    const safeWorkarounds = draft.tried_workarounds || [];
    const safeDuplicates = draft.potential_duplicate_issue_numbers || [];
    const safeMissing = draft.missing_information || [];
    const safeEnvironment = draft.environment || 'Not specified';

    const normalizedDraft: GitHubIssueDraft = {
      title: draft.title,
      problem_summary: draft.problem_summary,
      expected_behavior: draft.expected_behavior,
      actual_behavior: draft.actual_behavior,
      reproduction_steps: safeSteps,
      environment: safeEnvironment,
      error_messages: safeErrors,
      tried_workarounds: safeWorkarounds,
      potential_duplicate_issue_numbers: safeDuplicates,
      missing_information: safeMissing,
    };

    const markdownBody = `## Problem Summary
${draft.problem_summary}

### Expected Behavior
${draft.expected_behavior}

### Actual Behavior
${draft.actual_behavior}

### Steps to Reproduce
${safeSteps.map((s, idx) => `${idx + 1}. ${s}`).join('\n') || '*Not provided*'}

### Environment Details
${safeEnvironment}

### Error Messages
\`\`\`
${safeErrors.join('\n') || 'None'}
\`\`\`

### Workarounds Tried
${safeWorkarounds.map(w => `- ${w}`).join('\n') || 'None'}

### Discord Case Reference
- Case ID: \`${caseId}\`
${safeDuplicates.length > 0 ? `\n### Potential Duplicates\n${safeDuplicates.map(n => `- #${n}`).join('\n')}` : ''}
`;

    const linkId = `gh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const savedLink = this.githubRepo.createDraft({
      link_id: linkId,
      case_id: caseId,
      repo_owner: owner,
      repo_name: name,
      draft_title: draft.title,
      draft_body: markdownBody,
      created_by: creatorId,
    });

    this.auditRepo.log({
      guild_id: supportCase.guild_id,
      actor_id: creatorId,
      action: 'github_issue_draft_created',
      target_type: 'github_link',
      target_id: linkId,
      metadata: { repo: defaultRepo, title: draft.title },
    });

    logger.info({ linkId, caseId, repo: defaultRepo }, 'Prepared GitHub issue draft');

    return { link: savedLink, draft: normalizedDraft };
  }

  async publishIssue(linkId: string, approverId: string): Promise<GitHubLink> {
    const link = this.githubRepo.get(linkId);
    if (!link) {
      throw new Error(`Draft ${linkId} not found`);
    }

    if (link.status === 'created') {
      return link; // Idempotent
    }

    const supportCase = this.caseRepo.get(link.case_id);
    if (!supportCase) {
      throw new Error(`Associated case ${link.case_id} not found`);
    }

    // Check allowlist
    const guildConfig = this.guildRepo.get(supportCase.guild_id);
    const repoStr = `${link.repo_owner}/${link.repo_name}`;
    if (!guildConfig?.connected_repos.includes(repoStr)) {
      throw new Error(`Repository ${repoStr} is not on the server allowlist`);
    }

    // Create via GitHub API
    const created = await this.githubClient.createIssue(
      link.repo_owner,
      link.repo_name,
      link.draft_title,
      link.draft_body
    );

    // Update link record
    const updated = this.githubRepo.markCreated(
      linkId,
      created.number,
      created.htmlUrl,
      approverId
    );

    this.auditRepo.log({
      guild_id: supportCase.guild_id,
      actor_id: approverId,
      action: 'github_issue_published',
      target_type: 'github_link',
      target_id: linkId,
      metadata: { repo: repoStr, issueNumber: created.number, url: created.htmlUrl },
    });

    logger.info({ linkId, issueNumber: created.number, url: created.htmlUrl }, 'Successfully created GitHub issue');

    return updated!;
  }
}
