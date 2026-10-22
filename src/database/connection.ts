import { MongoClient, Db } from 'mongodb';
import { logger } from '../utils/logger.js';
import { createMemoryMongoDb, getOrCreateMemoryMongoDb } from './memory-db.js';

let clientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;

export interface DatabaseOptions {
  uri?: string;
  dbName?: string;
  inMemory?: boolean;
}

export async function connectDatabase(options: DatabaseOptions = {}): Promise<{ client: MongoClient | null; db: Db }> {
  const uri = options.uri || process.env.MONGODB_URI || 'memory://';
  const dbName = options.dbName || process.env.MONGODB_DB_NAME || 'threadsherpa';

  if (options.inMemory || uri === ':memory:' || uri.startsWith('memory://')) {
    const memoryKey = uri.startsWith('memory://') && uri.length > 9 ? uri.slice(9) : (options.dbName || 'threadsherpa');
    logger.info({ mode: 'in-memory', key: memoryKey }, 'Initializing in-memory MongoDB database backend');
    const memoryDb = getOrCreateMemoryMongoDb(memoryKey);
    dbInstance = memoryDb;
    await ensureMongoIndexes(memoryDb);
    return { client: null, db: memoryDb };
  }

  if (!clientInstance) {
    logger.info({ dbName }, 'Connecting to MongoDB Atlas...');
    clientInstance = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });

    await clientInstance.connect();
    dbInstance = clientInstance.db(dbName);
    logger.info({ dbName }, 'Successfully connected to MongoDB Atlas');

    await ensureMongoIndexes(dbInstance);
  }

  return { client: clientInstance, db: dbInstance! };
}

// Alias for backwards compatibility with any mongo-specific imports
export const connectMongo = connectDatabase;

export function getDatabase(): Db {
  if (!dbInstance) {
    // Lazy default to in-memory store if not initialized
    dbInstance = createMemoryMongoDb();
  }
  return dbInstance;
}

export const getMongoDb = getDatabase;

export async function closeDatabase(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
  }
  dbInstance = null;
  logger.info('Closed database connection');
}

export const closeMongo = closeDatabase;

export async function ensureMongoIndexes(db: Db): Promise<void> {
  try {
    // 1. Guild Configs
    await db.collection('guild_configs').createIndex({ guild_id: 1 }, { unique: true });

    // 2. Support Cases
    await db.collection('support_cases').createIndex({ case_id: 1 }, { unique: true });
    await db.collection('support_cases').createIndex({ guild_id: 1, status: 1 });
    await db.collection('support_cases').createIndex({ channel_id: 1 });
    await db.collection('support_cases').createIndex({ thread_id: 1 });
    await db.collection('support_cases').createIndex({ title: 'text', summary: 'text' });

    // 3. Case Evidence
    await db.collection('case_evidence').createIndex({ evidence_id: 1 }, { unique: true });
    await db.collection('case_evidence').createIndex({ case_id: 1 });

    // 4. Knowledge Items
    await db.collection('knowledge_items').createIndex({ knowledge_id: 1 }, { unique: true });
    await db.collection('knowledge_items').createIndex({ guild_id: 1, approval_status: 1 });
    await db.collection('knowledge_items').createIndex({
      question_patterns: 'text',
      canonical_answer: 'text',
      applies_when: 'text',
    });

    // 5. Knowledge Versions
    await db.collection('knowledge_versions').createIndex({ version_id: 1 }, { unique: true });
    await db.collection('knowledge_versions').createIndex({ knowledge_id: 1, version: -1 });

    // 6. Incidents
    await db.collection('incidents').createIndex({ incident_id: 1 }, { unique: true });
    await db.collection('incidents').createIndex({ guild_id: 1, verification_state: 1 });

    // 7. GitHub Links
    await db.collection('github_links').createIndex({ link_id: 1 }, { unique: true });
    await db.collection('github_links').createIndex({ case_id: 1 });

    // 8. Audit Events
    await db.collection('audit_events').createIndex({ event_id: 1 }, { unique: true });
    await db.collection('audit_events').createIndex({ guild_id: 1, created_at: -1 });

    // 9. Investigation Runs
    await db.collection('investigation_runs').createIndex({ run_id: 1 }, { unique: true });
    await db.collection('investigation_runs').createIndex({ case_id: 1, created_at: -1 });

    logger.debug('MongoDB indexes verified successfully');
  } catch (err) {
    logger.warn({ err }, 'Error ensuring MongoDB indexes (indexes may already exist)');
  }
}
