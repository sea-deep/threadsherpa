import type { Db } from 'mongodb';

export interface GuildConfig {
  guild_id: string;
  autonomy_mode: 'observe' | 'supervised' | 'auto';
  admin_role_ids: string[];
  support_channel_ids: string[];
  allowed_domains: string[];
  documentation_urls: string[];
  retention_days: number;
  require_response_approval: boolean;
  created_at: string;
  updated_at: string;
}

export class GuildConfigRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection('guild_configs');
  }

  async get(guildId: string): Promise<GuildConfig | null> {
    const doc = await this.collection.findOne({ guild_id: guildId });
    if (!doc) return null;
    return this.mapDoc(doc as Record<string, unknown>);
  }

  async upsert(config: Partial<GuildConfig> & { guild_id: string }): Promise<GuildConfig> {
    const existing = await this.get(config.guild_id);
    const now = new Date().toISOString();

    if (existing) {
      const updated: GuildConfig = {
        ...existing,
        ...config,
        updated_at: now,
      };

      await this.collection.updateOne(
        { guild_id: config.guild_id },
        { $set: { ...updated } }
      );

      return updated;
    } else {
      const created: GuildConfig = {
        guild_id: config.guild_id,
        autonomy_mode: config.autonomy_mode || 'supervised',
        admin_role_ids: config.admin_role_ids || [],
        support_channel_ids: config.support_channel_ids || [],
        allowed_domains: config.allowed_domains || [],
        documentation_urls: config.documentation_urls || [],
        retention_days: config.retention_days ?? 90,
        require_response_approval: config.require_response_approval ?? false,
        created_at: now,
        updated_at: now,
      };

      await this.collection.insertOne({ ...created });
      return created;
    }
  }

  async isSupportChannel(guildId: string, channelId: string, parentId?: string | null): Promise<boolean> {
    const config = await this.get(guildId);
    if (!config) return false;
    // One-time setup requirement: Server must have explicitly configured support channels
    if (!config.support_channel_ids || config.support_channel_ids.length === 0) {
      return false;
    }
    if (config.support_channel_ids.includes(channelId)) return true;
    if (parentId && config.support_channel_ids.includes(parentId)) return true;
    return false;
  }

  async isAdmin(guildId: string, userRoleIds: string[]): Promise<boolean> {
    const config = await this.get(guildId);
    if (!config) return false;
    if (config.admin_role_ids.length === 0) return false; // Discord Administrator is checked by the caller.
    return config.admin_role_ids.some(r => userRoleIds.includes(r));
  }

  private mapDoc(doc: Record<string, unknown>): GuildConfig {
    return {
      guild_id: String(doc.guild_id),
      autonomy_mode: doc.autonomy_mode as 'observe' | 'supervised' | 'auto',
      admin_role_ids: Array.isArray(doc.admin_role_ids) ? doc.admin_role_ids.map(String) : [],
      support_channel_ids: Array.isArray(doc.support_channel_ids) ? doc.support_channel_ids.map(String) : [],
      allowed_domains: Array.isArray(doc.allowed_domains) ? doc.allowed_domains.map(String) : [],
      documentation_urls: Array.isArray(doc.documentation_urls) ? doc.documentation_urls.map(String) : [],
      retention_days: Number(doc.retention_days || 90),
      require_response_approval: Boolean(doc.require_response_approval),
      created_at: String(doc.created_at),
      updated_at: String(doc.updated_at),
    };
  }
}
