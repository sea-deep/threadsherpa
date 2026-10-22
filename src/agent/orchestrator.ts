import { DatabaseSync } from 'node:sqlite';
import { ModelProvider } from '../integrations/model/model-provider.interface.js';
import { CaseRepository } from '../database/repositories/case.repo.js';
import { EvidenceRepository } from '../database/repositories/evidence.repo.js';
import { GuildConfigRepository } from '../database/repositories/guild-config.repo.js';
import { ToolRegistry } from './tools.js';
import { ResponsePolicy, PolicyEvaluationResult } from './policy.js';
import {
  InvestigationPlanSchema,
  GroundedAnswerDraftSchema,
  GroundedAnswerDraft,
  SupportCaseClassificationSchema,
} from './schemas.js';
import { SupportCase } from '../domain/case.js';
import { logger } from '../utils/logger.js';

export interface InvestigationResult {
  caseId: string;
  policyResult: PolicyEvaluationResult;
  toolsExecuted: number;
  rounds: number;
}

export class AgentOrchestrator {
  private policy: ResponsePolicy;

  constructor(
    private db: DatabaseSync,
    private caseRepo: CaseRepository,
    private evidenceRepo: EvidenceRepository,
    private guildRepo: GuildConfigRepository,
    private toolRegistry: ToolRegistry,
    private modelProvider: ModelProvider,
    private maxRounds: number = 3,
    private maxTools: number = 6
  ) {
    this.policy = new ResponsePolicy();
  }

