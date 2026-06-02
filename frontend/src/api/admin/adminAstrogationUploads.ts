import { apiFetch } from "../core/auth";

export type AdminAstrogationUploadArea = {
  galx: number;
  galy: number;
  square_name: string | null;
  sector_uid: string | null;
  has_asteroids: boolean;
  action: "created" | "updated";
};

export type AdminAstrogationRewardBreakdownItem = {
  galx: number;
  galy: number;
  action: "created" | "updated";
  square_name: string | null;
  has_asteroids: boolean;
  reward_rule: "new_ds" | "new_af" | "updated_ds_1y" | "updated_af_1y";
  amount: number;
};

export type AdminAstrogationUploadItem = {
  id: number;
  user_id: number | null;
  handle: string | null;
  created_at: string | null;
  events_seen: number;
  events_matched: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  areas: AdminAstrogationUploadArea[];
  reward_breakdown: AdminAstrogationRewardBreakdownItem[] | null;
};

export type ListAdminAstrogationUploadsResponse = {
  ok: boolean;
  total: number;
  offset: number;
  limit: number;
  data: AdminAstrogationUploadItem[];
};

export type AdminAstrogationImportArea = AdminAstrogationUploadArea & {
  previous_legacy_recorded_at: string | null;
  imported_recorded_at: string | null;
  effective_legacy_recorded_at: string | null;
};

export type AdminAstrogationPullResult = {
  ok: boolean;
  message: string;
  import: {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    areas: AdminAstrogationImportArea[];
  };
  reward: {
    payment_item_id: number;
    total_amount: number;
    new_ds_count: number;
    new_af_count: number;
    updated_ds_count: number;
    updated_af_count: number;
    communication_prefix: string | null;
    breakdown: AdminAstrogationRewardBreakdownItem[];
  } | null;
  log: AdminAstrogationUploadItem | null;
  history: {
    events_seen: number;
    events_matched: number;
    pages: number;
  };
};

export async function pullAstrogationForUser(userId: number): Promise<AdminAstrogationPullResult> {
  return apiFetch<AdminAstrogationPullResult>("/admin/astrogation-upload-logs/pull-for-user", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function listAdminAstrogationUploads(params?: {
  limit?: number;
  offset?: number;
  user_id?: number | null;
  handle?: string;
  date_from?: string;
  date_to?: string;
}): Promise<ListAdminAstrogationUploadsResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.user_id != null) query.set("user_id", String(params.user_id));
  if (params?.handle) query.set("handle", params.handle);
  if (params?.date_from) query.set("date_from", params.date_from);
  if (params?.date_to) query.set("date_to", params.date_to);
  const qs = query.toString();
  return apiFetch<ListAdminAstrogationUploadsResponse>(
    `/admin/astrogation-upload-logs${qs ? `?${qs}` : ""}`
  );
}
