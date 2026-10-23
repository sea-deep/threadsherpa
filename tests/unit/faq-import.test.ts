import { describe, expect, it } from 'vitest';
import { parseFaq, httpsSource } from '../../src/memory/faq-import.js';

describe('FAQ import', () => {
  it('preserves moderator facts, links and code instead of rewriting them', () => {
    expect(parseFaq('# FAQ\n\n## Where do I submit?\nUse [submissions](https://example.com).\n\n## How do I run it?\n```sh\n## This is a shell comment\nnpm start\n```'))
      .toEqual([{ question: 'Where do I submit?', answer: 'Use [submissions](https://example.com).' },
        { question: 'How do I run it?', answer: '```sh\n## This is a shell comment\nnpm start\n```' }]);
  });
  it('accepts Q/A pairs and Windows line endings', () => {
    expect(parseFaq('Q: Is a video required?\r\n\r\nA: No.\r\n\r\nQ: Can I work alone?\r\nA: Yes.'))
      .toEqual([{ question: 'Is a video required?', answer: 'No.' }, { question: 'Can I work alone?', answer: 'Yes.' }]);
  });
  it.each(['Just a paragraph.', '## Missing answer?', '## A?\nYes\n## A?\nNo', '## Run?\n```sh\nnpm start', 'x'.repeat(4001)])
    ('rejects an incomplete or ambiguous import before any save: %s', input => expect(() => parseFaq(input)).toThrow());
  it('bounds the import and rejects oversized questions', () => {
    expect(() => parseFaq(Array.from({ length: 11 }, (_, n) => `## Question ${n}?\nAnswer.`).join('\n'))).toThrow('10 answers');
    expect(() => parseFaq(`## ${'Q'.repeat(201)}\nAnswer`)).toThrow('200 characters');
  });
  it('accepts only optional credential-free HTTPS sources', () => {
    expect(httpsSource('')).toBeUndefined();
    expect(httpsSource(' https://example.com/faq ')).toBe('https://example.com/faq');
    for (const source of ['http://example.com', 'https://user:secret@example.com', 'javascript:alert(1)']) expect(() => httpsSource(source)).toThrow();
  });
});
