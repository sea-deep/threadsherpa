import { logger } from '../../utils/logger.js';

export interface SerpApiSearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
}

export class SerpApiClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPAPI_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, num: number = 3): Promise<SerpApiSearchResult[]> {
    if (!this.apiKey) {
      logger.debug('SerpApi not configured; skipping web search');
      return [];
    }

    const cleanQuery = query.trim().slice(0, 100);
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('q', cleanQuery);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('num', String(num));
    url.searchParams.set('engine', 'google');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        logger.warn({ status: response.status }, 'SerpApi search request failed');
        return [];
      }

      const data = await response.json() as { organic_results?: Array<Record<string, unknown>> };
      const results = data.organic_results || [];

      return results.map(r => ({
        title: String(r.title || ''),
        link: String(r.link || ''),
        snippet: String(r.snippet || ''),
        source: String(r.displayed_link || 'google_search'),
      }));
    } catch (err) {
      logger.error({ err, query: cleanQuery }, 'Error executing SerpApi web search');
      return [];
    }
  }
}
