import type { AppConfig } from './env.js';

export function hasSetupValue(value?: string): boolean {
  const clean = value?.trim() || '';
  return Boolean(clean && !/^(your[_ -]|dummy_|replace[_ -]|paste[_ -])/i.test(clean) && !/<[^>]+>/.test(clean));
}

/** Names and instructions only: never return credentials or connection strings. */
export function setupProblems(config: Pick<AppConfig, 'DISCORD_BOT_TOKEN' | 'MONGODB_URI' | 'MODEL_PROVIDER' | 'PAPER_INSTRUMENTS_API_KEY' | 'PAPERINSTRUMENTS_API_KEY'>): string[] {
  const problems: string[] = [];
  if (!hasSetupValue(config.DISCORD_BOT_TOKEN)) problems.push('Set DISCORD_BOT_TOKEN from Discord Developer Portal → Bot.');
  if (!hasSetupValue(config.MONGODB_URI)) problems.push('Set MONGODB_URI to the Atlas connection string from Connect → Drivers.');
  else if (!/^(mongodb(?:\+srv)?:\/\/|memory:\/\/|:memory:$)/.test(config.MONGODB_URI)) problems.push('MONGODB_URI must be a MongoDB connection string, not an Atlas project or cluster ID.');
  if (['paper', 'paperinstruments'].includes(config.MODEL_PROVIDER) && !hasSetupValue(config.PAPER_INSTRUMENTS_API_KEY || config.PAPERINSTRUMENTS_API_KEY)) {
    problems.push('Set PAPER_INSTRUMENTS_API_KEY from the Paper Instruments console.');
  }
  return problems;
}
