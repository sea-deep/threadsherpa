import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { hasSetupValue, setupProblems } from '../../src/config/readiness.js';
import { inviteUrl } from '../../src/setup.js';

const config = { DISCORD_BOT_TOKEN: 'fixture-token', MONGODB_URI: 'mongodb+srv://fixture-host/',
  MODEL_PROVIDER: 'paper' as const, PAPER_INSTRUMENTS_API_KEY: 'fixture-paper-key' };

describe('Minimum setup', () => {
  it('needs no application, server, or Atlas project ID', () => {
    expect(setupProblems(config)).toEqual([]);
  });
  it('rejects template placeholders without printing their values', () => {
    expect(hasSetupValue('your_discord_bot_token')).toBe(false);
    expect(hasSetupValue('mongodb+srv://<user>:<password>@cluster.mongodb.net/')).toBe(false);
    const issues = setupProblems({ ...config, DISCORD_BOT_TOKEN: '', MONGODB_URI: 'project-id-that-is-not-a-uri' });
    expect(issues).toHaveLength(2);
    expect(issues.join(' ')).not.toContain('fixture-paper-key');
    expect(issues.join(' ')).not.toContain('project-id-that-is-not-a-uri');
  });
  it('accepts the existing Paper key alias', () => {
    expect(setupProblems({ ...config, PAPER_INSTRUMENTS_API_KEY: '', PAPERINSTRUMENTS_API_KEY: 'fixture-alias' })).toEqual([]);
  });
  it('does not require a Paper key for local mode', () => {
    expect(setupProblems({ ...config, MODEL_PROVIDER: 'ollama', PAPER_INSTRUMENTS_API_KEY: '' })).toEqual([]);
  });
  it('creates a guild-install invite with command scopes and no administrator permission', () => {
    const url = new URL(inviteUrl('123456789012345678'));
    expect(url.searchParams.get('scope')).toBe('bot applications.commands');
    expect(url.searchParams.get('integration_type')).toBe('0');
    const permissions = BigInt(url.searchParams.get('permissions')!);
    expect(permissions & PermissionFlagsBits.Administrator).toBe(0n);
    expect(permissions & PermissionFlagsBits.SendMessagesInThreads).toBe(PermissionFlagsBits.SendMessagesInThreads);
  });
});
