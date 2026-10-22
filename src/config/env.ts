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

  // Database Configuration
  DATABASE_PATH: z.string().default('./data/threadsherpa.sqlite'),

  // Ollama Model Configuration
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:e4b-it-qat'),
  OLLAMA_EMBEDDING_MODEL: z.string().default('embeddinggemma-2:270m'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  // GitHub Integration Configuration
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_DEFAULT_REPO: z.string().optional(),

  // Support Bot Settings
  DEFAULT_AUTONOMY_MODE: z.enum(['observe', 'supervised', 'auto']).default('supervised'),
  MAX_INVESTIGATION_ROUNDS: z.coerce.number().int().min(1).max(5).default(3),
  MAX_TOOL_CALLS_PER_INVESTIGATION: z.coerce.number().int().min(1).max(12).default(6),
  INVESTIGATION_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  ALLOWED_DOMAINS: z.string().default(''), // Comma-separated allowlisted domains for web fetching
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
