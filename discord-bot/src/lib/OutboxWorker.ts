import type { Client } from 'discord.js';
import type { OutboxClaimMessage } from '../types/backend';
import type { BackendApi } from './BackendApi';
import type { BotConfig } from './BotConfig';

export class OutboxWorker {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  public constructor(
    private readonly backendApi: BackendApi,
    private readonly config: BotConfig
  ) {}

  public start(client: Client): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.drain(client);
    }, this.config.outboxPollMs);

    void this.drain(client);
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async drain(client: Client): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;

    try {
      const response = await this.backendApi.claimOutbox(5);
      const messages = Array.isArray(response.data) ? response.data : [];

      for (const message of messages) {
        await this.deliverMessage(client, message);
      }
    } catch (error) {
      console.error('Discord bot outbox poll failed:', error);
    } finally {
      this.busy = false;
    }
  }

  private async deliverMessage(client: Client, message: OutboxClaimMessage): Promise<void> {
    try {
      const channel = await client.channels.fetch(message.channel.id);
      if (!channel || !channel.isTextBased() || !('send' in channel) || !('messages' in channel)) {
        throw new Error(`Channel ${message.channel.id} is unavailable.`);
      }

      const messages =
        Array.isArray(message.meta?.messages) && message.meta?.messages.length > 0
          ? message.meta.messages
          : [message.content].filter((value): value is string => typeof value === 'string' && value.trim() !== '');

      const action = message.meta?.action ?? 'create';
      const previousMessageIds = Array.isArray(message.delivery?.message_ids) ? message.delivery!.message_ids : [];
      const sentMessageIds: string[] = [];

      if (action === 'update' && previousMessageIds.length > 0) {
        for (let index = 0; index < messages.length; index += 1) {
          const content = messages[index];
          const existingId = previousMessageIds[index];

          if (existingId) {
            const existing = await channel.messages.fetch(existingId).catch(() => null);
            if (existing) {
              await existing.edit({ content });
              sentMessageIds.push(existing.id);
              continue;
            }
          }

          const created = await channel.send({ content });
          sentMessageIds.push(created.id);
        }

        for (const extraId of previousMessageIds.slice(messages.length)) {
          const existing = await channel.messages.fetch(extraId).catch(() => null);
          if (existing) {
            await existing.delete().catch(() => undefined);
          }
        }
      } else {
        for (const content of messages) {
          const created = await channel.send({ content });
          sentMessageIds.push(created.id);
        }
      }

      await this.backendApi.markDelivered(message.id, {
        message_ids: sentMessageIds,
        guild_id: message.channel.guild_id,
        channel_id: message.channel.id,
      });
    } catch (error) {
      await this.backendApi.markFailed(message.id, {
        retry: true,
        error_message: error instanceof Error ? error.message : 'Unknown Discord delivery error',
      });
    }
  }
}
