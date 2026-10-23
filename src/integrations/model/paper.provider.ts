import OpenAI from 'openai';
import { ModelProvider, ModelHealthStatus, StructuredGenerationOptions, TextGenerationOptions } from './model-provider.interface.js';
import { instrumentModelProvider } from './traced.provider.js';
import { schemaExamples } from '../../agent/schemas.js';
import { recordModelUsage, traceAgentAction } from '../../utils/sentry.js';

// Published USD per million tokens, checked 2026-10-23. Estimates are not invoices.
// https://docs.paperinstruments.com/docs/ultramarine/billing
export const paperRates = { input: 0.15, cachedInput: 0.03, output: 0.50, checkedAt: '2026-10-23' };

export interface PaperUsage {
  calls: number;
  meteredCalls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number; // Includes reasoning; never add reasoning tokens again.
  reasoningTokens: number;
  estimatedCostUsd: number | null;
  pricingCheckedAt: string;
}

export function paperTokenCost(input: number, cached: number, output: number): number {
  return ((input - cached) * paperRates.input + cached * paperRates.cachedInput + output * paperRates.output) / 1_000_000;
}

export interface PaperProviderOptions {
  apiKey?: string;
  model?: string;
  reasoningEffort?: 'low' | 'high' | 'max';
  maxCompletionTokens?: number;
  timeoutMs?: number;
  localProvider: ModelProvider;
  localModel: string;
}

/** Paper reasons over support evidence; Gemma keeps learning and embeddings local. */
export class PaperProvider implements ModelProvider {
  private client: OpenAI | null;
  private local: ModelProvider;
  private model: string;
  private usage: PaperUsage = { calls: 0, meteredCalls: 0, inputTokens: 0, cachedInputTokens: 0,
    outputTokens: 0, reasoningTokens: 0, estimatedCostUsd: null, pricingCheckedAt: paperRates.checkedAt };

  constructor(private options: PaperProviderOptions) {
    this.model = options.model || 'ultramarine-1-flash';
    // Keep this key and endpoint separate from unrelated OPENAI_* settings.
    this.client = options.apiKey ? new OpenAI({ apiKey: options.apiKey,
      baseURL: 'https://api.paperinstruments.com/v1', maxRetries: 0, timeout: options.timeoutMs || 30000 }) : null;
    this.local = instrumentModelProvider(options.localProvider, options.localModel, 'ollama');
  }

  getUsage(): PaperUsage { return { ...this.usage }; }

  async healthCheck(): Promise<ModelHealthStatus> {
    if (!this.client) return { ok: false, models: [], selectedModelAvailable: false, embeddingModelAvailable: false,
      error: 'PAPER_INSTRUMENTS_API_KEY is not configured' };
    try {
      const models = await this.client.models.list({ timeout: 8000 });
      const local = await this.local.healthCheck();
      const selected = models.data.some(model => model.id === this.model);
      return { ok: selected, models: models.data.map(model => model.id), selectedModelAvailable: selected,
        embeddingModelAvailable: local.embeddingModelAvailable,
        error: !selected ? 'Ultramarine model is unavailable' : !local.selectedModelAvailable || !local.embeddingModelAvailable
          ? 'Paper is ready; local Gemma learning or embeddings are unavailable' : undefined };
    } catch {
      return { ok: false, models: [], selectedModelAvailable: false, embeddingModelAvailable: false,
        error: 'Could not verify Paper Instruments access; check the key and connectivity' };
    }
  }

  generateEmbedding(text: string): Promise<number[]> { return this.local.generateEmbedding(text); }

  generateText(options: TextGenerationOptions): Promise<string> { return this.complete(options, false); }

  async generateStructured<T>(options: StructuredGenerationOptions<T>): Promise<T> {
    if (['KnowledgeCandidateExtraction', 'KnowledgeDuplicate'].includes(options.schemaName || '')) return this.local.generateStructured(options);
    const shape = options.schemaName ? schemaExamples[options.schemaName] : undefined;
    const prompt = `${options.prompt}\n\nReturn only a JSON object.${shape ? ` Required shape: ${JSON.stringify(shape)}` : ''}`;
    const content = await this.complete({ ...options, prompt }, true);
    // Validation failure is visible to the caller; no silent paid repair or model fallback.
    return options.schema.parse(JSON.parse(content));
  }

  private async complete(options: TextGenerationOptions, json: boolean): Promise<string> {
    if (!this.client) throw new Error('PAPER_INSTRUMENTS_API_KEY is not configured');
    const client = this.client;
    return traceAgentAction('schemaName' in options ? String(options.schemaName) : 'support.ultramarine',
      'agent.inference', { 'gen_ai.request.model': this.model, 'gen_ai.provider.name': 'paperinstruments' }, async () => {
        this.usage.calls++;
        const completion = await client.chat.completions.create({
          model: this.model,
          messages: [
            ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
            { role: 'user', content: options.prompt },
          ],
          reasoning_effort: this.options.reasoningEffort || 'low',
          max_completion_tokens: Math.min(options.maxTokens || this.options.maxCompletionTokens || 4096, this.options.maxCompletionTokens || 4096),
          stream: false,
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
          // Use Paper's default sampling rather than generic provider overrides.
        }, { timeout: options.timeoutMs || this.options.timeoutMs || 30000 });

        const usage = completion.usage;
        if (usage && Number.isFinite(usage.prompt_tokens) && Number.isFinite(usage.completion_tokens)) {
          const cached = Math.min(usage.prompt_tokens, Math.max(0, usage.prompt_tokens_details?.cached_tokens || 0));
          this.usage.meteredCalls++;
          this.usage.inputTokens += usage.prompt_tokens;
          this.usage.cachedInputTokens += cached;
          this.usage.outputTokens += usage.completion_tokens;
          this.usage.reasoningTokens += usage.completion_tokens_details?.reasoning_tokens || 0;
          this.usage.estimatedCostUsd = (this.usage.estimatedCostUsd || 0) + paperTokenCost(usage.prompt_tokens, cached, usage.completion_tokens);
          recordModelUsage(usage.prompt_tokens, usage.completion_tokens);
        }
        const choice = completion.choices[0];
        if (!choice || choice.finish_reason !== 'stop' || !choice.message.content?.trim()) {
          throw new Error('Ultramarine did not return a complete answer within the configured output budget');
        }
        return choice.message.content.trim();
      });
  }
}
