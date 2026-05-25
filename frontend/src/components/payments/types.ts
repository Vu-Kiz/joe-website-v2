import type { PaymentItem } from "../../api/payments/payments";

export type PaymentsView = "pending" | "owed" | "history" | "templates" | "droidbrain";

export type PaymentGroup = {
  key: string;
  items: PaymentItem[];
  total: number;
  payee: string;
  payer: string;
  payerType: "user" | "faction";
  payerSubjectId: number | null;
};

export type PaymentsActionState = {
  working: boolean;
  message: string | null;
  error: string | null;
};

export type ManualPaymentTemplate = {
  id: number;
  name: string;

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

  frequency: "monthly";
  day_of_month: number;

  start_date: string;
  end_date: string | null;

  communication_prefix: string | null;
  notes: string | null;

  status: "active" | "paused";
  last_generated_period: string | null;

  meta?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type ManualPaymentTemplateFormPayload = {
  name: string;

  payer_subject_type: "user" | "faction";
  payer_subject_id: number | null;
  payer_label?: string | null;

  payee_subject_type: "user";
  payee_subject_id: number | null;
  payee_swc_uid?: string | null;
  payee_handle?: string | null;
  payee_label?: string | null;

  amount: number;
  bonus_amount?: number;

  frequency: "monthly";
  day_of_month: number;

  start_date: string;
  end_date?: string | null;

  communication_prefix?: string | null;
  notes?: string | null;

  status?: "active" | "paused";
};
