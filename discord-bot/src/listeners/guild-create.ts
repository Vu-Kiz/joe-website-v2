import { Listener, container } from '@sapphire/framework';
import { Events, type Guild } from 'discord.js';

export class GuildCreateListener extends Listener<typeof Events.GuildCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildCreate,
    });
  }

  public override async run(_guild: Guild): Promise<void> {
    await container.guildSyncService.sync(this.container.client);
  }
}
