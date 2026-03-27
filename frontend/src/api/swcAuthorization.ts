import { apiFetch } from "./auth";

export type SwcAuthorizationStatus = {
  member_tool_preferences?: {
    galaxy: boolean;
    payments: boolean;
  };
  connected: boolean;
  member_tools_connected?: boolean;
  payments_connected?: boolean;
  events_connected?: boolean;
  has_personal_events_access: boolean;
  has_personal_credit_log_access: boolean;
  has_faction_credit_log_access: boolean;
  has_character_privileges_access: boolean;
  granted_scopes: string | null;
  token_expires_at: string | null;
  last_verified_at: string | null;
  revoked_at: string | null;
  events_granted_scopes?: string | null;
  events_token_expires_at?: string | null;
  events_last_verified_at?: string | null;
  events_revoked_at?: string | null;
};

export async function getSwcAuthorizationStatus() {
  return apiFetch<{ ok: true; data: SwcAuthorizationStatus }>(
    `/swc/authorization`
  );
}

export async function updateSwcAuthorizationPreferences(memberToolPreferences: {
  galaxy: boolean;
  payments: boolean;
}) {
  return apiFetch<{
    ok: true;
    data: {
      member_tool_preferences: {
        galaxy: boolean;
        payments: boolean;
      };
    };
  }>(`/swc/authorization/preferences`, {
    method: "PUT",
    body: JSON.stringify({
      member_tool_preferences: memberToolPreferences,
    }),
  });
}

export type SwcPersonalEventsImportResponse = {
  ok: boolean;
  status: number;
  url?: string;
  query?: Record<string, string>;
  pages?: Array<{
    page: number;
    start_index: number;
    count: number;
    status: number;
    ok: boolean;
  }>;
  history?: {
    events_seen: number;
    events_matched: number;
    earliest_timestamp: number | null;
    latest_timestamp: number | null;
    matches: Array<{
      index: number;
      uid: string | null;
      type: string | null;
      timestamp: string | null;
      square_name: string | null;
      system_id: string | null;
      galx: number | null;
      galy: number | null;
      has_asteroids: boolean;
      text: string;
    }>;
  };
  import?: {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    skipped_no_coordinates: number;
  };
};

export async function importSwcPersonalEvents() {
  return apiFetch<SwcPersonalEventsImportResponse>(
    `/universe/search-records/import-personal-events`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}
