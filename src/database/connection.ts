import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { cosineSimilarity, parseVector } from '../utils/math.js';
import { logger } from '../utils/logger.js';

let defaultDb: DatabaseSync | null = null;

export interface DatabaseOptions {
  path?: string;
  inMemory?: boolean;
}

export function createDatabase(options: DatabaseOptions = {}): DatabaseSync {
  let db: DatabaseSync;

  if (options.inMemory || options.path === ':memory:') {
    db = new DatabaseSync(':memory:');
    logger.debug('Created in-memory SQLite database');
  } else {
    const dbPath = options.path || './data/threadsherpa.sqlite';
    const resolvedPath = path.resolve(dbPath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new DatabaseSync(resolvedPath);
    logger.info({ path: resolvedPath }, 'Opened SQLite database');
  }

  // Configure pragmas
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');

  // Register custom vector cosine similarity function for semantic search
  db.function('cosine_similarity', (a: unknown, b: unknown) => {
    if (typeof a !== 'string' || typeof b !== 'string') return 0;
    const vecA = parseVector(a);
    const vecB = parseVector(b);
    return cosineSimilarity(vecA, vecB);
  });

  return db;
}

export function getDatabase(options?: DatabaseOptions): DatabaseSync {
  if (!defaultDb) {
    defaultDb = createDatabase(options);
  }
  return defaultDb;
}

export function closeDatabase(): void {
  if (defaultDb) {
    defaultDb.close();
    defaultDb = null;
    logger.info('Closed default SQLite database');
  }
}
