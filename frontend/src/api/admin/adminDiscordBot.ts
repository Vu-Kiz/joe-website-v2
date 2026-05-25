import { apiFetch } from "../core/auth";

export type AdminDiscordBotGuild = {
  id: number;
  guild_id: string;
  guild_name: string;
  icon_url: string | null;
  member_count: number | null;
  available: boolean;
  last_seen_at: string | null;
};

export type AdminDiscordChannelConfig = {
  id: number;
  notification_key: string;
  guild_id: string | null;
  channel_id: string;
  channel_name: string | null;
  set_by_user_id: number | null;
  set_by_discord_user_id: string | null;
  updated_at: string | null;
};

export type AdminDiscordBotState = {
  client_id: string | null;
  invite_url: string | null;
  known_guilds: AdminDiscordBotGuild[];
  channel_configs: AdminDiscordChannelConfig[];
  default_recipient: AdminDiscordRecipient | null;
  candidate_recipients: AdminDiscordRecipient[];
};

export async function getAdminDiscordBotState() {
  return apiFetch<{ ok: true; data: AdminDiscordBotState }>("/admin/discord-bot");
}

export type AdminDiscordRecipient = {
  id: number;
  swc_handle: string | null;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_global_name: string | null;
  is_admin: boolean;
  is_sysadmin: boolean;
};

export async function updateAdminDiscordContactRecipient(defaultRecipientUserId: number | null) {
  return apiFetch<{ ok: true; message: string; data: Pick<AdminDiscordBotState, "default_recipient" | "candidate_recipients"> }>(
    "/admin/discord-bot/contact-recipient",
    {
      method: "POST",
      body: JSON.stringify({
        default_recipient_user_id: defaultRecipientUserId,
      }),
    }
  );
}
