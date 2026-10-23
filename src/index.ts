import { setupProblems } from './config/readiness.js';
import { getConfig } from './config/env.js';
import { getLogger } from './utils/logger.js';
import { initSentry } from './utils/sentry.js';
import { connectDatabase, closeDatabase } from './database/connection.js';
import { GuildConfigRepository } from './database/repositories/guild-config.repo.js';
import { CaseRepository } from './database/repositories/case.repo.js';
import { EvidenceRepository } from './database/repositories/evidence.repo.js';
import { KnowledgeRepository } from './database/repositories/knowledge.repo.js';
import { AuditRepository } from './database/repositories/audit.repo.js';
import { instrumentModelProvider } from './integrations/model/traced.provider.js';
import { createModelProvider } from './integrations/model/factory.js';
import { SafeFetcher } from './integrations/web/safe-fetcher.js';
import { MemoryRetriever } from './memory/retriever.js';
import { LearningPipeline } from './memory/learner.js';
import { ToolRegistry } from './agent/tools.js';
import { AgentOrchestrator } from './agent/orchestrator.js';
import { BotInteractionRouter } from './bot/handlers/router.js';
import { createBotClient } from './bot/client.js';
import type { Db } from 'mongodb';

const logger = getLogger();

export async function bootstrap() {
  logger.info('Starting ThreadSherpa — Answer once. Help the next person.');

  const config = getConfig();
  const missing = setupProblems(config);
  if (missing.length) throw new Error(`Setup needs a few values:\n${missing.join('\n')}\nRun npm run setup or open docs/START_HERE.md.`);

  // 1. Initialize Sentry Agent Tracing (if configured)
  if (config.SENTRY_DSN) {
    initSentry(config.SENTRY_DSN);
  }

  // 2. Initialize Unified Database (MongoDB Atlas / local / in-memory fallback)
  const conn = await connectDatabase({ uri: config.MONGODB_URI, dbName: config.MONGODB_DB_NAME });
  const db: Db = conn.db;
  logger.info({ durable: Boolean(conn.client), db: config.MONGODB_DB_NAME },
    conn.client ? 'Connected to MongoDB' : 'Temporary demo memory: data is lost when this process exits');

  // 3. Initialize Repositories (Unified MongoDB)
  const guildRepo = new GuildConfigRepository(db);
  const caseRepo = new CaseRepository(db);
  const evidenceRepo = new EvidenceRepository(db);
  const knowledgeRepo = new KnowledgeRepository(db);
  const auditRepo = new AuditRepository(db);

  // 4. Initialize Model Provider (Paper Instruments / Ollama / Gemini / Groq / OpenAI)
  const rawProvider = createModelProvider(config);
  const modelProvider = ['paper', 'paperinstruments'].includes(config.MODEL_PROVIDER) ? rawProvider : instrumentModelProvider(rawProvider,
    config.MODEL_PROVIDER === 'ollama' ? config.OLLAMA_MODEL : (config.OPENAI_MODEL || config.PAPER_MODEL), config.MODEL_PROVIDER);

  const modelHealth = await modelProvider.healthCheck();
  if (modelHealth.ok) {
    logger.info({
      provider: config.MODEL_PROVIDER,
      modelReady: modelHealth.selectedModelAvailable,
      embeddingsReady: modelHealth.embeddingModelAvailable,
    }, 'Model provider online and ready');
  } else {
    logger.warn({ provider: config.MODEL_PROVIDER, error: modelHealth.error }, 'Model health check reported issues (AI features will use fallbacks)');
  }

  // Read only moderator-selected documentation pages
  const allowedDomainsList = config.ALLOWED_DOMAINS.split(',').map(d => d.trim()).filter(Boolean);
  const safeFetcher = new SafeFetcher(allowedDomainsList);

  // 6. Initialize Memory & Agent Engines
  const memoryRetriever = new MemoryRetriever(knowledgeRepo, caseRepo, modelProvider);
  const learningPipeline = new LearningPipeline(knowledgeRepo, auditRepo, modelProvider);
  const toolRegistry = new ToolRegistry(memoryRetriever, safeFetcher, caseRepo, evidenceRepo);

  const orchestrator = new AgentOrchestrator(
    caseRepo,
    evidenceRepo,
    guildRepo,
    toolRegistry,
    modelProvider,
    1,
    config.MAX_TOOL_CALLS_PER_INVESTIGATION
  );

  // 7. Initialize Bot Interaction Router
  const router = new BotInteractionRouter(
    guildRepo,
    caseRepo,
    evidenceRepo,
    knowledgeRepo,
    orchestrator,
    learningPipeline
  );

  // 8. Start Discord Client if token is configured
  let discordClient = null;
  if (config.DISCORD_BOT_TOKEN && config.DISCORD_BOT_TOKEN !== 'dummy_token_for_tests') {
    discordClient = createBotClient({
      token: config.DISCORD_BOT_TOKEN,
      devGuildId: config.DISCORD_DEV_GUILD_ID,
      router,
    });

    try {
      await discordClient.login(config.DISCORD_BOT_TOKEN);
    } catch (err) {
      logger.error({ err }, 'Failed to login to Discord Gateway with configured token');
    }
  } else {
    logger.info('No live DISCORD_BOT_TOKEN provided. Bot gateway running in local/test-ready mode.');
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down ThreadSherpa gracefully...');
    if (discordClient) {
      discordClient.destroy();
    }
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return {
    db,
    guildRepo,
    caseRepo,
    evidenceRepo,
    knowledgeRepo,
    auditRepo,
    learningPipeline,
    orchestrator,
    router,
    discordClient,
  };
}

// Auto-start when executed directly
if (process.argv[1] && process.argv[1].endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  bootstrap().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
