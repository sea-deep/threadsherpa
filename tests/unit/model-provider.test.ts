import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { OllamaProvider } from '../../src/integrations/model/ollama.provider.js';
import { SupportCaseClassificationSchema } from '../../src/agent/schemas.js';

describe('Ollama Model Provider', () => {
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'gemma4:e4b-it-qat',
    embeddingModel: 'embeddinggemma-2:270m',
  });

  it.skipIf(process.env.RUN_LIVE_MODELS !== '1')('performs health check against local Ollama', async () => {
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.models.length).toBeGreaterThan(0);
    expect(health.selectedModelAvailable).toBe(true);
    expect(health.embeddingModelAvailable).toBe(true);
  });

  it.skipIf(process.env.RUN_LIVE_MODELS !== '1')('generates real 768-dimensional embeddings', async () => {
    const embedding = await provider.generateEmbedding('How to resolve database connection error in SQLite');
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(768);
    // Values should be non-trivial floats
    const hasNonZero = embedding.some(v => Math.abs(v) > 0.0001);
    expect(hasNonZero).toBe(true);
  });

  it.skipIf(process.env.RUN_LIVE_MODELS !== '1')('generates structured output validated with Zod', async () => {
    const prompt = `Classify this user support message: "I am trying to run npm install on Node 26 on macOS M3, but better-sqlite3 fails with C++ compiler errors"`;
    
    const result = await provider.generateStructured({
      prompt,
      schema: SupportCaseClassificationSchema,
      schemaName: 'SupportCaseClassification',
      timeoutMs: 45000,
    });

    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('summary');
    expect(['install', 'bug', 'general', 'question']).toContain(result.category);
  }, 90000);

  it('uses keyword search when embeddings are unavailable, without fabricating vectors', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      expect(await provider.generateEmbedding('test problem')).toEqual([]);
    } finally { mock.mockRestore(); }
  });

});
