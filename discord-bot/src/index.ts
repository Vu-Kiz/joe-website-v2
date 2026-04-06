import 'dotenv/config';
import {
  ApplicationCommandRegistries,
  RegisterBehavior,
  SapphireClient,
  container,
} from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';
import { BackendApi } from './lib/BackendApi';
import { BotConfig } from './lib/BotConfig';
import { GuildSyncService } from './lib/GuildSyncService';
import { OutboxWorker } from './lib/OutboxWorker';

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

const config = BotConfig.fromEnv(process.env);
container.botConfig = config;
container.backendApi = new BackendApi(config);
const dmBackendApi = new BackendApi(config, config.dmBackendUrl);
container.guildSyncService = new GuildSyncService(container.backendApi);
container.outboxWorker = new OutboxWorker(container.backendApi, dmBackendApi, config);

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds],
  loadMessageCommandListeners: false,
  defaultPrefix: undefined,
});

process.on('SIGINT', async () => {
  await container.outboxWorker.stop();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await container.outboxWorker.stop();
  client.destroy();
  process.exit(0);
});

void client.login(config.botToken);
