import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { createMemoryMongoDb } from '../../src/database/memory-db.js';
import { CaseRepository } from '../../src/database/repositories/case.repo.js';
import { EvidenceRepository } from '../../src/database/repositories/evidence.repo.js';
import { GuildConfigRepository } from '../../src/database/repositories/guild-config.repo.js';
import { KnowledgeRepository } from '../../src/database/repositories/knowledge.repo.js';
import { AuditRepository } from '../../src/database/repositories/audit.repo.js';
import { MemoryRetriever } from '../../src/memory/retriever.js';
import { LearningPipeline } from '../../src/memory/learner.js';
import { ToolRegistry } from '../../src/agent/tools.js';
import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { SafeFetcher } from '../../src/integrations/web/safe-fetcher.js';
import type { ModelProvider } from '../../src/integrations/model/model-provider.interface.js';
import { OllamaProvider } from '../../src/integrations/model/ollama.provider.js';
import { PaperProvider } from '../../src/integrations/model/paper.provider.js';
import type { SupportCase } from '../../src/domain/case.js';
import { answerFeedback } from '../../src/support/conversation.js';
import {
  campfireMembers,
  fixtureThreads,
  type Knowledge,
  type Message,
  type QueueItem,
  type SandboxState,
  type SaveResult,
  type Thread,
} from '../../shared/sandbox.js';
import { config, providerConfigured } from './config.js';

/* --------------------------------------------------------------- limits */

export class BudgetError extends Error {
  code = 'budget';
}
export class BusyError extends Error {
  code = 'busy';
}

const dayKey = () => new Date().toISOString().slice(0, 10);

export class Budget {
  private day = dayKey();
  private used = 0;

  constructor(private readonly limit: number) {}

  private roll() {
    const today = dayKey();
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
  }

  take(): void {
    this.roll();
    if (this.limit <= 0 || this.used >= this.limit) throw new BudgetError('Daily model budget reached');
    this.used += 1;
  }

  get snapshot() {
    this.roll();
    return { used: this.used, limit: this.limit, day: this.day };
  }
}

/** Counts every provider call, including embeddings and duplicate checks. */
class BudgetedProvider implements ModelProvider {
  constructor(private inner: ModelProvider, private budget: Budget, private onCall: () => void) {}

  private gate() {
    this.budget.take();
    this.onCall();
  }

  async generateText(options: Parameters<ModelProvider['generateText']>[0]) {
    this.gate();
    return this.inner.generateText(options);
  }

  async generateStructured<T>(options: Parameters<ModelProvider['generateStructured']>[0]) {
    this.gate();
    return this.inner.generateStructured(options) as Promise<T>;
  }

  async generateEmbedding(text: string) {
    this.gate();
    return this.inner.generateEmbedding(text);
  }

  async healthCheck() {
    return this.inner.healthCheck();
  }
}

class Semaphore {
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(task: () => Promise<T>, timeoutMs = 45000): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== grant);
          reject(new BusyError('The sandbox is busy. Try again in a moment.'));
        }, timeoutMs);
        const grant = () => {
          clearTimeout(timer);
          resolve();
        };
        this.waiters.push(grant);
      });
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
  }
}

/* -------------------------------------------------------------- provider */

let provider: ModelProvider | null = null;
let providerHealth: { ok: boolean; reason?: string; checkedAt: number } | null = null;
const budget = new Budget(config.dailyModelCallLimit);
const limiter = new Semaphore(config.maxConcurrentRequests);

export function getProvider(): ModelProvider {
  if (provider) return provider;
  const local = new OllamaProvider({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    embeddingModel: config.ollama.embeddingModel,
    defaultTimeoutMs: config.ollama.timeoutMs,
  });
  provider =
    config.provider === 'paper' || config.provider === 'paperinstruments'
      ? new PaperProvider({
          apiKey: config.paper.apiKey,
          model: config.paper.model,
          localProvider: local,
          localModel: config.ollama.model,
          timeoutMs: config.ollama.timeoutMs,
        })
      : local;
  return provider;
}

