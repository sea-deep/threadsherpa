import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Explicitly load the sandbox's own file. Never the bot's root .env.
dotenv.config({ path: path.join(root, '.env'), quiet: true });

const num = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const csv = (name: string, fallback: string[]): string[] => {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
};

export type RuntimeMode = 'guided' | 'live';

export const config = {
  port: num('SANDBOX_PORT', 8787),
  host: process.env.SANDBOX_HOST || '127.0.0.1',
  allowedOrigins: csv('SANDBOX_ALLOWED_ORIGIN', ['http://localhost:4321']),
  mode: (process.env.SANDBOX_MODE || 'guided').toLowerCase() as 'guided' | 'live' | 'auto',
  sessionTtlSeconds: num('SANDBOX_SESSION_TTL_SECONDS', 1200),
  maxActiveSessions: num('SANDBOX_MAX_ACTIVE_SESSIONS', 20),
  maxConcurrentRequests: num('SANDBOX_MAX_CONCURRENT_REQUESTS', 2),
  dailyModelCallLimit: num('SANDBOX_DAILY_MODEL_CALL_LIMIT', 0),
  maxQuestionsPerSession: num('SANDBOX_MAX_QUESTIONS_PER_SESSION', 10),
  maxSavesPerSession: num('SANDBOX_MAX_SAVES_PER_SESSION', 5),
  provider: (process.env.SANDBOX_MODEL_PROVIDER || process.env.MODEL_PROVIDER || 'ollama').toLowerCase(),
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'gemma4:e4b-it-qat',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'embeddinggemma-2:270m',
    timeoutMs: num('OLLAMA_TIMEOUT_MS', 90000),
  },
  paper: {
    apiKey: process.env.PAPER_INSTRUMENTS_API_KEY || '',
    model: process.env.PAPER_MODEL || 'paper-default',
  },
  cookieName: process.env.SANDBOX_COOKIE_NAME || 'ts_campfire',
  secureCookies: process.env.SANDBOX_SECURE_COOKIES === '1',
} as const;

export function providerConfigured(): boolean {
  if (config.provider === 'paper' || config.provider === 'paperinstruments') {
    return Boolean(config.paper.apiKey);
  }
  if (config.provider === 'ollama') return Boolean(config.ollama.baseUrl);
  return false;
}

export function liveRequested(): boolean {
  if (!providerConfigured()) return false;
  if (config.dailyModelCallLimit <= 0) return false;
  return config.mode === 'live' || config.mode === 'auto';
}

export { root as sandboxRoot };
