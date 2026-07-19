import { apiFetch } from "../core/auth";

export type MarketVendorListing = {
  id: number;
  vendor_id: number;
  ware_name: string;
  matched_item_type_uid: string | null;
  matched_entity_type: string | null;
  quantity: number;
  price: number;
  currency: string;
  image_small: string | null;
  image_large: string | null;
  vendor: {
    id: number;
    name: string;
    owner_label: string | null;
    system_label: string | null;
    container_label: string | null;
    planet_label: string | null;
    city_label: string | null;
    galx: number | null;
    galy: number | null;
    system_x: number | null;
    system_y: number | null;
    surface_x: number | null;
    surface_y: number | null;
    ground_x: number | null;
    ground_y: number | null;
    last_synced_at: string | null;
  };
};

export type MarketVendor = {
  id: number;
  swc_vendor_id: number;
  name: string;
  description: string | null;
  owner_uid: string | null;
  owner_label: string | null;
  shopkeeper_uid: string | null;
  shopkeeper_name: string | null;
  sector_uid: string | null;
  sector_label: string | null;
  system_uid: string | null;
  system_label: string | null;
  container_uid: string | null;
  container_type: string | null;
  container_label: string | null;
  planet_uid: string | null;
  planet_label: string | null;
  city_uid: string | null;
  city_label: string | null;
  galx: number | null;
  galy: number | null;
  system_x: number | null;
  system_y: number | null;
  surface_x: number | null;
  surface_y: number | null;
  ground_x: number | null;
  ground_y: number | null;
  last_synced_at: string | null;
  listings_count?: number;
  listings?: MarketVendorListing[];
};

export type PaginatedMeta = {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

export type MarketVendorSort = "price_asc" | "price_desc" | "quantity_desc" | "name_asc" | "distance_asc";

export type MarketVendorDirectorySort = "name_asc" | "owner_label_asc" | "location_asc" | "listings_desc" | "distance_asc";

export type MarketOwnerSort = "label_asc" | "vendors_desc";

export type MarketOwnerSuggestion = {
  label: string;
  vendor_count: number;
};

export type MarketHubSort = "label_asc" | "vendors_desc" | "distance_asc";

export type MarketHub = {
  galx: number;
  galy: number;
  // The building/ship/station vendors are actually clustered in (e.g. "The Galactic
  // Bazaar"), falling back to the system name for the rare vendor with no container.
  hub_label: string | null;
  vendor_count: number;
};

export function searchMarketVendorListings(params: {
  q?: string;
  entity_type?: string | null;
  vendor_id?: number | null;
  owner_label?: string | null;
  sort?: MarketVendorSort;
  my_galx?: number | null;
  my_galy?: number | null;
  page?: number;
  per_page?: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.entity_type) query.set("entity_type", params.entity_type);
  if (params.vendor_id) query.set("vendor_id", String(params.vendor_id));
  if (params.owner_label) query.set("owner_label", params.owner_label);
  if (params.sort) query.set("sort", params.sort);
  if (params.my_galx != null) query.set("my_galx", String(params.my_galx));
  if (params.my_galy != null) query.set("my_galy", String(params.my_galy));
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  return apiFetch<{ ok: boolean; data: MarketVendorListing[]; meta: PaginatedMeta }>(
    `/market-vendors?${query.toString()}`
  );
}

export function browseMarketVendors(params: {
  q?: string;
  owner_label?: string | null;
  galx?: number | null;
  galy?: number | null;
  sort?: MarketVendorDirectorySort;
  my_galx?: number | null;
  my_galy?: number | null;
  page?: number;
  per_page?: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.owner_label) query.set("owner_label", params.owner_label);
  if (params.galx != null) query.set("galx", String(params.galx));
  if (params.galy != null) query.set("galy", String(params.galy));
  if (params.sort) query.set("sort", params.sort);
  if (params.my_galx != null) query.set("my_galx", String(params.my_galx));
  if (params.my_galy != null) query.set("my_galy", String(params.my_galy));
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  return apiFetch<{ ok: boolean; data: MarketVendor[]; owners: MarketOwnerSuggestion[]; meta: PaginatedMeta }>(
    `/market-vendors/vendors?${query.toString()}`
  );
}

export function browseMarketHubs(params: {
  q?: string;
  sort?: MarketHubSort;
  my_galx?: number | null;
  my_galy?: number | null;
  page?: number;
  per_page?: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.sort) query.set("sort", params.sort);
  if (params.my_galx != null) query.set("my_galx", String(params.my_galx));
  if (params.my_galy != null) query.set("my_galy", String(params.my_galy));
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  return apiFetch<{ ok: boolean; data: MarketHub[]; meta: PaginatedMeta }>(
    `/market-vendors/hubs?${query.toString()}`
  );
}

export function browseMarketOwners(params: {
  q?: string;
  sort?: MarketOwnerSort;
  page?: number;
  per_page?: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  return apiFetch<{ ok: boolean; data: MarketOwnerSuggestion[]; meta: PaginatedMeta }>(
    `/market-vendors/owners?${query.toString()}`
  );
}

export function getMarketVendor(id: number) {
  return apiFetch<{ ok: boolean; data: MarketVendor }>(`/market-vendors/vendors/${id}`);
}
