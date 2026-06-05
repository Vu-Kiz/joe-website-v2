import { apiFetch } from "../core/auth";

export type AdminWorkerHealthState = {
  status: "ok" | "warn" | "error" | string;
  generated_at: string | null;
  queue: {
    status: "ok" | "warn" | "error" | string;
    default_connection: string | null;
    driver: string | null;
    pending_total: number | null;
    reserved_total: number | null;
    oldest_pending_seconds: number | null;
    by_queue: Array<{
      queue: string;
      pending: number;
      reserved: number;
      oldest_waiting_seconds: number | null;
      warn_threshold_seconds: number;
      status: "ok" | "warn" | "error" | string;
    }>;
    error: string | null;
  };
  failed_jobs: {
    status: "ok" | "warn" | "error" | string;
    total: number | null;
    recent: number | null;
    recent_window_hours: number | null;
    last_failed_at: string | null;
    latest: Array<{
      id: number;
      connection: string;
      queue: string;
      failed_at: string | null;
      job_name: string;
      error_summary: string;
    }>;
    error: string | null;
  };
  droidbrain_upload_queue: {
    status: "ok" | "warn" | "error" | string;
    counts: Record<string, number>;
    stuck_count: number;
    recent_failed: Array<{
      id: number;
      file_name: string;
      error_message: string | null;
      processed_at: string | null;
      updated_at: string | null;
    }>;
    error: string | null;
  };
  droidbrain_payment_queue: {
    status: "ok" | "warn" | "error" | string;
    counts: Record<string, number>;
    stuck_count: number;
    recent_failed: Array<{
      id: number;
      file_name: string;
      updated_at: string | null;
    }>;
    error: string | null;
  };
};

export async function getAdminWorkerHealth() {
  return apiFetch<{ ok: true; data: AdminWorkerHealthState }>("/admin/worker-health");
}

export async function recoverStuckImports() {
  return apiFetch<{ ok: true; dispatched: number }>("/admin/worker-health/recover-stuck-imports", { method: "POST" });
}

export async function runPaymentsNow() {
  return apiFetch<{ ok: true }>("/admin/worker-health/run-payments-now", { method: "POST" });
}

export async function retryFailedPayments() {
  return apiFetch<{ ok: true; reset: number }>("/admin/worker-health/retry-failed-payments", { method: "POST" });
}

export async function retryImport(id: number) {
  return apiFetch<{ ok: true }>(`/admin/worker-health/retry-import/${id}`, { method: "POST" });
}

export async function clearFailedJobs() {
  return apiFetch<{ ok: true; cleared: number }>("/admin/worker-health/failed-jobs", { method: "DELETE" });
}

export async function reindexSearchTab(tab: string) {
  return apiFetch<{ ok: true; dispatched: string[] }>("/admin/worker-health/reindex-search", {
    method: "POST",
    body: JSON.stringify({ tab }),
  });
}
