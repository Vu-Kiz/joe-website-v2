import { apiFetch } from "./auth";

export type DebugSwcAuthResponse = {
  ok: boolean;
  data: {
    user: {
      id: number;
      swc_handle: string | null;
      swc_character_id: number | null;
      is_sysadmin?: boolean;
    };
    authorization: {
      exists: boolean;
      granted_scopes: string | null;
      has_personal_events_access: boolean;
      has_personal_credit_log_access: boolean;
      has_faction_credit_log_access: boolean;
      has_character_privileges_access: boolean;
      token_expires_at: string | null;
      last_verified_at: string | null;
      revoked_at: string | null;
      has_access_token: boolean;
      has_refresh_token: boolean;
      events_authorization?: {
        exists: boolean;
        granted_scopes: string | null;
        token_expires_at: string | null;
        last_verified_at: string | null;
        revoked_at: string | null;
        has_access_token: boolean;
        has_refresh_token: boolean;
      };
    };
    factions: Array<{
      id: number;
      name: string;
      swc_uid: number | null;
      abbreviation?: string | null;
      pivot: {
        can_view_payments: boolean;
        can_pay_from_faction?: boolean;
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
      debug_scope?: string | null;
      access_type: string | null;
      events_access_type: string | null;
      debug_access_type?: string | null;
    };
  };
};

export type DebugPaymentsResponse = {
  ok: boolean;
  data: {
    user: {
      id: number;
      swc_handle: string | null;
      swc_character_id?: number | null;
    };
    visible_faction_ids?: number[];
    pending_items: any[];
    transfers: any[];
  };
};

export type DebugFactionsResponse = {
  ok: boolean;
  data: Array<{
    id: number;
    name: string;
    swc_uid: number | null;
    abbreviation: string | null;
  }>;
};

export type DebugRawSwcResponse = {
  ok: boolean;
  status: number;
  target_user?: {
    id: number;
    swc_handle: string | null;
    swc_character_id: number | null;
  };
  url: string;
  query: Record<string, string>;
  body: string | null;
  json: any;
  creditlog_summary?: {
    resource: string;
    request: string | null;
    page_transaction_count: number;
    transactions_attributes?: Record<string, unknown> | null;
    swcapi_attributes?: Record<string, unknown> | null;
    first_transaction_id?: string | number | null;
    last_transaction_id?: string | number | null;
  } | null;
};

export type DebugEventsHistoryResponse = {
  ok: boolean;
  status: number;
  target_user?: {
    id: number;
    swc_handle: string | null;
    swc_character_id: number | null;
  };
  url: string;
  query: Record<string, string>;
  pages: Array<{
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
    imported: Array<{
      record_id: number;
      uid: string | null;
      galx: number;
      galy: number;
      square_name: string | null;
      has_asteroids: boolean;
      legacy_recorded_at: string | null;
    }>;
  };
};

export type DebugFactionPrivilegeResponse = {
  ok: boolean;
  status: number;
  target_user?: {
    id: number;
    swc_handle: string | null;
    swc_character_id: number | null;
  };
  url: string;
  query: {
    faction_id: string;
  };
  body: string | null;
  json: any;
};

export type DebugTestPaymentResponse = {
  ok: boolean;
  mode: "transfer" | "manual";
  target_user?: {
    id: number;
    swc_handle: string | null;
    swc_character_id: number | null;
  };
  transfer?: {
    id: number;
    reference: string;
    payer_subject_type: "user" | "faction";
    payer_subject_id: number | null;
    payee_swc_uid: string | null;
    payee_handle: string | null;
    total_amount: number;
    communication: string | null;
    status: string;
  };
  manual_preview?: {
    receiver_handle: string | null;
    receiver_uid: string | null;
    reference: string | null;
    communication_prefix: string | null;
    generated_communication: string | null;
    payment_url: string | null;
  };
  inspection: {
    ok: boolean;
    matched: boolean;
    transfer_reference?: string | null;
    expected: {
      payer_subject_type: "user" | "faction";
      payer_subject_id: number;
      amount: number;
      receiver_uid: string;
      communication: string;
    };
    matched_transaction: any | null;
    searched_transaction_count: number;
    near_matches: Array<{
      score: number;
      summary: any;
    }>;
    searched_transactions_preview: any[];
  };
};

export type DebugPullCreditLogResponse = {
  ok: boolean;
  target_user?: {
    id: number;
    swc_handle: string | null;
    swc_character_id: number | null;
  };
  data: {
    ok: boolean;
    processed: number;
    verified: number;
    already_verified: number;
    unmatched: number;
    errors: number;
    contexts_loaded: number;
    message: string;
    matches: any[];
    failures: any[];
  };
};

export type DebugUniversePullResponse = {
  ok: boolean;
  message: string;
  data: any;
  persistence?: any;
};

export type DebugRuntimeResponse = {
  ok: boolean;
  data: {
    app_env: string | null;
    app_debug: boolean;
    app_url: string | null;
    request_host: string | null;
    request_scheme: string | null;
    pull_service_guard_present: boolean;
    pull_service_hash: string | null;
  };
};

export type DebugCombatSettingsResponse = {
  ok: boolean;
  data: {
    ship_classes: string[];
    weapon_damage_types: string[];
    ship_damage_type_modifiers: Record<string, number>;
    ship_class_modifiers: Record<string, Record<string, Record<string, number>>>;
  };
};

export type SectorCellAnnotation = {
  id?: number;
  sector_uid: string;
  galx: number;
  galy: number;
  marker_type: string | null;
  label: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

function withOptionalUserId(params: URLSearchParams, userId?: number) {
  if (userId && Number.isFinite(userId) && userId > 0) {
    params.set("user_id", String(userId));
  }
  return params;
}

export function getDebugSwcAuth(userId?: number) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  const qs = params.toString();
  return apiFetch<DebugSwcAuthResponse>(`/sys/debug/swc-auth${qs ? `?${qs}` : ""}`);
}

export function getDebugRuntime() {
  return apiFetch<DebugRuntimeResponse>(`/sys/debug/runtime`);
}

export function getDebugCombatSettings() {
  return apiFetch<DebugCombatSettingsResponse>(`/sys/debug/combat-settings`);
}

export function updateDebugCombatSettings(payload: {
  ship_damage_type_modifiers: Record<string, number>;
  ship_class_modifiers: Record<string, Record<string, Record<string, number>>>;
}) {
  return apiFetch<DebugCombatSettingsResponse>(`/sys/debug/combat-settings`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getDebugPayments(userId?: number) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  const qs = params.toString();
  return apiFetch<DebugPaymentsResponse>(`/sys/debug/payments${qs ? `?${qs}` : ""}`);
}

export function getDebugFactions() {
  return apiFetch<DebugFactionsResponse>(`/sys/debug/factions`);
}

export function getDebugRawSwc(
  path: string,
  queryParams?: Record<string, string>,
  userId?: number,
  authContext?: "member_tools" | "payments" | "events" | "debug"
) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  params.set("path", path);
  if (authContext) {
    params.set("auth_context", authContext);
  }

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (key.trim() && value != null) {
        params.set(key, String(value));
      }
    }
  }

  return apiFetch<DebugRawSwcResponse>(`/sys/debug/raw-swc?${params.toString()}`);
}

