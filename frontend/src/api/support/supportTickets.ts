import { apiFetch } from "../core/auth";

export type TicketSeverity = "tool_breaking" | "major_bug" | "minor_bug" | "visual_ui";
export type TicketStatus = "open" | "in_progress" | "resolved";

export const SEVERITY_LABELS: Record<TicketSeverity, string> = {
  tool_breaking: "🔴 Tool Breaking",
  major_bug:     "🟠 Major Bug",
  minor_bug:     "🟡 Minor Bug",
  visual_ui:     "🔵 Visual / UI Issue",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        "Open",
  in_progress: "In Progress",
  resolved:    "Resolved",
};

export type TicketMessage = {
  id: number;
  ticket_id: number;
  user_id: number;
  is_admin: boolean;
  body: string;
  created_at: string;
  user: { id: number; discord_user_id: string | null; swc_handle: string | null };
};

export type SupportTicket = {
  id: number;
  user_id: number;
  tool_key: string;
  title: string;
  severity: TicketSeverity;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
  user?: { id: number; discord_user_id: string | null; swc_handle: string | null };
};

// User-facing
export function getMyTickets(): Promise<{ ok: boolean; data: SupportTicket[] }> {
  return apiFetch("/support-tickets");
}

export function getTicket(id: number): Promise<{ ok: boolean; data: SupportTicket }> {
  return apiFetch(`/support-tickets/${id}`);
}

export function createTicket(payload: {
  tool_key: string;
  title: string;
  severity: TicketSeverity;
  description: string;
}): Promise<{ ok: boolean; data: SupportTicket }> {
  return apiFetch("/support-tickets", { method: "POST", body: JSON.stringify(payload) });
}

export function replyToTicket(id: number, body: string): Promise<{ ok: boolean; data: SupportTicket }> {
  return apiFetch(`/support-tickets/${id}/reply`, { method: "POST", body: JSON.stringify({ body }) });
}

// Admin
export function adminGetTickets(params?: {
  status?: TicketStatus;
  tool_key?: string;
}): Promise<{ ok: boolean; data: SupportTicket[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.tool_key) query.set("tool_key", params.tool_key);
  const qs = query.toString();
  return apiFetch(`/admin/support-tickets${qs ? `?${qs}` : ""}`);
}

export function adminGetTicket(id: number): Promise<{ ok: boolean; data: SupportTicket }> {
  return apiFetch(`/admin/support-tickets/${id}`);
}

export function adminReplyToTicket(id: number, body: string): Promise<{ ok: boolean; data: SupportTicket }> {
  return apiFetch(`/admin/support-tickets/${id}/reply`, { method: "POST", body: JSON.stringify({ body }) });
}

export function adminUpdateTicketStatus(id: number, status: TicketStatus): Promise<{ ok: boolean; data: SupportTicket }> {
  return apiFetch(`/admin/support-tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export type TicketRecipient = {
  id: number;
  swc_handle: string | null;
  discord_user_id: string;
  discord_username: string | null;
  discord_global_name: string | null;
  is_admin: boolean;
  is_sysadmin: boolean;
};

export function adminGetTicketSettings(): Promise<{ ok: boolean; data: { recipient: TicketRecipient | null; candidate_recipients: TicketRecipient[] } }> {
  return apiFetch("/admin/support-tickets-settings");
}

export function adminUpdateTicketSettings(recipientUserId: number | null): Promise<{ ok: boolean; message: string }> {
  return apiFetch("/admin/support-tickets-settings", { method: "POST", body: JSON.stringify({ recipient_user_id: recipientUserId }) });
}
