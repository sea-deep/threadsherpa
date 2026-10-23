import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationFlagsBitField } from 'discord.js';
import { checkSetup } from '../../src/setup.js';

vi.mock('node:fs/promises', () => ({ copyFile: vi.fn().mockRejectedValue(Object.assign(new Error('Exists'), { code: 'EEXIST' })) }));
vi.mock('../../src/config/env.js', () => ({ loadConfig: () => ({
  DISCORD_BOT_TOKEN: 'fixture-token', MONGODB_URI: 'mongodb+srv://fixture.invalid/', MONGODB_DB_NAME: 'threadsherpa',
  MODEL_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://localhost:11434', OLLAMA_MODEL: 'fixture-gemma', OLLAMA_EMBEDDING_MODEL: 'fixture-embedding',
}) }));
vi.mock('mongodb', () => ({ MongoClient: class {
  async connect() {} async close() {} db() { return { command: async () => ({ ok: 1 }) }; }
} }));
vi.mock('../../src/integrations/model/ollama.provider.js', () => ({ OllamaProvider: class {
  async healthCheck() { return { ok: true, selectedModelAvailable: true, embeddingModelAvailable: true }; }
} }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Setup readiness with a working token', () => {
  it.each([
    { flags: 0, ready: false },
    { flags: ApplicationFlagsBitField.Flags.GatewayMessageContentLimited, ready: true },
    { flags: ApplicationFlagsBitField.Flags.GatewayMessageContent, ready: true },
  ])('reports ready=$ready for application flags $flags', async ({ flags, ready }) => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '123456789012345678', flags }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await checkSetup()).toBe(ready);
    if (!ready) expect(output.mock.calls.flat().join('\n')).toContain('Message Content Intent is off');
    // The readiness check reads application settings; it never enables permissions itself.
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].method).toBeUndefined();
    expect(output.mock.calls.flat().join('\n')).not.toContain('fixture-token');
  });
});