export function getDebugEventsHistory(
  path: string,
  queryParams?: Record<string, string>,
  userId?: number
) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  params.set("path", path);

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (key.trim() && value != null) {
        params.set(key, String(value));
      }
    }
  }

  return apiFetch<DebugEventsHistoryResponse>(`/sys/debug/events-history?${params.toString()}`);
}

export function importDebugEventsHistory(
  path: string,
  queryParams?: Record<string, string>,
  userId?: number
) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  const qs = params.toString();

  return apiFetch<DebugEventsHistoryResponse>(
    `/sys/debug/events-history/import${qs ? `?${qs}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify({
        path,
        query: queryParams ?? {},
      }),
    }
  );
}

export function testFactionPrivilege(
  group: string,
  privilege: string,
  factionId: number | string,
  authContext?: "member_tools" | "payments" | "events" | "debug",
  userId?: number
) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  params.set("group", group);
  params.set("privilege", privilege);
  params.set("faction_id", String(factionId));
  if (authContext) {
    params.set("auth_context", authContext);
  }

  return apiFetch<DebugFactionPrivilegeResponse>(
    `/sys/debug/test-faction-privilege?${params.toString()}`
  );
}

export function testPaymentTransfer(paymentTransferId: number, userId?: number) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  const qs = params.toString();

  return apiFetch<DebugTestPaymentResponse>(
    `/sys/debug/test-payment${qs ? `?${qs}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify({
        payment_transfer_id: paymentTransferId,
      }),
    }
  );
}

export function testManualPayment(
  payload: {
    payer_subject_type: "user" | "faction";
    payer_subject_id: number;
    amount: number;
    receiver_handle?: string;
    receiver_uid?: string;
    reference?: string;
    communication_prefix?: string;
    communication?: string;
    item_count?: number;
  },
  userId?: number
) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  const qs = params.toString();

  return apiFetch<DebugTestPaymentResponse>(
    `/sys/debug/test-payment${qs ? `?${qs}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function pullDebugCreditLog(userId?: number) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  const qs = params.toString();

  return apiFetch<DebugPullCreditLogResponse>(
    `/sys/debug/pull-credit-log${qs ? `?${qs}` : ""}`,
    {
      method: "POST",
    }
  );
}

export function runUniversePull(
  payload: {
    resource: "system" | "sector" | "planet" | "station";
    identifier: string;
    persist?: boolean;
    deep?: boolean;
  }
) {
  return apiFetch<DebugUniversePullResponse>(`/sys/universe/pull`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runUniversePullAllSectors() {
  return apiFetch<DebugUniversePullResponse>(`/sys/universe/pull-all-sectors`, {
    method: "POST",
  });
}

export function getSectorCellAnnotations(sectorUid: string) {
  const params = new URLSearchParams({ sector_uid: sectorUid });
  return apiFetch<{ ok: boolean; data: SectorCellAnnotation[] }>(
    `/sys/universe/cell-annotations?${params.toString()}`
  );
}

export function saveSectorCellAnnotation(payload: {
  sector_uid: string;
  galx: number;
  galy: number;
  marker_type?: string | null;
  label?: string | null;
  notes?: string | null;
}) {
  return apiFetch<{ ok: boolean; message: string; data: SectorCellAnnotation | null }>(
    `/sys/universe/cell-annotations`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
