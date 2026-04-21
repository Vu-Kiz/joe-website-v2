export type BackendEnvelope<T> = {
  ok: true;
  data: T;
};

export type LatestChangelogVersionResponse = {
  version: string;
  released_at: string | null;
};

export type ChangelogAuthorizePostResponse = {
  allowed: boolean;
};

export type ChannelConfig = {
  id: number;
  notification_key: string;
  guild_id: string | null;
  channel_id: string;
  channel_name: string | null;
  set_by_user_id: number | null;
  set_by_discord_user_id: string | null;
};

export type JobResponse = {
  id: number;
  title: string;
};

export type JenResponse = {
  id: number;
  title: string;
};

export type OutboxClaimMessage = {
  id: number;
  notification_key: string;
  content: string;
  meta?: {
    source_type?: string;
    source_id?: number;
    action?: 'create' | 'update';
    messages?: string[];
    [key: string]: unknown;
  } | null;
  attempts: number;
  channel: {
    id: string;
    name: string | null;
    guild_id: string | null;
  } | null;
  dm?: {
    user_id: string;
  } | null;
  delivery?: {
    id: number;
    guild_id: string | null;
    channel_id: string;
    message_ids: string[];
  } | null;
};

export type SetChannelPayload = {
  discord_user_id: string;
  guild_id: string | null;
  channel_id: string;
  channel_name: string | null;
};

export type CreateJobPayload = {
  discord_user_id: string;
  title: string;
  description: string | null;
  job_mode: 'single' | 'multi' | 'open_ended';
  pay_type: 'fixed' | 'per_day_hyper';
  reward_amount: number;
  bonus_amount: number;
  bonus_note: string | null;
  bonus_reward: string | null;
  payer_subject_type: 'user' | 'faction';
  payer_subject_id: number | null;
};

export type CreateJenPayload = {
  discord_user_id: string;
  title: string;
  body: string;
  image_url: string | null;
};

export type MarkFailedPayload = {
  retry: boolean;
  error_message: string;
};

export type SyncGuildPayload = {
  guilds: Array<{
    guild_id: string;
    guild_name: string;
    icon_url: string | null;
    member_count: number | null;
    available: boolean;
  }>;
};
