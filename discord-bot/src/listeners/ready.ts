import { Listener, container } from '@sapphire/framework';
import { ActivityType, Events, type Client } from 'discord.js';

export class ReadyListener extends Listener<typeof Events.ClientReady> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.ClientReady,
      once: true,
    });
  }

  public override run(client: Client<true>): void {
    console.log(`Discord bot logged in as ${client.user?.tag || 'unknown user'}.`);
    client.user.setPresence({
      status: 'online',
      activities: [
        {
          name: 'Utto nye usabia atoonyoba?',
          type: ActivityType.Watching,
        },
      ],
    });
    void container.guildSyncService.sync(client);
    container.outboxWorker.start(client);
  }
}
