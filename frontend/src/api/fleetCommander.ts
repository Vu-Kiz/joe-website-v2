import { apiFetch } from "./auth";

export type FleetMember = {
  id: number;
  handle: string | null;
  swc_character_id: number;
  swc_uid: string | null;
  avatar_url: string | null;
};

export type FleetRosterMatrixRow = FleetMember & {
  strength: number | null;
  dexterity: number | null;
  speed: number | null;
  dodge: number | null;
  projectile: number | null;
  non_projectile: number | null;
  fighter_piloting: number | null;
  fighter_combat: number | null;
  capital_piloting: number | null;
  capital_combat: number | null;
  space_command: number | null;
  vehicle_piloting: number | null;
  vehicle_combat: number | null;
  infantry_command: number | null;
  vehicle_command: number | null;
  heavy_weapons: number | null;
  medical: number | null;
  diplomacy: number | null;
  crafting: number | null;
  management: number | null;
  perception: number | null;
  stealth: number | null;
  rnd_hull: number | null;
  rnd_electronics: number | null;
  rnd_engines: number | null;
  rnd_weapons: number | null;
  repair: number | null;
  comp_ops: number | null;
  fighter_garrison_score: number | null;
  has_snapshot: boolean;
  fetched_at: string | null;
  snapshot_error: string | null;
};

export async function getFleetMembers() {
  return apiFetch<{ ok: true; data: FleetMember[] }>(`/fleet/members`);
}

export async function getFleetRosterMatrix() {
  return apiFetch<{
    ok: true;
    generated_at: string;
    data: FleetRosterMatrixRow[];
  }>(`/fleet/roster-matrix`);
}

export async function getFleetMemberSkills(uid: string) {
  const normalizedUid = String(uid ?? "").trim();
  const encoded = encodeURIComponent(normalizedUid);

  return apiFetch<{
    ok: true;
    uid: string;
    auth_mode: "oauth" | "bearer" | string;
    data: Record<string, unknown>;
  }>(`/fleet/member-skills/${encoded}`);
}
