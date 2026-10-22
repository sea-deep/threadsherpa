export {
  connectDatabase as connectMongo,
  closeDatabase as closeMongo,
  getDatabase as getMongoDb,
  ensureMongoIndexes,
} from '../connection.js';
export type { DatabaseOptions as MongoConnectionOptions } from '../connection.js';
