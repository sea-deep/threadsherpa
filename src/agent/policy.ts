import { GroundedAnswerDraft } from './schemas.js';
import { CaseEvidence } from '../domain/case.js';
import { logger } from '../utils/logger.js';

export interface PolicyEvaluationResult {
  allowed: boolean;
  finalAnswer: string;
  action: 'respond' | 'clarify' | 'escalate';
  reason?: string;
  verifiedCitations: Array<{ source_url: string; excerpt: string }>;
}

const SENSITIVE_ACCOUNT_PATTERNS = [
  /reset\s+(my\s+)?(password|2fa|mfa)/i,
  /billing|refund|credit\s+card|invoice/i,
  /grant\s+(me\s+)?(admin|role|access)/i,
  /delete\s+(my\s+)?account/i,
];

export class ResponsePolicy {
  evaluate(
    draft: GroundedAnswerDraft,
    question: string,
    evidence: CaseEvidence[]
  ): PolicyEvaluationResult {
    // 1. Check for sensitive account operations that require private human handling
    for (const pattern of SENSITIVE_ACCOUNT_PATTERNS) {
      if (pattern.test(question)) {
        logger.info({ question }, 'Response policy: Question matches sensitive account action, forcing escalation');
        return {
          allowed: true,
          action: 'escalate',
          finalAnswer: 'This request involves account-specific or security-sensitive actions that require assistance from a human support administrator. A staff member has been alerted.',
          reason: 'Sensitive account operation',
          verifiedCitations: [],
        };
      }
    }

    // 2. If model explicitly requested escalation
    if (draft.escalate_to_human) {
      return {
        allowed: true,
        action: 'escalate',
        finalAnswer: draft.answer || 'I am escalating this ticket to the support team for expert review.',
        reason: draft.escalation_reason || 'Escalated by agent',
        verifiedCitations: [],
      };
    }

    // 3. If model needs clarification
    if (draft.requires_clarification && draft.clarification_question) {
      return {
        allowed: true,
        action: 'clarify',
        finalAnswer: draft.clarification_question,
        reason: 'Missing necessary context from user',
        verifiedCitations: [],
      };
    }

    // 4. Grounding and citation check
    const verifiedCitations: Array<{ source_url: string; excerpt: string }> = [];
    const evidenceUrls = new Set(evidence.map(e => e.source_url).filter(Boolean) as string[]);

    for (const cit of draft.citations) {
      if (evidenceUrls.has(cit.source_url)) {
        verifiedCitations.push({
          source_url: cit.source_url,
          excerpt: cit.excerpt,
        });
      }
    }

    // If answer claims to be confident but has zero evidence and zero approved knowledge, don't allow unverified hallucination
    if (draft.can_answer_confidently && evidence.length === 0) {
      logger.warn('Response policy: Model claimed confidence with zero evidence; enforcing cautious fallback');
      return {
        allowed: true,
        action: 'clarify',
        finalAnswer: `${draft.answer}\n\n*(Note: This suggestion is unverified against official documentation. Could you confirm your environment details?)*`,
        reason: 'Unverified evidence check',
        verifiedCitations: [],
      };
    }

    // 5. Successful grounded answer
    return {
      allowed: true,
      action: 'respond',
      finalAnswer: draft.answer,
      verifiedCitations,
    };
  }
}
