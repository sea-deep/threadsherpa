/** Synthetic examples for a dedicated demo database. Never represents MLH policy. */
import { pathToFileURL } from 'node:url';
import { connectDatabase, closeDatabase } from './connection.js';
import { KnowledgeRepository } from './repositories/knowledge.repo.js';
import { GuildConfigRepository } from './repositories/guild-config.repo.js';
import { demoQuestion, demoAnswer } from '../demo/scenario.js';
import { logger } from '../utils/logger.js';

export async function seedDemoData(uri?: string) {
  const { db, client } = await connectDatabase({ uri, dbName: 'threadsherpa_demo' });
  const knowledge = new KnowledgeRepository(db);
  const guilds = new GuildConfigRepository(db);
  await guilds.upsert({ guild_id: 'demo-community', autonomy_mode: 'supervised', support_channel_ids: ['demo-support'] });
  if (!(await knowledge.get('demo-schedule'))) {
    await knowledge.createCandidate({ knowledge_id: 'demo-schedule', guild_id: 'demo-community',
      question_patterns: [demoQuestion], canonical_answer: demoAnswer, created_by: 'demo-moderator' });
    await knowledge.approve('demo-schedule', 'demo-moderator');
  }
  logger.info({ persistent: Boolean(client), db: 'threadsherpa_demo' },
    client ? 'Synthetic demo data saved; not connected to a real Discord server' : 'Temporary sample data created; it will disappear at process exit. Use npm run demo for a complete scenario.');
  return db;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemoData().then(() => closeDatabase()).catch(err => { console.error('Demo seed failed', err); process.exitCode = 1; });
}
