import { apiFetch } from "./auth";

export type EotmEntry = {
  id: number;
  name: string;
  reason: string;
  image_path: string | null;
  image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ListEotmResponse = {
  ok: boolean;
  entries: EotmEntry[];
};

export type CurrentEotmResponse = {
  ok: boolean;
  entry: EotmEntry | null;
};

export type SaveEotmPayload = {
  name: string;
  reason: string;
  image_path?: string | null;
  image_url?: string | null;
};

export type SaveEotmResponse = {
  ok: boolean;
  entry: EotmEntry;
};

export async function getCurrentEotm(): Promise<CurrentEotmResponse> {
  return apiFetch<CurrentEotmResponse>("/eotm/current", {
    method: "GET",
  });
}

export async function listEotmAdmin(): Promise<ListEotmResponse> {
  return apiFetch<ListEotmResponse>("/admin/eotm", {
    method: "GET",
  });
}

export async function createEotm(payload: SaveEotmPayload): Promise<SaveEotmResponse> {
  return apiFetch<SaveEotmResponse>("/admin/eotm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEotm(
  id: number,
  payload: SaveEotmPayload
): Promise<SaveEotmResponse> {
  return apiFetch<SaveEotmResponse>(`/admin/eotm/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteEotm(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/admin/eotm/${id}`, {
    method: "DELETE",
  });
}