import {
  GuidedSandbox,
  initialState,
  FIXTURE_CORRECTION,
  announcements,
  preparedQuestions,
  sandboxCopy,
  searchThreads,
  type Knowledge,
  type Message,
  type Mode,
  type Perspective,
  type SandboxState,
  type SaveResult,
  type Thread,
} from "../../../shared/sandbox";

/* ------------------------------------------------------------------ types */

type Page = "thread" | "compose";

type Transport = {
  mode: Mode;
  init(): Promise<SandboxState>;
  post(
    title: string,
    body: string,
  ): Promise<{
    state: SandboxState;
    status: string;
    threadId?: string;
    note?: string;
  }>;
  reply(
    threadId: string,
    body: string,
    role: Perspective,
  ): Promise<{ state: SandboxState; status: string }>;
  save(messageId: string): Promise<{ state: SandboxState; result: SaveResult }>;
  edit(id: string, answer: string): Promise<SandboxState>;
  remove(id: string): Promise<SandboxState>;
  outcome(
    threadId: string,
    outcome: "solved" | "needs_help",
  ): Promise<SandboxState>;
  reset(): Promise<SandboxState>;
};

type Notice = {
  text: string;
  kind: "pending" | "error" | "ok";
  action?: "guided" | "restart";
};

type FieldError = {
  field: "title" | "body" | "reply" | "edit";
  message: string;
};

type MenuState = {
  messageId: string;
  trigger: HTMLElement;
};

const REFERENCE = Date.UTC(2026, 9, 23, 17, 40);
const TEST_EXAMPLES = [
  "I pushed a fix. Do I need a new submission?",
  "What should my README say about the update?",
  "What time does judging start?",
];

/* ------------------------------------------------------------------ utils */

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_");

