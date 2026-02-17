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

function envString(name: string): string {
  const v = (import.meta as any).env?.[name] as string | undefined;
  return (v ?? "").trim();
}

/**
 * API base for JSON calls (should include /api)
 * Example: https://dev-v2-api.swc-joe.com/api
 */
export function getApiBaseUrl(): string {
  return envString("VITE_API_BASE_URL").replace(/\/+$/, "");
}

/**
 * Backend ORIGIN for browser redirects (must NOT include /api)
 * Example: https://dev-v2-api.swc-joe.com
 */
export function getBackendOrigin(): string {
  const api = getApiBaseUrl();
  if (!api) return "";

  // Remove a trailing "/api" or "/api/" only (does not touch "/api/v2" etc.)
  return api.replace(/\/api\/?$/, "");
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is missing");

  const url = joinUrl(base, path);

  // Only set JSON content-type if we actually send a body.
  const hasBody = init.body != null;
  const headers: Record<string, string> = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...init,
    credentials: "include", // required for Laravel session cookies
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  const isJson = contentType.includes("application/json");
  const json = isJson && text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;

  if (!res.ok) {
    const msg =
      (json as any)?.error ||
      (json as any)?.message ||
      (text ? text.slice(0, 200) : "") ||
      `Request failed (${res.status}) at ${url}`;
    throw new Error(msg);
  }

  // If backend returns non-json for some reason, keep it explicit
  if (!isJson) {
    // Most of your API should be JSON. If you ever hit this, you’ll know why.
    throw new Error(`Expected JSON but got "${contentType}" from ${url}`);
  }

  return (json as T) ?? ({} as T);
}

export function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/auth/me");
}

export function apiLogout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/auth/logout", { method: "POST" });
}
export function fetchAuthAbout(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/auth/about");
}