// src/api/auth.ts

export type SwcUser = {
  id: number;
  discord_user_id?: string | null;
  discord_username?: string | null;
  discord_global_name?: string | null;
  discord_avatar_url?: string | null;
  swc_character_id: number | null;
  handle: string | null;
  avatar_url: string | null;

  is_joe_member: boolean;
  is_admin: boolean;
  is_sysadmin: boolean;
  is_intel: boolean;
  can_view_asteroid_intel: boolean;
  can_access_combat_calc: boolean;
  can_access_wrecking_helper_extension: boolean;
  can_access_fleet_commander: boolean;
  can_access_rm_browser: boolean;
  is_rm_browser_service_account: boolean;
  scan_window_top_left_galx?: number | null;
  scan_window_top_left_galy?: number | null;
  scan_window_bottom_right_galx?: number | null;
  scan_window_bottom_right_galy?: number | null;
  is_garry: boolean;
  is_raid: boolean;

  can_manage_blog: boolean;

  force_subscriber_tier: boolean;
  lock_joe_flags: boolean;
  store_has_active_plans: boolean;
  tool_access_tier: "full" | "public" | "none";
  tool_subscription: {
    id: number;
    plan_key: string;
    subscriber_type: "user" | "faction";
    status: string;
    current_period_end: string | null;
  } | null;
};

export class SiteLockedError extends Error {
  public readonly siteLocked = true;

  constructor(message: string) {
    super(message);
    this.name = "SiteLockedError";
  }
}

export type AuthMeResponse = {
  ok: true;
  user: SwcUser | null;
};

export const AUTH_STATE_CHANGED_EVENT = "joe:auth-state-changed";

const PERMISSION_FLAG_LABELS: Record<string, string> = {
  is_joe_member: "JOE member access",
  is_admin: "admin access",
  is_sysadmin: "sysadmin access",
  is_intel: "intel access",
  can_view_asteroid_intel: "asteroid intel access",
  can_manage_blog: "blog management access",
  can_manage_tips: "loading tip management access",
  can_manage_eotm: "employee spotlight management access",
  can_access_combat_calc: "combat calculator access",
  can_access_wrecking_helper_extension: "wrecking helper extension access",
  can_access_fleet_commander: "fleet commander access",
  can_access_rm_browser: "RM browser access",
  member_tool_access: "member tools access",
};

function formatPermissionFlag(flag: unknown): string {
  const value = String(flag ?? "").trim();
  if (!value) {
    return "unknown access";
  }

  if (PERMISSION_FLAG_LABELS[value]) {
    return PERMISSION_FLAG_LABELS[value];
  }

  return value
    .replace(/^can_/, "")
    .replace(/^is_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .toLowerCase() + " access";
}

export function emitAuthStateChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
}

export function subscribeToAuthStateChange(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => listener();
  window.addEventListener(AUTH_STATE_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handler);
  };
}

function requireEnv(name: string): string {
  const v = (import.meta as any).env?.[name] as string | undefined;
  if (!v) return "";
  return String(v).trim();
}

/**
 * API base for JSON calls (should include /api)
 * Example: https://api.joe-swc.com/api
 */
export function getApiBaseUrl(): string {
  return requireEnv("VITE_API_BASE_URL").replace(/\/+$/, "");
}

/**
 * Backend ORIGIN for browser redirects (must NOT include /api)
 * Example: https://api.joe-swc.com
 */
export function getBackendOrigin(): string {
  const explicitOrigin = requireEnv("VITE_BACKEND_ORIGIN").replace(/\/+$/, "");
  if (explicitOrigin) {
    return explicitOrigin;
  }

  const api = getApiBaseUrl();
  if (!api) return "";
  if (api.startsWith("/")) return "";
  return api.replace(/\/api\/?$/, "");
}

export function getSessionStreamUrl(): string {
  const base = getApiBaseUrl();
  if (!base) return "";
  return `${base}/auth/session-stream`;
}

/** Hit Sanctum to ensure Laravel issues XSRF-TOKEN cookie */
export async function ensureCsrfCookie(): Promise<void> {
  const origin = getBackendOrigin();
  const csrfUrl = origin ? `${origin}/sanctum/csrf-cookie` : "/sanctum/csrf-cookie";

  await fetch(csrfUrl, {
    method: "GET",
    credentials: "include",
  });
}

/** Backwards-compatible alias */
export async function initCsrf(): Promise<void> {
  return ensureCsrfCookie();
}

/** Read a cookie value */
function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** Current XSRF token */
export function getXsrfToken(): string {
  return getCookie("XSRF-TOKEN");
}

/**
 * Central API helper
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is missing");

  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const method = (init.method || "GET").toUpperCase();
  const isWrite =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  const headers: Record<string, string> = {
    ...(init.headers as any),
  };

  if (isWrite) {
    await ensureCsrfCookie();
    const xsrf = getXsrfToken();
    if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
  }

  if (!headers["Content-Type"] && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  headers["Accept"] = "application/json";

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });

  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response
  }

  if (res.status === 503 && json?.site_locked) {
    throw new SiteLockedError(
      json?.message || "The site is temporarily unavailable."
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      // Fallback for when the live session stream is not connected:
      // force auth-state subscribers (navbar/pages) to refresh immediately.
      emitAuthStateChanged();

      if (typeof window !== "undefined") {
        const isFallbackPending = window.sessionStorage.getItem("joe:401-fallback-pending") === "1";
        const isOnHome = window.location.pathname === "/home";

        if (!isFallbackPending && !isOnHome) {
          window.sessionStorage.setItem("joe:401-fallback-pending", "1");

          window.setTimeout(async () => {
            try {
              const base = getApiBaseUrl();
              const authUrl = `${base}/auth/me`;
              const authRes = await fetch(authUrl, {
                method: "GET",
                credentials: "include",
                headers: {
                  Accept: "application/json",
                },
              });

              const payload = await authRes.json().catch(() => null);
              const hasUser = !!payload?.user;

              if (!authRes.ok || !hasUser) {
                window.sessionStorage.setItem("joe:401-redirecting", "1");
                window.location.href = "/home?session_invalidated=1";
              }
            } catch {
              window.sessionStorage.setItem("joe:401-redirecting", "1");
              window.location.href = "/home?session_invalidated=1";
            } finally {
              window.sessionStorage.removeItem("joe:401-fallback-pending");
            }
          }, 1400);
        }
      }
    }

    const requiredFlags = Array.isArray(json?.required_flags)
      ? json.required_flags.filter(Boolean).map(formatPermissionFlag).join(", ")
      : null;
    const permissionHint =
      res.status === 403 && requiredFlags
        ? `${json?.message || "Forbidden"} Required access: ${requiredFlags}.`
        : null;
    const msg =
      permissionHint ||
      json?.message ||
      json?.data?.message ||
      json?.error ||
      (json?.errors
        ? Object.values(json.errors)
            .flat()
            .filter(Boolean)
            .join(" ")
        : null) ||
      (text?.startsWith("<!DOCTYPE")
        ? `Request failed (${res.status}) - CSRF/session issue`
        : `Request failed (${res.status}) at ${url}`);
    const error = new Error(msg) as Error & {
      status?: number;
      payload?: unknown;
      url?: string;
    };
    error.status = res.status;
    error.payload = json;
    error.url = url;
    throw error;
  }

  return json as T;
}

export function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/auth/me", {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
}

export function apiLogout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/auth/logout", {
    method: "POST",
  }).then((result) => {
    emitAuthStateChanged();
    return result;
  });
}
