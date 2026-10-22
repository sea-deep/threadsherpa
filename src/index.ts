import { getConfig } from './config/env.js';
import { getLogger } from './utils/logger.js';
import { createDatabase, closeDatabase } from './database/connection.js';
import { runMigrations } from './database/migrator.js';
import { GuildConfigRepository } from './database/repositories/guild-config.repo.js';
import { CaseRepository } from './database/repositories/case.repo.js';
import { EvidenceRepository } from './database/repositories/evidence.repo.js';
import { KnowledgeRepository } from './database/repositories/knowledge.repo.js';
import { IncidentRepository } from './database/repositories/incident.repo.js';
import { GitHubRepository } from './database/repositories/github.repo.js';
import { AuditRepository } from './database/repositories/audit.repo.js';
import { OllamaProvider } from './integrations/model/ollama.provider.js';
import { SafeFetcher } from './integrations/web/safe-fetcher.js';
import { GitHubClient } from './integrations/github/github.client.js';
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

  // 1. Initialize SQLite Database & Migrations
  const db = createDatabase({ path: config.DATABASE_PATH });
  const migrationsApplied = runMigrations(db);
  logger.info({ migrationsApplied }, 'Database initialized and schema verified');

  // 2. Initialize Repositories
  const guildRepo = new GuildConfigRepository(db);
  const caseRepo = new CaseRepository(db);
  const evidenceRepo = new EvidenceRepository(db);
  const knowledgeRepo = new KnowledgeRepository(db);
  const incidentRepo = new IncidentRepository(db);
  const githubRepo = new GitHubRepository(db);
  const auditRepo = new AuditRepository(db);

  // 3. Initialize Model Provider & Health Check
  const modelProvider = new OllamaProvider({
    baseUrl: config.OLLAMA_BASE_URL,
    model: config.OLLAMA_MODEL,
    embeddingModel: config.OLLAMA_EMBEDDING_MODEL,
    defaultTimeoutMs: config.OLLAMA_TIMEOUT_MS,
  });

  const modelHealth = await modelProvider.healthCheck();
  if (modelHealth.ok) {
    logger.info({
      model: config.OLLAMA_MODEL,
      embeddingModel: config.OLLAMA_EMBEDDING_MODEL,
      modelReady: modelHealth.selectedModelAvailable,
      embeddingsReady: modelHealth.embeddingModelAvailable,
    }, 'Ollama model provider online and ready');
  } else {
    logger.warn({ error: modelHealth.error }, 'Ollama health check reported issues (AI features will use fallbacks)');
  }

  // 4. Initialize Web & GitHub Clients
  const allowedDomainsList = config.ALLOWED_DOMAINS.split(',').map(d => d.trim()).filter(Boolean);
  const safeFetcher = new SafeFetcher(allowedDomainsList);
  const githubClient = new GitHubClient(config.GITHUB_TOKEN);

  // 5. Initialize Memory & Agent Engines
  const memoryRetriever = new MemoryRetriever(knowledgeRepo, caseRepo, modelProvider);
  const learningPipeline = new LearningPipeline(knowledgeRepo, auditRepo, modelProvider);
  const toolRegistry = new ToolRegistry(memoryRetriever, safeFetcher, githubClient, caseRepo, evidenceRepo);

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

  // 6. Initialize Bot Interaction Router
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

  // 7. Start Discord Client if token is configured
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
  const shutdown = () => {
    logger.info('Shutting down ThreadSherpa gracefully...');
    if (discordClient) {
      discordClient.destroy();
    }
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return {
    db,
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
  };
}

// Auto-start when executed directly
if (process.argv[1] && process.argv[1].endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  bootstrap().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
