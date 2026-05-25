import { apiFetch } from "../core/auth";

export type SiteLockMeta = {
  enabled: boolean;
  message: string;
  updated_at: string;
  updated_by: string;
};

export type SiteLockResponse = {
  ok: boolean;
  site_lock: SiteLockMeta;
  message?: string;
};

export type SiteLockStatusResponse = {
  ok: true;
  site_lock: {
    enabled: boolean;
    message: string;
  };
  is_authenticated: boolean;
  can_bypass: boolean;
};

export function getSiteLock(): Promise<SiteLockResponse> {
  return apiFetch<SiteLockResponse>("/admin/site-lock");
}

export function updateSiteLock(payload: {
  enabled: boolean;
  message: string;
}): Promise<SiteLockResponse> {
  return apiFetch<SiteLockResponse>("/admin/site-lock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchSiteLockStatus(): Promise<SiteLockStatusResponse> {
  return apiFetch<SiteLockStatusResponse>("/site-lock-status");
}