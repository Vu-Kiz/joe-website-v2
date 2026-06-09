import { apiFetch } from "../core/auth";

export type KanbanPriority = "none" | "low" | "medium" | "high" | "urgent";

export type KanbanCardUser = { id: number; swc_handle: string | null };

export type KanbanCard = {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  priority: KanbanPriority;
  due_date: string | null;
  created_by: number;
  assigned_to: number | null;
  ticket_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  creator?: KanbanCardUser;
  assignee?: KanbanCardUser | null;
  ticket?: { id: number; title: string } | null;
};

export type KanbanColumn = {
  id: number;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
  cards: KanbanCard[];
};

export const PRIORITY_LABELS: Record<KanbanPriority, string> = {
  none:   "None",
  low:    "Low",
  medium: "Medium",
  high:   "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<KanbanPriority, string> = {
  none:   "rgba(255,255,255,0.25)",
  low:    "#4ade80",
  medium: "#facc15",
  high:   "#fb923c",
  urgent: "#f87171",
};

// Board
export function getKanbanBoard(): Promise<{ ok: boolean; data: KanbanColumn[] }> {
  return apiFetch("/sys/kanban");
}

// Columns
export function createColumn(title: string): Promise<{ ok: boolean; data: KanbanColumn }> {
  return apiFetch("/sys/kanban/columns", { method: "POST", body: JSON.stringify({ title }) });
}

export function updateColumn(id: number, title: string): Promise<{ ok: boolean; data: KanbanColumn }> {
  return apiFetch(`/sys/kanban/columns/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
}

export function deleteColumn(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/sys/kanban/columns/${id}`, { method: "DELETE" });
}

export function reorderColumns(ids: number[]): Promise<{ ok: boolean }> {
  return apiFetch("/sys/kanban/columns/reorder", { method: "POST", body: JSON.stringify({ ids }) });
}

// Cards
export function createCard(payload: {
  column_id: number;
  title: string;
  description?: string | null;
  priority?: KanbanPriority;
  due_date?: string | null;
  assigned_to?: number | null;
}): Promise<{ ok: boolean; data: KanbanCard }> {
  return apiFetch("/sys/kanban/cards", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCard(id: number, payload: {
  column_id?: number;
  title?: string;
  description?: string | null;
  priority?: KanbanPriority;
  due_date?: string | null;
  assigned_to?: number | null;
}): Promise<{ ok: boolean; data: KanbanCard }> {
  return apiFetch(`/sys/kanban/cards/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteCard(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/sys/kanban/cards/${id}`, { method: "DELETE" });
}

export function reorderCards(columnId: number, ids: number[]): Promise<{ ok: boolean }> {
  return apiFetch("/sys/kanban/cards/reorder", { method: "POST", body: JSON.stringify({ column_id: columnId, ids }) });
}

export function promoteTicketToCard(ticketId: number, columnId: number): Promise<{ ok: boolean; data: KanbanCard }> {
  return apiFetch(`/sys/kanban/tickets/${ticketId}/promote`, { method: "POST", body: JSON.stringify({ column_id: columnId }) });
}

export function getKanbanAssignees(): Promise<{ ok: boolean; data: KanbanCardUser[] }> {
  return apiFetch("/sys/kanban/assignees");
}
