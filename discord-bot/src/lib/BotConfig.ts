export class BotConfig {
  public readonly botToken: string;
  public readonly clientId: string;
  public readonly guildId: string;
  public readonly backendUrl: string;
  public readonly dmBackendUrl: string;
  public readonly webappUrl: string;
  public readonly backendToken: string;
  public readonly outboxPollMs: number;

  public constructor({
    botToken,
    clientId,
    guildId,
    backendUrl,
    dmBackendUrl,
    webappUrl,
    backendToken,
    outboxPollMs,
  }: {
    botToken: string;
    clientId: string;
    guildId: string;
    backendUrl: string;
    dmBackendUrl: string;
    webappUrl: string;
    backendToken: string;
    outboxPollMs: number;
  }) {
    this.botToken = botToken;
    this.clientId = clientId;
    this.guildId = guildId;
    this.backendUrl = backendUrl;
    this.dmBackendUrl = dmBackendUrl;
    this.webappUrl = webappUrl;
    this.backendToken = backendToken;
    this.outboxPollMs = outboxPollMs;
  }

  public static fromEnv(env: NodeJS.ProcessEnv): BotConfig {
    const botToken = env.DISCORD_BOT_TOKEN || '';
    const clientId = env.DISCORD_BOT_CLIENT_ID || '';
    const guildId = env.DISCORD_BOT_GUILD_ID || '';
    const backendUrl = (env.DISCORD_BOT_BACKEND_URL || '').replace(/\/+$/, '');
    const dmBackendUrl = (env.DISCORD_BOT_DM_BACKEND_URL || backendUrl).replace(/\/+$/, '');
    const webappUrl = (env.DISCORD_BOT_WEBAPP_URL || '').replace(/\/+$/, '');
    const backendToken = env.DISCORD_BOT_BACKEND_TOKEN || '';
    const outboxPollMs = Math.max(3000, Number(env.DISCORD_BOT_OUTBOX_POLL_MS || 5000));

    if (!botToken || !clientId || !backendUrl || !dmBackendUrl || !webappUrl || !backendToken) {
      throw new Error('Missing required Discord bot environment configuration.');
    }

    return new BotConfig({
      botToken,
      clientId,
      guildId,
      backendUrl,
      dmBackendUrl,
      webappUrl,
      backendToken,
      outboxPollMs,
    });
  }
}
