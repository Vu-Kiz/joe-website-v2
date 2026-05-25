import { apiFetch } from "../core/auth";

export type BundleItem = {
  entity_type: string;
  entity_uid: string;
  entity_name: string;
  type_name: string | null;
  price_credits: number;
  quantity_total: number;
  entity_image_url: string | null;
  type_uid: string | null;
  wrecked?: boolean;
  hull?: number | null;
  max_hull?: number | null;
  shield?: number | null;
  max_shield?: number | null;
  ionic?: number | null;
  max_ionic?: number | null;
  location?: {
    sector: string | null;
    system: string | null;
    system_type: string | null;
    docked: boolean;
    container: { uid: string | null; name: string | null; type: string | null } | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
  } | null;
  cargo?: {
    weight_total: number | null;
    weight_remaining: number | null;
    passengers_total: number | null;
    passengers_remaining: number | null;
  } | null;
};

export type MarketListing = {
  id: number;
  channel: "faction_store" | "member";
  audience: "public" | "joe_members";
  seller_type: "faction" | "user";
  seller_id: number;
  entity_type: string;
  entity_uid: string;
  entity_name: string;
  entity_type_uid: string | null;
  location_galx: number | null;
  location_galy: number | null;
  location_label: string | null;
  price_credits: number;
  quantity_total: number;
  quantity_reserved: number;
  quantity_sold: number;
  quantity_available: number;
  notes: string | null;
  status: "open" | "reserved" | "transfer_pending" | "completed" | "cancelled";
  seller_name: string | null;
  listed_by: { id: number; handle: string } | null;
  entity_image_url: string | null;
  entity_snapshot: EntityDetail | null;
  sale_type: "standard" | "custom" | "bundle" | "stock";
  is_unlimited: boolean;
  bundle_items: BundleItem[] | null;
  image_watermarked: boolean;
  custom_image_url: string | null;
  custom_entity_category: string | null;
  custom_entity_uid: string | null;
  custom_entity_name: string | null;
  custom_entity_image_url: string | null;
  created_at: string | null;
};

export type MarketOrder = {
  id: number;
  listing_id: number;
  buyer_user_id: number;
  buyer?: { id: number; handle: string } | null;
  quantity: number;
  total_credits: number;
  payment_transfer_id: number | null;
  status: "pending_payment" | "paid" | "transfer_pending" | "completed" | "disputed" | "cancelled";
  order_reference: string;
  expires_at: string | null;
  completed_at: string | null;
  dispute_note: string | null;
  listing: {
    id: number;
    entity_name: string;
    entity_type: string;
    channel: string;
    audience: "public" | "joe_members";
    price_credits: number;
    sale_type: "standard" | "custom" | "bundle" | "stock";
  } | null;
};

export type MarketMeta = {
  current_page: number;
  last_page: number;
  total: number;
};

export const ENTITY_TYPES = [
  { key: "ship",     label: "Ships",      privilegeGroup: "ship"         },
  { key: "vehicle",  label: "Vehicles",   privilegeGroup: "vehicle"      },
  { key: "item",     label: "Items",      privilegeGroup: "item"         },
  { key: "droid",    label: "Droids",     privilegeGroup: "droid"        },
  { key: "material", label: "Materials",  privilegeGroup: "raw_material" },
  { key: "npc",      label: "NPCs",       privilegeGroup: "npc"          },
  { key: "creature", label: "Creatures",  privilegeGroup: "creature"     },
  { key: "station",  label: "Stations",   privilegeGroup: "station"      },
  { key: "city",     label: "Cities",     privilegeGroup: "city"         },
  { key: "facility", label: "Facilities", privilegeGroup: "facility"     },
] as const;

export type EntityTypeKey = typeof ENTITY_TYPES[number]["key"];

export async function getMarketListings(params: {
  channel?: string | string[];
  entity_type?: string | string[];
  sale_type?: string | string[];
  status?: string;
  page?: number;
}) {
  const q = new URLSearchParams();
  if (params.channel) q.set("channel", Array.isArray(params.channel) ? params.channel.join(",") : params.channel);
  if (params.entity_type) q.set("entity_type", Array.isArray(params.entity_type) ? params.entity_type.join(",") : params.entity_type);
  if (params.sale_type) q.set("sale_type", Array.isArray(params.sale_type) ? params.sale_type.join(",") : params.sale_type);
  if (params.status) q.set("status", params.status);
  if (params.page) q.set("page", String(params.page));
  return apiFetch<{ ok: true; data: MarketListing[]; meta: MarketMeta }>(
    `/market/listings?${q.toString()}`
  );
}

