import { apiFetch } from "../core/auth";

export interface RmMaterial {
  uid: string;
  name: string;
  type?: string;
  quantity?: number | string;
  // Location fields from SWC
  sector?: string;
  sector_uid?: string;
  system?: string;
  system_uid?: string;
  planet?: string;
  planet_uid?: string;
  // Injected by our backend
  _faction_uid: string;
  _faction_label: string;
  // Catch-all for other SWC fields
  [key: string]: unknown;
}

export interface SearchRmMaterialsParams {
  factions: string[];
  sector_uid?: string | null;
  system_uid?: string | null;
  type_uid?: string | null;
}

export interface SearchRmMaterialsResponse {
  ok: boolean;
  total: number;
  data: RmMaterial[];
  errors: string[] | null;
}

export async function searchRmMaterials(
  params: SearchRmMaterialsParams
): Promise<SearchRmMaterialsResponse> {
  const query = new URLSearchParams();

  params.factions.forEach((f) => query.append("factions[]", f));

  if (params.sector_uid) query.set("sector_uid", params.sector_uid);
  if (params.system_uid) query.set("system_uid", params.system_uid);
  if (params.type_uid) query.set("type_uid", params.type_uid);

  return apiFetch<SearchRmMaterialsResponse>(`/rm-browser/materials?${query.toString()}`);
}
