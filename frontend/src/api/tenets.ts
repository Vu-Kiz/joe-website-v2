import { apiFetch } from "./auth";

export type TenetOfSalvage = {
  id: number;
  title: string;
  body_bbcode: string;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TenetsResponse = {
  ok: boolean;
  items: TenetOfSalvage[];
};

export async function listTenets(): Promise<TenetsResponse> {
  return apiFetch("/tenets-of-salvage");
}

export async function listAdminTenets(): Promise<TenetsResponse> {
  return apiFetch("/admin/tenets-of-salvage");
}

export async function createTenet(payload: {
  title: string;
  body_bbcode: string;
  weight: number;
  is_active: boolean;
}): Promise<{ ok: boolean; item: TenetOfSalvage }> {
  return apiFetch("/admin/tenets-of-salvage", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTenet(
  id: number,
  payload: {
    title: string;
    body_bbcode: string;
    weight: number;
    is_active: boolean;
  }
): Promise<{ ok: boolean; item: TenetOfSalvage }> {
  return apiFetch(`/admin/tenets-of-salvage/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTenet(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/tenets-of-salvage/${id}`, {
    method: "DELETE",
  });
}