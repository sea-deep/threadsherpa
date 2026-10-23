import { describe, it, expect } from 'vitest';
import { answerFeedback } from '../../src/support/conversation.js';
import { groupWaitingQuestions } from '../../src/support/queue.js';
import type { SupportCase } from '../../src/domain/case.js';

const question = (id: string, title: string, overrides: Partial<SupportCase> = {}): SupportCase => ({
  case_id: id, guild_id: 'g', channel_id: 'support', message_id: id, requester_id: id, requester_username: id,
  category: 'question', title, status: 'awaiting_admin', reopen_count: 0, created_at: '2026-10-23T00:00:00Z', updated_at: '2026-10-23T00:00:00Z', ...overrides,
});

describe('Conversation outcomes', () => {
  it('recognizes clear confirmations, without treating gratitude or mixed feedback as a solve', () => {
    for (const text of ['That worked, thanks!', 'It’s fixed now.', 'thank you, that fixed it']) expect(answerFeedback(text)).toBe('solved');
    for (const text of ['Thanks!', 'That worked yesterday but it is broken now', 'That worked? Really?', 'Someone said that worked', 'It worked but I have another error']) expect(answerFeedback(text)).toBeNull();
  });
  it('recognizes unsuccessful advice with further troubleshooting context', () => {
    for (const text of ["That didn't work. I still get 403.", 'Still not working', 'Same error after restarting', 'That does not work for me']) expect(answerFeedback(text)).toBe('failed');
    expect(answerFeedback('What if that does not work?')).toBeNull();
  });
});

describe('Waiting topics', () => {
  it('brings repeated questions together without merging their records', () => {
    const input = [question('a', 'Where is the project submission form?'), question('b', 'Where is the project submission form'), question('c', 'How do I install Node?')];
    const groups = groupWaitingQuestions(input);
    expect(groups).toHaveLength(2);
    expect(groups[0].cases.map(c => c.case_id)).toEqual(['a', 'b']);
    expect(input).toHaveLength(3);
    expect(input.every(c => c.status === 'awaiting_admin')).toBe(true);
  });
  it('keeps different servers, support channels, numbers and negative conditions apart', () => {
    const input = [question('a', 'Can I submit Campfire without a video?'), question('b', 'Can I submit Campfire with a video?'),
      question('c', 'Where is the 2026 project submission form?'), question('d', 'Where is the 2027 project submission form?'),
      question('e', 'Can I submit Campfire without a video?', { guild_id: 'other' }),
      question('f', 'Can I submit Campfire without a video?', { channel_id: 'other' })];
    expect(groupWaitingQuestions(input)).toHaveLength(6);
  });
});