export async function liveStatus(): Promise<{ live: boolean; reason?: string; models?: string[] }> {
  if (!providerConfigured()) return { live: false, reason: 'No model provider is configured.' };
  if (config.dailyModelCallLimit <= 0) {
    return { live: false, reason: 'No sandbox model budget is configured, so live replies stay off.' };
  }
  if (config.mode === 'guided') return { live: false, reason: 'The sandbox is running in guided mode.' };
  const now = Date.now();
  if (providerHealth && now - providerHealth.checkedAt < 30_000) {
    return providerHealth.ok
      ? { live: true, models: [config.ollama.model] }
      : { live: false, reason: providerHealth.reason };
  }
  try {
    const health = await getProvider().healthCheck();
    const ok = health.ok && health.selectedModelAvailable;
    providerHealth = {
      ok,
      checkedAt: now,
      reason: ok ? undefined : health.error || 'The configured model is not available.',
    };
    return ok ? { live: true, models: health.models } : { live: false, reason: providerHealth.reason };
  } catch (err) {
    providerHealth = { ok: false, checkedAt: now, reason: err instanceof Error ? err.message : 'Provider unreachable' };
    return { live: false, reason: providerHealth.reason };
  }
}

/* ---------------------------------------------------------------- session */

const SOURCE_PREFIX = 'campfire://thread/';

function sourceUrl(threadId: string, messageId: string): string {
  return `${SOURCE_PREFIX}${encodeURIComponent(threadId)}/message/${encodeURIComponent(messageId)}`;
}

function parseSource(ref: string | undefined): { threadId: string; messageId: string } | null {
  if (!ref || !ref.startsWith(SOURCE_PREFIX)) return null;
  const rest = ref.slice(SOURCE_PREFIX.length);
  const split = rest.indexOf('/message/');
  if (split === -1) return null;
  const threadId = rest.slice(0, split);
  const messageId = rest.slice(split + '/message/'.length);
  if (!threadId || !messageId) return null;
  return { threadId: decodeURIComponent(threadId), messageId: decodeURIComponent(messageId) };
}

export class LiveSession {
  readonly id = randomUUID();
  readonly guildId: string;
  readonly createdAt = Date.now();
  readonly expiresAt: number;
  private db: Db;
  private cases: CaseRepository;
  private evidence: EvidenceRepository;
  private guilds: GuildConfigRepository;
  private knowledgeRepo: KnowledgeRepository;
  private learning: LearningPipeline;
  private agent: AgentOrchestrator;
  private threads: Thread[];
  private knowledge: Knowledge[] = [];
  private queue: QueueItem[] = [];
  private revision = 1;
  private questionsUsed = 0;
  private savesUsed = 0;
  private modelCalls = 0;
  private readonly idempotency = new Map<string, unknown>();

  constructor(readonly mode: 'live' | 'guided') {
    this.guildId = `sandbox-${this.id}`;
    this.expiresAt = Date.now() + config.sessionTtlSeconds * 1000;
    this.db = createMemoryMongoDb();
    this.cases = new CaseRepository(this.db);
    this.evidence = new EvidenceRepository(this.db);
    this.guilds = new GuildConfigRepository(this.db);
    this.knowledgeRepo = new KnowledgeRepository(this.db);
    const audited = new AuditRepository(this.db);
    const call = () => {
      this.modelCalls += 1;
    };
    const counted = new BudgetedProvider(getProvider(), budget, call);
    this.learning = new LearningPipeline(this.knowledgeRepo, audited, counted);
    const retriever = new MemoryRetriever(this.knowledgeRepo, this.cases, counted);
    const tools = new ToolRegistry(retriever, new SafeFetcher([]), this.cases, this.evidence);
    this.agent = new AgentOrchestrator(this.cases, this.evidence, this.guilds, tools, counted);
    this.threads = fixtureThreads();
  }

  get expired(): boolean {
    return Date.now() > this.expiresAt;
  }

