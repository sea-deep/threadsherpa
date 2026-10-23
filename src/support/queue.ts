import { SupportCase } from '../domain/case.js';
import { normalizeQuestion, searchTokens } from '../memory/matching.js';

export interface WaitingTopic { question: SupportCase; cases: SupportCase[]; }
const constraints = (title: string) => {
  const words = normalizeQuestion(title).replace(/\b(?:can|couldn|doesn|didn|isn|wasn|wouldn) t\b/g, 'not').split(' ');
  return words.filter(w => /^\d+$/.test(w) || ['no', 'not', 'without', 'missing', 'cannot', 'unable', 'blocked'].includes(w)).sort().join(' ');
};
function similar(a: SupportCase, b: SupportCase): boolean {
  if (a.guild_id !== b.guild_id || a.channel_id !== b.channel_id || constraints(a.title) !== constraints(b.title)) return false;
  if (normalizeQuestion(a.title) === normalizeQuestion(b.title)) return true;
  const left = new Set(searchTokens(a.title));
  const right = new Set(searchTokens(b.title));
  const common = [...left].filter(word => right.has(word)).length;
  return common >= 2 && common / new Set([...left, ...right]).size >= 0.65;
}

/** Suggestions for moderators, never merges, answer reuse or automatic bulk actions. */
export function groupWaitingQuestions(cases: SupportCase[]): WaitingTopic[] {
  const groups: WaitingTopic[] = [];
  for (const c of cases) {
    const group = groups.find(g => g.cases.every(member => similar(member, c)));
    if (group) group.cases.push(c);
    else groups.push({ question: c, cases: [c] });
  }
  return groups.sort((a, b) => b.cases.length - a.cases.length || a.question.created_at.localeCompare(b.question.created_at));
}
