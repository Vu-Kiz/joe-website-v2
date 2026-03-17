import { apiFetch } from "./auth";

export type SwcAuthorizationStatus = {
  connected: boolean;
  has_personal_credit_log_access: boolean;
  has_faction_credit_log_access: boolean;
  has_character_privileges_access: boolean;
  granted_scopes: string | null;
  token_expires_at: string | null;
};

export async function getSwcAuthorizationStatus() {
  return apiFetch<{ ok: true; data: SwcAuthorizationStatus }>(
    `/swc/authorization`
  );
}