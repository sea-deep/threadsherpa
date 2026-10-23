import { recordModelUsage } from '../../utils/sentry.js';
import { schemaExamples, ollamaOutputFormat } from '../../agent/schemas.js';
import { z } from 'zod';
import { ModelProvider, ModelHealthStatus, TextGenerationOptions, StructuredGenerationOptions } from './model-provider.interface.js';
import { logger } from '../../utils/logger.js';

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  defaultTimeoutMs?: number;
}

export class OllamaProvider implements ModelProvider {
  private baseUrl: string;
  private model: string;
  private embeddingModel: string;
  private defaultTimeoutMs: number;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    this.model = options.model || 'gemma4:e4b-it-qat';
    this.embeddingModel = options.embeddingModel || 'embeddinggemma-2:270m';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 60000;
  }

  async healthCheck(): Promise<ModelHealthStatus> {
    try {

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          ok: false,
          models: [],
          selectedModelAvailable: false,
          embeddingModelAvailable: false,
          error: `Ollama returned HTTP ${response.status}`,
        };
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelNames = (data.models || []).map(m => m.name);

      const selectedAvailable = modelNames.some(m => m === this.model || m.startsWith(`${this.model}:`));
      const embeddingAvailable = modelNames.some(m => m === this.embeddingModel || m.startsWith(`${this.embeddingModel}:`));

      return {
        ok: true,
        models: modelNames,
        selectedModelAvailable: selectedAvailable,
        embeddingModelAvailable: embeddingAvailable,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        selectedModelAvailable: false,
        embeddingModelAvailable: false,
        error: `Could not connect to Ollama at ${this.baseUrl}: ${msg}`,
      };
    }
  }

  async generateText(options: TextGenerationOptions): Promise<string> {
    const timeout = options.timeoutMs || this.defaultTimeoutMs;

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.2,
            num_predict: options.maxTokens ?? 2048,
          },
        }),
        signal: AbortSignal.timeout(timeout),
      });


      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama chat failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
      recordModelUsage(data.prompt_eval_count, data.eval_count);
      return data.message?.content || '';
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${timeout}ms`);
      }
      throw err;
    }
  }

  async generateStructured<T>(options: StructuredGenerationOptions<T>): Promise<T> {
    const timeout = options.timeoutMs || this.defaultTimeoutMs;

    const schemaInstruction = `You must return valid, raw JSON conforming to the requested schema.
Ensure your JSON output uses the exact keys required. Do NOT include markdown formatting or backticks.
${options.schemaName ? `Schema name: ${options.schemaName}. Required JSON shape: ${JSON.stringify(schemaExamples[options.schemaName] || {})}` : ''}`;
    const fullSystemPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${schemaInstruction}`
      : schemaInstruction;

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      { role: 'user', content: options.prompt },
    ];

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          format: ollamaOutputFormat(options.schemaName),
          stream: false,
          options: {
            temperature: options.temperature ?? 0.1,
            num_predict: options.maxTokens ?? 2048,
          },
        }),
        signal: AbortSignal.timeout(timeout),
      });


      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama chat failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
      recordModelUsage(data.prompt_eval_count, data.eval_count);
      const rawContent = data.message?.content?.trim() || '{}';

      let validationError: string;
      try {
        const parsed = options.schema.safeParse(JSON.parse(rawContent));
        if (parsed.success) return parsed.data;
        validationError = parsed.error.message;
      } catch (err) { validationError = err instanceof Error ? err.message : 'Invalid JSON'; }
      logger.warn('Structured output failed validation; attempting one repair');
      return await this.repairStructuredOutput(options, rawContent, validationError);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama structured request timed out after ${timeout}ms`);
      }
      throw err;
    }
  }

  private async repairStructuredOutput<T>(
    options: StructuredGenerationOptions<T>,
    previousOutput: string,
    validationError: string
  ): Promise<T> {
    const repairPrompt = `Your previous JSON output failed validation with the following error:
${validationError}

Previous output:
${previousOutput}

Please fix the output and return only valid JSON matching this shape:
${JSON.stringify(schemaExamples[options.schemaName || ''] || {})}`;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a JSON repair specialist. Output ONLY raw valid JSON.' },
          { role: 'user', content: repairPrompt },
        ],
        format: ollamaOutputFormat(options.schemaName),
        stream: false,
        options: { temperature: 0.05, num_predict: 2048 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs || this.defaultTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`JSON repair failed with HTTP ${response.status}`);
    }

    const data = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
      recordModelUsage(data.prompt_eval_count, data.eval_count);
    const repairedText = data.message?.content?.trim() || '{}';
    const parsed = JSON.parse(repairedText);
    return options.schema.parse(parsed);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const clean = text.trim();
    if (!clean) return [];
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embeddingModel, input: clean }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Embedding service returned HTTP ${response.status}`);
      const data = await response.json() as { embeddings?: number[][] };
      const vector = data.embeddings?.[0];
      if (!vector?.length || !vector.every(Number.isFinite)) throw new Error('Invalid embedding');
      return vector;
    } catch (err) {
      logger.warn({ err }, 'Embeddings unavailable; using keyword search only');
      return []; // Never mix fabricated vectors with the real model’s embedding space.
    }
  }
}
