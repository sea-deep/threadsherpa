import { z } from 'zod';

export interface SupportCaseClassification {
  category: 'install' | 'auth' | 'bug' | 'feature' | 'question' | 'outage' | 'general';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
  technical_entities: string[];
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
    can_answer_confidently: Boolean(obj.can_answer_confidently ?? false),
    answer: String(obj.answer || obj.response || ''),
    citations,
    requires_clarification: Boolean(obj.requires_clarification ?? false),
    clarification_question: obj.clarification_question ? String(obj.clarification_question) : null,
    escalate_to_human: Boolean(obj.escalate_to_human ?? false),
    escalation_reason: obj.escalation_reason ? String(obj.escalation_reason) : null,
  };
}, z.object({
  can_answer_confidently: z.boolean().default(false),
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

// Only identify a duplicate when every fact and condition is already covered.
export const KnowledgeDuplicateSchema = z.object({ duplicate: z.boolean(), existing_id: z.string() });

/** Give small local models an explicit shape as well as validating their response. */
export const schemaExamples: Record<string, unknown> = {
  KnowledgeDuplicate: { duplicate: false, existing_id: '' },
  GroundedAnswerDraft: { can_answer_confidently: false, answer: '', citations: [{ source_url: 'exact retrieved URL', excerpt: 'supporting text', relevance: 'why it helps' }], requires_clarification: true, clarification_question: 'One missing detail?', escalate_to_human: false, escalation_reason: null },
  KnowledgeCandidateExtraction: { question_patterns: ['One way to ask this question'], canonical_answer: 'Answer supplied by the moderator', applies_when: null, does_not_apply_when: null, authority: 'approved_admin', change_reason: null },
  SupportCaseClassification: { category: 'general', urgency: 'medium', title: 'Short title', summary: 'Known facts', technical_entities: [] },
};

/** Ollama can constrain known response shapes before our Zod validation/normalization. */
export function ollamaOutputFormat(schemaName?: string): unknown {
  const example = schemaName && schemaExamples[schemaName];
  if (!example) return 'json';
  const describe = (value: unknown): Record<string, unknown> => {
    if (value === null) return { type: ['string', 'null'] };
    if (Array.isArray(value)) return { type: 'array', items: value.length ? describe(value[0]) : { type: 'string' } };
    if (typeof value === 'object') {
      const object = value as Record<string, unknown>;
      return { type: 'object', properties: Object.fromEntries(Object.entries(object).map(([key, item]) => [key, describe(item)])), required: Object.keys(object) };
    }
    return { type: typeof value };
  };
  const schema = describe(example);
  if (schemaName === 'SupportCaseClassification') {
    const properties = schema.properties as Record<string, unknown>;
    properties.category = { type: 'string', enum: ['install', 'auth', 'bug', 'feature', 'question', 'outage', 'general'] };
    properties.urgency = { type: 'string', enum: ['low', 'medium', 'high', 'critical'] };
  }
  if (schemaName === 'KnowledgeCandidateExtraction') {
    (schema.properties as Record<string, unknown>).authority = { type: 'string', enum: ['approved_admin'] };
  }
  return schema;
}
