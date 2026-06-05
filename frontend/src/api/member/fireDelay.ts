import { apiFetch } from "../core/auth";

export type FireDelayShip = {
  uid: string;
  name: string | null;
  owner_uid: string | null;
  owner_name: string | null;
  class_name: string | null;
  type_name: string | null;
  public_status: string | null;
  galx: number | null;
  galy: number | null;
  in_droidbrain: boolean;
  fired_at: number;
  next_fire_at: number;
  remaining_seconds: number;
  is_ready: boolean;
};

export type FireDelayData = {
  ships: FireDelayShip[];
  fetched_at: number;
  fire_delay_seconds: number;
  faction_uid: number;
};

export type FireDelaySettings = {
  faction_uid: number;
  default_faction_uid: number;
};

export async function getFireDelays() {
  return apiFetch<{ ok: true; data: FireDelayData }>("/fire-delays");
}

export async function getFireDelaySettings() {
  return apiFetch<{ ok: true; data: FireDelaySettings }>("/fire-delays/settings");
}

export async function updateFireDelaySettings(factionUid: number) {
  return apiFetch<{ ok: true; data: FireDelaySettings }>("/fire-delays/settings", {
    method: "PUT",
    body: JSON.stringify({ faction_uid: factionUid }),
  });
}
