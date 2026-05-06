import { apiFetch } from "./auth";

export type PaymentSubjectType = "user" | "faction";

export type PaymentItem = {
  id: number;
  tool_key: string;
  source_type: string;
  source_id: number;
  payer_subject_type: PaymentSubjectType;
  payer_subject_id: number | null;
  payer_label: string | null;
  payee_subject_type: "user";
  payee_subject_id: number | null;
  payee_swc_uid: string | null;
  payee_handle: string | null;
  payee_label: string | null;
  amount: number;
  bonus_amount: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
  meta?: Record<string, unknown>;
};

export type PaymentTransfer = {
  id: number;
  payer_subject_type: PaymentSubjectType;
  payer_subject_id: number | null;
  payer_label: string | null;
  payee_subject_type: "user";
  payee_subject_id: number | null;
  payee_swc_uid: string | null;
  payee_handle: string | null;
  payee_label: string | null;
  total_amount: number;
  reference: string;
  communication: string | null;
  payment_method: string;
  status: string;
  opened_at: string | null;
  verified_at: string | null;
  paid_at: string | null;
  verified_transaction_id?: number | null;
  meta?: Record<string, unknown> | null;
  items?: PaymentItem[];
};

export type PaymentsResponse = {
  ok: true;
  data: PaymentItem[];
};

export type PendingPaymentsCountResponse = {
  ok: true;
  data: {
    count: number;
    has_pending: boolean;
  };
};

export type PaymentTransfersResponse = {
  ok: true;
  data: PaymentTransfer[];
};

export type BuildSinglePaymentResponse = {
  ok: true;
  data: {
    transfer: PaymentTransfer;
    url: string;
  };
};

export type SendSinglePaymentResponse = {
  ok: true;
  data: {
    message: string;
    transaction_id: number | null;
  };
  transfer: PaymentTransfer;
};

export type SendBulkPaymentResponse = {
  ok: true;
  data: {
    processed: number;
    sent: number;
    failed: number;
    message: string;
    results: Array<{
      transfer_id: number;
      reference: string;
      payee: string | null;
      amount: number;
      ok: boolean;
      transaction_id?: number | null;
      error?: string;
    }>;
  };
};

export type BuildBulkPaymentResponse = {
  ok: true;
  data: {
    transfers: PaymentTransfer[];
    bulk_page_url: string | null;
    pipe_lines: string;
  };
};

export type VerifyPaymentTransferResponse = {
  ok: boolean;
  data: {
    ok: boolean;
    already_verified: boolean;
    matched_transaction_id: number | null;
    message: string;
  };
  transfer: PaymentTransfer;
};

export type PullCreditLogResponse = {
  ok: boolean;
  data: {
    ok: boolean;
    processed: number;
    verified: number;
    already_verified: number;
    unmatched: number;
    errors: number;
    contexts_loaded: number;
    message: string;
    matches: Array<{
      transfer_id: number;
      reference: string;
      transaction_id: number;
      payee: string | null;
      amount: number;
      context: string;
    }>;
    failures: Array<{
      transfer_id: number;
      reference: string;
      payee?: string | null;
      amount?: number;
      error?: string;
      context: string;
    }>;
  };
};

export type DroidBrainPaymentSettingsResponse = {
  ok: true;
  data: {
    settings: {
      default_payer_faction_id: number | null;
    };
    payer_options: Array<{
      id: number;
      name: string;
      swc_uid: string | null;
      abbreviation: string | null;
    }>;
  };
};

export async function getPayments() {
  return apiFetch<PaymentsResponse>("/payments");
}

export async function getPendingPaymentsCount() {
  return apiFetch<PendingPaymentsCountResponse>("/payments/pending-count");
}

export async function getPaymentsOwedToMe() {
  return apiFetch<PaymentsResponse>("/payments/owed-to-me");
}

export async function getPaymentTransfers() {
  return apiFetch<PaymentTransfersResponse>("/payment-transfers");
}

export async function getUnverifiedSupportTransfers() {
  return apiFetch<PaymentTransfersResponse>("/payment-transfers/unverified-support");
}

export async function buildSinglePayment(payment_item_ids: number[]) {
  return apiFetch<BuildSinglePaymentResponse>("/payments/build-single", {
    method: "POST",
    body: JSON.stringify({ payment_item_ids }),
  });
}

export async function sendSinglePayment(payment_item_ids: number[]) {
  return apiFetch<SendSinglePaymentResponse>("/payments/send-single", {
    method: "POST",
    body: JSON.stringify({ payment_item_ids }),
  });
}

export async function sendBulkPayment(payment_item_ids: number[]) {
  return apiFetch<SendBulkPaymentResponse>("/payments/send-bulk", {
    method: "POST",
    body: JSON.stringify({ payment_item_ids }),
  });
}

export async function buildBulkPayment(payment_item_ids: number[]) {
  return apiFetch<BuildBulkPaymentResponse>("/payments/build-bulk", {
    method: "POST",
    body: JSON.stringify({ payment_item_ids }),
  });
}

export async function verifyPaymentTransfer(id: number) {
  return apiFetch<VerifyPaymentTransferResponse>(
    `/payment-transfers/${id}/verify`,
    {
      method: "POST",
    }
  );
}

export async function manualVerifyPaymentTransfer(
  id: number,
  payload: {
    swc_transaction_id?: number | null;
    note?: string | null;
  }
) {
  return apiFetch<VerifyPaymentTransferResponse>(
    `/payment-transfers/${id}/manual-verify`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function pullCreditLog() {
  return apiFetch<PullCreditLogResponse>("/payments/pull-credit-log", {
    method: "POST",
  });
}

export async function getDroidBrainPaymentSettings() {
  return apiFetch<DroidBrainPaymentSettingsResponse>("/payments/droidbrain-settings");
}

export async function updateDroidBrainPaymentSettings(payload: {
  default_payer_faction_id: number | null;
}) {
  return apiFetch<{ ok: true; data: { default_payer_faction_id: number | null } }>(
    "/payments/droidbrain-settings",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}
