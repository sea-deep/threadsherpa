import { KnowledgeItem } from '../domain/knowledge.js';

export function normalizeQuestion(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

const stopWords = new Set('a an the i my me we our you your is are was were be been do does did how what when where why can could would should to for of in on at it this that please help with and or have has get'.split(' '));

export function searchTokens(text: string): string[] {
  return [...new Set(normalizeQuestion(text).split(' ').filter(w => w && !stopWords.has(w)))];
}

export function isCurrentKnowledge(item: KnowledgeItem): boolean {
  return item.approval_status === 'approved' && (!item.expires_at || Date.parse(item.expires_at) > Date.now());
}

/** A ranking signal, never a probability that an answer is correct. */
export function lexicalScore(query: string, item: KnowledgeItem): number {
  const normalized = normalizeQuestion(query);
  if (!normalized) return 0;
  if (item.question_patterns.some(p => normalizeQuestion(p) === normalized)) return 1;
  const tokens = searchTokens(query);
  if (!tokens.length) return 0;
  const score = (text: string) => {
    const words = new Set(searchTokens(text));
    return tokens.filter(t => words.has(t)).length / tokens.length;
  };
  // Partial keyword matches must go through synthesis; only exact patterns skip it.
  return Math.min(0.79, Math.max(...item.question_patterns.map(score), score(item.canonical_answer) * 0.6));
}
