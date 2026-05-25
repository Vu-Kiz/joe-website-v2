import { apiFetch } from "../core/auth";

export type PayableFaction = {
  id: number;
  name: string;
  swc_uid: number | null;
  abbreviation: string | null;
};

export async function getMyPayableFactions() {
  return apiFetch<{ ok: true; data: PayableFaction[] }>(
    "/factions/mine/payable"
  );
}
