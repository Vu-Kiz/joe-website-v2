import { apiFetch } from "./auth";

export type FactionConsoleMember = {
  id: number;
  handle: string | null;
  avatar_url: string | null;
  swc_character_id: number | null;
  granted: boolean;
};

export type FactionConsoleSubscription = {
  id: number;
  plan_key: string;
  faction_id: number;
  faction_name: string | null;
  faction_abbreviation: string | null;
  seat_count: number | null;
  price_paid_credits: number;
  current_period_end: string | null;
};

export type FactionConsoleDetail = {
  subscription: FactionConsoleSubscription;
  seats_used: number;
  members: FactionConsoleMember[];
};

export function getFactionConsoles() {
  return apiFetch<{ ok: boolean; data: FactionConsoleSubscription[] }>("/faction-console");
}

export function getFactionConsole(subscriptionId: number) {
  return apiFetch<{ ok: boolean; data: FactionConsoleDetail }>(`/faction-console/${subscriptionId}`);
}

export function grantFactionSeat(subscriptionId: number, userId: number) {
  return apiFetch<{ ok: boolean; message: string }>(`/faction-console/${subscriptionId}/members/${userId}`, {
    method: "POST",
  });
}

export function revokeFactionSeat(subscriptionId: number, userId: number) {
  return apiFetch<{ ok: boolean; message: string }>(`/faction-console/${subscriptionId}/members/${userId}`, {
    method: "DELETE",
  });
}
