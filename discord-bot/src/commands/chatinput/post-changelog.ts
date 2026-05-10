import { Command, container } from '@sapphire/framework';
import { ChannelType, type ChatInputCommandInteraction } from 'discord.js';

function normalizeVersion(input: string): string | null {
  const cleaned = input.trim().replace(/^v/i, '');
  if (!cleaned) {
    return null;
  }

  // Allow semantic-style release strings like 2.0.5 or 2.0.5-beta.1
  if (!/^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export class PostChangelogCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'post-changelog',
      description: 'Post a changelog link for a specific release version.',
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
        .addStringOption((option) =>
          option
            .setName('version')
            .setDescription('Optional release version (example: 2.0.5). Leave blank to use latest.')
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Optional channel to post in (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        ),
      { guildIds }
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: 'Run this command in a server channel.',
        ephemeral: true,
      });
    }

    try {
      await container.backendApi.authorizeChangelogPost(interaction.user.id);
    } catch (_error) {
      return interaction.reply({
        content: 'Only linked sysadmins can use /post-changelog.',
        ephemeral: true,
      });
    }

    const rawVersion = interaction.options.getString('version');
    let version: string | null = null;
    let releaseDateText: string | null = null;

    if (rawVersion && rawVersion.trim() !== '') {
      version = normalizeVersion(rawVersion);
      if (!version) {
        return interaction.reply({
          content: 'Invalid version format. Use something like `2.0.5`.',
          ephemeral: true,
        });
      }
    } else {
      try {
        const latest = await container.backendApi.getLatestChangelogVersion();
        version = normalizeVersion(latest.data.version);
        if (latest.data.released_at) {
          const releasedAt = new Date(latest.data.released_at);
          if (!Number.isNaN(releasedAt.getTime())) {
            releaseDateText = releasedAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          }
        }
      } catch (error) {
        return interaction.reply({
          content: 'Could not resolve the latest release version. Provide a version manually (example: `2.0.5`).',
          ephemeral: true,
        });
      }
    }

    if (!version) {
      return interaction.reply({
        content: 'Could not resolve a valid changelog version.',
        ephemeral: true,
      });
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    if (!targetChannel || !('send' in targetChannel) || typeof targetChannel.send !== 'function') {
      return interaction.reply({
        content: 'Could not resolve a text channel to post to.',
        ephemeral: true,
      });
    }

    const changelogLink = `${container.botConfig.webappUrl}/tools?tools_view=changelog&changelog_version=${encodeURIComponent(version)}`;
    const message = releaseDateText
      ? `New release **v${version}** (${releaseDateText}) is now live.\nChange log: ${changelogLink}`
      : `New release **v${version}** is now live.\nChange log: ${changelogLink}`;

    await targetChannel.send({ content: message });

    return interaction.reply({
      content: `Posted changelog link for **v${version}** in <#${targetChannel.id}>.`,
      ephemeral: true,
    });
  }
}
