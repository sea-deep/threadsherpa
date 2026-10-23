import dns from 'node:dns/promises';
import { isIP } from 'node:net';
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

export function isPrivateIp(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0));
  }
  if (isIP(ip) === 6) {
    const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const mapped = normalized.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/);
    if (mapped) {
      const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
      return isPrivateIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return normalized.startsWith('::') || /^(f[cd]|fe[89ab]|ff)/.test(normalized);
  }
  return true; // An unrecognized DNS answer cannot authorize a network request.
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

  if (parsed.username || parsed.password) return { safe: false, reason: 'URL credentials are blocked' };
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Check explicit blocked hostnames
  if ((isIP(hostname) && isPrivateIp(hostname)) || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
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
    const lookups = await dns.lookup(hostname, { all: true });
    if (!lookups.length || lookups.some(lookup => isPrivateIp(lookup.address))) {
      logger.warn({ hostname }, 'SSRF guard blocked access to resolved private IP');
      return { safe: false, reason: 'Host resolves to a blocked IP address' };
    }
  } catch (err) {
    return { safe: false, reason: `Failed to resolve host: ${err instanceof Error ? err.message : String(err)}` };
  }

  return { safe: true, url: parsed };
}
