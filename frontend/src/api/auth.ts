export type SwcUser = {
  id: number;
  swc_character_id: number | null;
  handle: string | null;
  avatar_url: string | null;

  is_joe_member: boolean;
  is_admin: boolean;
  is_sysadmin: boolean;
  is_intel: boolean;
  is_garry: boolean;
  is_raid: boolean;
};

export type AuthMeResponse = {
  ok: true;
  user: SwcUser | null;
};

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

/** Ensure Laravel issues XSRF-TOKEN cookie (Sanctum SPA) */
export async function ensureCsrfCookie(): Promise<void> {
  const origin = getBackendOrigin();
  if (!origin) throw new Error("VITE_API_BASE_URL is missing");
  await fetch(`${origin}/sanctum/csrf-cookie`, {
    method: "GET",
    credentials: "include",
  });
}

/** Read XSRF token from cookie (Laravel uses XSRF-TOKEN) */
function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is missing");

  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const method = (init?.method || "GET").toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  // For write requests, ensure CSRF cookie exists and send X-XSRF-TOKEN header
  let headers: Record<string, string> = {
    ...(init?.headers as any),
  };

  if (isWrite) {
    // Make sure we have XSRF-TOKEN cookie set
    await ensureCsrfCookie();
    const xsrf = getCookie("XSRF-TOKEN");
    if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
  }

  // JSON by default (unless caller overrides)
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
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
    // not json
  }

  if (!res.ok) {
    // Laravel 419 returns an HTML page by default
    const msg =
      json?.message ||
      json?.error ||
      (text?.startsWith("<!DOCTYPE") ? `Request failed (${res.status}) - CSRF/session issue` : `Request failed (${res.status}) at ${url}`);
    throw new Error(msg);
  }

  return json as T;
}

export function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/auth/me");
}

export function apiLogout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/auth/logout", { method: "POST" });
}