  async init(): Promise<void> {
    await this.guilds.upsert({
      guild_id: this.guildId,
      autonomy_mode: 'supervised',
      support_channel_ids: ['ask-campfire'],
      allowed_domains: [],
      documentation_urls: [],
    });
  }

  snapshot(): SandboxState {
    return {
      sessionId: this.id,
      mode: this.mode,
      threads: JSON.parse(JSON.stringify(this.threads)) as Thread[],
      knowledge: JSON.parse(JSON.stringify(this.knowledge)) as Knowledge[],
      queue: JSON.parse(JSON.stringify(this.queue)) as QueueItem[],
      limits: {
        questionsUsed: this.questionsUsed,
        questionsMax: config.maxQuestionsPerSession,
        savesUsed: this.savesUsed,
        savesMax: config.maxSavesPerSession,
        expiresAt: new Date(this.expiresAt).toISOString(),
      },
      revision: this.revision,
    };
  }

  cached<T>(key: string | undefined, run: () => Promise<T>): Promise<T> {
    if (key && this.idempotency.has(key)) return Promise.resolve(this.idempotency.get(key) as T);
    return run().then((value) => {
      if (key) {
        if (this.idempotency.size > 80) {
          const first = this.idempotency.keys().next().value;
          if (first) this.idempotency.delete(first);
        }
        this.idempotency.set(key, value);
      }
      return value;
    });
  }

  private thread(id: string): Thread | null {
    return this.threads.find((t) => t.id === id) || null;
  }

  private ensureQueue(thread: Thread, reason: QueueItem['reason']) {
    this.queue = this.queue.filter((q) => q.threadId !== thread.id);
    this.queue.unshift({
      caseId: thread.caseId || '',
      threadId: thread.id,
      title: thread.title,
      reason,
      at: new Date().toISOString(),
    });
  }

  private clearQueue(threadId: string) {
    this.queue = this.queue.filter((q) => q.threadId !== threadId);
  }

  private memberContext(thread: Thread): string {
    return thread.messages
      .filter((m) => m.author.role === 'member')
      .map((m) => m.body)
      .join('\n');
  }

  private async ensureCase(thread: Thread): Promise<SupportCase> {
    if (thread.caseId) {
      const existing = await this.cases.get(thread.caseId);
      if (existing) return existing;
    }
    const id = `case_${thread.id}`;
    const existing = await this.cases.get(id);
    if (existing) {
      thread.caseId = id;
      return existing;
    }
    const first = thread.messages.find((m) => m.author.role === 'member');
    const created = await this.cases.create({
      case_id: id,
      guild_id: this.guildId,
      channel_id: 'ask-campfire',
      thread_id: thread.id,
      message_id: first?.id || thread.id,
      requester_id: campfireMembers.alex.id,
      requester_username: thread.authorName,
      category: 'question',
      title: thread.title,
      summary: this.memberContext(thread) || thread.title,
      status: 'new',
    });
    thread.caseId = id;
    return created;
  }

  private async investigate(thread: Thread): Promise<'answer' | 'quiet' | 'clarify' | 'escalate'> {
    const supportCase = await this.ensureCase(thread);
    // The orchestrator replaces the summary with its answer, so restore live context first.
    await this.cases.updateSummary(supportCase.case_id, this.memberContext(thread) || thread.title);
    const result = await limiter.run(() => this.agent.investigateCase(supportCase.case_id));
    const { action, finalAnswer, verifiedCitations } = result.policyResult;
    thread.caseId = supportCase.case_id;

    if (action === 'respond' || action === 'clarify' || action === 'escalate') {
      const citation = verifiedCitations[0];
      const knowledgeId = citation?.source_url?.startsWith('memory:')
        ? citation.source_url.slice('memory:'.length)
        : null;
      const message: Message = {
        id: `msg_${randomUUID()}`,
        author: campfireMembers.bot,
        body: finalAnswer,
        at: new Date().toISOString(),
        kind: 'answer',
        knowledgeId,
      };
      thread.messages.push(message);
      thread.status = action === 'respond' ? 'answered' : action === 'clarify' ? 'awaiting' : 'needs_help';
      this.clearQueue(thread.id);
      this.revision += 1;
      return action === 'clarify' ? 'clarify' : action === 'escalate' ? 'escalate' : 'answer';
    }

    // Queue: no public bot message, ever.
    thread.status = 'awaiting';
    this.ensureQueue(thread, result.policyResult.reason === 'Repeated unsuccessful advice' ? 'failed' : 'unsupported');
    this.revision += 1;
    return 'quiet';
  }

