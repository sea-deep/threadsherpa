import dns from 'node:dns/promises';
import { logger } from '../utils/logger.js';

export interface SsrfValidationResult {
  safe: boolean;
  reason?: string;
  url?: URL;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254', // AWS/GCP/Azure instance metadata
  'metadata.google.internal',
]);

export function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  // 10.0.0.0 - 10.255.255.255
  if (/^10\./.test(ip)) return true;
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\./.test(ip)) return true;
  // 127.0.0.0/8 loopback
  if (/^127\./.test(ip)) return true;
  // 169.254.0.0/16 link-local
  if (/^169\.254\./.test(ip)) return true;
  // IPv6 loopback and private
  if (ip === '::1' || ip === 'fe80::' || ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true;

  return false;
}

export async function validateUrl(urlStr: string, allowedDomains: string[] = []): Promise<SsrfValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check explicit blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { safe: false, reason: `Access to internal host '${hostname}' is blocked` };
  }

  // Enforce allowed domains if configured
  if (allowedDomains.length > 0) {
    const isAllowed = allowedDomains.some(d => {
      const cleanDomain = d.trim().toLowerCase();
      return hostname === cleanDomain || hostname.endsWith(`.${cleanDomain}`);
    });
    if (!isAllowed) {
      return { safe: false, reason: `Host '${hostname}' is not in the allowed domains list` };
    }
  }

  // Resolve DNS to verify it doesn't resolve to a private IP (mitigate DNS rebinding)
  try {
    const lookup = await dns.lookup(hostname);
    if (isPrivateIp(lookup.address)) {
      logger.warn({ hostname, resolvedIp: lookup.address }, 'SSRF guard blocked access to resolved private IP');
      return { safe: false, reason: `Host resolves to private IP address: ${lookup.address}` };
    }
  } catch (err) {
    return { safe: false, reason: `Failed to resolve host: ${err instanceof Error ? err.message : String(err)}` };
  }

  return { safe: true, url: parsed };
}