  async investigateCase(caseId: string): Promise<InvestigationResult> {
    const supportCase = this.caseRepo.get(caseId);
    if (!supportCase) {
      throw new Error(`Case ${caseId} not found`);
    }

    const guildConfig = this.guildRepo.get(supportCase.guild_id);
    const allowedDomains = guildConfig?.allowed_domains || [];
    const connectedRepos = guildConfig?.connected_repos || [];

    const toolCtx = {
      guildId: supportCase.guild_id,
      caseId: supportCase.case_id,
      allowedDomains,
      connectedRepos,
    };

    // Update case status to investigating
    this.caseRepo.updateStatus(caseId, 'investigating');
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTime = new Date().toISOString();

    let toolsExecuted = 0;
    let rounds = 0;

    try {
      // Step 1: Check internal memory first
      const initialKnowledge = await this.toolRegistry.executeTool('search_knowledge', { query: supportCase.title }, toolCtx);
      toolsExecuted++;

      const foundKnowledge = (initialKnowledge.data as { foundKnowledge?: Array<{ answer: string; similarity: number; appliesWhen?: string }> })?.foundKnowledge || [];
      const topMatch = foundKnowledge[0];

      // If we have an exact/high-similarity approved match (similarity >= 0.70)
      if (topMatch && topMatch.similarity >= 0.70) {
        logger.info({ caseId, similarity: topMatch.similarity }, 'Found high-confidence approved knowledge match');

        const evidence = this.evidenceRepo.getByCaseId(caseId);
        const policyResult = this.policy.evaluate(
          {
            can_answer_confidently: true,
            answer: topMatch.answer,
            citations: [
              {
                source_url: `memory:${topMatch}`,
                excerpt: topMatch.answer,
                relevance: 'Approved canonical solution',
              },
            ],
            requires_clarification: false,
            clarification_question: null,
            escalate_to_human: false,
            escalation_reason: null,
          },
          supportCase.title,
          evidence
        );

        this.recordRun(runId, caseId, 'completed', 1, toolsExecuted, 'Resolved via approved knowledge', null, startTime);
        this.caseRepo.updateStatus(caseId, 'answered');
        this.caseRepo.updateSummary(caseId, supportCase.summary || supportCase.title, policyResult.finalAnswer);

        return { caseId, policyResult, toolsExecuted, rounds: 1 };
      }

      // Step 2: Formulate investigation plan
      rounds++;
      const planPrompt = `You are ThreadSherpa Support Copilot.
Investigate the following support inquiry:
Title: "${supportCase.title}"
Summary: "${supportCase.summary || 'None'}"

Available Tools:
- search_knowledge(query)
- find_similar_cases(query)
- fetch_url(url)
- search_github_issues(repo, query)
- get_github_issue(repo, issueNumber)
- search_github_releases(repo)

Create an investigation plan with missing facts and planned tool calls (max 3).`;

      const plan = await this.modelProvider.generateStructured({
        prompt: planPrompt,
        schema: InvestigationPlanSchema,
        schemaName: 'InvestigationPlan',
        timeoutMs: 35000,
      }).catch(err => {
        logger.warn({ err }, 'Failed to generate investigation plan, proceeding with direct search');
        return {
          initial_assessment: 'Investigating issue directly',
          missing_facts: [],
          planned_actions: [
            { tool: 'find_similar_cases', args: { query: supportCase.title }, rationale: 'Look for past resolutions' },
          ],
        };
      });

      // Step 3: Execute planned tool actions
      const plannedActions = plan.planned_actions || [];
      const collectedToolResults: Array<{ tool: string; result: unknown }> = [];
      for (const action of plannedActions) {
        if (toolsExecuted >= this.maxTools) break;
        const result = await this.toolRegistry.executeTool(action.tool, action.args, toolCtx);
        toolsExecuted++;
        collectedToolResults.push({ tool: action.tool, result: result.data || result.error });
      }

      // Step 4: Formulate Grounded Answer Draft
      const evidence = this.evidenceRepo.getByCaseId(caseId);
      const evidenceText = evidence.map(e => `[${e.source_type} - ${e.source_url || 'ref'}]: ${e.excerpt}`).join('\n\n');

      const answerPrompt = `You are ThreadSherpa Support Copilot.
Formulate a helpful, grounded response to the user's issue based strictly on the retrieved evidence.

User Question: "${supportCase.title}"
Retrieved Evidence:
${evidenceText || 'No external evidence found.'}

Rules:
1. If the evidence contains the solution, answer clearly with actionable instructions and cite the exact source_url.
2. If critical information is missing from the user, set requires_clarification=true and provide clarification_question.
3. If the problem cannot be resolved with available evidence or involves private credentials, set escalate_to_human=true.
4. Do NOT invent URLs or fabricate claims not present in the evidence.`;

      const draft = await this.modelProvider.generateStructured({
        prompt: answerPrompt,
        schema: GroundedAnswerDraftSchema,
        schemaName: 'GroundedAnswerDraft',
        timeoutMs: 40000,
      }).catch(err => {
        logger.warn({ err }, 'Failed to generate structured answer, escalating');
        return {
          can_answer_confidently: false,
          answer: 'I have logged your request, but could not complete automated investigation. Escalating to support staff.',
          citations: [],
          requires_clarification: false,
          clarification_question: null,
          escalate_to_human: true,
          escalation_reason: 'Automated synthesis timeout or failure',
        };
      });

      const normalizedDraft: GroundedAnswerDraft = {
        can_answer_confidently: draft.can_answer_confidently ?? false,
        answer: draft.answer || '',
        citations: draft.citations || [],
        requires_clarification: draft.requires_clarification ?? false,
        clarification_question: draft.clarification_question ?? null,
        escalate_to_human: draft.escalate_to_human ?? false,
        escalation_reason: draft.escalation_reason ?? null,
      };

      // Step 5: Evaluate against deterministic ResponsePolicy
      const policyResult = this.policy.evaluate(normalizedDraft, supportCase.title, evidence);

      const nextStatus = policyResult.action === 'escalate'
        ? 'escalated'
        : policyResult.action === 'clarify'
          ? 'awaiting_user'
          : 'answered';

      this.caseRepo.updateStatus(caseId, nextStatus);
      this.caseRepo.updateSummary(caseId, supportCase.summary || supportCase.title, policyResult.finalAnswer);

      this.recordRun(runId, caseId, 'completed', rounds, toolsExecuted, policyResult.finalAnswer, null, startTime);

      return {
        caseId,
        policyResult,
        toolsExecuted,
        rounds,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, caseId }, 'Investigation run failed');
      this.recordRun(runId, caseId, 'failed', rounds, toolsExecuted, null, msg, startTime);
      this.caseRepo.updateStatus(caseId, 'escalated', `Investigation failure: ${msg}`);

      return {
        caseId,
        policyResult: {
          allowed: true,
          action: 'escalate',
          finalAnswer: `An error occurred during investigation: ${msg}. A support administrator has been notified.`,
          reason: msg,
          verifiedCitations: [],
        },
        toolsExecuted,
        rounds,
      };
    }
  }

  private recordRun(
    runId: string,
    caseId: string,
    status: 'completed' | 'failed',
    rounds: number,
    tools: number,
    summary: string | null,
    error: string | null,
    startedAt: string
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO investigation_runs (
        run_id, case_id, status, rounds_executed, tools_called,
        findings_summary, error_message, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(runId, caseId, status, rounds, tools, summary, error, startedAt, now);
  }
}
