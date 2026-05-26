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

/** Returns all factions the current user is a member of (for use as subscription payer). */
export async function getMyFactions() {
  return apiFetch<{ ok: true; data: PayableFaction[] }>(
    "/factions/mine"
  );
}
