import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PaperProvider, paperTokenCost } from '../../src/integrations/model/paper.provider.js';
import { ModelProvider } from '../../src/integrations/model/model-provider.interface.js';
import { createModelProvider } from '../../src/integrations/model/factory.js';
import { loadConfig } from '../../src/config/env.js';

const local = (): ModelProvider => ({ generateText: vi.fn(), generateStructured: vi.fn().mockResolvedValue({ question_patterns: ['Question'] }),
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
  healthCheck: vi.fn().mockResolvedValue({ ok: true, models: ['gemma'], selectedModelAvailable: true, embeddingModelAvailable: true }) });
const reply = (content: string, finish = 'stop', usage: unknown = { prompt_tokens: 20000, prompt_tokens_details: { cached_tokens: 10000 },
  completion_tokens: 1000, completion_tokens_details: { reasoning_tokens: 800 }, total_tokens: 21000 }) => new Response(JSON.stringify({
  id: 'fixture', object: 'chat.completion', created: 0, model: 'ultramarine-1-flash',
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finish }], usage,
}), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.restoreAllMocks());
describe('Paper Instruments and local Gemma', () => {
  it('uses the SDK at the Paper endpoint with bounded reasoning and no unrelated settings', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply('{"answer":"Check the pinned post."}'));
    const provider = new PaperProvider({ apiKey: 'fixture-key', localProvider: local(), localModel: 'gemma', maxCompletionTokens: 4096 });
    const result = await provider.generateStructured({ prompt: 'Answer from evidence', schema: z.object({ answer: z.string() }) });
    expect(result.answer).toContain('pinned');
    const [input, init] = fetch.mock.calls[0];
    const request = new Request(input, init);
    expect(request.url).toBe('https://api.paperinstruments.com/v1/chat/completions');
    const body = await request.clone().json();
    expect(body.reasoning_effort).toBe('low');
    expect(body.max_completion_tokens).toBe(4096);
    expect(body.temperature).toBeUndefined();
    expect(provider.getUsage()).toMatchObject({ calls: 1, meteredCalls: 1, inputTokens: 20000, cachedInputTokens: 10000,
      outputTokens: 1000, reasoningTokens: 800 });
    // Reasoning tokens are already included in output; cached input is a subset of input.
    expect(provider.getUsage().estimatedCostUsd).toBeCloseTo(0.0023, 9);
  });
  it('keeps question variants and embeddings local without a Paper request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const gemma = local();
    const provider = new PaperProvider({ apiKey: 'fixture-key', localProvider: gemma, localModel: 'gemma' });
    await provider.generateStructured({ prompt: 'Find question variants', schemaName: 'KnowledgeCandidateExtraction', schema: z.any() });
    expect(await provider.generateEmbedding('Question')).toEqual([0.1, 0.2]);
    expect(fetch).not.toHaveBeenCalled();
    expect(gemma.generateStructured).toHaveBeenCalled();
    expect(provider.getUsage().calls).toBe(0);
  });
  it('rejects truncated output while still counting returned billable usage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply('{"answer":', 'length'));
    const provider = new PaperProvider({ apiKey: 'fixture-key', localProvider: local(), localModel: 'gemma' });
    await expect(provider.generateText({ prompt: 'Question' })).rejects.toThrow('complete answer');
    expect(provider.getUsage().meteredCalls).toBe(1);
  });
  it('does not silently retry invalid JSON or errors', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply('not JSON'));
    const provider = new PaperProvider({ apiKey: 'fixture-key', localProvider: local(), localModel: 'gemma' });
    await expect(provider.generateStructured({ prompt: 'Question', schema: z.object({ answer: z.string() }) })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not invent costs when the response omits usage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Answer' }, finish_reason: 'stop' }] }), { headers: { 'Content-Type': 'application/json' } }));
    const provider = new PaperProvider({ apiKey: 'fixture-key', localProvider: local(), localModel: 'gemma' });
    await provider.generateText({ prompt: 'Question' });
    expect(provider.getUsage()).toMatchObject({ calls: 1, meteredCalls: 0, estimatedCostUsd: null });
  });
  it('does not substitute another provider’s key when the Paper key is absent', async () => {
    const provider = createModelProvider(loadConfig({ MODEL_PROVIDER: 'paper', PAPER_INSTRUMENTS_API_KEY: '', PAPERINSTRUMENTS_API_KEY: '',
      OPENAI_API_KEY: 'unrelated-key', OPENAI_BASE_URL: 'https://unrelated.example/v1' }));
    await expect(provider.generateText({ prompt: 'Question' })).rejects.toThrow('PAPER_INSTRUMENTS_API_KEY');
  });
  it('prices reasoning once, using uncached and cached input separately', () => {
    expect(paperTokenCost(20000, 0, 1000)).toBeCloseTo(0.0035, 9);
  });
});
