import { apiFetch } from "../core/auth";

export type AdminMemberChangelogEntry = {
  id: number;
  version: string;
  title: string;
  details: string;
  tools: string[];
  audiences: string[];
  sort_order: number;
  released_at: string | null;
  is_active: boolean;
  updated_at: string | null;
};

export type UpsertMemberChangelogPayload = {
  version: string;
  title: string;
  details: string;
  tools: string[];
  audiences: string[];
  sort_order?: number;
  released_at: string | null;
  is_active: boolean;
};

export async function getAdminMemberChangelog() {
  const response = await apiFetch<{ ok: true; data: AdminMemberChangelogEntry[] }>("/admin/member-changelog");
  return response.data ?? [];
}

export async function createAdminMemberChangelog(payload: UpsertMemberChangelogPayload) {
  const response = await apiFetch<{ ok: true; data: AdminMemberChangelogEntry }>("/admin/member-changelog", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateAdminMemberChangelog(id: number, payload: UpsertMemberChangelogPayload) {
  const response = await apiFetch<{ ok: true; data: AdminMemberChangelogEntry }>(`/admin/member-changelog/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteAdminMemberChangelog(id: number) {
  return apiFetch<{ ok: true }>(`/admin/member-changelog/${id}`, {
    method: "DELETE",
  });
}

export async function generateAdminMemberChangelogFromReadme(replaceExisting: boolean, markdown?: string) {
  return apiFetch<{ ok: true; created: number; updated: number; total: number; source?: string }>("/admin/member-changelog/generate-from-readme", {
    method: "POST",
    body: JSON.stringify({
      replace_existing: replaceExisting,
      markdown: markdown?.trim() ? markdown : undefined,
    }),
  });
}

export type AdminMemberChangelogExportPayload = {
  ok: true;
  exported_at: string;
  version: string | null;
  count: number;
  entries: AdminMemberChangelogEntry[];
};

export async function exportAdminMemberChangelog(version?: string) {
  const trimmedVersion = version?.trim() ?? "";
  const suffix = trimmedVersion ? `?version=${encodeURIComponent(trimmedVersion)}` : "";
  return apiFetch<AdminMemberChangelogExportPayload>(`/admin/member-changelog/export${suffix}`);
}

export async function importAdminMemberChangelog(
  entries: UpsertMemberChangelogPayload[],
  replaceExisting: boolean
) {
  return apiFetch<{ ok: true; created: number; updated: number; total: number; replace_existing: boolean }>(
    "/admin/member-changelog/import",
    {
      method: "POST",
      body: JSON.stringify({
        replace_existing: replaceExisting,
        entries,
      }),
    }
  );
}
