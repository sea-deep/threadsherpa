import { normalizeQuestion } from '../memory/matching.js';

/** Only explicit first-person feedback changes a case; gratitude or quoted advice is insufficient. */
export function answerFeedback(message: string): 'solved' | 'failed' | null {
  const text = normalizeQuestion(message);
  if (/^(?:(?:sorry|unfortunately|no) )?(?:(?:that|this|it) (?:didn t|did not|doesn t|does not) work|still not working|it s still broken|that didn t help|same error)\b/.test(text)) return 'failed';
  if (/^(?:(?:thanks|thank you|ty) )?(?:that worked|this worked|it worked|that fixed it|this fixed it|it s fixed|it is fixed|that solved it|problem solved|issue resolved)(?: (?:thanks|thank you|ty|now|perfectly|for me|all good))*$/.test(text)) return 'solved';
  return null;
}
