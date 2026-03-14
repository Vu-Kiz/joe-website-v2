import { apiFetch } from "./auth";

export type TenetOfSalvageItem = {
  id: number;
  title: string;
  body_bbcode: string;
  weight: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ListTenetsOfSalvageResponse = {
  ok: boolean;
  items: TenetOfSalvageItem[];
};

export type SaveTenetOfSalvagePayload = {
  title: string;
  body_bbcode: string;
  weight: number;
  is_active: boolean;
};

export type SaveTenetOfSalvageResponse = {
  ok: boolean;
  item: TenetOfSalvageItem;
};

export async function listTenetsOfSalvageAdmin(): Promise<ListTenetsOfSalvageResponse> {
  return apiFetch<ListTenetsOfSalvageResponse>("/admin/tenets-of-salvage", {
    method: "GET",
  });
}

export async function createTenetOfSalvage(
  payload: SaveTenetOfSalvagePayload
): Promise<SaveTenetOfSalvageResponse> {
  return apiFetch<SaveTenetOfSalvageResponse>("/admin/tenets-of-salvage", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTenetOfSalvage(
  id: number,
  payload: SaveTenetOfSalvagePayload
): Promise<SaveTenetOfSalvageResponse> {
  return apiFetch<SaveTenetOfSalvageResponse>(`/admin/tenets-of-salvage/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTenetOfSalvage(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/admin/tenets-of-salvage/${id}`, {
    method: "DELETE",
  });
}