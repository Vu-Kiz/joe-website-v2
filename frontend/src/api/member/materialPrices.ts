import { apiFetch } from "../core/auth";

export type MaterialPrice = {
  id: number;
  material_uid: string;
  material_name: string;
  price_per_unit: number;
  set_by?: { id: number; swc_handle: string } | null;
  updated_at: string;
};

export function getMaterialPrices() {
  return apiFetch<{ ok: boolean; data: MaterialPrice[] }>("/material-prices");
}

export function upsertMaterialPrice(materialUid: string, pricePerUnit: number) {
  return apiFetch<{ ok: boolean; data: MaterialPrice }>("/admin/material-prices", {
    method: "POST",
    body: JSON.stringify({ material_uid: materialUid, price_per_unit: pricePerUnit }),
  });
}

export function deleteMaterialPrice(materialUid: string) {
  return apiFetch<{ ok: boolean }>(`/admin/material-prices/${encodeURIComponent(materialUid)}`, {
    method: "DELETE",
  });
}