export async function getMyListings() {
  return apiFetch<{ ok: true; data: MarketListing[] }>(`/market/listings/mine`);
}

export async function getListing(id: number) {
  return apiFetch<{ ok: true; data: MarketListing }>(`/market/listings/${id}`);
}

export async function getFactionStoreListings(params: { entity_type?: string; page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.entity_type) q.set("entity_type", params.entity_type);
  if (params.page) q.set("page", String(params.page));
  return apiFetch<{ ok: true; data: MarketListing[]; meta: MarketMeta }>(
    `/market/faction-store?${q.toString()}`
  );
}

export async function postFactionStoreListing(body: {
  faction_id: number;
  entity_type: string;
  entity_uid: string;
  entity_name: string;
  entity_type_uid?: string | null;
  location_galx?: number | null;
  location_galy?: number | null;
  location_label?: string | null;
  price_credits: number;
  quantity_total: number;
  audience?: "public" | "joe_members";
  notes?: string | null;
  image_watermarked?: boolean;
}) {
  return apiFetch<{ ok: true; data: MarketListing }>(`/market/faction-store`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postMemberListing(body: {
  entity_type: string;
  entity_uid: string;
  entity_name: string;
  entity_type_uid?: string | null;
  location_galx?: number | null;
  location_galy?: number | null;
  location_label?: string | null;
  price_credits: number;
  quantity_total: number;
  audience?: "public" | "joe_members";
  notes?: string | null;
  image_watermarked?: boolean;
}) {
  return apiFetch<{ ok: true; data: MarketListing }>(`/market/listings`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postStockListing(body: {
  entity_type: string;
  entity_uids: string[];
  price_credits: number;
  faction_id?: number | null;
  audience?: "public" | "joe_members";
  notes?: string | null;
  image_watermarked?: boolean;
}) {
  return apiFetch<{ ok: true; data: MarketListing }>(`/market/listings`, {
    method: "POST",
    body: JSON.stringify({ ...body, sale_type: "stock" }),
  });
}

export async function postBundleListing(body: {
  bundle_name: string;
  faction_id?: number | null;
  audience?: "public" | "joe_members";
  notes?: string | null;
  image_watermarked?: boolean;
  items: { entity_type: string; entity_uid: string; entity_name: string; price_credits: number; quantity_total?: number }[];
}) {
  return apiFetch<{ ok: true; data: MarketListing }>(`/market/listings`, {
    method: "POST",
    body: JSON.stringify({ ...body, sale_type: "bundle" }),
  });
}

export async function cancelListing(id: number) {
  return apiFetch<{ ok: true }>(`/market/listings/${id}/cancel`, { method: "POST" });
}

export async function createOrder(listingId: number, quantity: number) {
  return apiFetch<{
    ok: true;
    data: MarketOrder;
    payment: {
      transfer_id: number;
      payee_handle: string;
      payee_swc_uid: string;
      amount: number;
      reference: string;
    };
  }>(`/market/listings/${listingId}/orders`, {
    method: "POST",
    body: JSON.stringify({ quantity }),
  });
}

export async function getMyOrders() {
  return apiFetch<{ ok: true; data: MarketOrder[] }>(`/market/orders/mine`);
}

export async function cancelOrder(id: number) {
  return apiFetch<{ ok: true }>(`/market/orders/${id}/cancel`, { method: "POST" });
}

export async function payOrder(id: number) {
  return apiFetch<{
    ok: true;
    message: string;
    transaction_id: number | null;
  } | {
    ok: false;
    needs_payments_access?: boolean;
    message: string;
    reference?: string;
    payee_handle?: string;
    amount?: number;
  }>(`/market/orders/${id}/pay`, { method: "POST" });
}

export type EntityDetail = {
  uid: string | null;
  name: string | null;
  type_uid: string | null;
  type_name: string | null;
  image_url: string | null;
  quantity?: number | null;
  wrecked: boolean;
  hull: number | null;
  max_hull: number | null;
  shield: number | null;
  max_shield: number | null;
  ionic: number | null;
  max_ionic: number | null;
  location: {
    sector: string | null;
    system: string | null;
    system_type: string | null;
    docked: boolean;
    container: { uid: string | null; name: string | null; type: string | null } | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
  };
  owner: { uid: string | null; name: string | null } | null;
  cargo: {
    weight_total: number | null;
    weight_remaining: number | null;
    volume_total: number | null;
    volume_remaining: number | null;
    passengers_total: number | null;
    passengers_remaining: number | null;
  } | null;
};

export async function getPendingFulfillment() {
  return apiFetch<{ ok: true; data: MarketOrder[] }>(`/market/orders/to-fulfill`);
}

export async function fulfillOrder(id: number) {
  return apiFetch<{ ok: true; manual?: boolean; message: string } | { ok: false; message: string }>(
    `/market/orders/${id}/fulfill`, { method: "POST" }
  );
}

export async function refundOrder(id: number) {
  return apiFetch<{ ok: true; message: string } | { ok: false; message: string }>(
    `/market/orders/${id}/refund`, { method: "POST" }
  );
}

export async function retryTransfer(id: number) {
  return apiFetch<{ ok: true; manual?: boolean; message: string } | { ok: false; message: string }>(
    `/market/orders/${id}/retry-transfer`, { method: "POST" }
  );
}

export async function markOrderComplete(id: number) {
  return apiFetch<{ ok: true; message: string } | { ok: false; message: string }>(
    `/market/orders/${id}/mark-complete`, { method: "POST" }
  );
}

export async function confirmMaterialOrder(id: number) {
  return apiFetch<{ ok: true; message: string } | { ok: false; message: string }>(
    `/market/orders/${id}/confirm-material`, { method: "POST" }
  );
}

export async function getEntityDetail(entityType: string, entityUid: string) {
  return apiFetch<{ ok: true; entity_type: string; data: EntityDetail; raw: any }>(
    `/market/inventory/entity?entity_type=${encodeURIComponent(entityType)}&entity_uid=${encodeURIComponent(entityUid)}`
  );
}

export async function getPersonalInventory(entityType: string) {
  return apiFetch<{ ok: true; entity_type: string; data: any }>(
    `/market/inventory/personal?entity_type=${encodeURIComponent(entityType)}`
  );
}

export async function getFactionInventory(factionId: number, entityType: string) {
  return apiFetch<{ ok: true; entity_type: string; faction: any; data: any }>(
    `/market/inventory/faction?faction_id=${factionId}&entity_type=${encodeURIComponent(entityType)}`
  );
}

export type EntityTypeResult = {
  uid: string;
  name: string;
  image_url: string | null;
  category: string;
};

export async function searchEntityTypes(q: string) {
  return apiFetch<{ results: EntityTypeResult[] }>(
    `/market/entity-types/search?q=${encodeURIComponent(q)}`
  );
}

export async function uploadCustomImage(file: File): Promise<{
  ok: true;
  original_path: string;
  watermarked_path: string;
  original_url: string;
  watermarked_url: string;
}> {
  const form = new FormData();
  form.append("image", file);
  const { getApiBaseUrl, ensureCsrfCookie, getXsrfToken } = await import("../core/auth");
  await ensureCsrfCookie();
  const xsrf = getXsrfToken();
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/market/custom-image/upload`, {
    method: "POST",
    credentials: "include",
    headers: xsrf ? { "X-XSRF-TOKEN": xsrf } : {},
    body: form,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.message ?? "Upload failed");
  }
  return res.json();
}

export async function postCustomListing(body: {
  price_credits: number;
  audience?: "public" | "joe_members";
  notes?: string | null;
  custom_image_path: string;
  custom_image_watermarked_path: string;
  custom_entity_category: string;
  custom_entity_uid: string;
  custom_entity_name: string;
  custom_entity_image_url?: string | null;
  faction_id?: number | null;
  is_unlimited?: boolean;
  quantity_total?: number | null;
}) {
  return apiFetch<{ ok: true; data: MarketListing }>(`/market/listings`, {
    method: "POST",
    body: JSON.stringify({ ...body, sale_type: "custom" }),
  });
}
