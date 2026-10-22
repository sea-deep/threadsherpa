import { getConfig } from './config/env.js';
import { getLogger } from './utils/logger.js';
import { initSentry } from './utils/sentry.js';
import { createDatabase, closeDatabase } from './database/connection.js';
import { runMigrations } from './database/migrator.js';
import { connectMongo, closeMongo } from './database/mongo/connection.js';
import { MongoKnowledgeRepository } from './database/mongo/knowledge.mongo.js';
import { MongoCaseRepository } from './database/mongo/case.mongo.js';
import { GuildConfigRepository } from './database/repositories/guild-config.repo.js';
import { CaseRepository } from './database/repositories/case.repo.js';
import { EvidenceRepository } from './database/repositories/evidence.repo.js';
import { KnowledgeRepository } from './database/repositories/knowledge.repo.js';
import { IncidentRepository } from './database/repositories/incident.repo.js';
import { GitHubRepository } from './database/repositories/github.repo.js';
import { AuditRepository } from './database/repositories/audit.repo.js';
import { OllamaProvider } from './integrations/model/ollama.provider.js';
import { createModelProvider } from './integrations/model/factory.js';
import { SafeFetcher } from './integrations/web/safe-fetcher.js';
import { GitHubClient } from './integrations/github/github.client.js';
import { SerpApiClient } from './integrations/web/serpapi.client.js';
import { MemoryRetriever } from './memory/retriever.js';
import { LearningPipeline } from './memory/learner.js';
import { ToolRegistry } from './agent/tools.js';
import { AgentOrchestrator } from './agent/orchestrator.js';
import { GitHubCopilot } from './agent/github-copilot.js';
import { IncidentDetector } from './agent/incident-detector.js';
import { BotInteractionRouter } from './bot/handlers/router.js';
import { createBotClient } from './bot/client.js';

const logger = getLogger();

export async function bootstrap() {
  logger.info('========================================');
  logger.info('Starting ThreadSherpa Support Copilot...');
  logger.info('========================================');

  const config = getConfig();

  // 1. Initialize Sentry Agent Tracing (if configured)
  if (config.SENTRY_DSN) {
    initSentry(config.SENTRY_DSN);
  }

  // 2. Initialize Database (Dual: SQLite / MongoDB Atlas)
  let mongoDbInstance = null;
  if (config.DATABASE_PROVIDER === 'mongodb' || config.MONGODB_URI) {
    try {
      const { db: mDb } = await connectMongo({
        uri: config.MONGODB_URI,
        dbName: config.MONGODB_DB_NAME,
      });
      mongoDbInstance = mDb;
      logger.info({ provider: 'MongoDB Atlas', db: config.MONGODB_DB_NAME }, 'Using MongoDB Atlas database backend');
    } catch (mongoErr) {
      logger.warn({ mongoErr }, 'Could not connect to MongoDB Atlas; falling back to local SQLite engine');
    }
  }

  // Always initialize SQLite engine for reliable local storage, FTS5, and fallback
  const db = createDatabase({ path: config.DATABASE_PATH });
  const migrationsApplied = runMigrations(db);
  logger.info({ migrationsApplied, path: config.DATABASE_PATH }, 'SQLite database engine verified');

  // 3. Initialize Repositories
  const guildRepo = new GuildConfigRepository(db);
  const caseRepo = new CaseRepository(db);
  const evidenceRepo = new EvidenceRepository(db);
  const knowledgeRepo = new KnowledgeRepository(db);
  const incidentRepo = new IncidentRepository(db);
  const githubRepo = new GitHubRepository(db);
  const auditRepo = new AuditRepository(db);

  // If MongoDB is connected, initialize Mongo repositories for dual persistence and Atlas Vector Search
  let mongoKnowledgeRepo: MongoKnowledgeRepository | null = null;
  let mongoCaseRepo: MongoCaseRepository | null = null;
  if (mongoDbInstance) {
    mongoKnowledgeRepo = new MongoKnowledgeRepository(mongoDbInstance);
    mongoCaseRepo = new MongoCaseRepository(mongoDbInstance);
  }

  // 4. Initialize Model Provider (Local Ollama / Google Gemini / Groq / OpenAI)
  const modelProvider = createModelProvider(config);

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

  // 5. Initialize Web, GitHub, & SerpApi Clients
  const allowedDomainsList = config.ALLOWED_DOMAINS.split(',').map(d => d.trim()).filter(Boolean);
  const safeFetcher = new SafeFetcher(allowedDomainsList);
  const githubClient = new GitHubClient(config.GITHUB_TOKEN);
  const serpApiClient = new SerpApiClient(config.SERPAPI_API_KEY);

  if (serpApiClient.isConfigured()) {
    logger.info('SerpApi Google search enabled for live web investigations');
  }

  // 6. Initialize Memory & Agent Engines
  const memoryRetriever = new MemoryRetriever(knowledgeRepo, caseRepo, modelProvider);
  const learningPipeline = new LearningPipeline(knowledgeRepo, auditRepo, modelProvider);
  const toolRegistry = new ToolRegistry(memoryRetriever, safeFetcher, githubClient, caseRepo, evidenceRepo, serpApiClient);

  const orchestrator = new AgentOrchestrator(
    db,
    caseRepo,
    evidenceRepo,
    guildRepo,
    toolRegistry,
    modelProvider,
    config.MAX_INVESTIGATION_ROUNDS,
    config.MAX_TOOL_CALLS_PER_INVESTIGATION
  );

  const githubCopilot = new GitHubCopilot(
    caseRepo,
    evidenceRepo,
    githubRepo,
    guildRepo,
    auditRepo,
    githubClient,
    modelProvider
  );

  const incidentDetector = new IncidentDetector(caseRepo, incidentRepo, auditRepo);

  // 7. Initialize Bot Interaction Router
  const router = new BotInteractionRouter(
    guildRepo,
    caseRepo,
    evidenceRepo,
    knowledgeRepo,
    orchestrator,
    learningPipeline,
    githubCopilot,
    incidentDetector
  );

  // 8. Start Discord Client if token is configured
  let discordClient = null;
  if (config.DISCORD_BOT_TOKEN && config.DISCORD_BOT_TOKEN !== 'dummy_token_for_tests') {
    discordClient = createBotClient({
      token: config.DISCORD_BOT_TOKEN,
      clientId: config.DISCORD_CLIENT_ID,
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
    closeDatabase();
    await closeMongo();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return {
    db,
    mongoDbInstance,
    mongoKnowledgeRepo,
    mongoCaseRepo,
    guildRepo,
    caseRepo,
    knowledgeRepo,
    incidentRepo,
    githubRepo,
    auditRepo,
    learningPipeline,
    orchestrator,
    githubCopilot,
    incidentDetector,
    router,
    discordClient,
    serpApiClient,
  };
}

// Auto-start when executed directly
if (process.argv[1] && process.argv[1].endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  bootstrap().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
