import { recordModelUsage } from '../../utils/sentry.js';
import { schemaExamples } from '../../agent/schemas.js';
import { z } from 'zod';
import {
  ModelProvider,
  ModelHealthStatus,
  TextGenerationOptions,
  StructuredGenerationOptions,
} from './model-provider.interface.js';
import { logger } from '../../utils/logger.js';

export interface OpenAICompatibleProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  defaultTimeoutMs?: number;
}

export class OpenAICompatibleProvider implements ModelProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private embeddingModel: string;
  private defaultTimeoutMs: number;

  constructor(options: OpenAICompatibleProviderOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '';
    this.baseUrl = (options.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.embeddingModel = options.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 45000;
  }

  async healthCheck(): Promise<ModelHealthStatus> {
    if (!this.apiKey && !this.baseUrl.includes('localhost') && !this.baseUrl.includes('127.0.0.1')) {
      return {
        ok: false,
        models: [],
        selectedModelAvailable: false,
        embeddingModelAvailable: false,
        error: 'API key not configured for cloud model provider',
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        return {
          ok: false,
          models: [],
          selectedModelAvailable: false,
          embeddingModelAvailable: false,
          error: `Model endpoint responded with HTTP ${response.status}`,
        };
      }

      const data = await response.json() as { data?: Array<{ id: string }> };
      const modelList = Array.isArray(data.data) ? data.data.map(m => m.id) : [];

      return {
        ok: true,
        models: modelList,
        selectedModelAvailable: modelList.length === 0 || modelList.some(m => m.includes(this.model)),
        embeddingModelAvailable: true,
      };
    } catch (err) {
      return {
        ok: false,
        models: [],
        selectedModelAvailable: false,
        embeddingModelAvailable: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async generateText(options: TextGenerationOptions): Promise<string> {
    const timeout = options.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Cloud model chat failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      recordModelUsage(data.usage?.prompt_tokens, data.usage?.completion_tokens);
      return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Cloud model chat timed out after ${timeout}ms`);
      }
      throw err;
    }
  }

  async generateStructured<T>(options: StructuredGenerationOptions<T>): Promise<T> {
    const timeout = options.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const schemaInstruction = `Respond ONLY with valid JSON conforming to the expected schema.
Do NOT include markdown block markers (\`\`\`json) or conversational commentary.
${options.schemaName ? `Schema name: ${options.schemaName}. Required JSON shape: ${JSON.stringify(schemaExamples[options.schemaName] || {})}` : ''}`;

    const fullSystemPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${schemaInstruction}`
      : schemaInstruction;

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      { role: 'user', content: options.prompt },
    ];

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Structured chat failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      recordModelUsage(data.usage?.prompt_tokens, data.usage?.completion_tokens);
      const rawContent = data.choices?.[0]?.message?.content?.trim() || '{}';

      try {
        const parsedJson = JSON.parse(rawContent);
        const validated = options.schema.safeParse(parsedJson);
        if (validated.success) {
          return validated.data;
        }

        logger.warn({ issues: validated.error.issues }, 'Structured validation failed, attempting repair');
        return await this.repairStructuredOutput(options, rawContent, validated.error.message);
      } catch (jsonErr) {
        logger.warn({ err: jsonErr }, 'JSON parse failed, attempting repair');
        const errMsg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
        return await this.repairStructuredOutput(options, rawContent, errMsg);
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Cloud model structured request timed out after ${timeout}ms`);
      }
      throw err;
    }
  }

  private async repairStructuredOutput<T>(
    options: StructuredGenerationOptions<T>,
    badOutput: string,
    validationError: string
  ): Promise<T> {
    const repairPrompt = `Your previous response failed JSON schema validation.
Validation error:
${validationError}

Your previous output was:
${badOutput}

Original prompt:
${options.prompt}

Correct all validation errors and output the corrected JSON object now. Output ONLY valid JSON:`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a JSON repair assistant. Output only strictly valid JSON matching the schema.' },
            { role: 'user', content: repairPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Repair failed with status ${response.status}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const repairedContent = data.choices?.[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(repairedContent);
      return options.schema.parse(parsed);
    } catch (err) {
      clearTimeout(timer);
      logger.error({ err, badOutput }, 'Failed to repair structured output');
      throw err;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      return [];
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text.slice(0, 4000),
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Embeddings endpoint failed; using keyword search only');
        return [];
      }

      const data = await response.json() as {
        data?: Array<{ embedding?: number[] }>;
      };

      const embedding = data.data?.[0]?.embedding;
      if (Array.isArray(embedding) && embedding.length > 0) {
        return embedding;
      }

      return [];
    } catch (err) {
      logger.debug({ err }, 'Error calling cloud embeddings API, using keyword search only');
      return [];
    }
  }

}
