import { apiFetch } from "./auth";

export type ToolSubscriptionPlan = {
  id: number;
  key: string;
  label: string;
  description: string | null;
  monthly_price_credits: number;
  is_active: boolean;
  updated_by: { id: number; swc_handle: string } | null;
  updated_at: string | null;
};

export type PublicTool = {
  key: string;
  label: string;
  description: string;
};

export type ToolSubscriptionFactionDeal = {
  id: number;
  faction: { id: number; name: string; abbreviation: string } | null;
  plan_key: string;
  override_price_credits: number | null;
  per_seat_price_credits: number | null;
  max_seats: number | null;
  notes: string | null;
  set_by: { id: number; swc_handle: string } | null;
  updated_at: string | null;
};

export type Faction = {
  id: number;
  name: string;
  abbreviation: string;
};

export type PlanSeatTier = {
  id: number;
  plan_key: string;
  min_seats: number;
  price_per_seat_credits: number;
};

export async function getToolStorePlans() {
  return apiFetch<{
    ok: true;
    data: { plans: ToolSubscriptionPlan[]; public_tools: PublicTool[]; seat_tiers: PlanSeatTier[] };
  }>("/admin/tool-store/plans");
}

export async function createSeatTier(data: { plan_key: string; min_seats: number; price_per_seat_credits: number }) {
  return apiFetch<{ ok: true; data: PlanSeatTier }>("/admin/tool-store/seat-tiers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSeatTier(id: number, data: { price_per_seat_credits: number }) {
  return apiFetch<{ ok: true; data: PlanSeatTier }>(`/admin/tool-store/seat-tiers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSeatTier(id: number) {
  return apiFetch<{ ok: true }>(`/admin/tool-store/seat-tiers/${id}`, { method: "DELETE" });
}

export async function updateToolStorePlan(
  key: string,
  data: Partial<Pick<ToolSubscriptionPlan, "label" | "description" | "monthly_price_credits" | "is_active">>
) {
  return apiFetch<{ ok: true; data: ToolSubscriptionPlan }>(`/admin/tool-store/plans/${key}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getToolStoreDeals() {
  return apiFetch<{
    ok: true;
    data: {
      deals: ToolSubscriptionFactionDeal[];
      factions: Faction[];
      plan_keys: Record<string, string>;
    };
  }>("/admin/tool-store/deals");
}

export async function createToolStoreDeal(data: {
  faction_id: number;
  plan_key: string;
  override_price_credits?: number | null;
  per_seat_price_credits?: number | null;
  max_seats?: number | null;
  notes?: string | null;
}) {
  return apiFetch<{ ok: true; data: ToolSubscriptionFactionDeal }>("/admin/tool-store/deals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateToolStoreDeal(
  id: number,
  data: {
    override_price_credits?: number | null;
    per_seat_price_credits?: number | null;
    max_seats?: number | null;
    notes?: string | null;
  }
) {
  return apiFetch<{ ok: true; data: ToolSubscriptionFactionDeal }>(`/admin/tool-store/deals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteToolStoreDeal(id: number) {
  return apiFetch<{ ok: true }>(`/admin/tool-store/deals/${id}`, { method: "DELETE" });
}

export type ToolStoreSettings = {
  payee_faction_id: number | null;
  factions: Faction[];
};

export async function getToolStoreSettings() {
  return apiFetch<{ ok: true; data: ToolStoreSettings }>("/admin/tool-store/settings");
}

export async function updateToolStoreSettings(data: {
  payee_faction_id?: number | null;
}) {
  return apiFetch<{ ok: true; data: { payee_faction_id: number | null } }>(
    "/admin/tool-store/settings",
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export type UserSearchResult = {
  id: number;
  swc_handle: string;
};

export async function searchToolStoreUsers(q: string) {
  return apiFetch<{ ok: true; data: UserSearchResult[] }>(`/admin/tool-store/users/search?q=${encodeURIComponent(q)}`);
}

export type GrantedSubscription = {
  user: { id: number; swc_handle: string };
  plan_key: string;
  status: string;
  current_period_end: string | null;
};

export async function toggleSubscriberPreview() {
  return apiFetch<{ ok: true; data: { force_subscriber_tier: boolean } }>(
    "/admin/tool-store/subscriber-preview/toggle",
    { method: "POST" }
  );
}

export async function toggleLockJoeFlags() {
  return apiFetch<{ ok: true; data: { lock_joe_flags: boolean } }>(
    "/admin/tool-store/lock-joe-flags/toggle",
    { method: "POST" }
  );
}

export async function grantToolSubscription(data: {
  user_id: number;
  plan_key: string;
  months: number;
}) {
  return apiFetch<{ ok: true; data: GrantedSubscription }>("/admin/tool-store/grant", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export type GrantedFactionSubscription = {
  faction: { id: number; name: string };
  manager: { id: number; swc_handle: string };
  plan_key: string;
  seat_count: number;
  current_period_end: string | null;
};

export async function grantFactionToolSubscription(data: {
  faction_id: number;
  plan_key: string;
  months: number;
  seat_count: number;
  manager_user_id: number;
}) {
  return apiFetch<{ ok: true; data: GrantedFactionSubscription }>("/admin/tool-store/grant-faction", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
