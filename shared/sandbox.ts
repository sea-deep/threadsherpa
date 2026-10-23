/**
 * Shared sandbox contract used by the website (browser + build) and the sandbox API.
 * No Discord, database, or provider identifiers live here.
 */

export type Mode = 'guided' | 'live';
export type Perspective = 'member' | 'moderator';
export type ThreadStatus = 'open' | 'answered' | 'awaiting' | 'resolved' | 'needs_help';
export type AuthorRole = 'member' | 'moderator' | 'bot';

export interface Author {
  id: string;
  name: string;
  role: AuthorRole;
}

export interface Message {
  id: string;
  author: Author;
  body: string;
  at: string;
  kind: 'text' | 'answer';
  /** Bot answers: the approved knowledge used to write this reply. */
  knowledgeId?: string | null;
  /** Moderator messages: set once the message itself has been saved. */
  savedKnowledgeId?: string | null;
}

export interface Thread {
  id: string;
  title: string;
  authorName: string;
  createdAt: string;
  status: ThreadStatus;
  messages: Message[];
  caseId?: string | null;
  origin?: 'fixture' | 'visitor';
}

export interface Knowledge {
  id: string;
  question: string;
  answer: string;
  sourceThreadId: string;
  sourceMessageId: string;
  version: number;
  updatedAt: string;
  origin?: 'fixture' | 'visitor';
}

export interface QueueItem {
  caseId: string;
  threadId: string;
  title: string;
  reason: 'unsupported' | 'failed' | 'needs_help';
  at: string;
}

export interface SandboxLimits {
  questionsUsed: number;
  questionsMax: number;
  savesUsed: number;
  savesMax: number;
  expiresAt: string;
}

export interface SandboxState {
  sessionId: string;
  mode: Mode;
  threads: Thread[];
  knowledge: Knowledge[];
  queue: QueueItem[];
  limits: SandboxLimits;
  revision: number;
}

export interface SaveResult {
  status: 'saved' | 'exists';
  knowledgeId: string;
}

/* ------------------------------------------------------------------ copy */

export const sandboxCopy = {
  guild: 'Campfire',
  disclosure: 'Campfire is fictional. Nothing here posts to Discord.',
  liveLabel: 'Live sandbox',
  liveNote: 'Questions and saved replies are sent to the configured model provider. Use fictional details.',
  guidedLabel: 'Guided example',
  guidedNote: 'Prepared conversations. No live AI replies.',
  queueEmpty: 'No questions waiting.',
  knowledgeEmpty: 'No saved answers yet. Save a moderator reply to get started.',
  removeExplanation: 'Future replies will stop using this answer. Existing messages stay in place.',
  genericFailure: "This action couldn't finish. Your text is still here. Try again.",
  liveTimeout: "The live check couldn't finish. Your question is still here.",
  budget: 'Live replies are paused for now. You can still explore the guided example.',
  guidedSwitch: 'Explore the guided example',
  restartDialog: 'Restart Campfire? This clears only your sandbox conversations and saved answers.',
  checking: 'Checking saved answers...',
} as const;

/* --------------------------------------------------------------- fixture */

export const FIXTURE_THREAD_TITLE = 'Can I update my project after submitting?';
export const FIXTURE_QUESTION =
  'I spotted a bug after sharing my repo. Can I push a fix, or is the submitted version locked?';
export const FIXTURE_ANSWER =
  'Yes. Keep the same repo link and push your fixes before submissions close. Add a short “Latest changes” section to your README so reviewers can see what changed.';
export const FIXTURE_CORRECTION =
  'Submission updates are now closed. Keep your original repo link; further changes will not be reviewed.';

export const FIXTURE_REPLY =
  'Keep the original repo link and push the fix before submissions close. Add a short “Latest changes” section to your README so reviewers can see the update.';
export const README_REPLY =
  'Yes. Add a short “Latest changes” section to your README describing what changed.';
export const CORRECTED_REPLY =
  'Submission updates are closed, so further changes won\'t be reviewed. Keep the original repo link.';

export const announcements = {
  channel: 'announcements',
  heading: 'Weekend build submissions',
  lines: [
    'Submit a public repository with a short description of what it does.',
    'Your README needs screenshots and setup steps a stranger can follow.',
    'A demo video is optional. Solo projects are welcome.',
    'Support questions go in #ask-campfire.',
  ],
  footnote: 'Fictional event details for this sandbox.',
};

