import { copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';
import { PermissionFlagsBits, ApplicationFlagsBitField } from 'discord.js';
import { loadConfig } from './config/env.js';
import { hasSetupValue, setupProblems } from './config/readiness.js';
import { OllamaProvider } from './integrations/model/ollama.provider.js';
import { createModelProvider } from './integrations/model/factory.js';

export function inviteUrl(applicationId: string): string {
  const permissions = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.SendMessagesInThreads |
    PermissionFlagsBits.ReadMessageHistory | PermissionFlagsBits.EmbedLinks;
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({ client_id: applicationId, scope: 'bot applications.commands', permissions: String(permissions), integration_type: '0' }).toString();
  return url.toString();
}

export async function checkSetup(): Promise<boolean> {
  // Never overwrite the user's existing keys or settings.
  try { await copyFile('.env.example', '.env', constants.COPYFILE_EXCL); }
  catch (err) { if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err; }
  // Reload after creating .env. dotenv won't replace shell environment values.
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  const config = loadConfig();
  console.log('\nThreadSherpa setup check · no messages posted, no paid inference\n');
  const problems = setupProblems(config);
  for (const problem of problems) console.log(`NEEDS INPUT  ${problem}`);
  let ready = problems.length === 0;
  const checks: Array<Promise<string>> = [];
  if (hasSetupValue(config.DISCORD_BOT_TOKEN)) checks.push((async () => {
    try {
      const response = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
        headers: { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}` }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('access');
      const app = await response.json() as { id?: string; flags?: number };
      if (!app.id || !/^\d+$/.test(app.id)) throw new Error('response');
      const flags = new ApplicationFlagsBitField(app.flags || 0);
      if (!flags.has(ApplicationFlagsBitField.Flags.GatewayMessageContent) && !flags.has(ApplicationFlagsBitField.Flags.GatewayMessageContentLimited)) {
        ready = false;
        return `FIX  Discord token works, but Message Content Intent is off. Enable it in Developer Portal → Bot → Privileged Gateway Intents, then save.\nInvite the bot:\n${inviteUrl(app.id)}`;
      }
      return `OK  Discord token and Message Content Intent accepted. Invite the bot:\n${inviteUrl(app.id)}`;
    } catch { ready = false; return 'FIX  Discord token was not accepted or Discord is unreachable. Check Developer Portal → Bot → Reset Token.'; }
  })());
  if (hasSetupValue(config.MONGODB_URI) && /^mongodb(?:\+srv)?:\/\//.test(config.MONGODB_URI)) checks.push((async () => {
    let client: MongoClient | undefined;
    try {
      client = new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
      await client.connect();
      await client.db(config.MONGODB_DB_NAME).command({ ping: 1 });
      return 'OK  MongoDB connection accepted. The bot creates its collections and regular indexes on startup.';
    } catch { ready = false; return 'FIX  MongoDB could not connect. Check the database user/password, connection string, and Atlas Network Access → Add Current IP Address.'; }
    finally { await client?.close().catch(() => {}); }
  })());
  if (config.MONGODB_URI.startsWith('memory://') || config.MONGODB_URI === ':memory:') {
    ready = false;
    console.log('NEEDS INPUT  MONGODB_URI currently uses temporary memory. Paste the Atlas connection string to keep answers after restart.');
  }
  checks.push((async () => {
    const provider = new OllamaProvider({ baseUrl: config.OLLAMA_BASE_URL, model: config.OLLAMA_MODEL, embeddingModel: config.OLLAMA_EMBEDDING_MODEL });
    const health = await provider.healthCheck();
    if (health.ok && health.selectedModelAvailable && health.embeddingModelAvailable) return 'OK  Local Gemma and embedding models are ready.';
    ready = false;
    return 'FIX  Start Ollama, then run: ollama pull gemma4:e4b-it-qat && ollama pull embeddinggemma-2:270m';
  })());
  if (['paper', 'paperinstruments'].includes(config.MODEL_PROVIDER) && hasSetupValue(config.PAPER_INSTRUMENTS_API_KEY || config.PAPERINSTRUMENTS_API_KEY)) checks.push((async () => {
    const health = await createModelProvider(config).healthCheck();
    if (health.selectedModelAvailable) return 'OK  Paper Instruments key and Ultramarine model accepted. No generation requested.';
    ready = false; return 'FIX  Paper Instruments access could not be verified. Check the key in https://platform.paperinstruments.com/';
  })());
  for (const line of await Promise.all(checks)) console.log(line);
  console.log(ready ? '\nReady. Run npm run dev, then from a regular text channel use /setup channel:#your-support-forum autonomy_mode:auto.\n' : '\nFinish the items above, then run npm run setup again. Full guide: docs/START_HERE.md\n');
  return ready;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkSetup().then(ready => { process.exitCode = ready ? 0 : 1; }).catch(() => {
    console.error('Setup check could not finish. Check the variable names and values in .env. See docs/START_HERE.md.');
    process.exitCode = 1;
  });
}
