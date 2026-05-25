import { apiFetch } from "../core/auth";

export type JobPayRate = {
  id: number;
  name: string;
  description: string | null;
  unit_label: string;
  base_rate: number;
  bonus_rate: number | null;
  bonus_description: string | null;
  payer_subject_type: "user" | "faction";
  payer_subject_id: number | null;
  payer_label: string | null;
  status: "active" | "inactive";
  created_by_user_id: number | null;
  created_at?: string;
  updated_at?: string;
};

export type JobPayClaim = {
  id: number;
  job_pay_rate_id: number;
  claimant_user_id: number;
  claimant_swc_uid: string | null;
  claimant_handle: string | null;
  quantity: number;
  include_bonus: boolean;
  base_total: number;
  bonus_total: number;
  total_amount: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  review_note: string | null;
  payment_item_id: number | null;
  pay_rate?: JobPayRate | null;
  created_at?: string;
  updated_at?: string;
};

export async function getJobPayRates() {
  return apiFetch<{ ok: true; data: JobPayRate[] }>("/job-pay-rates");
}

export async function createJobPayRate(payload: Partial<JobPayRate>) {
  return apiFetch<{ ok: true; data: JobPayRate }>("/job-pay-rates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateJobPayRate(id: number, payload: Partial<JobPayRate>) {
  return apiFetch<{ ok: true; data: JobPayRate }>(`/job-pay-rates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteJobPayRate(id: number) {
  return apiFetch<{ ok: true }>(`/job-pay-rates/${id}`, { method: "DELETE" });
}

export async function getJobPayClaims(params?: { status?: string }) {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return apiFetch<{ ok: true; data: JobPayClaim[] }>(`/job-pay-claims${query}`);
}

export async function submitJobPayClaim(payload: {
  job_pay_rate_id: number;
  quantity: number;
  include_bonus?: boolean;
  notes?: string;
}) {
  return apiFetch<{ ok: true; data: JobPayClaim }>("/job-pay-claims", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveJobPayClaim(id: number, review_note?: string) {
  return apiFetch<{ ok: true; data: JobPayClaim }>(`/job-pay-claims/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ review_note: review_note ?? null }),
  });
}

export async function rejectJobPayClaim(id: number, review_note?: string) {
  return apiFetch<{ ok: true; data: JobPayClaim }>(`/job-pay-claims/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ review_note: review_note ?? null }),
  });
}
