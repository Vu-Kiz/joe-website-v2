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
      has_personal_credit_log_access: boolean;
      has_faction_credit_log_access: boolean;
      has_character_privileges_access: boolean;
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

  return apiFetch<DebugRawSwcResponse>(`/sys/debug/raw-swc?${params.toString()}`);
}

export function testFactionPrivilege(
  group: string,
  privilege: string,
  factionId: number | string,
  userId?: number
) {
  const params = withOptionalUserId(new URLSearchParams(), userId);
  params.set("group", group);
  params.set("privilege", privilege);
  params.set("faction_id", String(factionId));

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
    receiver_uid?: string;
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