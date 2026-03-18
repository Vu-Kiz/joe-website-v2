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
  items?: PaymentItem[];
};

export type PaymentsResponse = {
  ok: true;
  data: PaymentItem[];
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

export async function getPayments() {
  return apiFetch<PaymentsResponse>("/payments");
}

export async function getPaymentsOwedToMe() {
  return apiFetch<PaymentsResponse>("/payments/owed-to-me");
}

export async function getPaymentTransfers() {
  return apiFetch<PaymentTransfersResponse>("/payment-transfers");
}

export async function buildSinglePayment(payment_item_ids: number[]) {
  return apiFetch<BuildSinglePaymentResponse>("/payments/build-single", {
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