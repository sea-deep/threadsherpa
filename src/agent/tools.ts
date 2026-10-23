import { MemoryRetriever } from '../memory/retriever.js';
import { SafeFetcher } from '../integrations/web/safe-fetcher.js';
import { CaseRepository } from '../database/repositories/case.repo.js';
import { EvidenceRepository } from '../database/repositories/evidence.repo.js';
import { traceAgentAction } from '../utils/sentry.js';
import { lexicalScore } from '../memory/matching.js';
import { randomUUID } from 'node:crypto';

export interface ToolContext { guildId: string; caseId: string; allowedDomains: string[]; documentationUrls: string[]; }
export interface ToolResult { tool: string; success: boolean; data?: unknown; error?: string; }

export class ToolRegistry {
  constructor(private memory: MemoryRetriever, private fetcher: SafeFetcher, _cases: CaseRepository, private evidence: EvidenceRepository) {}

  async executeTool(tool: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    return traceAgentAction(`tool.${tool}`, 'agent.tool', { toolName: tool, caseId: ctx.caseId }, async () => {
      try {
        if (tool === 'search_knowledge') {
          const result = await this.memory.search(ctx.guildId, String(args.query || ''), 3);
          for (const item of result.knowledge) await this.evidence.add({
            evidence_id: `ev_${randomUUID()}`, case_id: ctx.caseId, source_type: 'memory', source_url: `memory:${item.knowledge_id}`,
            title: item.question_patterns[0], excerpt: item.canonical_answer, authority_score: 0.9,
            metadata: { question_match: lexicalScore(String(args.query || ''), item), version: item.current_version, verified_at: item.verified_at, expires_at: item.expires_at,
              source_refs: item.source_refs, question_patterns: item.question_patterns, question_context: item.question_context, applies_when: item.applies_when, does_not_apply_when: item.does_not_apply_when },
          });
          return { tool, success: true, data: { foundKnowledge: result.knowledge.map(k => ({ id: k.knowledge_id,
            answer: k.canonical_answer, similarity: k.similarity, method: k.retrieval_method,
            appliesWhen: k.applies_when, doesNotApplyWhen: k.does_not_apply_when })) } };
        }
        if (tool === 'fetch_url') {
          const url = String(args.url || '');
          if (!ctx.documentationUrls.includes(url)) return { tool, success: false, error: 'This source page was not selected by a moderator' };
          const doc = await this.fetcher.fetchPage(url, ctx.allowedDomains);
          await this.evidence.add({ evidence_id: `ev_${randomUUID()}`, case_id: ctx.caseId, source_type: 'documentation',
            source_url: doc.url, title: doc.title, excerpt: doc.text.slice(0, 3000), authority_score: 0.8,
            metadata: { suspectedInjection: doc.suspectedPromptInjection } });
          return { tool, success: true, data: { url: doc.url, title: doc.title } };
        }
        return { tool, success: false, error: 'Tool not available' };
      } catch { return { tool, success: false, error: 'Source lookup could not complete' }; }
    });
  }
}
