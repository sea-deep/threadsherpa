import { MongoClient, Db } from 'mongodb';
import { logger } from '../../utils/logger.js';

let clientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;

export interface MongoConnectionOptions {
  uri?: string;
  dbName?: string;
}

export async function connectMongo(options: MongoConnectionOptions = {}): Promise<{ client: MongoClient; db: Db }> {
  const uri = options.uri || process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = options.dbName || process.env.MONGODB_DB_NAME || 'threadsherpa';

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

    // Ensure database indexes
    await ensureMongoIndexes(dbInstance);
  }

  return { client: clientInstance, db: dbInstance! };
}

export function getMongoDb(): Db {
  if (!dbInstance) {
    throw new Error('MongoDB has not been initialized. Call connectMongo() first.');
  }
  return dbInstance;
}

export async function closeMongo(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
    dbInstance = null;
    logger.info('Closed MongoDB Atlas connection');
  }
}

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

    logger.info('MongoDB Atlas indexes verified successfully');
  } catch (err) {
    logger.warn({ err }, 'Error ensuring MongoDB indexes (may already exist)');
  }
}
