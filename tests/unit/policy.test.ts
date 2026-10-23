import { describe, it, expect } from 'vitest';
import { ResponsePolicy } from '../../src/agent/policy.js';
import { CaseEvidence } from '../../src/domain/case.js';

describe('ResponsePolicy & Confidence Calibration', () => {
  const policy = new ResponsePolicy();

  const mockEvidence: CaseEvidence[] = [
    {
      evidence_id: 'ev_1',
      case_id: 'case_1',
      source_type: 'documentation',
      source_url: 'https://nodejs.org/api/sqlite.html',
      title: 'Node.js SQLite Docs',
      excerpt: 'Use node:sqlite for native synchronous SQLite operations.',
      authority_score: 0.9,
      metadata: {},
      created_at: new Date().toISOString(),
    },
  ];

  it('forces escalation on sensitive account operations like 2FA reset or password reset', () => {
    const result = policy.evaluate(
      {
        can_answer_confidently: true,
        answer: 'I can help you reset your 2FA credentials.',
        citations: [],
        requires_clarification: false,
        clarification_question: null,
        escalate_to_human: false,
        escalation_reason: null,
      },
      'Please reset my 2FA immediately',
      mockEvidence
    );

    expect(result.action).toBe('escalate');
    expect(result.finalAnswer).toContain('private support');
  });

  it('forces escalation when model explicitly requests escalation', () => {
    const result = policy.evaluate(
      {
        can_answer_confidently: false,
        answer: 'I do not have enough information to resolve this issue.',
        citations: [],
        requires_clarification: false,
        clarification_question: null,
        escalate_to_human: true,
        escalation_reason: 'Unverified database corruption',
      },
      'My database file is completely corrupted',
      mockEvidence
    );

    expect(result.action).toBe('escalate');
  });

  it('quietly queues speculative clarification without a conditional reviewed answer', () => {
    const result = policy.evaluate(
      {
        can_answer_confidently: false,
        answer: '',
        citations: [],
        requires_clarification: true,
        clarification_question: 'Which version of Node.js and operating system are you using?',
        escalate_to_human: false,
        escalation_reason: null,
      },
      'The app crashed on startup',
      mockEvidence
    );

    expect(result.action).toBe('queue');
    expect(result.finalAnswer).not.toContain('Which version of Node.js');
  });

  it('verifies citations against retrieved evidence and rejects fabricated URLs', () => {
    const result = policy.evaluate(
      {
        can_answer_confidently: true,
        answer: 'Use the DatabaseSync class from node:sqlite.',
        citations: [
          {
            source_url: 'https://nodejs.org/api/sqlite.html',
            excerpt: 'Use node:sqlite for native synchronous SQLite operations.',
            relevance: 'Official Node docs',
          },
          {
            source_url: 'https://fake-hallucinated-source.com/exploit',
            excerpt: 'Made up citation',
            relevance: 'Fabricated',
          },
        ],
        requires_clarification: false,
        clarification_question: null,
        escalate_to_human: false,
        escalation_reason: null,
      },
      'How do I use SQLite in Node 26?',
      mockEvidence
    );

    expect(result.action).toBe('respond');
    expect(result.verifiedCitations.length).toBe(1);
    expect(result.verifiedCitations[0].source_url).toBe('https://nodejs.org/api/sqlite.html');
  });
  it('asks a focused question only when a scoped reviewed answer matches the question', () => {
    const draft = { can_answer_confidently: false, answer: '', citations: [{ source_url: 'memory:scoped', excerpt: 'Use the Autumn signup.', relevance: 'Scope' }], requires_clarification: true, clarification_question: 'Do you mean the Autumn sprint?', escalate_to_human: false, escalation_reason: null };
    const evidence: CaseEvidence = { ...mockEvidence[0], source_type: 'memory', source_url: 'memory:scoped', metadata: { question_match: 1, applies_when: 'Autumn sprint only' } };
    expect(policy.evaluate(draft, 'How do I join the sprint?', [evidence]).action).toBe('clarify');
    expect(policy.evaluate(draft, 'How do I claim a badge?', [{ ...evidence, metadata: { ...evidence.metadata, question_match: 0.2 } }]).action).toBe('queue');
  });

});
