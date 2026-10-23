import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dns from 'node:dns/promises';
import { SafeFetcher } from '../../src/integrations/web/safe-fetcher.js';
import { isPrivateIp, validateUrl } from '../../src/security/ssrf.js';

beforeEach(() => { vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any); });
afterEach(() => vi.restoreAllMocks());

describe('Documentation boundaries', () => {
  it('does not inherit a default allowlist when a server explicitly permits no domains', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(new SafeFetcher(['example.org']).fetchPage('https://example.org', [])).rejects.toThrow('No documentation domains');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('disables automatic redirects and keeps the page title', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html><head><title>Event handbook</title></head><body><h1>Help</h1><p>Read this.</p></body></html>', { headers: { 'content-type': 'text/html' } }));
    const doc = await new SafeFetcher(['example.org']).fetchPage('https://example.org/handbook');
    expect(fetch.mock.calls[0][1]?.redirect).toBe('error');
    expect(doc.title).toBe('Event handbook');
    expect(doc.text).toContain('Read this.');
  });
  it('enforces the response size limit while reading, before parsing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('a'.repeat(262145)));
    await expect(new SafeFetcher(['example.org']).fetchPage('https://example.org')).rejects.toThrow('exceeds 256KB');
  });
  it('rejects a hostname when any DNS address is private', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }] as any);
    expect((await validateUrl('https://example.org', ['example.org'])).safe).toBe(false);
  });
  it.each(['0.0.0.0', '100.64.0.1', '::', 'fe90::1', 'fd12::1', 'fc12::1', '::ffff:127.0.0.1', '::ffff:7f00:1'])('blocks nonpublic address %s', ip => {
    expect(isPrivateIp(ip)).toBe(true);
  });
});