export const campfireMembers = {
  alex: { id: 'member-alex', name: 'Alex', role: 'member' as const },
  sam: { id: 'mod-sam', name: 'Sam', role: 'moderator' as const },
  priya: { id: 'member-priya', name: 'Priya', role: 'member' as const },
  noor: { id: 'member-noor', name: 'Noor', role: 'member' as const },
  bot: { id: 'bot-threadsherpa', name: 'ThreadSherpa', role: 'bot' as const },
};

const at = (minutesAgo: number) => new Date(Date.UTC(2026, 9, 23, 17, 40 - minutesAgo)).toISOString();

export function fixtureThreads(): Thread[] {
  return [
    {
      id: 'thread-update',
      title: FIXTURE_THREAD_TITLE,
      authorName: 'Alex',
      createdAt: at(48),
      status: 'open',
      origin: 'fixture',
      caseId: null,
      messages: [
        {
          id: 'msg-alex-1',
          author: campfireMembers.alex,
          body: FIXTURE_QUESTION,
          at: at(48),
          kind: 'text',
          savedKnowledgeId: null,
        },
        {
          id: 'msg-sam-1',
          author: campfireMembers.sam,
          body: FIXTURE_ANSWER,
          at: at(41),
          kind: 'text',
          savedKnowledgeId: null,
        },
      ],
    },
    {
      id: 'thread-readme',
      title: 'Is there a README template for submissions?',
      authorName: 'Priya',
      createdAt: at(210),
      status: 'open',
      origin: 'fixture',
      caseId: null,
      messages: [
        {
          id: 'msg-priya-1',
          author: campfireMembers.priya,
          body: 'First time submitting. Is there a structure reviewers expect?',
          at: at(210),
          kind: 'text',
        },
        {
          id: 'msg-sam-2',
          author: campfireMembers.sam,
          body: 'Start with what it does, then setup steps, a screenshot, and one command that runs it. Keep it short enough to skim.',
          at: at(204),
          kind: 'text',
        },
      ],
    },
    {
      id: 'thread-solo',
      title: 'Can I submit a solo project?',
      authorName: 'Noor',
      createdAt: at(320),
      status: 'open',
      origin: 'fixture',
      caseId: null,
      messages: [
        {
          id: 'msg-noor-1',
          author: campfireMembers.noor,
          body: 'None of my friends are free this weekend. Is a one-person submission allowed?',
          at: at(320),
          kind: 'text',
        },
        {
          id: 'msg-sam-3',
          author: campfireMembers.sam,
          body: 'Yes. Solo projects are judged the same way. Say in the README what you built by yourself.',
          at: at(315),
          kind: 'text',
        },
      ],
    },
  ];
}

export function initialState(mode: Mode, sessionId = 'local-guided'): SandboxState {
  return {
    sessionId,
    mode,
    threads: fixtureThreads(),
    knowledge: [],
    queue: [],
    limits: {
      questionsUsed: 0,
      questionsMax: mode === 'live' ? 10 : 10,
      savesUsed: 0,
      savesMax: mode === 'live' ? 5 : 99,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    },
    revision: 1,
  };
}

/* ------------------------------------------------------- prepared scenes */

export type PreparedKey = 'fix' | 'readme' | 'judging' | 'solved' | 'failed' | 'later';

export const preparedQuestions: Array<{ key: PreparedKey; label: string }> = [
  { key: 'fix', label: 'I pushed a fix. Do I need a new submission?' },
  { key: 'readme', label: 'Do I need to explain the fix anywhere?' },
  { key: 'judging', label: 'What time does judging start?' },
  { key: 'solved', label: 'That worked, thanks!' },
  { key: 'failed', label: "That didn't work." },
  { key: 'later', label: 'Can I still push a fix to my submission?' },
];

const norm = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function knowledgeShape(knowledge: Knowledge[]): 'fixture' | 'correction' | 'custom' | 'none' {
  if (!knowledge.length) return 'none';
  if (knowledge.some((item) => norm(item.answer) === norm(FIXTURE_ANSWER))) return 'fixture';
  if (knowledge.some((item) => norm(item.answer) === norm(FIXTURE_CORRECTION))) return 'correction';
  return 'custom';
}

