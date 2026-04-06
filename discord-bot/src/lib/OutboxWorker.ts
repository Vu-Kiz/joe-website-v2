import type { Client } from 'discord.js';
import type { OutboxClaimMessage } from '../types/backend';
import type { BackendApi } from './BackendApi';
import type { BotConfig } from './BotConfig';

export class OutboxWorker {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private static readonly DELIVERY_TIMEOUT_MS = 15000;

  public constructor(
    private readonly backendApi: BackendApi,
    private readonly dmBackendApi: BackendApi,
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
      const dmResponse = await this.dmBackendApi.claimDirectOutbox(5);
      const messages = Array.isArray(response.data) ? response.data : [];
      const dmMessages = Array.isArray(dmResponse.data) ? dmResponse.data : [];
      const claimedMessages = [...messages, ...dmMessages];
      if (claimedMessages.length > 0) {
        console.log(`Discord bot claimed ${claimedMessages.length} outbox message(s).`);
      }

      for (const message of claimedMessages) {
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
      console.log(`Starting Discord delivery for outbox message ${message.id} (${message.notification_key}).`);
      const messages =
        Array.isArray(message.meta?.messages) && message.meta?.messages.length > 0
          ? message.meta.messages
          : [message.content].filter((value): value is string => typeof value === 'string' && value.trim() !== '');

      if (message.dm?.user_id) {
        console.log(`Outbox message ${message.id} targeting DM user ${message.dm.user_id}.`);
        const user = await this.withTimeout(
          client.users.fetch(message.dm.user_id),
          `Timed out fetching Discord user ${message.dm.user_id}.`
        );
        if (!user) {
          throw new Error(`Discord user ${message.dm.user_id} is unavailable.`);
        }

        const sentMessageIds: string[] = [];
        for (const content of messages) {
          console.log(`Sending DM for outbox message ${message.id} to ${message.dm.user_id}.`);
          const created = await this.withTimeout(
            user.send({ content }),
            `Timed out sending DM to Discord user ${message.dm.user_id}.`
          );
          sentMessageIds.push(created.id);
        }

        console.log(`Marking outbox message ${message.id} as delivered after DM send.`);
        await this.dmBackendApi.markDelivered(message.id, {
          message_ids: sentMessageIds,
          guild_id: null,
          channel_id: null,
        });

        return;
      }

      if (!message.channel?.id) {
        throw new Error('No Discord delivery target was supplied for the outbox message.');
      }

      const channel = await this.withTimeout(
        client.channels.fetch(message.channel.id),
        `Timed out fetching Discord channel ${message.channel.id}.`
      );
      if (!channel || !channel.isTextBased() || !('send' in channel) || !('messages' in channel)) {
        throw new Error(`Channel ${message.channel.id} is unavailable.`);
      }

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
              await this.withTimeout(
                existing.edit({ content }),
                `Timed out editing Discord message ${existing.id}.`
              );
              sentMessageIds.push(existing.id);
              continue;
            }
          }

          const created = await this.withTimeout<any>(
            channel.send({ content }),
            `Timed out sending message to Discord channel ${message.channel.id}.`
          );
          sentMessageIds.push(created.id);
        }

        for (const extraId of previousMessageIds.slice(messages.length)) {
          const existing = await this.withTimeout(
            channel.messages.fetch(extraId).catch(() => null),
            `Timed out fetching Discord message ${extraId}.`
          );
          if (existing) {
            await existing.delete().catch(() => undefined);
          }
        }
      } else {
        for (const content of messages) {
          const created = await this.withTimeout<any>(
            channel.send({ content }),
            `Timed out sending message to Discord channel ${message.channel.id}.`
          );
          sentMessageIds.push(created.id);
        }
      }

      console.log(`Marking outbox message ${message.id} as delivered after channel send.`);
      await this.backendApi.markDelivered(message.id, {
        message_ids: sentMessageIds,
        guild_id: message.channel.guild_id,
        channel_id: message.channel.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Discord delivery error';
      console.error(`Discord delivery failed for outbox message ${message.id}:`, errorMessage);
      const backendApi = message.notification_key === 'contact_requests'
        ? this.dmBackendApi
        : this.backendApi;

      try {
        await backendApi.markFailed(message.id, {
          retry: true,
          error_message: errorMessage,
        });
      } catch (markFailedError) {
        console.error(
          `Failed to mark Discord outbox message ${message.id} as failed:`,
          markFailedError instanceof Error ? markFailedError.message : markFailedError
        );
      }
    }
  }

  private async withTimeout<T>(promise: Promise<T>, errorMessage: string): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), OutboxWorker.DELIVERY_TIMEOUT_MS);
      }),
    ]);
  }
}
