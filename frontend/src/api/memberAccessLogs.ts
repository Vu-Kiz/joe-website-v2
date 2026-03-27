import { apiFetch } from "./auth";

export type MemberAccessLogItem = {
  id: number;
  actor_user_id: number | null;
  actor_handle: string | null;
  area: string;
  action: string;
  request_method: string;
  request_path: string;
  summary: string;
  response_status: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

export type ListMemberAccessLogsResponse = {
  ok: boolean;
  logs: MemberAccessLogItem[];
};

export async function listMemberAccessLogs(): Promise<ListMemberAccessLogsResponse> {
  return apiFetch<ListMemberAccessLogsResponse>("/admin/member-access-logs", {
    method: "GET",
  });
}