/** Pick the prepared fact for a guided question. Returns null when the example has no prepared reply. */
export function guidedAnswer(
  key: PreparedKey,
  knowledge: Knowledge[]
): { kind: 'answer'; body: string } | { kind: 'quiet'; reason: 'unsupported' | 'failed' | 'needs_help' } | { kind: 'solved' } | null {
  const shape = knowledgeShape(knowledge);
  if (key === 'solved') return { kind: 'solved' };
  if (key === 'failed') return { kind: 'quiet', reason: 'failed' };
  if (key === 'judging') return { kind: 'quiet', reason: 'unsupported' };
  if (shape === 'none') return { kind: 'quiet', reason: 'unsupported' };
  if (shape === 'custom') return null;
  if (key === 'later' || shape === 'correction') {
    return shape === 'correction'
      ? { kind: 'answer', body: CORRECTED_REPLY }
      : { kind: 'answer', body: FIXTURE_REPLY };
  }
  if (key === 'readme') return { kind: 'answer', body: README_REPLY };
  return { kind: 'answer', body: FIXTURE_REPLY };
}

export function matchPreparedKey(title: string): PreparedKey | null {
  const text = norm(title);
  if (!text) return null;
  if (/^(that|this|it) (worked|fixed)/.test(text) || text === 'problem solved' || text === 'issue resolved') return 'solved';
  if (text.includes('didn t work') || text.includes('did not work') || text.includes('still broken')) return 'failed';
  if (text.includes('judging') || (text.includes('what time') && text.includes('start'))) return 'judging';
  if (text.includes('still push') || text.includes('still update') || text.includes('push a fix after')) return 'later';
  if (text.includes('readme') || text.includes('explain the fix')) return 'readme';
  if (text.includes('pushed a fix') || text.includes('new submission') || text.includes('update my project')) return 'fix';
  return null;
}

/* --------------------------------------------------------- guided engine */

