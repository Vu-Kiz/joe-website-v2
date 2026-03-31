import { apiFetch } from "./auth";

export type DroidBrainTab =
  | "ships"
  | "stations"
  | "planets"
  | "cities"
  | "vehicles"
  | "npcs"
  | "summary";

export type DroidBrainFilters = {
  q: string;
  uid: string;
  uploader: string;
  type: string;
  class: string;
  system: string;
  planet: string;
  owner: string;
};

export type DroidBrainResultRow = Record<string, unknown> & {
  id?: number;
  entity_uid?: string | null;
  identifier?: string | null;
  name?: string | null;
  type_name?: string | null;
  race_name?: string | null;
  class_name?: string | null;
  sector_name?: string | null;
  system_name?: string | null;
  planet_name?: string | null;
  owner_name?: string | null;
  government?: string | null;
  galx?: number | null;
  galy?: number | null;
  sysx?: number | null;
  sysy?: number | null;
  total?: number | null;
  snapshot_unixtime?: number | null;
  file_id?: number | null;
  file_name?: string | null;
  file_change_status?: string | null;
  file_created_at?: string | null;
  uploader_handle?: string | null;
};

export type DroidBrainContext = {
  tab: DroidBrainTab;
  tab_labels: Record<DroidBrainTab, string>;
  filters: DroidBrainFilters;
  options: {
    uploader_options: string[];
    type_options: string[];
    class_options: string[];
    system_options: string[];
    planet_options: string[];
    owner_options: string[];
  };
  did_search: boolean;
  results: DroidBrainResultRow[];
  total_rows: number;
  page: number;
  per_page: number;
  total_pages: number;
  summary: Record<string, DroidBrainResultRow[]>;
};

export type DroidBrainUploadResult = {
  file_id: number;
  duplicate: boolean;
  payload_type: string;
  snapshot_unix: number | null;
  counts: Record<string, number>;
  message: string;
  duplicate_attempt_status?: string | null;
  duplicate_attempt_new_entities_count?: number | null;
  duplicate_attempt_modified_entities_count?: number | null;
  duplicate_attempt_unchanged_entities_count?: number | null;
  existing_change_status?: string | null;
  existing_new_entities_count?: number | null;
  existing_modified_entities_count?: number | null;
  existing_unchanged_entities_count?: number | null;
  reward_summary?: {
    total_amount: number;
    payment_item_id: number | null;
    payer_label: string;
    payee_handle: string | null;
    payee_label: string;
    systems: Array<{
      system_name: string | null;
      galx: number;
      galy: number;
      status: string;
      is_new_system: boolean;
      new_entities_count: number;
      modified_entities_count: number;
      unchanged_entities_count: number;
      total_amount: number;
    }>;
  } | null;
};

export type DroidBrainUploadDebug = {
  file: {
    id: number;
    file_name: string;
    payload_type: string | null;
    snapshot_unix: number | null;
    change_status: string | null;
    new_entities_count: number;
    modified_entities_count: number;
    unchanged_entities_count: number;
    uploader_handle: string | null;
    created_at: string | null;
  };
  entity_counts: Record<string, number>;
  scan_objects_preview: Array<{
    id: number;
    scan_id: number;
    object_type: string | null;
    object_uid: string | null;
    object_name: string | null;
    system_name?: string | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
  }>;
  reward_logs: Array<{
    id: number;
    payment_item_id: number | null;
    galx: number;
    galy: number;
    system_name: string | null;
    reward_status: string;
    is_new_system: boolean;
    new_entities_count: number;
    modified_entities_count: number;
    unchanged_entities_count: number;
    total_amount: number;
    cooldown_until: string | null;
  }>;
  reward_payment: DroidBrainUploadResult["reward_summary"] | null;
  payer_options: Array<{
    id: number;
    name: string;
    swc_uid: string | null;
    abbreviation: string | null;
  }>;
};

export async function getDroidBrain(params?: Partial<Record<string, string | number | null | undefined>>) {
  const query = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  return apiFetch<{ ok: true; data: DroidBrainContext }>(
    `/droidbrain${query.toString() ? `?${query.toString()}` : ""}`
  );
}

export async function getDroidBrainHistory(tab: DroidBrainTab, uid: string, limit = 10) {
  const query = new URLSearchParams({
    tab,
    uid,
    limit: String(limit),
  });

  return apiFetch<{ ok: true; data: DroidBrainResultRow[] }>(`/droidbrain/history?${query.toString()}`);
}

export async function uploadDroidBrainFile(file: File) {
  const form = new FormData();
  form.append("file", file);

  return apiFetch<{ ok: true; data: DroidBrainUploadResult }>("/droidbrain/upload", {
    method: "POST",
    body: form,
  });
}

export async function getDroidBrainUploadDebug(fileId: number) {
  return apiFetch<{ ok: true; data: DroidBrainUploadDebug }>(`/droidbrain/uploads/${fileId}/debug`);
}

export async function createDroidBrainRewardPayment(fileId: number, payerFactionId: number) {
  return apiFetch<{ ok: true; data: NonNullable<DroidBrainUploadResult["reward_summary"]> }>(
    `/droidbrain/uploads/${fileId}/reward-payment`,
    {
      method: "POST",
      body: JSON.stringify({
        payer_faction_id: payerFactionId,
      }),
    }
  );
}
