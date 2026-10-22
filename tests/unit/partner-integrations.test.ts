import { describe, it, expect, vi, afterEach } from 'vitest';
import { SerpApiClient } from '../../src/integrations/web/serpapi.client.js';

describe('SerpApiClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('detects unconfigured state and skips live calls', async () => {
    const client = new SerpApiClient('');
    expect(client.isConfigured()).toBe(false);
    const results = await client.search('better-sqlite3 compile error');
    expect(results).toEqual([]);
  });

  it('parses organic search results into normalized structures', async () => {
    const mockResponse = {
      organic_results: [
        {
          title: 'Node 26 native addon compilation fix',
          link: 'https://github.com/WiseLibs/better-sqlite3/issues/1234',
          snippet: 'Use built-in node:sqlite on Node 26 LTS to avoid V8 deprecations.',
          displayed_link: 'github.com › WiseLibs',
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const client = new SerpApiClient('test-serpapi-key');
    expect(client.isConfigured()).toBe(true);

    const results = await client.search('node 26 sqlite fix', 1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Node 26 native addon compilation fix');
    expect(results[0].link).toBe('https://github.com/WiseLibs/better-sqlite3/issues/1234');
    expect(results[0].snippet).toContain('node:sqlite');
    expect(results[0].source).toBe('github.com › WiseLibs');
  });

  it('returns empty array when search endpoint returns non-200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const client = new SerpApiClient('invalid-key');
    const results = await client.search('test query');
    expect(results).toEqual([]);
  });
});
