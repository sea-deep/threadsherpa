import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Discord Configuration
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required in production').default('dummy_token_for_tests'),
  DISCORD_CLIENT_ID: z.string().default('123456789012345678'),
  DISCORD_DEV_GUILD_ID: z.string().optional(),

  // Unified Database: MongoDB / MongoDB Atlas
  DATABASE_PROVIDER: z.string().default('mongodb'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/threadsherpa'),
  MONGODB_DB_NAME: z.string().default('threadsherpa'),

  // Model Provider Selection & Cloud APIs
  MODEL_PROVIDER: z.enum(['ollama', 'openai', 'gemini', 'groq', 'openrouter', 'paper', 'paperinstruments']).default('ollama'),

  // Local Open-Weight Model Configuration (Ollama / Gemma)
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:e4b-it-qat'),
  OLLAMA_EMBEDDING_MODEL: z.string().default('embeddinggemma-2:270m'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  // Paper Instruments (Ultramarine 1 Flash)
  PAPER_INSTRUMENTS_API_KEY: z.string().optional(),
  PAPERINSTRUMENTS_API_KEY: z.string().optional(),
  PAPER_MODEL: z.string().default('ultramarine-1-flash'),

  // External / Cloud Model Provider Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // GitHub Integration Configuration
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_DEFAULT_REPO: z.string().optional(),

  // Partner Integrations (Hacktoberfest Challenge Categories)
  SENTRY_DSN: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),

  // Support Bot Settings
  DEFAULT_AUTONOMY_MODE: z.enum(['observe', 'supervised', 'auto']).default('supervised'),
  MAX_INVESTIGATION_ROUNDS: z.coerce.number().int().min(1).max(5).default(3),
  MAX_TOOL_CALLS_PER_INVESTIGATION: z.coerce.number().int().min(1).max(12).default(6),
  INVESTIGATION_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  ALLOWED_DOMAINS: z.string().default('docs.github.com,nodejs.org,mongodb.com'),
});

export type AppConfig = z.infer<typeof envSchema>;

let parsedConfig: AppConfig | null = null;

export function loadConfig(overrides?: Partial<Record<string, unknown>>): AppConfig {
  const rawEnv = {
    ...process.env,
    ...(overrides || {}),
  };

  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${issues}`);
  }

  parsedConfig = result.data;
  return parsedConfig;
}

export function getConfig(): AppConfig {
  if (!parsedConfig) {
    return loadConfig();
  }
  return parsedConfig;
}
