import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { config, liveRequested, providerConfigured } from './config.js';
import { BudgetError, BusyError, LiveSession, liveStatus, store } from './live.js';

const MAX_BODY = 16 * 1024;

type Reply = { status: number; body: unknown; headers?: Record<string, string> };

const copy = {
  missingTitle: 'Add a question before posting.',
  longTitle: 'Keep the question under 100 characters.',
  longBody: 'Keep the details under 1,000 characters.',
  liveTimeout: "The live check couldn't finish. Your question is still here.",
  budget: 'Live replies are paused for now. You can still explore the guided example.',
  generic: "This action couldn't finish. Your text is still here. Try again.",
} as const;

function cors(origin: string | undefined): Record<string, string> {
  const allowed = origin && config.allowedOrigins.includes(origin) ? origin : '';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,idempotency-key',
    vary: 'origin',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
  };
}

function cookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

function statusFromError(error: unknown): Reply {
  if (error instanceof BudgetError) {
    return { status: 429, body: { error: { code: 'budget', message: copy.budget } } };
  }
  if (error instanceof BusyError) {
    return { status: 503, body: { error: { code: 'busy', message: copy.liveTimeout } } };
  }
  const status = (error as { status?: number }).status;
  if (status) return { status, body: { error: { code: 'request', message: copy.generic } } };
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { status: 504, body: { error: { code: 'live_failed', message: copy.liveTimeout } } };
  }
  return { status: 502, body: { error: { code: 'live_failed', message: copy.liveTimeout } } };
}

function sessionFrom(req: http.IncomingMessage): LiveSession | null {
  const jar = cookies(req.headers.cookie);
  return store.get(jar[config.cookieName]);
}

function cookieHeader(session: LiveSession): string {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  return `${config.cookieName}=${encodeURIComponent(session.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    config.secureCookies ? '; Secure' : ''
  }`;
}

async function waitForLive() {
  return liveStatus();
}

