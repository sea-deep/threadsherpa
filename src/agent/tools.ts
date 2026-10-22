import { MemoryRetriever } from '../memory/retriever.js';
import { SafeFetcher } from '../integrations/web/safe-fetcher.js';
import { GitHubClient } from '../integrations/github/github.client.js';
import { SerpApiClient } from '../integrations/web/serpapi.client.js';
import { CaseRepository } from '../database/repositories/case.repo.js';
import { EvidenceRepository } from '../database/repositories/evidence.repo.js';
import { traceAgentAction } from '../utils/sentry.js';
import { logger } from '../utils/logger.js';

export interface ToolContext {
  guildId: string;
  caseId: string;
  allowedDomains: string[];
  connectedRepos: string[];
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ToolRegistry {
  private serpApiClient: SerpApiClient;

  constructor(
    private memoryRetriever: MemoryRetriever,
    private safeFetcher: SafeFetcher,
    private githubClient: GitHubClient,
    private caseRepo: CaseRepository,
    private evidenceRepo: EvidenceRepository,
    serpApiClient?: SerpApiClient
  ) {
    this.serpApiClient = serpApiClient || new SerpApiClient();
  }

  async executeTool(toolName: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    return await traceAgentAction(`tool.${toolName}`, 'agent.tool', { toolName, caseId: ctx.caseId }, async () => {
      logger.debug({ toolName, args, caseId: ctx.caseId }, 'Executing agent tool');

      try {
        switch (toolName) {
          case 'search_web_serpapi': {
            const query = String(args.query || '');
            const results = await this.serpApiClient.search(query, 3);

            for (const item of results) {
              await this.evidenceRepo.add({
                evidence_id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                case_id: ctx.caseId,
                source_type: 'web',
                source_url: item.link,
                title: item.title,
                excerpt: item.snippet,
                authority_score: 0.75,
                metadata: { source: item.source },
              });
            }

            return {
              tool: toolName,
              success: true,
              data: { searchResults: results },
            };
          }
          case 'search_knowledge': {
            const query = String(args.query || '');
            const results = await this.memoryRetriever.search(ctx.guildId, query, 3);

            // Record top evidence in case
            for (const item of results.knowledge) {
              await this.evidenceRepo.add({
                evidence_id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                case_id: ctx.caseId,
                source_type: 'memory',
                source_url: `memory:${item.knowledge_id}`,
                title: item.question_patterns[0] || 'Approved Knowledge',
                excerpt: item.canonical_answer,
                authority_score: 0.9,
                metadata: { version: item.current_version, authority: item.authority },
              });
            }

            return {
              tool: toolName,
              success: true,
              data: {
                foundKnowledge: results.knowledge.map(k => ({
                  id: k.knowledge_id,
                  answer: k.canonical_answer,
                  patterns: k.question_patterns,
                  appliesWhen: k.applies_when,
                  similarity: k.similarity,
                })),
              },
            };
          }

          case 'find_similar_cases': {
            const query = String(args.query || '');
            const cases = await this.caseRepo.searchSimilarCases(ctx.guildId, query, 3);
            return {
              tool: toolName,
              success: true,
              data: {
                cases: cases.map(c => ({
                  caseId: c.case_id,
                  title: c.title,
                  summary: c.summary,
                  status: c.status,
                  outcome: c.resolution_outcome,
                })),
              },
            };
          }

          case 'fetch_url': {
            const url = String(args.url || '');
            const doc = await this.safeFetcher.fetchPage(url, ctx.allowedDomains);

            await this.evidenceRepo.add({
              evidence_id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              case_id: ctx.caseId,
              source_type: 'web',
              source_url: doc.url,
              title: doc.title,
              excerpt: doc.text.slice(0, 1000),
              authority_score: 0.7,
              metadata: { contentLength: doc.contentLength, suspectedInjection: doc.suspectedPromptInjection },
            });

            return {
              tool: toolName,
              success: true,
              data: {
                title: doc.title,
                url: doc.url,
                excerpt: doc.text.slice(0, 1500),
                suspectedInjection: doc.suspectedPromptInjection,
              },
            };
          }

          case 'search_github_issues': {
            const repo = String(args.repo || ctx.connectedRepos[0] || '');
            const query = String(args.query || '');
            if (!repo || !repo.includes('/')) {
              return { tool: toolName, success: false, error: 'Valid repository (owner/repo) not specified or connected' };
            }

            const [owner, name] = repo.split('/');
            const issues = await this.githubClient.searchIssues(owner, name, query);

            for (const issue of issues) {
              await this.evidenceRepo.add({
                evidence_id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                case_id: ctx.caseId,
                source_type: 'github_issue',
                source_url: issue.url,
                title: `#${issue.number} ${issue.title}`,
                excerpt: issue.bodyExcerpt,
                authority_score: 0.8,
                metadata: { state: issue.state, labels: issue.labels },
              });
            }

            return {
              tool: toolName,
              success: true,
              data: { issues },
            };
          }

          case 'get_github_issue': {
            const repo = String(args.repo || ctx.connectedRepos[0] || '');
            const issueNumber = Number(args.issueNumber);
            if (!repo || !repo.includes('/') || isNaN(issueNumber)) {
              return { tool: toolName, success: false, error: 'Valid repo and issueNumber required' };
            }

            const [owner, name] = repo.split('/');
            const issue = await this.githubClient.getIssue(owner, name, issueNumber);
            if (!issue) {
              return { tool: toolName, success: false, error: `GitHub issue #${issueNumber} not found` };
            }

            return {
              tool: toolName,
              success: true,
              data: { issue },
            };
          }

          case 'search_github_releases': {
            const repo = String(args.repo || ctx.connectedRepos[0] || '');
            if (!repo || !repo.includes('/')) {
              return { tool: toolName, success: false, error: 'Valid repository (owner/repo) not specified' };
            }

            const [owner, name] = repo.split('/');
            const releases = await this.githubClient.searchReleases(owner, name);
            return {
              tool: toolName,
              success: true,
              data: { releases },
            };
          }

          default:
            return {
              tool: toolName,
              success: false,
              error: `Unknown tool: ${toolName}`,
            };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          tool: toolName,
          success: false,
          error: msg,
        };
      }
    });
  }
}
