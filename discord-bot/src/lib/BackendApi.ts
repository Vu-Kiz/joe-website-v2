import type {
  BackendEnvelope,
  ChannelConfig,
  ChangelogAuthorizePostResponse,
  CreateJenPayload,
  CreateJobPayload,
  JenResponse,
  JobResponse,
  LatestChangelogVersionResponse,
  MarkFailedPayload,
  OutboxClaimMessage,
  SetChannelPayload,
  SyncGuildPayload,
} from '../types/backend';
import type { BotConfig } from './BotConfig';

type FetchOptions = RequestInit;

export class BackendApi {
  public constructor(
    private readonly config: BotConfig,
    private readonly baseUrl: string = config.backendUrl
  ) {}

  public async fetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.backendToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let data: unknown = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      const contentType = response.headers.get('content-type') ?? 'unknown';
      const bodyStart = text.slice(0, 500).replace(/\s+/g, ' ').trim();
      console.error(
        `Backend API returned non-JSON response for ${url} ` +
          `(status ${response.status}, content-type ${contentType}). Body start: ${bodyStart}`
      );
      throw error;
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message?: unknown }).message ?? `Backend request failed with ${response.status}`)
          : `Backend request failed with ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  public setAnnouncementChannel(notificationKey: string, payload: SetChannelPayload) {
    return this.fetch<BackendEnvelope<ChannelConfig>>(`/discord-bot/channels/${notificationKey}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public createJob(payload: CreateJobPayload) {
    return this.fetch<BackendEnvelope<JobResponse>>('/discord-bot/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public createJen(payload: CreateJenPayload) {
    return this.fetch<BackendEnvelope<JenResponse>>('/discord-bot/jen', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public claimOutbox(limit = 5) {
    return this.fetch<BackendEnvelope<OutboxClaimMessage[]>>(`/discord-bot/outbox/claim?limit=${limit}`);
  }

  public claimDirectOutbox(limit = 5) {
    return this.fetch<BackendEnvelope<OutboxClaimMessage[]>>(`/discord-bot/outbox/claim-direct?limit=${limit}`);
  }

  public syncState(payload: SyncGuildPayload) {
    return this.fetch<{ ok: true; count: number }>('/discord-bot/sync-state', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public getLatestChangelogVersion() {
    return this.fetch<BackendEnvelope<LatestChangelogVersionResponse>>('/discord-bot/changelog/latest-version');
  }

  public authorizeChangelogPost(discordUserId: string) {
    return this.fetch<BackendEnvelope<ChangelogAuthorizePostResponse>>('/discord-bot/changelog/authorize-post', {
      method: 'POST',
      body: JSON.stringify({
        discord_user_id: discordUserId,
      }),
    });
  }

  public markDelivered(
    messageId: number,
    payload: {
      message_ids: string[];
      guild_id: string | null;
      channel_id: string | null;
    }
  ) {
    return this.fetch<{ ok: true }>(`/discord-bot/outbox/${messageId}/delivered`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public markFailed(messageId: number, payload: MarkFailedPayload) {
    return this.fetch<{ ok: true }>(`/discord-bot/outbox/${messageId}/failed`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public fulfillMarketOrder(orderId: number, discordUserId: string) {
    return this.fetch<{ ok: true; manual?: boolean; message: string }>(
      `/discord-bot/market/orders/${orderId}/fulfill`,
      {
        method: 'POST',
        body: JSON.stringify({ discord_user_id: discordUserId }),
      }
    );
  }
}
