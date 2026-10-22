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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

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
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama chat failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as { message?: { content?: string } };
      return data.message?.content || '';
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${timeout}ms`);
      }
      throw err;
    }
  }

  async generateStructured<T>(options: StructuredGenerationOptions<T>): Promise<T> {
    const timeout = options.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const schemaInstruction = `You must return valid, raw JSON conforming to the requested schema.
Ensure your JSON output uses the exact keys required. Do NOT include markdown formatting or backticks.
${options.schemaName ? `Schema name: ${options.schemaName}` : ''}`;
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
          format: 'json',
          stream: false,
          options: {
            temperature: options.temperature ?? 0.1,
            num_predict: options.maxTokens ?? 2048,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama chat failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as { message?: { content?: string } };
      const rawContent = data.message?.content?.trim() || '{}';

      // Parse and validate
      try {
        const parsedJson = JSON.parse(rawContent);
        const validated = options.schema.safeParse(parsedJson);
        if (validated.success) {
          return validated.data;
        }

        logger.warn({ issues: validated.error.issues, rawContent }, 'Structured output validation failed, attempting repair');
        return await this.repairStructuredOutput(options, rawContent, validated.error.message);
      } catch (jsonErr: unknown) {
        logger.warn({ rawContent, err: jsonErr }, 'JSON parse failed, attempting repair');
        const errMsg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
        return await this.repairStructuredOutput(options, rawContent, errMsg);
      }
    } catch (err: unknown) {
      clearTimeout(timer);
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

Please fix the output and return only valid JSON matching the schema.`;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a JSON repair specialist. Output ONLY raw valid JSON.' },
          { role: 'user', content: repairPrompt },
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0.05 },
      }),
    });

    if (!response.ok) {
      throw new Error(`JSON repair failed with HTTP ${response.status}`);
    }

    const data = await response.json() as { message?: { content?: string } };
    const repairedText = data.message?.content?.trim() || '{}';
    const parsed = JSON.parse(repairedText);
    return options.schema.parse(parsed);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const clean = (text || '').trim();
    if (clean.length === 0) {
      return this.fallbackEmbedding('empty', 768);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: clean,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings returned HTTP ${response.status}`);
      }

      const data = await response.json() as { embedding?: number[]; embeddings?: number[][] };
      if (Array.isArray(data.embedding) && data.embedding.length > 0) {
        return data.embedding;
      }
      if (Array.isArray(data.embeddings) && Array.isArray(data.embeddings[0])) {
        return data.embeddings[0];
      }

      throw new Error('No embedding returned from Ollama');
    } catch (err) {
      logger.warn({ err, text: clean.slice(0, 50) }, 'Failed to get embedding from Ollama, using fallback vector');
      return this.fallbackEmbedding(clean);
    }
  }

  private fallbackEmbedding(text: string, dimension: number = 768): number[] {
    // Deterministic pseudo-embedding for fallback or test environments
    const vec = new Array(dimension).fill(0);
    const clean = text.toLowerCase();
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      const pos = (code * 31 + i) % dimension;
      vec[pos] += 1;
    }
    // Normalize
    const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return mag > 0 ? vec.map(v => v / mag) : vec;
  }
}
