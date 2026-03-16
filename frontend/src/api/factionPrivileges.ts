import { apiFetch } from "./auth";

export type FactionPrivilegeCheckResult = {
  id: number;
  name: string;
  swc_uid: number | null;
  abbreviation: string | null;
  privilege_group: string;
  privilege_name: string;
  check: {
    ok: boolean;
    allowed: boolean;
    message?: string;
    status?: number;
    source?: string;
    checked_at?: string | null;
    meta?: any;
  };
};

export async function getMyFactionPrivileges(
  privilegeGroup: string,
  privilegeName: string,
  refresh = true
) {
  const params = new URLSearchParams({
    privilege_group: privilegeGroup,
    privilege_name: privilegeName,
    refresh: refresh ? "1" : "0",
  });

  return apiFetch<{ ok: true; data: FactionPrivilegeCheckResult[] }>(
    `/factions/mine/privileges?${params.toString()}`
  );
}