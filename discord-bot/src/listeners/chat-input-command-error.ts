import { Listener } from '@sapphire/framework';
import type { ChatInputCommandInteraction } from 'discord.js';

export class ChatInputCommandErrorListener extends Listener<'chatInputCommandError'> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: 'chatInputCommandError',
    });
  }

  public override async run(error: unknown, payload: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown command failure';
    const { interaction } = payload;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: message,
        ephemeral: true,
      }).catch(() => undefined);
      return;
    }

    await interaction.reply({
      content: message,
      ephemeral: true,
    }).catch(() => undefined);
  }
}
