import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

let sentryInitialized = false;

export function initSentry(dsn?: string): boolean {
  const targetDsn = dsn || process.env.SENTRY_DSN;
  if (!targetDsn) {
    return false;
  }

  try {
    Sentry.init({
      dsn: targetDsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
      integrations: [],
      beforeSend(event) {
        delete event.user;
        // Redact any tokens in Sentry events
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
        }
        return event;
      },
    });

    sentryInitialized = true;
    logger.info('Sentry Agent Tracing initialized successfully');
    return true;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Sentry');
    return false;
  }
}

export async function traceAgentAction<T>(
  name: string,
  op: 'agent.tool' | 'agent.investigation' | 'agent.inference' | 'agent.learning',
  attributes: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  if (!sentryInitialized) {
    return await fn();
  }

  return await Sentry.startSpan(
    {
      name,
      op: { 'agent.tool': 'gen_ai.execute_tool', 'agent.investigation': 'gen_ai.invoke_agent', 'agent.inference': 'gen_ai.request', 'agent.learning': 'gen_ai.invoke_agent' }[op],
      attributes: {
        'gen_ai.operation.name': { 'agent.tool': 'execute_tool', 'agent.investigation': 'invoke_agent', 'agent.inference': 'chat', 'agent.learning': 'invoke_agent' }[op],
        ...(op === 'agent.tool' ? { 'gen_ai.tool.name': name } : {}),
        'threadsherpa.version': '1.0.0',
        ...attributes,
      },
    },
    async (span) => {
      try {
        const result = await fn();
        span?.setStatus({ code: 1 }); // OK
        return result;
      } catch (err) {
        span?.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) });
        Sentry.captureException(err);
        throw err;
      }
    }
  );
}

/** Numeric metadata only: never send community message bodies or prompts. */
export function recordModelUsage(inputTokens?: number, outputTokens?: number): void {
  if (!sentryInitialized) return;
  const span = Sentry.getActiveSpan();
  if (Number.isFinite(inputTokens)) span?.setAttribute('gen_ai.usage.input_tokens', inputTokens!);
  if (Number.isFinite(outputTokens)) span?.setAttribute('gen_ai.usage.output_tokens', outputTokens!);
}

export function recordAnswerMetrics(route: string, tools: number, modelCalls: number): void {
  if (!sentryInitialized) return;
  Sentry.getActiveSpan()?.setAttributes({ 'support.route': route, 'support.tools': tools, 'support.generation_calls': modelCalls });
}
