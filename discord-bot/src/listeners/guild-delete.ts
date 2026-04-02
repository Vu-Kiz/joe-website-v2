import { Listener, container } from '@sapphire/framework';
import { Events, type Guild } from 'discord.js';

export class GuildDeleteListener extends Listener<typeof Events.GuildDelete> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildDelete,
    });
  }

  public override async run(_guild: Guild): Promise<void> {
    await container.guildSyncService.sync(this.container.client);
  }
}
