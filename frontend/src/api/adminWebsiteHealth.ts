import { apiFetch } from "./auth";

export type AdminWebsiteHealthState = {
  app: {
    name: string | null;
    env: string | null;
    version: string | null;
    app_url: string | null;
    timezone: string | null;
    php: string | null;
    laravel: string | null;
    now: string | null;
  };
  database: {
    status: string;
    driver: string | null;
    host: string | null;
    database: string | null;
    error: string | null;
  };
  queue: {
    status: string;
    default_connection: string | null;
    driver: string | null;
    pending_jobs: number | null;
    failed_jobs: number | null;
    recent_failed_jobs: number | null;
    recent_failure_window_hours: number | null;
    last_failed_at: string | null;
    error: string | null;
  };
  discord_bot: {
    status: string;
    configured: boolean;
    known_guilds: number | null;
    available_guilds: number | null;
    last_seen_guild: {
      guild_name: string | null;
      guild_id: string | null;
      last_seen_at: string | null;
    } | null;
    outbox_pending: number | null;
    outbox_processing: number | null;
    outbox_failed: number | null;
    outbox_sent: number | null;
    error: string | null;
  };
  storage: {
    app_storage_writable: boolean;
    framework_writable: boolean;
    cache_writable: boolean;
    bootstrap_cache_writable: boolean;
  };
};

export async function getAdminWebsiteHealth() {
  return apiFetch<{ ok: true; data: AdminWebsiteHealthState }>("/admin/website-health");
}
