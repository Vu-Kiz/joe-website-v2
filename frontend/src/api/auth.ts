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
  scan_window_top_left_galx?: number | null;
  scan_window_top_left_galy?: number | null;
  scan_window_bottom_right_galx?: number | null;
  scan_window_bottom_right_galy?: number | null;
  is_garry: boolean;
  is_raid: boolean;

  can_manage_blog: boolean;
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
 * Example: https://dev-v2-api.swc-joe.com/api
 */
export function getApiBaseUrl(): string {
  return requireEnv("VITE_API_BASE_URL").replace(/\/+$/, "");
}

/**
 * Backend ORIGIN for browser redirects (must NOT include /api)
 * Example: https://dev-v2-api.swc-joe.com
 */
export function getBackendOrigin(): string {
  const api = getApiBaseUrl();
  if (!api) return "";
  return api.replace(/\/api\/?$/, "");
}

/** Hit Sanctum to ensure Laravel issues XSRF-TOKEN cookie */
export async function ensureCsrfCookie(): Promise<void> {
  const origin = getBackendOrigin();
  if (!origin) throw new Error("VITE_API_BASE_URL is missing");

  await fetch(`${origin}/sanctum/csrf-cookie`, {
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
    const msg =
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
  return apiFetch<AuthMeResponse>("/auth/me");
}

export function apiLogout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/auth/logout", {
    method: "POST",
  }).then((result) => {
    emitAuthStateChanged();
    return result;
  });
}