  async post(title: string, body: string): Promise<{ state: SandboxState; threadId: string; status: string }> {
    if (this.questionsUsed >= config.maxQuestionsPerSession) throw new BudgetError('Question limit reached');
    const thread: Thread = {
      id: `thread_${randomUUID()}`,
      title,
      authorName: 'Alex',
      createdAt: new Date().toISOString(),
      status: 'open',
      origin: 'visitor',
      caseId: null,
      messages: [
        {
          id: `msg_${randomUUID()}`,
          author: campfireMembers.alex,
          body: body || title,
          at: new Date().toISOString(),
          kind: 'text',
        },
      ],
    };
    this.threads.unshift(thread);
    this.questionsUsed += 1;
    this.revision += 1;
    const outcome = await this.investigate(thread);
    return { state: this.snapshot(), threadId: thread.id, status: outcome };
  }

  async reply(threadId: string, body: string, role: 'member' | 'moderator'): Promise<{ state: SandboxState; status: string }> {
    const thread = this.thread(threadId);
    if (!thread) throw new Error('Thread not found');
    thread.messages.push({
      id: `msg_${randomUUID()}`,
      author: role === 'moderator' ? campfireMembers.sam : campfireMembers.alex,
      body,
      at: new Date().toISOString(),
      kind: 'text',
    });
    this.revision += 1;
    if (role === 'moderator') return { state: this.snapshot(), status: 'posted' };

    const feedback = answerFeedback(body);
    if (feedback) {
      const supportCase = await this.ensureCase(thread);
      if (feedback === 'solved') {
        await this.cases.updateStatus(supportCase.case_id, 'resolved', 'solved');
        thread.status = 'resolved';
        this.clearQueue(thread.id);
      } else {
        await this.cases.updateStatus(supportCase.case_id, 'awaiting_admin');
        thread.status = 'needs_help';
        this.ensureQueue(thread, 'failed');
      }
      this.revision += 1;
      return { state: this.snapshot(), status: feedback };
    }

    const looksLikeQuestion = /\?/.test(body) || body.trim().split(/\s+/).length >= 4;
    if (!looksLikeQuestion) return { state: this.snapshot(), status: 'posted' };

    const outcome = await this.investigate(thread);
    return { state: this.snapshot(), status: outcome };
  }

  async save(messageId: string): Promise<{ state: SandboxState; result: SaveResult }> {
    let found: { thread: Thread; message: Message } | null = null;
    for (const thread of this.threads) {
      const message = thread.messages.find((m) => m.id === messageId);
      if (message) {
        found = { thread, message };
        break;
      }
    }
    if (!found || found.message.author.role !== 'moderator') throw new Error('Message cannot be saved');
    const { thread, message } = found;
    if (message.savedKnowledgeId) {
      return { state: this.snapshot(), result: { status: 'exists', knowledgeId: message.savedKnowledgeId } };
    }
    if (this.savesUsed >= config.maxSavesPerSession) throw new BudgetError('Save limit reached');

    const supportCase = await this.ensureCase(thread);
    const firstMember = thread.messages.find((m) => m.author.role === 'member');
    const outcome = await limiter.run(() =>
      this.learning.saveAnswer({
        guildId: this.guildId,
        channelId: 'ask-campfire',
        adminUserId: campfireMembers.sam.id,
        adminMessage: message.body,
        sourceUrl: sourceUrl(thread.id, message.id),
        originCaseId: supportCase.case_id,
        reviewedPatterns: [thread.title],
        caseContext: {
          title: thread.title,
          originalQuestion: thread.title,
          originalContext: firstMember?.body || thread.title,
        },
      })
    );

    message.savedKnowledgeId = outcome.item.knowledge_id;
    this.savesUsed += 1;
    this.upsertKnowledge(outcome.item);
    if (outcome.status === 'saved') this.revision += 1;
    return {
      state: this.snapshot(),
      result: { status: outcome.status, knowledgeId: outcome.item.knowledge_id },
    };
  }

