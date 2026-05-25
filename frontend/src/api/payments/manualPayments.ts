import { apiFetch } from "../core/auth";

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
  payee_user_id?: number | null;
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

export type ManualPaymentTemplateOptionsResponse = {
  ok: true;
  data: {
    default_payee: {
      id: number;
      handle: string | null;
      swc_character_id: number | null;
      swc_uid: string | null;
      avatar_url: string | null;
    } | null;
    users: Array<{
      id: number;
      handle: string | null;
      swc_character_id: number | null;
      swc_uid: string | null;
      avatar_url: string | null;
    }>;
    payer_options: Array<{
      key: string;
      payer_subject_type: "user" | "faction";
      payer_subject_id: number | null;
      label: string;
      source?: string;
    }>;
    payer_debug?: Array<{
      type: "user" | "faction";
      id: number | null;
      name: string;
      swc_uid?: number | null;
      allowed: boolean;
      source: string;
      message?: string | null;
      local_allowed?: boolean;
      swc_check?: {
        ok: boolean;
        allowed: boolean;
        status?: number | null;
        source?: string | null;
        checked_at?: string | null;
      } | null;
    }>;
  };
};

export async function getManualPaymentTemplates() {
  return apiFetch<{ ok: true; data: ManualPaymentTemplate[] }>(
    `/manual-payment-templates`
  );
}

export async function getManualPaymentTemplateOptions() {
  return apiFetch<ManualPaymentTemplateOptionsResponse>(
    `/manual-payment-templates/options`
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

export async function toggleManualPaymentTemplate(id: number) {
  return apiFetch<{ ok: true; data: ManualPaymentTemplate }>(
    `/manual-payment-templates/${id}/toggle`,
    {
      method: "POST",
    }
  );
}

export async function generateManualPaymentTemplate(id: number) {
  return apiFetch<{
    ok: true;
    data: {
      template: ManualPaymentTemplate;
      payment_item: {
        id: number;
        payer_subject_type: "user" | "faction";
        payer_subject_id: number | null;
        payer_label: string | null;
        payee_handle: string | null;
        total_amount: number;
        status: string;
      } | null;
    };
  }>(
    `/manual-payment-templates/${id}/generate`,
    {
      method: "POST",
    }
  );
}
