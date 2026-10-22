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
    const domains = allowedDomains && allowedDomains.length > 0 ? allowedDomains : this.defaultAllowedDomains;
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
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${urlStr}: HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      // Enforce 256KB cap
      const truncated = rawText.slice(0, 262144);

      let title = '';
      let cleanText = '';

      if (contentType.includes('text/html') || truncated.includes('<html')) {
        const $ = cheerio.load(truncated);

        // Strip non-content tags
        $('script, style, noscript, nav, footer, iframe, svg, head').remove();

        title = $('title').text().trim() || $('h1').first().text().trim() || validation.url.hostname;
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
