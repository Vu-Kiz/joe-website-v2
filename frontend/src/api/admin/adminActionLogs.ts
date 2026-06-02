import { apiFetch } from "../core/auth";

export type AdminActionLogItem = {
  id: number;
  actor_user_id: number | null;
  actor_handle: string | null;
  area: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

export type ListAdminActionLogsResponse = {
  ok: boolean;
  logs: AdminActionLogItem[];
};

export async function listAdminActionLogs(params?: {
  limit?: number;
}): Promise<ListAdminActionLogsResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<ListAdminActionLogsResponse>(
    `/admin/action-logs${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );
}