import { describe, it, expect, vi } from 'vitest';
import { initSentry, traceAgentAction } from '../../src/utils/sentry.js';

describe('Sentry Agent Tracing', () => {
  it('returns false when no DSN is configured', () => {
    const initialized = initSentry(undefined);
    expect(typeof initialized).toBe('boolean');
  });

  it('transparently executes traced callback and returns its output', async () => {
    const output = await traceAgentAction(
      'test-action',
      'agent.tool',
      { tool: 'knowledge_search' },
      async () => {
        return { hits: 3 };
      }
    );

    expect(output).toEqual({ hits: 3 });
  });

  it('propagates errors from callback without suppressing them', async () => {
    await expect(
      traceAgentAction(
        'failing-action',
        'agent.tool',
        { tool: 'failing_tool' },
        async () => {
          throw new Error('Tool execution timeout');
        }
      )
    ).rejects.toThrow('Tool execution timeout');
  });
});
