import * as cheerio from 'cheerio';
import { validateUrl } from '../../security/ssrf.js';
import { logger } from '../../utils/logger.js';

export interface FetchedWebDocument {
  url: string;
  title: string;
  text: string;
  contentLength: number;
  suspectedPromptInjection: boolean;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /disregard\s+(all\s+)?rules/i,
  /antigravity\s+override/i,
];

export class SafeFetcher {
  constructor(private defaultAllowedDomains: string[] = []) {}

  async fetchPage(urlStr: string, allowedDomains?: string[]): Promise<FetchedWebDocument> {
    const domains = allowedDomains ?? this.defaultAllowedDomains;
    if (!domains.length) throw new Error('No documentation domains configured for this server');
    const validation = await validateUrl(urlStr, domains);
    if (!validation.safe || !validation.url) {
      throw new Error(`SSRF guard blocked fetch: ${validation.reason}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(validation.url.toString(), {
        headers: {
          'User-Agent': 'ThreadSherpa/1.0 (+https://github.com/sea-deep/threadsherpa)',
          'Accept': 'text/html,application/xhtml+xml,text/plain',
        },
        signal: controller.signal,
        redirect: 'error', // Redirect targets have not passed the allowlist and DNS checks.
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${urlStr}: HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!response.body) throw new Error('Documentation response has no body');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 262144) throw new Error('Documentation response exceeds 256KB');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const truncated = Buffer.concat(chunks).toString('utf8');
      clearTimeout(timeout);

      let title = '';
      let cleanText = '';

      if (contentType.includes('text/html') || truncated.includes('<html')) {
        const $ = cheerio.load(truncated);

        title = $('title').text().trim() || $('h1').first().text().trim() || validation.url.hostname;
        // Strip non-content tags
        $('script, style, noscript, nav, footer, iframe, svg, head').remove();

        cleanText = $('body').text().replace(/\s+/g, ' ').trim();
      } else {
        title = validation.url.pathname.split('/').pop() || validation.url.hostname;
        cleanText = truncated.replace(/\s+/g, ' ').trim();
      }

      // Detect prompt injection attempts in external untrusted content
      const suspectedInjection = INJECTION_PATTERNS.some(p => p.test(cleanText));
      if (suspectedInjection) {
        logger.warn({ url: urlStr }, 'Potential prompt injection pattern detected in retrieved web content');
      }

      return {
        url: validation.url.toString(),
        title: title.slice(0, 150),
        text: cleanText.slice(0, 15000), // Max 15k chars for prompt context
        contentLength: cleanText.length,
        suspectedPromptInjection: suspectedInjection,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Fetch timed out for ${urlStr}`);
      }
      throw err;
    }
  }
}
