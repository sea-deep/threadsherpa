import { z } from 'zod';

export interface SupportCaseClassification {
  category: 'install' | 'auth' | 'bug' | 'feature' | 'question' | 'outage' | 'general';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
  technical_entities: string[];
}

export interface InvestigationPlan {
  initial_assessment: string;
  missing_facts: string[];
  planned_actions: Array<{
    tool: string;
    args: Record<string, unknown>;
    rationale: string;
  }>;
}

export interface GroundedAnswerDraft {
  can_answer_confidently: boolean;
  answer: string;
  citations: Array<{
    source_url: string;
    excerpt: string;
    relevance: string;
  }>;
  requires_clarification: boolean;
  clarification_question: string | null;
  escalate_to_human: boolean;
  escalation_reason: string | null;
}

export interface KnowledgeCandidateExtraction {
  question_patterns: string[];
  canonical_answer: string;
  applies_when: string | null;
  does_not_apply_when: string | null;
  authority: 'official_doc' | 'maintainer' | 'approved_admin' | 'community_lead';
  change_reason: string | null;
}

export interface GitHubIssueDraft {
  title: string;
  problem_summary: string;
  expected_behavior: string;
  actual_behavior: string;
  reproduction_steps: string[];
  environment: string;
  error_messages: string[];
  tried_workarounds: string[];
  potential_duplicate_issue_numbers: number[];
  missing_information: string[];
}

export interface IncidentClusterProposal {
  symptom_cluster_key: string;
  incident_title: string;
  common_symptoms: string[];
  suspected_cause: string;
  is_likely_widespread: boolean;
}

