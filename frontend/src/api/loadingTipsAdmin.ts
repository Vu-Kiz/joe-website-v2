import { apiFetch } from "./auth";

export type LoadingTipItem = {
  id: number;
  tip: string;
  created_at: string | null;
};

export type ListLoadingTipsResponse = {
  ok: boolean;
  tips: LoadingTipItem[];
};

export type SaveLoadingTipPayload = {
  tip: string;
};

export type SaveLoadingTipResponse = {
  ok: boolean;
  tip: LoadingTipItem;
};

export async function listLoadingTipsAdmin(): Promise<ListLoadingTipsResponse> {
  return apiFetch<ListLoadingTipsResponse>("/admin/loading-tips", {
    method: "GET",
  });
}

export async function createLoadingTip(
  payload: SaveLoadingTipPayload
): Promise<SaveLoadingTipResponse> {
  return apiFetch<SaveLoadingTipResponse>("/admin/loading-tips", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLoadingTip(
  id: number,
  payload: SaveLoadingTipPayload
): Promise<SaveLoadingTipResponse> {
  return apiFetch<SaveLoadingTipResponse>(`/admin/loading-tips/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLoadingTip(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/admin/loading-tips/${id}`, {
    method: "DELETE",
  });
}