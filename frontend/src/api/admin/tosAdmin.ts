import { apiFetch } from "../core/auth";

export type TosDocumentItem = {
  id: number;
  version: number;
  content: string;
  is_active: boolean;
  published_at: string | null;
  created_at: string | null;
};

export async function listTosDocuments(): Promise<{ ok: boolean; documents: TosDocumentItem[] }> {
  return apiFetch("/admin/tos", { method: "GET" });
}

export async function createTosDocument(content: string): Promise<{ ok: boolean; document: TosDocumentItem }> {
  return apiFetch("/admin/tos", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function updateTosDocument(id: number, content: string): Promise<{ ok: boolean; document: TosDocumentItem }> {
  return apiFetch(`/admin/tos/${id}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function publishTosDocument(id: number): Promise<{ ok: boolean; document: TosDocumentItem }> {
  return apiFetch(`/admin/tos/${id}/publish`, { method: "POST" });
}

export async function deleteTosDocument(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/tos/${id}`, { method: "DELETE" });
}
