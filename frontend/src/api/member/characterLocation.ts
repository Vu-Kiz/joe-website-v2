import { apiFetch } from "../core/auth";

export type CharacterLocation = {
  sector: string | null;
  system: string | null;
  system_type: string | null;
  docked: boolean;
  container: { name: string | null; uid: string | null; type: string | null } | null;
  galx: number | null;
  galy: number | null;
  sysx: number | null;
  sysy: number | null;
};

export async function getMyCharacterLocation() {
  return apiFetch<{ ok: boolean; data?: CharacterLocation; message?: string }>(
    `/character-location`
  );
}
