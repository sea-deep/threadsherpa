import pino from 'pino';
import { getConfig } from '../config/env.js';

let loggerInstance: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (loggerInstance) {
    return loggerInstance;
  }

  let level = 'info';
  try {
    level = getConfig().LOG_LEVEL;
  } catch {
    level = process.env.LOG_LEVEL || 'info';
  }

  const isDev = process.env.NODE_ENV !== 'production';

  loggerInstance = pino({
    level,
    redact: {
      paths: [
        'token',
        '*.token',
        '*.botToken',
        'DISCORD_BOT_TOKEN',
        'GITHUB_TOKEN',
        'authorization',
        'headers.authorization',
        'headers.cookie',
        'password',
        '*.password',
        'secret',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });

  return loggerInstance;
}

export const logger = getLogger();
