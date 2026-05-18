import { apiFetch } from "./auth";

export type StorePlan = {
  key: string;
  label: string;
  description: string | null;
  monthly_price_credits: number;
  standard_price_credits: number;
  has_faction_deal: boolean;
};

export type PublicTool = {
  key: string;
  label: string;
  description: string;
};

export type StoreSubscription = {
  id: number;
  plan_key: string;
  subscriber_type: "user" | "faction";
  subscriber_id: number;
  status: string;
  price_paid_credits: number;
  current_period_start: string | null;
  current_period_end: string | null;
};

export type StorePlanSeatTier = {
  min_seats: number;
  price_per_seat_credits: number;
};

export type StoreCatalogResponse = {
  ok: true;
  data: {
    plans: StorePlan[];
    public_tools: PublicTool[];
    seat_tiers: Record<string, StorePlanSeatTier[]>;
    tier: "full" | "public" | "none";
    subscription: StoreSubscription | null;
    has_payments_access: boolean;
  };
};

export async function getStoreCatalog() {
  return apiFetch<StoreCatalogResponse>("/tools/store/catalog");
}

export async function getSubscribeQuote(data: {
  plan_key: string;
  subscriber_type: "user" | "faction";
  faction_id?: number | null;
  seat_count?: number;
}) {
  return apiFetch<{
    ok: true;
    data: {
      plan: { key: string; label: string };
      price_credits: number;
      subscriber_type: string;
      faction_id: number | null;
      seat_count: number | null;
      per_seat: boolean;
      per_seat_price: number | null;
      max_seats: number | null;
      payee_configured: boolean;
    };
  }>("/tools/store/subscribe/quote", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function sendSubscription(data: {
  plan_key: string;
  subscriber_type: "user" | "faction";
  faction_id?: number | null;
  seat_count?: number;
}) {
  return apiFetch<{
    ok: true;
    data: {
      message: string;
      subscription: StoreSubscription;
      transaction_id: number | null;
    };
  }>("/tools/store/subscribe/send", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMySubscription() {
  return apiFetch<{
    ok: true;
    data: { tier: string; subscription: StoreSubscription | null };
  }>("/tools/store/my-subscription");
}
