import '@sapphire/pieces';
import type { BackendApi } from '../lib/BackendApi';
import type { BotConfig } from '../lib/BotConfig';
import type { GuildSyncService } from '../lib/GuildSyncService';
import type { OutboxWorker } from '../lib/OutboxWorker';

declare module '@sapphire/pieces' {
  interface Container {
    botConfig: BotConfig;
    backendApi: BackendApi;
    guildSyncService: GuildSyncService;
    outboxWorker: OutboxWorker;
  }
}