let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class GuidedSandbox {
  private state: SandboxState;

  constructor(state?: SandboxState) {
    this.state = clone(state || initialState('guided'));
  }

  snapshot(): SandboxState {
    return clone(this.state);
  }

  private touch() {
    this.state.revision += 1;
  }

  private thread(id: string) {
    return this.state.threads.find((t) => t.id === id) || null;
  }

  private addQueue(thread: Thread, reason: QueueItem['reason']) {
    this.state.queue = this.state.queue.filter((q) => q.threadId !== thread.id);
    this.state.queue.unshift({
      caseId: thread.caseId || `case-${thread.id}`,
      threadId: thread.id,
      title: thread.title,
      reason,
      at: new Date().toISOString(),
    });
    thread.caseId = thread.caseId || `case-${thread.id}`;
  }

  private clearQueue(threadId: string) {
    this.state.queue = this.state.queue.filter((q) => q.threadId !== threadId);
  }

  postQuestion(title: string, body: string): { state: SandboxState; result: { status: 'answered' | 'quiet'; key: PreparedKey | null; note?: string } } {
    const thread: Thread = {
      id: uid('thread'),
      title,
      authorName: 'Alex',
      createdAt: new Date().toISOString(),
      status: 'open',
      origin: 'visitor',
      caseId: uid('case'),
      messages: [
        {
          id: uid('msg'),
          author: campfireMembers.alex,
          body: body || title,
          at: new Date().toISOString(),
          kind: 'text',
        },
      ],
    };
    this.state.threads.unshift(thread);
    const key = matchPreparedKey(title);
    if (!key) {
      this.addQueue(thread, 'unsupported');
      thread.status = 'awaiting';
      this.touch();
      return { state: this.snapshot(), result: { status: 'quiet', key } };
    }
    const outcome = guidedAnswer(key, this.state.knowledge);
    if (!outcome) {
      this.addQueue(thread, 'unsupported');
      thread.status = 'awaiting';
      this.touch();
      return {
        state: this.snapshot(),
        result: { status: 'quiet', key, note: 'This edit is outside the prepared scenes, so the guided example waits for a moderator.' },
      };
    }
    if (outcome.kind === 'solved') {
      thread.status = 'resolved';
      this.clearQueue(thread.id);
      this.touch();
      return { state: this.snapshot(), result: { status: 'quiet', key } };
    }
    if (outcome.kind === 'quiet') {
      this.addQueue(thread, outcome.reason);
      thread.status = outcome.reason === 'failed' ? 'needs_help' : 'awaiting';
      this.touch();
      return { state: this.snapshot(), result: { status: 'quiet', key } };
    }
    thread.messages.push({
      id: uid('msg'),
      author: campfireMembers.bot,
      body: outcome.body,
      at: new Date().toISOString(),
      kind: 'answer',
      knowledgeId: this.state.knowledge[0]?.id || null,
    });
    thread.status = 'answered';
    this.clearQueue(thread.id);
    this.touch();
    return { state: this.snapshot(), result: { status: 'answered', key } };
  }

  reply(threadId: string, body: string, role: Perspective): SandboxState {
    const thread = this.thread(threadId);
    if (!thread) return this.snapshot();
    thread.messages.push({
      id: uid('msg'),
      author: role === 'moderator' ? campfireMembers.sam : campfireMembers.alex,
      body,
      at: new Date().toISOString(),
      kind: 'text',
    });
    if (role === 'member') {
      const feedback = answerFeedback(body);
      if (feedback === 'solved') {
        thread.status = 'resolved';
        this.clearQueue(thread.id);
      } else if (feedback === 'failed') {
        thread.status = 'needs_help';
        this.addQueue(thread, 'failed');
      }
    }
    this.touch();
    return this.snapshot();
  }

  saveMessage(messageId: string): { state: SandboxState; result: SaveResult } {
    for (const thread of this.state.threads) {
      const message = thread.messages.find((m) => m.id === messageId);
      if (!message || message.author.role !== 'moderator') {
        return { state: this.snapshot(), result: { status: 'exists', knowledgeId: '' } };
      }
      if (message.savedKnowledgeId) {
        return { state: this.snapshot(), result: { status: 'exists', knowledgeId: message.savedKnowledgeId } };
      }
      const existing = this.state.knowledge.find(
        (k) => k.sourceThreadId === thread.id && norm(k.answer) === norm(message.body)
      );
      if (existing) {
        message.savedKnowledgeId = existing.id;
        this.touch();
        return { state: this.snapshot(), result: { status: 'exists', knowledgeId: existing.id } };
      }
      const item: Knowledge = {
        id: uid('know'),
        question: thread.title,
        answer: message.body,
        sourceThreadId: thread.id,
        sourceMessageId: message.id,
        version: 1,
        updatedAt: new Date().toISOString(),
        origin: message.body === FIXTURE_ANSWER ? 'fixture' : 'visitor',
      };
      this.state.knowledge.unshift(item);
      message.savedKnowledgeId = item.id;
      this.state.limits.savesUsed += 1;
      this.touch();
      return { state: this.snapshot(), result: { status: 'saved', knowledgeId: item.id } };
    }
    return { state: this.snapshot(), result: { status: 'exists', knowledgeId: '' } };
  }

  editKnowledge(id: string, answer: string): SandboxState {
    const item = this.state.knowledge.find((k) => k.id === id);
    if (!item) return this.snapshot();
    item.answer = answer;
    item.version += 1;
    item.updatedAt = new Date().toISOString();
    this.touch();
    return this.snapshot();
  }

  removeKnowledge(id: string): SandboxState {
    this.state.knowledge = this.state.knowledge.filter((k) => k.id !== id);
    for (const thread of this.state.threads) {
      for (const message of thread.messages) {
        if (message.savedKnowledgeId === id) message.savedKnowledgeId = null;
      }
    }
    this.touch();
    return this.snapshot();
  }

  outcome(caseIdOrThreadId: string, outcome: 'solved' | 'needs_help'): SandboxState {
    const thread =
      this.thread(caseIdOrThreadId) ||
      this.state.threads.find((t) => t.caseId === caseIdOrThreadId) ||
      null;
    if (!thread) return this.snapshot();
    if (outcome === 'solved') {
      thread.status = 'resolved';
      this.clearQueue(thread.id);
    } else {
      thread.status = 'needs_help';
      this.addQueue(thread, 'needs_help');
    }
    this.touch();
    return this.snapshot();
  }

  reset(): SandboxState {
    this.state = initialState('guided');
    return this.snapshot();
  }
}

/** Mirrors src/support/conversation.ts for the client-only guided fallback. */
export function answerFeedback(message: string): 'solved' | 'failed' | null {
  const text = norm(message);
  if (/^(?:(?:sorry|unfortunately|no) )?(?:(?:that|this|it) (?:didn t|did not|doesn t|does not) work|still not working|it s still broken|that didn t help|same error)\b/.test(text)) return 'failed';
  if (/^(?:(?:thanks|thank you|ty) )?(?:that worked|this worked|it worked|that fixed it|this fixed it|it s fixed|it is fixed|that solved it|problem solved|issue resolved)(?: (?:thanks|thank you|ty|now|perfectly|for me|all good))*$/.test(text)) return 'solved';
  return null;
}

/* --------------------------------------------------------------- search */

export function searchThreads(threads: Thread[], query: string): Thread[] {
  const q = norm(query);
  if (!q) return threads;
  const tokens = q.split(' ').filter(Boolean);
  return threads.filter((thread) => {
    const text = norm([thread.title, ...thread.messages.map((m) => m.body)].join(' '));
    return tokens.every((token) => text.includes(token));
  });
}
