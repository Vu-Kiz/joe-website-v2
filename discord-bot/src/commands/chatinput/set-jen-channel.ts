import { Command, container } from '@sapphire/framework';
import { ChannelType, type ChatInputCommandInteraction } from 'discord.js';

export class SetJenChannelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'set-jen-channel',
      description: 'Set the Discord channel used for JEN announcements.',
    });
  }

  public override registerApplicationCommands(registry: Command.Registry): void {
    const guildIds = container.botConfig.guildId
      ? [container.botConfig.guildId]
      : undefined;

    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to use for JEN announcements')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        ),
      { guildIds }
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (!channel || !interaction.guildId) {
      return interaction.reply({
        content: 'Run this command in the server channel you want to use.',
        ephemeral: true,
      });
    }

    const payload = await container.backendApi.setAnnouncementChannel('jen', {
      discord_user_id: interaction.user.id,
      guild_id: interaction.guildId,
      channel_id: channel.id,
      channel_name: 'name' in channel && typeof channel.name === 'string' ? channel.name : null,
    });

    return interaction.reply({
      content: `Saved JEN announcements to <#${payload.data.channel_id}>.`,
      ephemeral: true,
    });
  }
}
