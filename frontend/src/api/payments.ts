import { apiFetch } from "./auth";

export type PaymentItem = {
  id: number;
  tool_key: string;
  source_type: string;
  source_id: number;
  payer_subject_type: "user" | "faction";
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
  payer_subject_type: "user" | "faction";
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
  items?: PaymentItem[];
};

export async function getPayments() {
  return apiFetch<{ ok: true; data: PaymentItem[] }>(`/payments`);
}

export async function getPaymentsOwedToMe() {
  return apiFetch<{ ok: true; data: PaymentItem[] }>(`/payments/owed-to-me`);
}

export async function getPaymentTransfers() {
  return apiFetch<{ ok: true; data: PaymentTransfer[] }>(`/payment-transfers`);
}

export async function buildSinglePayment(payment_item_ids: number[]) {
  return apiFetch<{ ok: true; data: { transfer: PaymentTransfer; url: string } }>(`/payments/build-single`, {
    method: "POST",
    body: JSON.stringify({ payment_item_ids }),
  });
}

export async function buildBulkPayment(payment_item_ids: number[]) {
  return apiFetch<{
    ok: true;
    data: {
      transfers: PaymentTransfer[];
      bulk_page_url: string | null;
      pipe_lines: string;
    };
  }>(`/payments/build-bulk`, {
    method: "POST",
    body: JSON.stringify({ payment_item_ids }),
  });
}