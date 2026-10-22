import { describe, it, expect } from 'vitest';
import { validateUrl, isPrivateIp } from '../../src/security/ssrf.js';

describe('SSRF Protection Guard', () => {
  it('identifies private IP addresses', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.5.1')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);

    // Public IPs should not be marked private
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('blocks localhost and loopback hostnames', async () => {
    const res1 = await validateUrl('http://localhost:3000/api');
    expect(res1.safe).toBe(false);
    expect(res1.reason).toContain('blocked');

    const res2 = await validateUrl('http://127.0.0.1:8080/secret');
    expect(res2.safe).toBe(false);
  });

  it('blocks AWS/GCP/Azure instance metadata endpoints', async () => {
    const res = await validateUrl('http://169.254.169.254/latest/meta-data/');
    expect(res.safe).toBe(false);
  });

  it('blocks non-HTTP protocols like file://, ftp://, and gopher://', async () => {
    const resFile = await validateUrl('file:///etc/passwd');
    expect(resFile.safe).toBe(false);
    expect(resFile.reason).toContain('Unsupported protocol');

    const resFtp = await validateUrl('ftp://ftp.example.com');
    expect(resFtp.safe).toBe(false);
  });

  it('enforces allowed domains allowlist when configured', async () => {
    const allowed = ['docs.github.com', 'developer.mozilla.org'];

    const valid = await validateUrl('https://docs.github.com/en/rest', allowed);
    expect(valid.safe).toBe(true);

    const blocked = await validateUrl('https://malicious-site.com/exploit', allowed);
    expect(blocked.safe).toBe(false);
    expect(blocked.reason).toContain('not in the allowed domains list');
  });
});
