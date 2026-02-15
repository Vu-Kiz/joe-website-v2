// src/api/auth.ts
export interface SwcUser {
  id: number;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  is_joe_member: boolean;
  is_admin: boolean;
  is_sysadmin: boolean;
  is_intel: boolean;
  is_garry: boolean;
  is_raid: boolean;
}

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Full API base, e.g. "https://dev-v2-api.swc-joe.com/api"
 * Always without trailing slash.
 */
export function getBackendBaseUrl(): string {
  return RAW_API_BASE.replace(/\/+$/, "");
}

/**
 * Backend origin *without* `/api`, e.g.
 *   "https://dev-v2-api.swc-joe.com"
 *
 * Used for non-API web routes like /oauth.
 */
export function getBackendOrigin(): string {
  return getBackendBaseUrl().replace(/\/api\/?$/, "");
}

export interface AuthMeResponse {
  ok: boolean;
  user: SwcUser | null;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/auth/me`, {
    credentials: "include",
  });

  if (!res.ok) {
    return { ok: false, user: null };
  }

  return res.json();
}

export async function apiLogout(): Promise<void> {
  const base = getBackendBaseUrl();
  await fetch(`${base}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
