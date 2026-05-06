import { apiFetch } from "./auth";

export type AdminDroidBrainUploadItem = {
  id: number;
  queue_item_id: number | null;
  queue_status: string | null;
  queue_error_message: string | null;
  queue_processed_at: string | null;
  file_name: string;
  payload_type: string | null;
  snapshot_unix: number | null;
  change_status: string;
  new_entities_count: number;
  modified_entities_count: number;
  unchanged_entities_count: number;
  total_entities_count: number;
  uploader_user_id: number | null;
  uploader_handle: string | null;
  uploader_swc_uid: string | null;
  uploader_record_handle: string | null;
  uploader_record_swc_uid: string | null;
  uploader_user_swc_handle: string | null;
  uploader_user_discord_global_name: string | null;
  uploader_user_discord_username: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminDroidBrainUploadsResponse = {
  ok: true;
  data: {
    uploads: AdminDroidBrainUploadItem[];
    pagination: {
      page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
    filters: {
      user: string | null;
      q: string | null;
      date_from: string | null;
      date_to: string | null;
    };
    uploader_options: string[];
  };
};

export async function listAdminDroidBrainUploads(params?: {
  page?: number;
  per_page?: number;
  user?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
}): Promise<AdminDroidBrainUploadsResponse> {
  const query = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === "") {
      return;
    }

    query.set(key, String(value));
  });

  return apiFetch<AdminDroidBrainUploadsResponse>(
    `/admin/droidbrain-uploads${query.toString() ? `?${query.toString()}` : ""}`,
    {
      method: "GET",
    }
  );
}

