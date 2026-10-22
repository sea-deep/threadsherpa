import { DatabaseSync } from 'node:sqlite';

export interface GuildConfig {
  guild_id: string;
  autonomy_mode: 'observe' | 'supervised' | 'auto';
  admin_role_ids: string[];
  support_channel_ids: string[];
  allowed_domains: string[];
  connected_repos: string[];
  retention_days: number;
  require_response_approval: boolean;
  created_at: string;
  updated_at: string;
}

export class GuildConfigRepository {
  constructor(private db: DatabaseSync) {}

  get(guildId: string): GuildConfig | null {
    const row = this.db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return this.mapRow(row);
  }

  upsert(config: Partial<GuildConfig> & { guild_id: string }): GuildConfig {
    const existing = this.get(config.guild_id);
    const now = new Date().toISOString();

    if (existing) {
      const updated: GuildConfig = {
        ...existing,
        ...config,
        updated_at: now,
      };

      this.db.prepare(`
        UPDATE guild_configs SET
          autonomy_mode = ?,
          admin_role_ids = ?,
          support_channel_ids = ?,
          allowed_domains = ?,
          connected_repos = ?,
          retention_days = ?,
          require_response_approval = ?,
          updated_at = ?
        WHERE guild_id = ?
      `).run(
        updated.autonomy_mode,
        JSON.stringify(updated.admin_role_ids),
        JSON.stringify(updated.support_channel_ids),
        JSON.stringify(updated.allowed_domains),
        JSON.stringify(updated.connected_repos),
        updated.retention_days,
        updated.require_response_approval ? 1 : 0,
        now,
        config.guild_id
      );

      return updated;
    } else {
      const created: GuildConfig = {
        guild_id: config.guild_id,
        autonomy_mode: config.autonomy_mode || 'supervised',
        admin_role_ids: config.admin_role_ids || [],
        support_channel_ids: config.support_channel_ids || [],
        allowed_domains: config.allowed_domains || [],
        connected_repos: config.connected_repos || [],
        retention_days: config.retention_days ?? 90,
        require_response_approval: config.require_response_approval ?? false,
        created_at: now,
        updated_at: now,
      };

      this.db.prepare(`
        INSERT INTO guild_configs (
          guild_id, autonomy_mode, admin_role_ids, support_channel_ids,
          allowed_domains, connected_repos, retention_days, require_response_approval,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        created.guild_id,
        created.autonomy_mode,
        JSON.stringify(created.admin_role_ids),
        JSON.stringify(created.support_channel_ids),
        JSON.stringify(created.allowed_domains),
        JSON.stringify(created.connected_repos),
        created.retention_days,
        created.require_response_approval ? 1 : 0,
        now,
        now
      );

      return created;
    }
  }

  isSupportChannel(guildId: string, channelId: string, parentId?: string | null): boolean {
    const config = this.get(guildId);
    if (!config) return false;
    // One-time setup requirement: Server must have explicitly configured support channels
    if (!config.support_channel_ids || config.support_channel_ids.length === 0) {
      return false;
    }
    if (config.support_channel_ids.includes(channelId)) return true;
    if (parentId && config.support_channel_ids.includes(parentId)) return true;
    return false;
  }

  isAdmin(guildId: string, userRoleIds: string[]): boolean {
    const config = this.get(guildId);
    if (!config) return false;
    if (config.admin_role_ids.length === 0) return true; // If no roles configured yet, allow server admins
    return config.admin_role_ids.some(r => userRoleIds.includes(r));
  }

  private mapRow(row: Record<string, unknown>): GuildConfig {
    return {
      guild_id: String(row.guild_id),
      autonomy_mode: row.autonomy_mode as 'observe' | 'supervised' | 'auto',
      admin_role_ids: JSON.parse((row.admin_role_ids as string) || '[]'),
      support_channel_ids: JSON.parse((row.support_channel_ids as string) || '[]'),
      allowed_domains: JSON.parse((row.allowed_domains as string) || '[]'),
      connected_repos: JSON.parse((row.connected_repos as string) || '[]'),
      retention_days: Number(row.retention_days || 90),
      require_response_approval: Number(row.require_response_approval) === 1,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }
}
