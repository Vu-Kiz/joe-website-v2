import { apiFetch } from "./auth";

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

export async function getManualPaymentTemplates() {
  return apiFetch<{ ok: true; data: ManualPaymentTemplate[] }>(
    `/manual-payment-templates`
  );
}

export async function createManualPaymentTemplate(
  payload: ManualPaymentTemplateFormPayload
) {
  return apiFetch<{ ok: true; data: ManualPaymentTemplate }>(
    `/manual-payment-templates`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateManualPaymentTemplate(
  id: number,
  payload: Partial<ManualPaymentTemplateFormPayload> & {
    status?: "active" | "paused";
  }
) {
  return apiFetch<{ ok: true; data: ManualPaymentTemplate }>(
    `/manual-payment-templates/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteManualPaymentTemplate(id: number) {
  return apiFetch<{ ok: true; message: string }>(
    `/manual-payment-templates/${id}`,
    {
      method: "DELETE",
    }
  );
}