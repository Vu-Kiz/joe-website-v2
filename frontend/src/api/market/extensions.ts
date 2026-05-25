import { apiFetch } from "../core/auth";

export type WreckingHelperSettingsResponse = {
  ok: boolean;
  prefix: string;
  updated_at?: string | null;
};

export type WreckingHelperTokenResponse = {
  ok: boolean;
  token: string;
  token_name: string;
};

export type WreckingHelperTokenRevokeResponse = {
  ok: boolean;
  revoked_count: number;
};

export async function getWreckingHelperSettings(): Promise<WreckingHelperSettingsResponse> {
  return apiFetch<WreckingHelperSettingsResponse>("/extension/wrecking-helper/settings", {
    method: "GET",
  });
}

export async function updateWreckingHelperSettings(prefix: string): Promise<WreckingHelperSettingsResponse> {
  return apiFetch<WreckingHelperSettingsResponse>("/extension/wrecking-helper/settings", {
    method: "PUT",
    body: JSON.stringify({ prefix }),
  });
}

export async function issueWreckingHelperToken(): Promise<WreckingHelperTokenResponse> {
  return apiFetch<WreckingHelperTokenResponse>("/extension/wrecking-helper/token", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function revokeWreckingHelperToken(): Promise<WreckingHelperTokenRevokeResponse> {
  return apiFetch<WreckingHelperTokenRevokeResponse>("/extension/wrecking-helper/token", {
    method: "DELETE",
  });
}
