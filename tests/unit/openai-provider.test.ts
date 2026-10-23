import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { OpenAICompatibleProvider } from '../../src/integrations/model/openai.provider.js';
import { createModelProvider } from '../../src/integrations/model/factory.js';
import { PaperProvider } from '../../src/integrations/model/paper.provider.js';
import { loadConfig } from '../../src/config/env.js';

describe('OpenAI-Compatible & Cloud Model Provider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('OpenAICompatibleProvider', () => {
    it('reports error on health check when API key is missing for external endpoint', async () => {
      const provider = new OpenAICompatibleProvider({
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
      });

      const health = await provider.healthCheck();
      expect(health.ok).toBe(false);
      expect(health.error).toContain('API key not configured');
    });

    it('successfully checks health against mock models endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4o-mini' }, { id: 'text-embedding-3-small' }],
        }),
      });

      const provider = new OpenAICompatibleProvider({
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
      });

      const health = await provider.healthCheck();
      expect(health.ok).toBe(true);
      expect(health.selectedModelAvailable).toBe(true);
    });

    it('generates text with proper auth and payload format', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello! I am ThreadSherpa running on cloud API.',
              },
            },
          ],
        }),
      });

      const provider = new OpenAICompatibleProvider({
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      const text = await provider.generateText({
        prompt: 'Say hello',
      });

      expect(text).toBe('Hello! I am ThreadSherpa running on cloud API.');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
          }),
        })
      );
    });

    it('generates and validates structured output', async () => {
      const TestSchema = z.object({
        status: z.enum(['ok', 'error']),
        confidence: z.number(),
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ status: 'ok', confidence: 0.95 }),
              },
            },
          ],
        }),
      });

      const provider = new OpenAICompatibleProvider({
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      const structured = await provider.generateStructured({
        prompt: 'Check status',
        schema: TestSchema,
      });

      expect(structured.status).toBe('ok');
      expect(structured.confidence).toBe(0.95);
    });

    it('parses real embeddings and returns no vector when the API is down', async () => {
      // 1. Success case
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      });

      const provider = new OpenAICompatibleProvider({
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      const emb = await provider.generateEmbedding('hello');
      expect(emb).toEqual([0.1, 0.2, 0.3]);

      // 2. Fallback case when endpoint errors
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const fallbackVec = await provider.generateEmbedding('test fallback');
      expect(Array.isArray(fallbackVec)).toBe(true);
      expect(fallbackVec).toEqual([]);
    });
  });

  describe('createModelProvider Factory', () => {
    it('initializes Gemini provider when MODEL_PROVIDER is gemini', () => {
      const config = loadConfig({
        MODEL_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-gemini-key',
        DISCORD_BOT_TOKEN: 'mock_token',
        DISCORD_CLIENT_ID: 'mock_client',
      });

      const provider = createModelProvider(config);
      expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    });

    it('initializes Groq provider when MODEL_PROVIDER is groq', () => {
      const config = loadConfig({
        MODEL_PROVIDER: 'groq',
        GROQ_API_KEY: 'test-groq-key',
        DISCORD_BOT_TOKEN: 'mock_token',
        DISCORD_CLIENT_ID: 'mock_client',
      });

      const provider = createModelProvider(config);
      expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    });

    it('initializes Paper Instruments provider when MODEL_PROVIDER is paper', () => {
      const config = loadConfig({
        MODEL_PROVIDER: 'paper',
        PAPER_INSTRUMENTS_API_KEY: 'test-paper-key',
        DISCORD_BOT_TOKEN: 'mock_token',
        DISCORD_CLIENT_ID: 'mock_client',
      });

      const provider = createModelProvider(config);
      expect(provider).toBeInstanceOf(PaperProvider);
    });
  });
});