async function route(req: http.IncomingMessage, url: URL): Promise<Reply> {
  const method = req.method || 'GET';
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const origin = req.headers.origin;
  if (origin && !config.allowedOrigins.includes(origin)) {
    return { status: 403, body: { error: { code: 'origin', message: 'Origin not allowed' } } };
  }
  const base = cors(origin);
  const idem = asString(req.headers['idempotency-key']).slice(0, 80) || undefined;

  if (method === 'GET' && path === '/api/sandbox/health') {
    const status = await waitForLive();
    return {
      status: 200,
      body: {
        mode: status.live ? 'live' : 'guided',
        live: status.live,
        reason: status.reason || null,
        budget: store.budgetSnapshot,
        sessions: store.size,
      },
      headers: base,
    };
  }

  if (method === 'POST' && path === '/api/sandbox/sessions') {
    const status = await waitForLive();
    const requested = url.searchParams.get('mode');
    if (!status.live || requested === 'guided') {
      return {
        status: 200,
        body: {
          capability: {
            mode: 'guided',
            live: false,
            reason: status.reason || (requested === 'guided' ? 'Guided example requested.' : 'Live sandbox unavailable.'),
          },
          state: null,
        },
        headers: base,
      };
    }
    const existing = sessionFrom(req);
    if (existing) {
      return {
        status: 200,
        body: { capability: { mode: 'live', live: true }, state: existing.snapshot() },
        headers: base,
      };
    }
    const session = await store.create();
    return {
      status: 200,
      body: { capability: { mode: 'live', live: true }, state: session.snapshot() },
      headers: { ...base, 'set-cookie': cookieHeader(session) },
    };
  }

  if (method === 'GET' && path === '/api/sandbox/state') {
    const session = sessionFrom(req);
    if (!session) {
      return {
        status: 200,
        body: {
          capability: { mode: 'guided', live: false, reason: 'No live sandbox session.' },
          state: null,
        },
        headers: base,
      };
    }
    return { status: 200, body: { capability: { mode: 'live', live: true }, state: session.snapshot() }, headers: base };
  }

  if (method === 'DELETE' && path === '/api/sandbox/session') {
    const session = sessionFrom(req);
    if (session) store.destroy(session.id);
    const status = await waitForLive();
    return {
      status: 200,
      body: {
        capability: { mode: status.live ? 'live' : 'guided', live: status.live },
        state: null,
      },
      headers: { ...base, 'set-cookie': `${config.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` },
    };
  }

  // Everything below needs the live session cookie.
  const session = sessionFrom(req);
  if (!session) {
    return {
      status: 409,
      body: { error: { code: 'no_session', message: copy.generic }, capability: { mode: 'guided', live: false } },
      headers: base,
    };
  }

  if (method === 'POST' && path === '/api/sandbox/posts') {
    const body = (await readJson(req)) as Record<string, unknown>;
    const title = asString(body.title).trim();
    const details = asString(body.body).trim();
    if (!title) return { status: 400, body: { error: { code: 'title', message: copy.missingTitle } }, headers: base };
    if (title.length > 100)
      return { status: 400, body: { error: { code: 'title_length', message: copy.longTitle } }, headers: base };
    if (details.length > 1000)
      return { status: 400, body: { error: { code: 'body_length', message: copy.longBody } }, headers: base };
    try {
      const result = await session.cached(idem, () => session.post(title, details));
      return { status: 200, body: { capability: { mode: 'live', live: true }, ...result }, headers: base };
    } catch (error) {
      const reply = statusFromError(error);
      return { ...reply, body: { ...(reply.body as object), state: session.snapshot() }, headers: base };
    }
  }

  const messageMatch = path.match(/^\/api\/sandbox\/threads\/([^/]+)\/messages$/);
  if (method === 'POST' && messageMatch) {
    const body = (await readJson(req)) as Record<string, unknown>;
    const text = asString(body.body).trim();
    const role = body.role === 'moderator' ? 'moderator' : 'member';
    if (!text) return { status: 400, body: { error: { code: 'empty', message: copy.generic } }, headers: base };
    if (text.length > 1000)
      return { status: 400, body: { error: { code: 'body_length', message: copy.longBody } }, headers: base };
    try {
      const result = await session.cached(idem, () => session.reply(decodeURIComponent(messageMatch[1]), text, role));
      return { status: 200, body: { capability: { mode: 'live', live: true }, ...result }, headers: base };
    } catch (error) {
      const reply = statusFromError(error);
      return { ...reply, body: { ...(reply.body as object), state: session.snapshot() }, headers: base };
    }
  }

  const saveMatch = path.match(/^\/api\/sandbox\/messages\/([^/]+)\/save$/);
  if (method === 'POST' && saveMatch) {
    try {
      const result = await session.cached(idem, () => session.save(decodeURIComponent(saveMatch[1])));
      return { status: 200, body: { capability: { mode: 'live', live: true }, ...result }, headers: base };
    } catch (error) {
      const reply = statusFromError(error);
      return { ...reply, body: { ...(reply.body as object), state: session.snapshot() }, headers: base };
    }
  }

  const knowledgeMatch = path.match(/^\/api\/sandbox\/knowledge\/([^/]+)$/);
  if (knowledgeMatch && (method === 'PATCH' || method === 'DELETE')) {
    const id = decodeURIComponent(knowledgeMatch[1]);
    try {
      if (method === 'DELETE') {
        const state = await session.cached(idem, () => session.remove(id));
        return { status: 200, body: { capability: { mode: 'live', live: true }, state }, headers: base };
      }
      const body = (await readJson(req)) as Record<string, unknown>;
      const answer = asString(body.answer).trim();
      if (!answer) return { status: 400, body: { error: { code: 'empty', message: copy.generic } }, headers: base };
      if (answer.length > 1200)
        return { status: 400, body: { error: { code: 'body_length', message: copy.longBody } }, headers: base };
      const state = await session.cached(idem, () => session.edit(id, answer));
      return { status: 200, body: { capability: { mode: 'live', live: true }, state }, headers: base };
    } catch (error) {
      const reply = statusFromError(error);
      return { ...reply, body: { ...(reply.body as object), state: session.snapshot() }, headers: base };
    }
  }

  const outcomeMatch = path.match(/^\/api\/sandbox\/cases\/([^/]+)\/outcome$/);
  if (method === 'POST' && outcomeMatch) {
    const body = (await readJson(req)) as Record<string, unknown>;
    const outcome = body.outcome === 'solved' ? 'solved' : body.outcome === 'needs_help' ? 'needs_help' : null;
    if (!outcome) return { status: 400, body: { error: { code: 'outcome', message: copy.generic } }, headers: base };
    try {
      const state = await session.cached(idem, () => session.outcome(decodeURIComponent(outcomeMatch[1]), outcome));
      return { status: 200, body: { capability: { mode: 'live', live: true }, state }, headers: base };
    } catch (error) {
      const reply = statusFromError(error);
      return { ...reply, body: { ...(reply.body as object), state: session.snapshot() }, headers: base };
    }
  }

  return { status: 404, body: { error: { code: 'not_found', message: 'Not found' } }, headers: base };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(origin));
    res.end();
    return;
  }
  try {
    const reply = await route(req, url);
    res.writeHead(reply.status, { 'content-type': 'application/json; charset=utf-8', ...reply.headers });
    res.end(JSON.stringify(reply.body));
  } catch (error) {
    const reply = statusFromError(error);
    res.writeHead(reply.status, { 'content-type': 'application/json; charset=utf-8', ...cors(origin) });
    res.end(JSON.stringify(reply.body));
  }
});

server.listen(config.port, config.host, () => {
  const live = liveRequested();
  // Deliberately terse: no visitor content is ever logged.
  console.log(
    `[sandbox] listening on http://${config.host}:${config.port} · mode=${config.mode} · provider=${
      live ? config.provider : 'guided'
    } · sessions=${store.size}`
  );
  if (!providerConfigured()) console.log('[sandbox] no live provider configured; the website will use the guided example.');
  else if (config.dailyModelCallLimit <= 0) console.log('[sandbox] SANDBOX_DAILY_MODEL_CALL_LIMIT=0; live replies stay off.');
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