  private upsertKnowledge(item: {
    knowledge_id: string;
    question_patterns: string[];
    canonical_answer: string;
    current_version: number;
    updated_at: string;
    source_refs: string[];
  }) {
    const source = parseSource(item.source_refs[0]);
    const entry: Knowledge = {
      id: item.knowledge_id,
      question: item.question_patterns[0] || 'Saved answer',
      answer: item.canonical_answer,
      sourceThreadId: source?.threadId || '',
      sourceMessageId: source?.messageId || '',
      version: item.current_version,
      updatedAt: item.updated_at,
    };
    const index = this.knowledge.findIndex((k) => k.id === entry.id);
    if (index >= 0) this.knowledge[index] = entry;
    else this.knowledge.unshift(entry);
  }

  async edit(id: string, answer: string): Promise<SandboxState> {
    const updated = await limiter.run(() =>
      this.learning.correctAndSupersede(
        id,
        { canonical_answer: answer, change_reason: 'Moderator edit in the Campfire sandbox' },
        campfireMembers.sam.id
      )
    );
    if (!updated) throw new Error('Saved answer not found');
    this.upsertKnowledge(updated);
    this.revision += 1;
    return this.snapshot();
  }

  async remove(id: string): Promise<SandboxState> {
    const ok = await this.knowledgeRepo.delete(id);
    if (!ok) throw new Error('Saved answer not found');
    this.knowledge = this.knowledge.filter((k) => k.id !== id);
    for (const thread of this.threads) {
      for (const message of thread.messages) {
        if (message.savedKnowledgeId === id) message.savedKnowledgeId = null;
      }
    }
    this.revision += 1;
    return this.snapshot();
  }

  async outcome(threadId: string, outcome: 'solved' | 'needs_help'): Promise<SandboxState> {
    const thread = this.thread(threadId);
    if (!thread) throw new Error('Thread not found');
    const supportCase = await this.ensureCase(thread);
    if (outcome === 'solved') {
      await this.cases.updateStatus(supportCase.case_id, 'resolved', 'solved');
      thread.status = 'resolved';
      this.clearQueue(thread.id);
    } else {
      await this.cases.updateStatus(supportCase.case_id, 'awaiting_admin');
      thread.status = 'needs_help';
      this.ensureQueue(thread, 'needs_help');
    }
    this.revision += 1;
    return this.snapshot();
  }

  get modelCallCount() {
    return this.modelCalls;
  }
}

/* ------------------------------------------------------------------ store */

export class SessionStore {
  private sessions = new Map<string, LiveSession>();
  private sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref?.();
  }

  get size() {
    return this.sessions.size;
  }

  get budgetSnapshot() {
    return budget.snapshot;
  }

  async create(): Promise<LiveSession> {
    this.sweep();
    if (this.sessions.size >= config.maxActiveSessions) {
      // Drop the oldest expired-adjacent session rather than denying every new visitor.
      const oldest = [...this.sessions.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) this.sessions.delete(oldest.id);
    }
    const session = new LiveSession('live');
    await session.init();
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string | undefined): LiveSession | null {
    if (!id) return null;
    const session = this.sessions.get(id);
    if (!session) return null;
    if (session.expired) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  destroy(id: string) {
    this.sessions.delete(id);
  }

  private sweep() {
    for (const [id, session] of this.sessions) {
      if (session.expired) this.sessions.delete(id);
    }
  }
}

export const store = new SessionStore();