export const SupportCaseClassificationSchema: z.ZodType<SupportCaseClassification, z.ZodTypeDef, unknown> = z.preprocess((val: unknown) => {
  if (typeof val !== 'object' || val === null) return val;
  const obj = val as Record<string, unknown>;
  return {
    category: obj.category || obj.classification || 'general',
    urgency: obj.urgency || obj.severity || 'medium',
    title: obj.title || obj.headline || 'Support inquiry',
    summary: obj.summary || obj.description || 'Customer support inquiry',
    technical_entities: obj.technical_entities || obj.technology || [],
  };
}, z.object({
  category: z.enum(['install', 'auth', 'bug', 'feature', 'question', 'outage', 'general']).default('general'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  title: z.string().default('Support Inquiry'),
  summary: z.string().default('Customer issue reported'),
  technical_entities: z.array(z.string()).default([]),
}));

export const InvestigationPlanSchema: z.ZodType<InvestigationPlan, z.ZodTypeDef, unknown> = z.preprocess((val: unknown) => {
  if (typeof val !== 'object' || val === null) return val;
  const raw = val as Record<string, unknown>;
  const obj = (raw.investigation_plan && typeof raw.investigation_plan === 'object')
    ? (raw.investigation_plan as Record<string, unknown>)
    : raw;

  const rawActions = obj.planned_actions || obj.planned_tool_calls || [];
  const plannedActions = Array.isArray(rawActions)
    ? rawActions.map((a: unknown) => {
        if (typeof a !== 'object' || a === null) return { tool: 'search_knowledge', args: {}, rationale: '' };
        const act = a as Record<string, unknown>;
        return {
          tool: String(act.tool || act.tool_name || 'search_knowledge'),
          args: (typeof act.args === 'object' && act.args) ? (act.args as Record<string, unknown>) : (typeof act.parameters === 'object' && act.parameters ? (act.parameters as Record<string, unknown>) : {}),
          rationale: String(act.rationale || 'Investigate issue'),
        };
      })
    : [];

  return {
    initial_assessment: String(obj.initial_assessment || 'Investigating issue based on query'),
    missing_facts: Array.isArray(obj.missing_facts) ? obj.missing_facts.map(String) : [],
    planned_actions: plannedActions,
  };
}, z.object({
  initial_assessment: z.string().default('Investigating issue'),
  missing_facts: z.array(z.string()).default([]),
  planned_actions: z.array(z.object({
    tool: z.string(),
    args: z.record(z.unknown()).default({}),
    rationale: z.string().default(''),
  })).default([]),
}));

export const GroundedAnswerDraftSchema: z.ZodType<GroundedAnswerDraft, z.ZodTypeDef, unknown> = z.preprocess((val: unknown) => {
  if (typeof val !== 'object' || val === null) return val;
  const obj = val as Record<string, unknown>;
  const rawCitations = obj.citations || obj.sources || [];
  const citations = Array.isArray(rawCitations)
    ? rawCitations.map((c: unknown) => {
        if (typeof c !== 'object' || c === null) return { source_url: 'unknown', excerpt: '', relevance: '' };
        const cit = c as Record<string, unknown>;
        return {
          source_url: String(cit.source_url || cit.url || 'ref'),
          excerpt: String(cit.excerpt || cit.quote || ''),
          relevance: String(cit.relevance || 'Relevant documentation'),
        };
      })
    : [];

  return {
    can_answer_confidently: Boolean(obj.can_answer_confidently ?? true),
    answer: String(obj.answer || obj.response || ''),
    citations,
    requires_clarification: Boolean(obj.requires_clarification ?? false),
    clarification_question: obj.clarification_question ? String(obj.clarification_question) : null,
    escalate_to_human: Boolean(obj.escalate_to_human ?? false),
    escalation_reason: obj.escalation_reason ? String(obj.escalation_reason) : null,
  };
}, z.object({
  can_answer_confidently: z.boolean().default(true),
  answer: z.string().default(''),
  citations: z.array(z.object({
    source_url: z.string(),
    excerpt: z.string(),
    relevance: z.string(),
  })).default([]),
  requires_clarification: z.boolean().default(false),
  clarification_question: z.string().nullable().default(null),
  escalate_to_human: z.boolean().default(false),
  escalation_reason: z.string().nullable().default(null),
}));

export const KnowledgeCandidateExtractionSchema: z.ZodType<KnowledgeCandidateExtraction, z.ZodTypeDef, unknown> = z.preprocess((val: unknown) => {
  if (typeof val !== 'object' || val === null) return val;
  const obj = val as Record<string, unknown>;

  const rawPatterns = obj.question_patterns || obj.reusable_question_patterns || obj.patterns || [];
  const patterns = Array.isArray(rawPatterns) ? rawPatterns.map(String) : [String(rawPatterns)];

  let appliesWhen: string | null = null;
  if (Array.isArray(obj.applies_when)) {
    appliesWhen = obj.applies_when.map(String).join('; ');
  } else if (typeof obj.applies_when === 'string') {
    appliesWhen = obj.applies_when;
  }

  let doesNotApplyWhen: string | null = null;
  if (Array.isArray(obj.does_not_apply_when)) {
    doesNotApplyWhen = obj.does_not_apply_when.map(String).join('; ');
  } else if (typeof obj.does_not_apply_when === 'string') {
    doesNotApplyWhen = obj.does_not_apply_when;
  }

  return {
    question_patterns: patterns.length > 0 ? patterns : ['General issue inquiry'],
    canonical_answer: String(obj.canonical_answer || obj.answer || obj.solution || ''),
    applies_when: appliesWhen,
    does_not_apply_when: doesNotApplyWhen,
    authority: obj.authority || 'approved_admin',
    change_reason: obj.change_reason || obj.change_reason_notes || null,
  };
}, z.object({
  question_patterns: z.array(z.string()).min(1),
  canonical_answer: z.string().min(10),
  applies_when: z.string().nullable().default(null),
  does_not_apply_when: z.string().nullable().default(null),
  authority: z.enum(['official_doc', 'maintainer', 'approved_admin', 'community_lead']).default('approved_admin'),
  change_reason: z.string().nullable().default(null),
}));

export const GitHubIssueDraftSchema: z.ZodType<GitHubIssueDraft, z.ZodTypeDef, unknown> = z.preprocess((val: unknown) => {
  if (typeof val !== 'object' || val === null) return val;
  const obj = val as Record<string, unknown>;
  return {
    title: String(obj.title || 'Technical Bug Report'),
    problem_summary: String(obj.problem_summary || obj.summary || 'Problem reported by user'),
    expected_behavior: String(obj.expected_behavior || 'Expected normal operation without errors'),
    actual_behavior: String(obj.actual_behavior || 'Received error during execution'),
    reproduction_steps: Array.isArray(obj.reproduction_steps) ? obj.reproduction_steps.map(String) : [],
    environment: String(obj.environment || 'Not specified'),
    error_messages: Array.isArray(obj.error_messages) ? obj.error_messages.map(String) : [],
    tried_workarounds: Array.isArray(obj.tried_workarounds) ? obj.tried_workarounds.map(String) : [],
    potential_duplicate_issue_numbers: Array.isArray(obj.potential_duplicate_issue_numbers)
      ? obj.potential_duplicate_issue_numbers.map(Number).filter(n => !isNaN(n))
      : [],
    missing_information: Array.isArray(obj.missing_information) ? obj.missing_information.map(String) : [],
  };
}, z.object({
  title: z.string().default('Technical Issue'),
  problem_summary: z.string().default(''),
  expected_behavior: z.string().default(''),
  actual_behavior: z.string().default(''),
  reproduction_steps: z.array(z.string()).default([]),
  environment: z.string().default('Not specified'),
  error_messages: z.array(z.string()).default([]),
  tried_workarounds: z.array(z.string()).default([]),
  potential_duplicate_issue_numbers: z.array(z.number().int()).default([]),
  missing_information: z.array(z.string()).default([]),
}));
