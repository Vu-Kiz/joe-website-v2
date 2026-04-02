import { apiFetch } from "./auth";

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
};

export async function getAdminDiscordBotState() {
  return apiFetch<{ ok: true; data: AdminDiscordBotState }>("/admin/discord-bot");
}
