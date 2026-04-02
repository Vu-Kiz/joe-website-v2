import type { Client, Guild } from 'discord.js';
import type { BackendApi } from './BackendApi';

export class GuildSyncService {
  public constructor(private readonly backendApi: BackendApi) {}

  public async sync(client: Client): Promise<void> {
    const guilds = Array.from(client.guilds.cache.values()).map((guild: Guild) => ({
      guild_id: guild.id,
      guild_name: guild.name,
      icon_url: guild.iconURL() ?? null,
      member_count: guild.memberCount ?? null,
      available: guild.available,
    }));

    await this.backendApi.syncState({ guilds });
  }
}
