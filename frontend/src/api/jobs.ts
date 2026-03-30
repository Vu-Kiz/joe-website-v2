import { apiFetch } from "./auth";

export type Job = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  job_mode: "single" | "multi" | "open_ended";
  pay_type: "fixed" | "per_day_hyper";
  reward_amount: number;
  bonus_amount: number;
  bonus_reward: string | null;
  bonus_note: string | null;
  payer_subject_type: "user" | "faction";
  payer_subject_id: number | null;
  payer_label: string | null;
  created_by_user_id: number;
  created_by_handle: string;
  assigned_to_user_id: number | null;
  assigned_to_handle: string | null;
  days_taken: number | null;
  completed_at: string | null;
  closed_at: string | null;
  meta?: Record<string, unknown> | null;
  assignments?: JobAssignment[];
};

export type JobAssignment = {
  id: number;
  job_id: number;
  worker_user_id: number | null;
  worker_swc_uid: string;
  worker_handle: string;
  status: string;
  days_taken: number | null;
  completed_at: string | null;
  meta?: Record<string, unknown> | null;
};

export async function getJobs(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return apiFetch<{ ok: true; data: Job[] }>(`/jobs${query}`);
}

export async function getJob(id: number) {
  return apiFetch<{ ok: true; data: Job }>(`/jobs/${id}`);
}

export async function createJob(payload: Record<string, unknown>) {
  return apiFetch<{ ok: true; data: Job }>(`/jobs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function takeJob(id: number) {
  return apiFetch<{ ok: true; data: Job }>(`/jobs/${id}/take`, {
    method: "POST",
  });
}

export async function completeJob(id: number, days_taken?: number, include_bonus?: boolean) {
  return apiFetch<{ ok: true; data: Job }>(`/jobs/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ days_taken, include_bonus }),
  });
}

export async function setJobBonus(id: number, include_bonus: boolean) {
  return apiFetch<{ ok: true; data: Job }>(`/jobs/${id}/bonus`, {
    method: "POST",
    body: JSON.stringify({ include_bonus }),
  });
}

export async function closeJob(id: number) {
  return apiFetch<{ ok: true; data: Job }>(`/jobs/${id}/close`, {
    method: "POST",
  });
}

export async function joinJob(id: number) {
  return apiFetch<{ ok: true; data: JobAssignment }>(`/jobs/${id}/join`, {
    method: "POST",
  });
}

export async function completeAssignment(id: number, days_taken?: number, include_bonus?: boolean) {
  return apiFetch<{ ok: true; data: JobAssignment }>(`/job-assignments/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ days_taken, include_bonus }),
  });
}

export async function setAssignmentBonus(id: number, include_bonus: boolean) {
  return apiFetch<{ ok: true; data: JobAssignment }>(`/job-assignments/${id}/bonus`, {
    method: "POST",
    body: JSON.stringify({ include_bonus }),
  });
}
