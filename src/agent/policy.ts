import { GroundedAnswerDraft } from './schemas.js';
import { CaseEvidence } from '../domain/case.js';

export interface PolicyEvaluationResult {
  allowed: boolean;
  finalAnswer: string;
  action: 'respond' | 'clarify' | 'escalate' | 'queue';
  reason?: string;
  verifiedCitations: Array<{ source_url: string; excerpt: string }>;
}

const sensitivePatterns = [
  /reset\s+(my\s+)?(password|2fa|mfa)/i,
  /\b(billing|refund|credit\s+card|invoice)\b/i,
  /grant\s+(me\s+)?(admin|role|access)/i,
  /delete\s+(my\s+)?account/i,
  /\b(api[_ -]?key|access[_ -]?token|password)\s*[:=]\s*\S+/i,
];

export const handoffAnswer = 'Please use private support for account or payment issues. A moderator will need to help.';

/** Citation checks establish provenance, not factual entailment; moderators remain the authority. */
export function isUsableEvidence(e: CaseEvidence): boolean {
  if (!e.source_url || !e.excerpt.trim() || e.metadata.subtype === 'user_context' || e.metadata.suspectedInjection) return false;
  if (e.source_type === 'memory') {
    return !e.metadata.expires_at || Date.parse(String(e.metadata.expires_at)) > Date.now();
  }
  // Search snippets and member messages are leads, not verified documentation.
  return e.source_type === 'documentation';
}

export class ResponsePolicy {
  requiresHuman(question: string): boolean {
    return sensitivePatterns.some(pattern => pattern.test(question));
  }

  evaluate(draft: GroundedAnswerDraft, question: string, evidence: CaseEvidence[]): PolicyEvaluationResult {
    if (this.requiresHuman(question) || draft.escalate_to_human) {
      return { allowed: true, action: 'escalate', finalAnswer: this.requiresHuman(question) ? handoffAnswer : 'Queued for a moderator.',
        reason: this.requiresHuman(question) ? 'Sensitive account operation' : 'Human review needed', verifiedCitations: [] };
    }
    const usable = evidence.filter(isUsableEvidence);
    const verifiedCitations = draft.citations.flatMap(c => {
      const source = usable.find(e => e.source_url === c.source_url);
      return source ? [{ source_url: c.source_url, excerpt: source.excerpt }] : [];
    });
    if (draft.requires_clarification && draft.clarification_question?.trim() && verifiedCitations.some(c => usable.some(e => e.source_url === c.source_url && e.source_type === 'memory' && Number(e.metadata.question_match) >= 0.65 && (e.metadata.applies_when || e.metadata.does_not_apply_when)))) {
      return { allowed: true, action: 'clarify', finalAnswer: draft.clarification_question,
        reason: 'Missing context for a cited conditional answer', verifiedCitations };
    }
    if (draft.requires_clarification || !draft.can_answer_confidently || !draft.answer.trim() || !verifiedCitations.length) {
      return { allowed: true, action: 'queue',
        finalAnswer: 'No saved answer yet. Queued for a moderator.',
        reason: 'No supported answer', verifiedCitations: [] };
    }
    // Do not let unverified inline links survive through an otherwise valid citation.
    const urls = draft.answer.match(/https?:\/\/[^\s<>\])]+/g) || [];
    const approvedUrls = new Set(usable.flatMap(e => [e.source_url, ...(e.source_type === 'memory' ? (e.excerpt.match(/https?:\/\/[^\s<>\])]+/g) || []) : [])]));
    if (urls.some(url => !approvedUrls.has(url))) {
      return { allowed: true, action: 'queue', finalAnswer: 'I couldn’t verify an answer. Queued for a moderator.',
        reason: 'Unsupported link in answer', verifiedCitations: [] };
    }
    return { allowed: true, action: 'respond', finalAnswer: draft.answer, verifiedCitations };
  }
}