const timeAgo = (iso: string): string => {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "now";
  const minutes = Math.max(0, Math.round((REFERENCE - then) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

const statusLabel = (thread: Thread): string => {
  switch (thread.status) {
    case "awaiting":
      return "Waiting for moderator";
    case "answered":
      return "Answered";
    case "resolved":
      return "Solved";
    case "needs_help":
      return "Needs help";
    default:
      return "Open";
  }
};

const queueReason = (
  reason: "unsupported" | "failed" | "needs_help",
): string =>
  reason === "unsupported" ? "Waiting for a moderator" : "Needs a person";

const scrollbar = (element: HTMLElement | null) => {
  if (element) element.scrollTop = element.scrollHeight;
};

/* --------------------------------------------------------------- transports */

class SandboxError extends Error {
  code: string;
  status: number;
  state?: SandboxState;

  constructor(
    message: string,
    code = "unknown",
    status = 0,
    state?: SandboxState,
  ) {
    super(message);
    this.name = "SandboxError";
    this.code = code;
    this.status = status;
    this.state = state;
  }
}

class GuidedTransport implements Transport {
  mode: Mode = "guided";
  private sandbox = new GuidedSandbox();

  async init(): Promise<SandboxState> {
    this.sandbox = new GuidedSandbox();
    return this.sandbox.snapshot();
  }

  async post(title: string, body: string) {
    const result = this.sandbox.postQuestion(title, body);
    const threadId = result.state.threads[0]?.id;
    return {
      state: result.state,
      status: result.result.status === "answered" ? "answer" : "quiet",
      threadId,
      note: result.result.note,
    };
  }

  async reply(threadId: string, body: string, role: Perspective) {
    const state = this.sandbox.reply(threadId, body, role);
    const thread = state.threads.find((item) => item.id === threadId);
    const last = thread?.messages[thread.messages.length - 1];
    if (last?.author.role === "bot") return { state, status: "answer" };
    if (thread?.status === "resolved") return { state, status: "solved" };
    if (thread?.status === "needs_help") return { state, status: "failed" };
    return { state, status: "posted" };
  }

  async save(messageId: string) {
    return this.sandbox.saveMessage(messageId);
  }

  async edit(id: string, answer: string) {
    return this.sandbox.editKnowledge(id, answer);
  }

  async remove(id: string) {
    return this.sandbox.removeKnowledge(id);
  }

  async outcome(threadId: string, outcome: "solved" | "needs_help") {
    return this.sandbox.outcome(threadId, outcome);
  }

  async reset() {
    return this.sandbox.reset();
  }
}

class LiveTransport implements Transport {
  mode: Mode = "live";

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown; timeout?: number } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      init.timeout ?? 120_000,
    );
    try {
      const response = await fetch(path, {
        method: init.method ?? "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          ...(init.body !== undefined
            ? { "content-type": "application/json" }
            : {}),
          "idempotency-key": crypto.randomUUID(),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const data = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
        state?: SandboxState;
      } | null;
      if (!response.ok) {
        throw new SandboxError(
          data?.error?.message ?? sandboxCopy.genericFailure,
          data?.error?.code ?? "request",
          response.status,
          data?.state,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof SandboxError) throw error;
      if ((error as Error)?.name === "AbortError") {
        throw new SandboxError(sandboxCopy.liveTimeout, "live_failed", 504);
      }
      throw new SandboxError(sandboxCopy.genericFailure, "network", 0);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async init(): Promise<SandboxState> {
    const data = await this.request<{
      capability?: { live?: boolean; mode?: string };
      state?: SandboxState | null;
    }>("/api/sandbox/sessions", { method: "POST", timeout: 15_000 });
    if (!data.state || !data.capability?.live) {
      throw new SandboxError("Live sandbox unavailable.", "not_live", 503);
    }
    return data.state;
  }

  async post(title: string, body: string) {
    return this.request<{
      state: SandboxState;
      status: string;
      threadId?: string;
    }>("/api/sandbox/posts", {
      method: "POST",
      body: { title, body },
    });
  }

  async reply(threadId: string, body: string, role: Perspective) {
    return this.request<{ state: SandboxState; status: string }>(
      `/api/sandbox/threads/${encodeURIComponent(threadId)}/messages`,
      { method: "POST", body: { body, role } },
    );
  }

  async save(messageId: string) {
    return this.request<{ state: SandboxState; result: SaveResult }>(
      `/api/sandbox/messages/${encodeURIComponent(messageId)}/save`,
      { method: "POST", body: {} },
    );
  }

  async edit(id: string, answer: string) {
    const data = await this.request<{ state: SandboxState }>(
      `/api/sandbox/knowledge/${encodeURIComponent(id)}`,
      { method: "PATCH", body: { answer } },
    );
    return data.state;
  }

  async remove(id: string) {
    const data = await this.request<{ state: SandboxState }>(
      `/api/sandbox/knowledge/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return data.state;
  }

  async outcome(threadId: string, outcome: "solved" | "needs_help") {
    const data = await this.request<{ state: SandboxState }>(
      `/api/sandbox/cases/${encodeURIComponent(threadId)}/outcome`,
      { method: "POST", body: { outcome } },
    );
    return data.state;
  }

  async reset(): Promise<SandboxState> {
    await this.request("/api/sandbox/session", {
      method: "DELETE",
      timeout: 15_000,
    });
    return this.init();
  }
}

/* ------------------------------------------------------------------ start */

function start(root: HTMLElement) {
  const refs = {
    thread: root.querySelector<HTMLElement>(".thread"),
    forumBody: root.querySelector<HTMLElement>("[data-forum-body]"),
    tabs: root.querySelector<HTMLElement>("[data-tool-tabs]"),
    search: root.querySelector<HTMLInputElement>("[data-search]"),
    rail: root.querySelector<HTMLElement>(".rail"),
    railFoot: root.querySelector<HTMLElement>(".rail__foot"),
    modeLabel: root.querySelector<HTMLElement>("[data-mode-label]"),
    modePill: root.querySelector<HTMLElement>("[data-mode-pill]"),
    modeNote: root.querySelector<HTMLElement>("[data-mode-note]"),
    channelLabel: root.querySelector<HTMLElement>("[data-channel-label]"),
    support: root.querySelector<HTMLElement>("[data-support]"),
    restartDialog: document.querySelector<HTMLDialogElement>(
      "[data-restart-dialog]",
    ),
    canvas: root.querySelector<HTMLCanvasElement>("[data-thread-canvas]"),
    liveStatus: root.querySelector<HTMLElement>("[data-live-status]"),
  };

  let state = initialState("guided");
  let transport: Transport = new GuidedTransport();
  let mode: Mode = "guided";
  let perspective: Perspective = "moderator";
  let channel: "support" | "announcements" = "support";
  let toolsTab: "threads" | "queue" | "saved" = "threads";
  let selectedThreadId = "thread-update";
  let search = "";
  let page: Page = "thread";
  let mobilePane: "rail" | "forum" | "thread" = "forum";
  let narration: "none" | "saved" | "answered" | "solved" = "none";
  let narrationThreadId: string | null = null;
  let notice: Notice | null = null;
  let fieldError: FieldError | null = null;
  let draft = { title: "", body: "" };
  let chips: string[] = [];
  let replyDrafts: Record<string, string> = {};
  let editingId: string | null = null;
  let editingText = "";
  let removingId: string | null = null;
  let pending:
    "post" | "reply" | "save" | "edit" | "remove" | "outcome" | "reset" | null =
    null;
  let highlightMessageId: string | null = null;
  let menu: MenuState | null = null;
  let menuElement: HTMLElement | null = null;
  let scene: {
    setPhase(phase: string): void;
    setPointer(x: number, y: number): void;
    destroy(): void;
  } | null = null;

  const selected = (): Thread | null =>
    state.threads.find((thread) => thread.id === selectedThreadId) ?? null;

  const knowledge = (id: string | null | undefined): Knowledge | null =>
    id ? (state.knowledge.find((item) => item.id === id) ?? null) : null;

  function apply(next: SandboxState) {
    state = next;
    if (!state.threads.some((thread) => thread.id === selectedThreadId)) {
      selectedThreadId = state.threads[0]?.id ?? "";
    }
    if (perspective === "member" && toolsTab !== "threads")
      toolsTab = "threads";
    mode = transport.mode;
  }

  /* --------------------------------------------------------------- chrome */

  function renderChrome() {
    root.dataset.mode = mode;
    root.dataset.perspective = perspective;
    root.dataset.mobilePane = mobilePane;
    root.dataset.channel = channel;

    if (refs.modeLabel)
      refs.modeLabel.textContent =
        mode === "live" ? sandboxCopy.liveLabel : sandboxCopy.guidedLabel;
    if (refs.modePill) {
      refs.modePill.dataset.mode = mode;
      refs.modePill.setAttribute(
        "aria-label",
        mode === "live" ? "Live sandbox" : "Guided example",
      );
    }
    if (refs.modeNote) {
      refs.modeNote.innerHTML =
        mode === "live"
          ? `<span class="dot" aria-hidden="true"></span><strong>${sandboxCopy.liveLabel}.</strong> ${sandboxCopy.liveNote}`
          : `<span class="dot" aria-hidden="true"></span><strong>${sandboxCopy.guidedLabel}.</strong> ${sandboxCopy.guidedNote}`;
    }
    if (refs.channelLabel) {
      refs.channelLabel.textContent =
        channel === "announcements" ? "#announcements" : "#ask-campfire";
    }
    if (refs.liveStatus) {
      const text = notice?.text ?? "";
      if (refs.liveStatus.textContent !== text)
        refs.liveStatus.textContent = text;
    }
    root
      .querySelectorAll<HTMLElement>("[data-perspective]")
      .forEach((button) => {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.perspective === perspective),
        );
      });
    root.querySelectorAll<HTMLElement>("[data-channel]").forEach((button) => {
      const current =
        (channel === "announcements" &&
          button.dataset.channel === "announcements") ||
        (channel === "support" && button.dataset.channel === "support");
      if (current) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    if (refs.tabs) {
      (refs.tabs as HTMLElement).hidden = perspective !== "moderator";
      refs.tabs
        .querySelectorAll<HTMLElement>("[data-tool-tab]")
        .forEach((tab) => {
          tab.setAttribute(
            "aria-selected",
            String(tab.dataset.toolTab === toolsTab),
          );
        });
      const queue = refs.tabs.querySelector<HTMLElement>(
        '[data-count="queue"]',
      );
      const saved = refs.tabs.querySelector<HTMLElement>(
        '[data-count="saved"]',
      );
      if (queue) queue.textContent = String(state.queue.length);
      if (saved) saved.textContent = String(state.knowledge.length);
    }
    if (refs.railFoot) {
      const limits = state.limits;
      const usage =
        mode === "live"
          ? `<span style="display:block;margin-top:.35rem">${limits.questionsUsed} of ${limits.questionsMax} questions used</span>`
          : "";
      refs.railFoot.innerHTML = `<strong>Your sandbox</strong>In-memory only. Restart clears it.${usage}<button class="rail__restart" type="button" data-restart>Restart Campfire</button>`;
    }
  }

  /* ---------------------------------------------------------------- forum */

  function threadRow(thread: Thread): string {
    const last = thread.messages[thread.messages.length - 1];
    return `<button class="thread-row" type="button" data-thread-id="${esc(thread.id)}" aria-current="${
      thread.id === selectedThreadId ? "true" : "false"
    }" aria-label="Open thread: ${esc(thread.title)}">
      <span class="thread-row__top">
        <span class="thread-row__dot" data-status="${thread.status}"></span>
        <span class="thread-row__title">${esc(thread.title)}</span>
        <svg class="thread-row__chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m4 2 4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path></svg>
      </span>
      <span class="thread-row__meta">${esc(thread.authorName)} · ${timeAgo(thread.createdAt)} ago · ${statusLabel(thread)}</span>
      <span class="thread-row__snippet">${esc(last?.body ?? "")}</span>
    </button>`;
  }

  function listHtml(): string {
    if (!state.threads.length) {
      return `<div class="empty-state"><p>No matching threads. Try another word or start a post.</p><button class="btn btn--ghost btn--small" type="button" data-new-post>New post</button></div>`;
    }
    const visible = searchThreads(state.threads, search);
    if (!visible.length) {
      return `<div class="empty-state"><p>No matching threads. Try another word or start a post.</p><button class="btn btn--ghost btn--small" type="button" data-new-post>New post</button></div>`;
    }
    return `<div class="forum__list" role="list">${visible.map(threadRow).join("")}</div>`;
  }

  function queueHtml(): string {
    if (!state.queue.length)
      return `<div class="tool-empty">${sandboxCopy.queueEmpty}</div>`;
    return `<div class="tools">${state.queue
      .map(
        (
          item,
        ) => `<button class="queue-item" type="button" data-open-thread="${esc(item.threadId)}">
          <span class="queue-item__reason" data-reason="${item.reason}">${queueReason(item.reason)}</span>
          <span class="queue-item__title">${esc(item.title)}</span>
          <span class="thread-row__meta">${timeAgo(item.at)} ago</span>
        </button>`,
      )
      .join("")}</div>`;
  }

  function knowledgeHtml(item: Knowledge): string {
    const id = safeId(item.id);
    if (removingId === item.id) {
      return `<div class="knowledge" data-knowledge="${esc(item.id)}">
        <p class="knowledge__q">${esc(item.question)}</p>
        <p class="knowledge__meta">${esc(item.answer)}</p>
        <p class="knowledge__a" style="-webkit-line-clamp:unset">${esc(sandboxCopy.removeExplanation)}</p>
        <div class="knowledge__actions">
          <button class="link-btn" type="button" data-cancel-remove>Keep answer</button>
          <button class="link-btn link-btn--danger" type="button" data-confirm-remove="${esc(item.id)}">Remove answer</button>
        </div>
      </div>`;
    }
    if (editingId === item.id) {
      return `<div class="knowledge" data-knowledge="${esc(item.id)}">
        <form data-edit-form="${esc(item.id)}">
          <div class="field">
            <label for="edit-question-${id}">Original question</label>
            <input id="edit-question-${id}" type="text" value="${esc(item.question)}" readonly />
          </div>
          <div class="field">
            <label for="edit-answer-${id}">Saved guidance</label>
            <textarea id="edit-answer-${id}" data-edit-text maxlength="1200">${esc(editingText)}</textarea>
            ${fieldError?.field === "edit" ? `<span class="field__error" role="alert">${esc(fieldError.message)}</span>` : ""}
          </div>
          ${
            mode === "guided"
              ? `<div class="editor__prep"><button class="link-btn" type="button" data-try-correction>Try a correction</button></div>`
              : ""
          }
          <div class="editor__actions">
            <button class="btn btn--ghost btn--small" type="button" data-cancel-edit>Cancel</button>
            <button class="btn btn--primary btn--small" type="submit" ${pending === "edit" ? "disabled" : ""}>Save changes</button>
          </div>
        </form>
      </div>`;
    }
    return `<div class="knowledge" data-knowledge="${esc(item.id)}">
      <p class="knowledge__q">${esc(item.question)}</p>
      <p class="knowledge__a">${esc(item.answer)}</p>
      <p class="knowledge__meta"><span>v${item.version}</span><span aria-hidden="true">·</span><span>${timeAgo(item.updatedAt)} ago</span></p>
      <div class="knowledge__actions">
        <button class="link-btn" type="button" data-source-thread="${esc(item.sourceThreadId)}" data-source-message="${esc(item.sourceMessageId)}">Original answer</button>
        <button class="link-btn" type="button" data-edit-knowledge="${esc(item.id)}">Edit answer</button>
        <button class="link-btn link-btn--danger" type="button" data-remove-knowledge="${esc(item.id)}">Remove from memory</button>
      </div>
    </div>`;
  }

  function savedHtml(): string {
    if (!state.knowledge.length)
      return `<div class="tool-empty">${sandboxCopy.knowledgeEmpty}</div>`;
    return `<div class="tools">${state.knowledge.map(knowledgeHtml).join("")}</div>`;
  }

  function renderForumBody() {
    if (!refs.forumBody) return;
    refs.forumBody.innerHTML =
      toolsTab === "queue"
        ? queueHtml()
        : toolsTab === "saved"
          ? savedHtml()
          : listHtml();
  }

  /* --------------------------------------------------------------- thread */

  function sourceButton(
    item: Knowledge | null,
    label = "Original answer",
  ): string {
    if (!item) return "";
    return `<button class="answer__source" type="button" data-source-thread="${esc(
      item.sourceThreadId,
    )}" data-source-message="${esc(item.sourceMessageId)}">${label}</button>`;
  }

  function messageHtml(message: Message, thread: Thread): string {
    const isBot = message.author.role === "bot";
    const isMod = message.author.role === "moderator";
    const saved =
      isMod && message.savedKnowledgeId
        ? knowledge(message.savedKnowledgeId)
        : null;
    const source =
      isBot && message.knowledgeId ? knowledge(message.knowledgeId) : null;
    const outcomesDisabled =
      pending !== null ||
      thread.status === "resolved" ||
      thread.status === "needs_help";

    return `<article class="msg${isBot ? " msg--bot" : ""}${message.id === highlightMessageId ? " is-highlighted" : ""}" data-message-id="${esc(
      message.id,
    )}" tabindex="-1">
      ${
        isBot
          ? `<div class="msg__avatar msg__avatar--bot" aria-hidden="true"><img src="/brand/mark.svg" alt="" width="366" height="272" loading="lazy" /></div>`
          : `<div class="msg__avatar${isMod ? " msg__avatar--sam" : ""}" aria-hidden="true">${esc(
              message.author.name.slice(0, 1),
            )}</div>`
      }
      <div class="msg__main">
        <div class="msg__head">
          <span class="msg__name">${esc(message.author.name)}</span>
          ${isMod ? `<span class="msg__tag">Mod</span>` : ""}
          ${isBot ? `<span class="msg__tag msg__tag--bot">Bot</span>` : ""}
          <span class="msg__time">${timeAgo(message.at)}</span>
          ${saved ? `<span class="msg__saved"><svg width="9" height="8" viewBox="0 0 9 8" fill="none" aria-hidden="true"><path d="m1 4 2.2 2.2L8 1.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path></svg>Saved</span>` : ""}
        </div>
        ${
          isBot
            ? `<div class="answer">
                <p class="answer__text">${esc(message.body)}</p>
                <div class="answer__foot">
                  ${source ? sourceButton(source) : ""}
                  <div class="outcomes">
                    <button class="outcome${thread.status === "resolved" ? " is-active" : ""}" type="button" data-outcome="solved" ${
                      outcomesDisabled ? "disabled" : ""
                    }>Solved</button>
                    <button class="outcome${thread.status === "needs_help" ? " is-active" : ""}" type="button" data-outcome="needs_help" ${
                      outcomesDisabled ? "disabled" : ""
                    }>Need help</button>
                  </div>
                </div>
              </div>`
            : `<p class="msg__text">${esc(message.body)}</p>`
        }
      </div>
      ${
        isMod && perspective === "moderator"
          ? `<button class="msg__actions" type="button" data-actions aria-label="Message actions" aria-haspopup="menu" aria-expanded="false">
              <svg width="14" height="4" viewBox="0 0 14 4" fill="none" aria-hidden="true"><circle cx="2" cy="2" r="1.6" fill="currentColor"></circle><circle cx="7" cy="2" r="1.6" fill="currentColor"></circle><circle cx="12" cy="2" r="1.6" fill="currentColor"></circle></svg>
            </button>`
          : ""
      }
    </article>`;
  }

  function threadHead(thread: Thread): string {
    return `<div class="thread__head">
      <button class="thread__back" type="button" data-back-to-threads>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M8 1 3 6l5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        Back to threads
      </button>
      <div class="thread__heading">
        <h3 class="thread__title" id="campfire-thread-title" tabindex="-1">${esc(thread.title)}</h3>
        <div class="thread__meta">
          <span>${esc(thread.authorName)}</span>
          <span aria-hidden="true">·</span>
          <span>${timeAgo(thread.createdAt)} ago</span>
          <span class="status-pill" data-status="${thread.status}">${statusLabel(thread)}</span>
        </div>
      </div>
    </div>`;
  }

  function noticeHtml(): string {
    if (!notice) return "";
    const action =
      notice.action === "guided"
        ? `<button type="button" data-guided-switch>${sandboxCopy.guidedSwitch}</button>`
        : notice.action === "restart"
          ? `<button type="button" data-restart>Restart Campfire</button>`
          : "";
    const spinner =
      notice.kind === "pending"
        ? '<span class="spinner" aria-hidden="true"></span>'
        : "";
    return `<div class="status-line ${notice.kind === "error" ? "status-line--error" : notice.kind === "ok" ? "status-line--ok" : ""}" data-notice>${spinner}<span>${esc(
      notice.text,
    )}</span>${action}</div>`;
  }

  function helperContent(): { text: string; action: string } | null {
    if (channel === "announcements" || page === "compose") return null;
    const thread = selected();
    if (!thread) return null;

    if (narration === "solved" && narrationThreadId === thread.id) {
      return {
        text: "One human answer. Another person helped.",
        action: `<a class="btn btn--ghost btn--small" href="/setup/">Set up ThreadSherpa</a>`,
      };
    }
    if (narration === "answered" && narrationThreadId === thread.id) {
      const source = [...thread.messages]
        .reverse()
        .find(
          (message) => message.author.role === "bot" && message.knowledgeId,
        );
      const item = knowledge(source?.knowledgeId);
      return {
        text: "Same facts. A reply for this question.",
        action: item
          ? `<button class="btn btn--ghost btn--small" type="button" data-source-thread="${esc(
              item.sourceThreadId,
            )}" data-source-message="${esc(item.sourceMessageId)}">See the original answer</button>`
          : "",
      };
    }
    if (narration === "saved") {
      return {
        text: "That answer is now in memory. Ask a new question to see what it can help with.",
        action: `<button class="btn btn--ghost btn--small" type="button" data-ask-new>Ask a new question</button>`,
      };
    }
    if (perspective === "moderator") {
      const unsaved = [...thread.messages]
        .reverse()
        .find(
          (message) =>
            message.author.role === "moderator" && !message.savedKnowledgeId,
        );
      if (unsaved) {
        return {
          text: "Save this answer, then ask the same thing in your own words.",
          action: `<button class="btn btn--ghost btn--small" type="button" data-show-me>Show me where</button>`,
        };
      }
    }
    return null;
  }

  function supportHtml(): string {
    const helper = helperContent();
    if (!notice && !helper) return "";
    return `${noticeHtml()}${
      helper
        ? `<div class="helper"><span class="helper__text">${esc(helper.text)}</span>${helper.action}</div>`
        : ""
    }`;
  }

  function composerHtml(thread: Thread): string {
    const roleLabel =
      perspective === "moderator"
        ? "Write a reusable answer"
        : "Reply in this thread";
    const draftForThread = replyDrafts[thread.id] ?? "";
    return `<div class="thread__composer">
      <form class="composer" data-reply-form>
        <label class="sr-only" for="campfire-reply">${roleLabel}</label>
        <textarea id="campfire-reply" rows="1" placeholder="${roleLabel}" maxlength="1000" data-reply-input>${esc(
          draftForThread,
        )}</textarea>
        <button class="send" type="submit" ${pending === "reply" ? "disabled" : ""}>Send reply</button>
      </form>
      ${fieldError?.field === "reply" ? `<p class="field__error" role="alert" style="margin:.35rem 0 0">${esc(fieldError.message)}</p>` : ""}
      <p class="composer__hint">Enter sends. Shift+Enter adds a line.</p>
    </div>`;
  }

  function threadBody(thread: Thread): string {
    return `${threadHead(thread)}
      <div class="thread__scroll" data-thread-scroll>
        <div class="messages" data-messages>${thread.messages
          .map((message) => messageHtml(message, thread))
          .join("")}</div>
      </div>
      <div class="thread__support" data-support>${supportHtml()}</div>
      ${composerHtml(thread)}
      <svg class="thread__trace" data-trace aria-hidden="true"></svg>`;
  }

  function composeView(): string {
    const guided = mode === "guided";
    const examples = guided
      ? preparedQuestions.map((item) => item.label)
      : TEST_EXAMPLES;
    const titleDisabled = pending === "post" ? "disabled" : "";
    return `<div class="compose">
      <div class="compose__head">
        <div>
          <h3 class="compose__title" tabindex="-1" id="campfire-compose-title">New post</h3>
          <p class="compose__sub">Ask a question in the fictional Campfire server.</p>
        </div>
        <button class="compose__cancel" type="button" data-cancel-compose>Cancel</button>
      </div>
      <form data-compose-form>
        <div class="field">
          <label for="compose-title">Question</label>
          <input id="compose-title" name="title" type="text" maxlength="100" placeholder="What do you need help with?" value="${esc(
            draft.title,
          )}" autocomplete="off" data-compose-title />
          ${fieldError?.field === "title" ? `<span class="field__error" role="alert">${esc(fieldError.message)}</span>` : ""}
        </div>
        <div class="field">
          <label for="compose-body">Details</label>
          <textarea id="compose-body" name="body" maxlength="1000" placeholder="Add a little context. Use fictional details." data-compose-body>${esc(
            draft.body,
          )}</textarea>
          ${fieldError?.field === "body" ? `<span class="field__error" role="alert">${esc(fieldError.message)}</span>` : ""}
        </div>
        <div class="compose__chips" aria-label="Example questions">
          ${examples
            .map(
              (label) =>
                `<button class="chip${chips.includes(label) ? " is-active" : ""}" type="button" data-chip="${esc(
                  label,
                )}">${esc(label)}</button>`,
            )
            .join("")}
        </div>
        ${
          guided
            ? `<p class="compose__note">Guided example: prepared questions have prepared replies. Other questions wait for a moderator.</p>`
            : ""
        }
        <div class="compose__actions">
          <button class="btn btn--primary btn--small" type="submit" ${titleDisabled}>Post question</button>
          <span class="compose__note">${guided ? "No live AI replies in this mode." : "A real model call may take a few seconds."}</span>
        </div>
      </form>
    </div>`;
  }

  function announcementsView(): string {
    return `<div class="announce">
      <div class="announce__inner">
        <button class="thread__back" type="button" data-back-to-threads>Back to threads</button>
        <p class="mono" style="color:var(--lantern)">#announcements</p>
        <h3 tabindex="-1" id="campfire-announcement-title">${announcements.heading}</h3>
        <p class="announce__meta">Campfire organizers · pinned</p>
        <ul>${announcements.lines.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
        <p class="announce__foot">${announcements.footnote}</p>
      </div>
    </div>`;
  }

  function renderThread() {
    if (!refs.thread) return;
    if (channel === "announcements") {
      refs.thread.innerHTML = announcementsView();
      return;
    }
    if (page === "compose") {
      refs.thread.innerHTML = composeView();
      return;
    }
    const thread = selected();
    if (!thread) {
      refs.thread.innerHTML = `<div class="empty-state">This thread is no longer here.</div>`;
      return;
    }
    refs.thread.innerHTML = threadBody(thread);
  }

  function renderAll() {
    renderChrome();
    renderForumBody();
    renderThread();
  }

  /* ------------------------------------------------------------- motions */

  function traceEnabled(): boolean {
    if (document.documentElement.classList.contains("motion-paused"))
      return false;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function threadPoint(element: HTMLElement, side: "left" | "right" = "right") {
    if (!refs.thread) return { x: 0, y: 0 };
    const pane = refs.thread.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      x: side === "right" ? rect.right - pane.left : rect.left - pane.left,
      y: rect.top - pane.top + rect.height / 2,
    };
  }

  async function drawTrace(kind: "save" | "answer", elementId: string) {
    if (!traceEnabled()) return;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const svg = refs.thread?.querySelector<SVGSVGElement>("[data-trace]");
    if (!svg || !refs.thread) return;
    const paneRect = refs.thread.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${paneRect.width} ${paneRect.height}`);
    const gutter = Math.max(12, paneRect.width - 12);
    const from =
      kind === "save"
        ? refs.thread.querySelector<HTMLElement>(
            `[data-message-id="${CSS.escape(elementId)}"] [data-actions]`,
          )
        : refs.thread.querySelector<HTMLElement>(
            `[data-message-id="${CSS.escape(elementId)}"] [data-source-thread]`,
          );
    const target =
      refs.thread.querySelector<HTMLElement>("[data-support] .status-line") ??
      refs.thread.querySelector<HTMLElement>("[data-support]");
    if (!from || !target) return;
    const a = threadPoint(from, "right");
    const b = threadPoint(target, "right");
    const start = { x: Math.min(a.x + 4, gutter), y: a.y };
    const end = { x: gutter, y: b.y };
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${start.x} ${start.y} C ${gutter} ${start.y}, ${gutter} ${end.y}, ${end.x} ${end.y}`,
    );
    const node = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    node.setAttribute("class", "trace-node");
    node.setAttribute("cx", String(end.x));
    node.setAttribute("cy", String(end.y));
    node.setAttribute("r", "2.4");
    svg.replaceChildren(path, node);

    try {
      const { default: gsap } = await import("gsap");
      const length = path.getTotalLength();
      gsap.fromTo(
        path,
        { strokeDasharray: length, strokeDashoffset: length, opacity: 0 },
        {
          strokeDashoffset: 0,
          opacity: 0.55,
          duration: 0.5,
          ease: "power2.out",
        },
      );
      gsap.fromTo(
        node,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, delay: 0.42 },
      );
    } catch {
      path.classList.add("is-on");
      node.classList.add("is-on");
    }
  }

  function animatePanel() {
    if (!traceEnabled() || !refs.thread) return;
    const content = refs.thread.firstElementChild as HTMLElement | null;
    if (!content) return;
    content.animate(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 200, easing: "cubic-bezier(0.22,1,0.36,1)" },
    );
  }

  /* --------------------------------------------------------------- events */

  function focus(selector: string) {
    window.requestAnimationFrame(() => {
      root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    });
  }

  function openThread(
    id: string,
    options: { focusHeading?: boolean; pane?: boolean } = {},
  ) {
    if (!state.threads.some((thread) => thread.id === id)) return;
    selectedThreadId = id;
    channel = "support";
    page = "thread";
    toolsTab = "threads";
    fieldError = null;
    if (options.pane !== false) mobilePane = "thread";
    renderAll();
    animatePanel();
    scrollbar(
      refs.thread?.querySelector<HTMLElement>("[data-thread-scroll]") ?? null,
    );
    if (options.focusHeading !== false) focus("#campfire-thread-title");
  }

  function openCompose() {
    perspective = "member";
    channel = "support";
    page = "compose";
    mobilePane = "thread";
    toolsTab = "threads";
    fieldError = null;
    renderAll();
    animatePanel();
    focus("#compose-title");
  }

  function revealSource(threadId: string, messageId: string) {
    if (!threadId) return;
    const exists = state.threads.some((thread) => thread.id === threadId);
    if (!exists) return;
    selectedThreadId = threadId;
    channel = "support";
    page = "thread";
    mobilePane = "thread";
    highlightMessageId = messageId;
    renderAll();
    window.requestAnimationFrame(() => {
      const target = refs.thread?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(messageId)}"]`,
      );
      if (!target) return;
      target.scrollIntoView({
        block: "center",
        behavior: traceEnabled() ? "smooth" : "auto",
      });
      target.focus({ preventScroll: true });
      window.setTimeout(() => {
        target.classList.remove("is-highlighted");
      }, 2600);
    });
  }

  async function runPost() {
    if (pending) return;
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title) {
      fieldError = {
        field: "title",
        message: "Add a question before posting.",
      };
      renderThread();
      focus("#compose-title");
      return;
    }
    if (title.length > 100) {
      fieldError = {
        field: "title",
        message: "Keep the question under 100 characters.",
      };
      renderThread();
      focus("#compose-title");
      return;
    }
    if (body.length > 1000) {
      fieldError = {
        field: "body",
        message: "Keep the details under 1,000 characters.",
      };
      renderThread();
      focus("#compose-body");
      return;
    }
    fieldError = null;
    pending = "post";
    notice =
      mode === "live" ? { text: sandboxCopy.checking, kind: "pending" } : null;
    renderThread();
    try {
      const result = await transport.post(title, body);
      apply(result.state);
      const threadId = result.threadId ?? state.threads[0]?.id ?? "";
      if (threadId) selectedThreadId = threadId;
      draft = { title: "", body: "" };
      page = "thread";
      mobilePane = "thread";
      toolsTab = "threads";
      notice = null;
      if (
        ["answer", "answered", "clarify", "escalate"].includes(result.status)
      ) {
        narration = "answered";
        narrationThreadId = selectedThreadId;
        scene?.setPhase("answered");
      } else if (result.status === "solved") {
        narration = "solved";
        narrationThreadId = selectedThreadId;
      } else {
        narration = "none";
        if (result.note) notice = { text: result.note, kind: "ok" };
      }
      pending = null;
      renderAll();
      animatePanel();
      scrollbar(
        refs.thread?.querySelector<HTMLElement>("[data-thread-scroll]") ?? null,
      );
      focus("#campfire-thread-title");
    } catch (error) {
      handleError(error, "post");
    } finally {
      pending = null;
    }
  }

  async function runReply() {
    if (pending) return;
    const thread = selected();
    if (!thread) return;
    const text = (replyDrafts[thread.id] ?? "").trim();
    if (!text) {
      fieldError = { field: "reply", message: "Write a reply before sending." };
      renderThread();
      focus("#campfire-reply");
      return;
    }
    fieldError = null;
    pending = "reply";
    if (mode === "live" && perspective === "member") {
      notice = { text: sandboxCopy.checking, kind: "pending" };
    }
    renderThread();
    try {
      const result = await transport.reply(thread.id, text, perspective);
      apply(result.state);
      delete replyDrafts[thread.id];
      notice = null;
      if (result.status === "solved") {
        narration = "solved";
        narrationThreadId = thread.id;
      } else if (
        ["answer", "answered", "clarify", "escalate", "quiet"].includes(
          result.status,
        )
      ) {
        if (result.status !== "quiet") {
          narration = "answered";
          narrationThreadId = thread.id;
          scene?.setPhase("answered");
        } else {
          narration = "none";
        }
      } else {
        narration = "none";
      }
      pending = null;
      renderAll();
      scrollbar(
        refs.thread?.querySelector<HTMLElement>("[data-thread-scroll]") ?? null,
      );
      focus("#campfire-reply");
    } catch (error) {
      handleError(error, "reply");
    } finally {
      pending = null;
    }
  }

  async function runSave(messageId: string) {
    if (pending) return;
    closeMenu();
    pending = "save";
    notice = { text: "Saving answer...", kind: "pending" };
    renderThread();
    try {
      const result = await transport.save(messageId);
      apply(result.state);
      notice = {
        text: result.result.status === "saved" ? "Saved." : "Already saved.",
        kind: "ok",
      };
      narration = "saved";
      narrationThreadId = null;
      highlightMessageId = messageId;
      pending = null;
      renderAll();
      scene?.setPhase("saved");
      focus(`[data-message-id="${CSS.escape(messageId)}"] [data-actions]`);
      await drawTrace("save", messageId);
    } catch (error) {
      handleError(error, "save");
    } finally {
      pending = null;
    }
  }

  async function runEdit(id: string) {
    if (pending) return;
    const answer = editingText.trim();
    if (!answer) {
      fieldError = { field: "edit", message: "Add guidance before saving." };
      renderForumBody();
      return;
    }
    pending = "edit";
    fieldError = null;
    try {
      const next = await transport.edit(id, answer);
      apply(next);
      editingId = null;
      narration = "none";
      notice = { text: "Updated for future questions.", kind: "ok" };
      pending = null;
      renderAll();
      focus('[data-tool-tab="saved"]');
    } catch (error) {
      handleError(error, "edit");
    } finally {
      pending = null;
    }
  }

  async function runRemove(id: string) {
    if (pending) return;
    pending = "remove";
    try {
      const next = await transport.remove(id);
      apply(next);
      removingId = null;
      narration = "none";
      notice = null;
      pending = null;
      renderAll();
      focus('[data-tool-tab="saved"]');
    } catch (error) {
      handleError(error, "remove");
    } finally {
      pending = null;
    }
  }

  async function runOutcome(outcome: "solved" | "needs_help") {
    const thread = selected();
    if (!thread || pending) return;
    pending = "outcome";
    try {
      const next = await transport.outcome(thread.id, outcome);
      apply(next);
      notice = null;
      if (outcome === "solved") {
        narration = "solved";
        narrationThreadId = thread.id;
      } else {
        narration = "none";
      }
      pending = null;
      renderAll();
    } catch (error) {
      handleError(error, "outcome");
    } finally {
      pending = null;
    }
  }

  async function runReset() {
    if (pending) return;
    pending = "reset";
    try {
      const next = await transport.reset();
      apply(next);
      guidedStateAfterReset();
      if (refs.restartDialog?.open) refs.restartDialog.close();
      pending = null;
      renderAll();
      focus("#campfire-thread-title");
    } catch (error) {
      handleError(error, "reset");
    } finally {
      pending = null;
    }
  }

  function guidedStateAfterReset() {
    perspective = "moderator";
    channel = "support";
    toolsTab = "threads";
    page = "thread";
    mobilePane = "forum";
    selectedThreadId = state.threads[0]?.id ?? "thread-update";
    narration = "none";
    narrationThreadId = null;
    notice = null;
    fieldError = null;
    draft = { title: "", body: "" };
    chips = [];
    replyDrafts = {};
    editingId = null;
    removingId = null;
    highlightMessageId = null;
  }

  function setPerspective(next: Perspective) {
    if (next === perspective) return;
    perspective = next;
    if (next === "member") toolsTab = "threads";
    renderAll();
    focus(`[data-perspective="${next}"]`);
  }

  function setToolsTab(tab: "threads" | "queue" | "saved") {
    if (perspective !== "moderator") return;
    toolsTab = tab;
    renderChrome();
    renderForumBody();
    focus(`[data-tool-tab="${tab}"]`);
  }

  function handleError(
    error: unknown,
    kind: "post" | "reply" | "save" | "edit" | "remove" | "outcome" | "reset",
  ) {
    pending = null;
    if (error instanceof SandboxError) {
      if (error.state) apply(error.state);
      if (error.code === "budget") {
        notice = { text: sandboxCopy.budget, kind: "error", action: "guided" };
      } else if (error.code === "live_failed" || error.code === "network") {
        notice = {
          text: sandboxCopy.liveTimeout,
          kind: "error",
          action: mode === "live" ? "guided" : undefined,
        };
      } else if (error.code === "no_session") {
        notice = {
          text: sandboxCopy.genericFailure,
          kind: "error",
          action: "restart",
        };
      } else if (error.code === "title" || error.code === "title_length") {
        fieldError = {
          field: "title",
          message:
            error.code === "title"
              ? "Add a question before posting."
              : "Keep the question under 100 characters.",
        };
        notice = null;
      } else if (error.code === "body_length") {
        fieldError = {
          field: kind === "reply" ? "reply" : "body",
          message:
            kind === "reply"
              ? "Keep the reply under 1,000 characters."
              : "Keep the details under 1,000 characters.",
        };
        notice = null;
      } else {
        notice = { text: sandboxCopy.genericFailure, kind: "error" };
      }
    } else {
      notice = { text: sandboxCopy.genericFailure, kind: "error" };
    }
    if (kind === "post") renderThread();
    else if (kind === "edit") renderForumBody();
    else renderAll();
  }

  function openMenu(messageId: string, x?: number, y?: number) {
    closeMenu();
    const trigger = refs.thread?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(messageId)}"] [data-actions]`,
    );
    if (!trigger) return;
    trigger.setAttribute("aria-expanded", "true");
    const element = document.createElement("div");
    element.className = "message-menu";
    element.setAttribute("role", "menu");
    element.setAttribute("aria-label", "Message actions");
    element.innerHTML = `<span class="message-menu__label">Apps</span>
      <button class="message-menu__item" type="button" role="menuitem" data-save-answer="${esc(messageId)}">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1.5 6.5 4.5 9.5 10.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        Save this answer
      </button>`;
    // The floating menu lives outside root, so it owns its save click handler.
    element
      .querySelector<HTMLButtonElement>("[data-save-answer]")
      ?.addEventListener("click", () => {
        void runSave(messageId);
      });
    document.body.append(element);
    const rect = trigger.getBoundingClientRect();
    const menuRect = element.getBoundingClientRect();
    const width = menuRect.width || 214;
    const height = menuRect.height || 80;
    let left = x ?? rect.right - width;
    let top = y ?? rect.bottom + 6;
    if (x !== undefined || y !== undefined) {
      left = x ?? left;
      top = y ?? top;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    if (top + height > window.innerHeight - 8)
      top = Math.max(8, rect.top - height - 6);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    menu = { messageId, trigger };
    menuElement = element;
    element.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }

  function closeMenu(restore = false) {
    if (menuElement) menuElement.remove();
    if (menu?.trigger) menu.trigger.setAttribute("aria-expanded", "false");
    const trigger = menu?.trigger;
    menuElement = null;
    menu = null;
    if (restore && trigger) trigger.focus({ preventScroll: true });
  }

  function showWhere() {
    const thread = selected();
    if (!thread) return;
    const target = [...thread.messages]
      .reverse()
      .find(
        (message) =>
          message.author.role === "moderator" && !message.savedKnowledgeId,
      );
    if (!target) return;
    if (channel !== "support") channel = "support";
    page = "thread";
    mobilePane = "thread";
    renderAll();
    window.requestAnimationFrame(() => {
      const element = refs.thread?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(target.id)}"]`,
      );
      if (!element) return;
      element.scrollIntoView({
        block: "center",
        behavior: traceEnabled() ? "smooth" : "auto",
      });
      const button = element.querySelector<HTMLElement>("[data-actions]");
      button?.focus({ preventScroll: true });
      button?.classList.add("is-pointed");
      window.setTimeout(() => button?.classList.remove("is-pointed"), 2200);
    });
  }

  function switchToGuided() {
    transport = new GuidedTransport();
    mode = "guided";
    notice = null;
    apply(initialState("guided"));
    guidedStateAfterReset();
    renderAll();
    focus("#campfire-thread-title");
    scene?.setPhase("idle");
  }

  /* ------------------------------------------------------------- listeners */

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    const closest = (selector: string) => target.closest<HTMLElement>(selector);

    if (closest("[data-save-answer]")) {
      const id = closest("[data-save-answer]")?.dataset.saveAnswer;
      if (id) void runSave(id);
      return;
    }

    const threadButton = closest("[data-thread-id]");
    if (threadButton?.dataset.threadId) {
      openThread(threadButton.dataset.threadId);
      return;
    }

    const queueButton = closest("[data-open-thread]");
    if (queueButton?.dataset.openThread) {
      openThread(queueButton.dataset.openThread);
      return;
    }

    const perspectiveButton = closest("button[data-perspective]");
    if (perspectiveButton?.dataset.perspective) {
      setPerspective(perspectiveButton.dataset.perspective as Perspective);
      return;
    }

    const toolTab = closest("[data-tool-tab]");
    if (toolTab?.dataset.toolTab) {
      setToolsTab(toolTab.dataset.toolTab as "threads" | "queue" | "saved");
      return;
    }

    if (closest("[data-server-home]")) {
      channel = "support";
      page = "thread";
      toolsTab = "threads";
      mobilePane = "forum";
      renderAll();
      focus(`[data-thread-id="${CSS.escape(selectedThreadId)}"]`);
      return;
    }

    if (closest("button[data-channel]")) {
      const next = closest("button[data-channel]")?.dataset.channel;
      channel = next === "announcements" ? "announcements" : "support";
      page = "thread";
      toolsTab = "threads";
      mobilePane = next === "announcements" ? "thread" : "forum";
      renderAll();
      if (channel === "announcements") focus("#campfire-announcement-title");
      return;
    }

    if (closest("[data-new-post]") || closest("[data-ask-new]")) {
      openCompose();
      return;
    }

    if (closest("[data-cancel-compose]")) {
      page = "thread";
      fieldError = null;
      draft = { title: "", body: "" };
      chips = [];
      mobilePane = "thread";
      renderAll();
      focus("#campfire-thread-title");
      return;
    }

    if (closest("[data-chip]")) {
      const label = closest("[data-chip]")?.dataset.chip ?? "";
      draft.title = label;
      chips = [label];
      const input = root.querySelector<HTMLInputElement>(
        "[data-compose-title]",
      );
      if (input) input.value = label;
      root.querySelectorAll<HTMLElement>("[data-chip]").forEach((chip) => {
        chip.classList.toggle("is-active", chip.dataset.chip === label);
      });
      return;
    }

    if (closest("[data-back-to-threads]") || closest("[data-close-channels]")) {
      page = "thread";
      mobilePane = "forum";
      renderChrome();
      if (closest("[data-close-channels]")) {
        root
          .querySelector<HTMLElement>("[data-open-channels]")
          ?.setAttribute("aria-expanded", "false");
      }
      focus(`[data-thread-id="${CSS.escape(selectedThreadId)}"]`);
      return;
    }

    if (closest("[data-open-channels]")) {
      const button = closest("[data-open-channels]");
      mobilePane = mobilePane === "rail" ? "forum" : "rail";
      button?.setAttribute("aria-expanded", String(mobilePane === "rail"));
      renderChrome();
      styleMobilePane();
      focus(".rail__back");
      return;
    }

    if (closest("[data-actions]")) {
      const id =
        closest("[data-actions]")?.closest<HTMLElement>("[data-message-id]")
          ?.dataset.messageId;
      if (id) {
        const button = closest("[data-actions]");
        if (button?.getAttribute("aria-expanded") === "true") closeMenu(true);
        else openMenu(id);
      }
      return;
    }

    if (closest("[data-show-me]")) {
      showWhere();
      return;
    }

    const source = closest("[data-source-thread]");
    if (source?.dataset.sourceThread) {
      revealSource(
        source.dataset.sourceThread,
        source.dataset.sourceMessage ?? "",
      );
      return;
    }

    const outcome = closest("[data-outcome]");
    if (outcome?.dataset.outcome) {
      void runOutcome(outcome.dataset.outcome as "solved" | "needs_help");
      return;
    }

    const edit = closest("[data-edit-knowledge]");
    if (edit?.dataset.editKnowledge) {
      editingId = edit.dataset.editKnowledge;
      editingText =
        state.knowledge.find((item) => item.id === editingId)?.answer ?? "";
      removingId = null;
      renderForumBody();
      focus("[data-edit-text]");
      return;
    }

    if (closest("[data-cancel-edit]")) {
      editingId = null;
      fieldError = null;
      renderForumBody();
      focus('[data-tool-tab="saved"]');
      return;
    }

    if (closest("[data-try-correction]")) {
      editingText = FIXTURE_CORRECTION;
      const textarea =
        root.querySelector<HTMLTextAreaElement>("[data-edit-text]");
      if (textarea) textarea.value = FIXTURE_CORRECTION;
      return;
    }

    const remove = closest("[data-remove-knowledge]");
    if (remove?.dataset.removeKnowledge) {
      removingId = remove.dataset.removeKnowledge;
      editingId = null;
      renderForumBody();
      focus("[data-confirm-remove]");
      return;
    }

    if (closest("[data-cancel-remove]")) {
      removingId = null;
      renderForumBody();
      focus('[data-tool-tab="saved"]');
      return;
    }

    const confirmRemove = closest("[data-confirm-remove]");
    if (confirmRemove?.dataset.confirmRemove) {
      void runRemove(confirmRemove.dataset.confirmRemove);
      return;
    }

    if (closest("[data-restart]")) {
      closeMenu();
      refs.restartDialog?.showModal();
      return;
    }

    if (closest("[data-cancel-restart]")) {
      refs.restartDialog?.close();
      return;
    }

    if (closest("[data-confirm-restart]")) {
      void runReset();
      return;
    }

    if (closest("[data-guided-switch]")) {
      switchToGuided();
      return;
    }

    if (closest("[data-message-menu]")) return;
  });

  root.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement;
    if (form.matches("[data-reply-form]")) {
      event.preventDefault();
      void runReply();
    } else if (form.matches("[data-compose-form]")) {
      event.preventDefault();
      void runPost();
    } else if (form.matches("[data-edit-form]")) {
      event.preventDefault();
      const id = form.dataset.editForm;
      if (id) void runEdit(id);
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-search]")) {
      search = (target as HTMLInputElement).value;
      toolsTab = "threads";
      renderChrome();
      renderForumBody();
      return;
    }
    if (target.matches("[data-compose-title]")) {
      draft.title = (target as HTMLInputElement).value;
      if (fieldError?.field === "title") {
        fieldError = null;
        target.closest(".field")?.querySelector(".field__error")?.remove();
      }
      return;
    }
    if (target.matches("[data-compose-body]")) {
      draft.body = (target as HTMLTextAreaElement).value;
      if (fieldError?.field === "body") {
        fieldError = null;
        target.closest(".field")?.querySelector(".field__error")?.remove();
      }
      return;
    }
    if (target.matches("[data-reply-input]")) {
      const value = (target as HTMLTextAreaElement).value;
      if (selectedThreadId) replyDrafts[selectedThreadId] = value;
      if (fieldError?.field === "reply") {
        fieldError = null;
        root.querySelector(".thread__composer .field__error")?.remove();
      }
      const area = target as HTMLTextAreaElement;
      area.style.height = "auto";
      area.style.height = `${Math.min(area.scrollHeight, 110)}px`;
      return;
    }
    if (target.matches("[data-edit-text]")) {
      editingText = (target as HTMLTextAreaElement).value;
      if (fieldError?.field === "edit") {
        fieldError = null;
        target.closest(".field")?.querySelector(".field__error")?.remove();
      }
    }
  });

  refs.search?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && refs.search?.value) {
      refs.search.value = "";
      search = "";
      renderForumBody();
    }
  });

  root.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (
      target.matches("[data-reply-input]") &&
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      if ((event as KeyboardEvent).isComposing) return;
      event.preventDefault();
      void runReply();
    }
    if (target.matches("[data-compose-title]") && event.key === "Enter") {
      if ((event as KeyboardEvent).isComposing) return;
      event.preventDefault();
      void runPost();
    }
  });

  root.addEventListener("contextmenu", (event) => {
    const target = event.target as HTMLElement;
    const message = target.closest<HTMLElement>("[data-message-id]");
    const button = message?.querySelector("[data-actions]");
    if (!message || !button) return;
    event.preventDefault();
    openMenu(message.dataset.messageId ?? "", event.clientX, event.clientY);
  });

  document.addEventListener("keydown", (event) => {
    if (!menuElement) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = [
        ...menuElement.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "ArrowDown"
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    }
    if (event.key === "Tab") closeMenu();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!menuElement) return;
    const target = event.target as Node;
    if (menuElement.contains(target)) return;
    closeMenu();
  });

  document.addEventListener(
    "scroll",
    () => {
      if (menuElement) closeMenu();
    },
    true,
  );

  window.addEventListener("resize", () => {
    if (menuElement) closeMenu();
  });

  refs.restartDialog?.addEventListener("click", (event) => {
    const dialog = refs.restartDialog;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });

  function styleMobilePane() {
    root.dataset.mobilePane = mobilePane;
  }

  /* ------------------------------------------------------------- bootstrap */

  function renderAllWithPane() {
    renderAll();
    styleMobilePane();
  }

  renderAll();
  styleMobilePane();

  // Static markup and the first render should agree. Re-render to bind current state.
  renderAllWithPane();

  void (async () => {
    try {
      const health = await fetch("/api/sandbox/health", {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      }).then((response) => (response.ok ? response.json() : null));
      if (!health?.live) return;
      const next = new LiveTransport();
      const liveState = await next.init();
      transport = next;
      mode = "live";
      apply(liveState);
      notice = null;
      renderAll();
    } catch {
      // The guided example is the honest default. No error is shown for an absent live service.
    }
  })();

  void (async () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 768) return;
    try {
      const { mountThreadScene } = await import("./thread-scene");
      if (refs.canvas) scene = mountThreadScene(refs.canvas);
    } catch {
      // The composed poster remains.
    }
  })();
}

/* ---------------------------------------------------------------- boot */

const mount = document.querySelector<HTMLElement>("[data-campfire]");
if (mount && !mount.dataset.booted) {
  mount.dataset.booted = "true";
  start(mount);
}
