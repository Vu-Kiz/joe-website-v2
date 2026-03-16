import { apiFetch } from "./auth";

export type DebugSwcAuthResponse = {
  ok: true;
  data: {
    user: {
      id: number;
      swc_handle: string | null;
      swc_character_id: number | null;
    };
    authorization: {
      exists: boolean;
      granted_scopes: string | null;
      has_personal_events_access: boolean;
      has_faction_events_access: boolean;
      token_expires_at: string | null;
      last_verified_at: string | null;
      revoked_at: string | null;
      has_access_token: boolean;
      has_refresh_token: boolean;
    };
    factions: Array<{
      id: number;
      name: string;
      swc_uid: number | null;
      pivot: {
        can_view_payments: boolean;
        can_mark_payments_paid: boolean;
        can_manage_jobs: boolean;
      };
    }>;
    config: {
      authorize_url: string | null;
      token_url: string | null;
      api_base: string | null;
      redirect_uri: string | null;
      default_scope: string | null;
      events_scope: string | null;
      access_type: string | null;
      events_access_type: string | null;
    };
  };
};

export type DebugPaymentsResponse = {
  ok: true;
  data: {
    user: {
      id: number;
      swc_handle: string | null;
    };
    pending_items: any[];
    transfers: any[];
  };
};

export type DebugFactionsResponse = {
  ok: true;
  data: Array<{
    id: number;
    name: string;
    swc_uid: number | null;
    abbreviation: string | null;
  }>;
};

export function getDebugSwcAuth(userId?: number) {
  const qs = userId ? `?user_id=${userId}` : "";
  return apiFetch<DebugSwcAuthResponse>(`/sys/debug/swc-auth${qs}`);
}

export function getDebugPayments(userId?: number) {
  const qs = userId ? `?user_id=${userId}` : "";
  return apiFetch<DebugPaymentsResponse>(`/sys/debug/payments${qs}`);
}

export function getDebugFactions() {
  return apiFetch<DebugFactionsResponse>(`/sys/debug/factions`);
}

export function testFactionPrivilege(
  group: string,
  privilege: string,
  factionId: number | string
) {
  const params = new URLSearchParams({
    group,
    privilege,
    faction_id: String(factionId),
  });

  return apiFetch<any>(`/sys/debug/test-faction-privilege?${params.toString()}`);
}