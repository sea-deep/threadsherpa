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
      op,
      attributes: {
        ...attributes,
        'threadsherpa.version': '1.0.0',
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
