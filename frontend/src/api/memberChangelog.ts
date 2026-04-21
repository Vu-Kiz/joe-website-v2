import { apiFetch } from "./auth";

export type MemberChangelogEntry = {
  id: number;
  version: string;
  title: string;
  details: string;
  tools: string[];
  audiences: string[];
  released_at: string | null;
};

export async function getMemberChangelog() {
  const response = await apiFetch<{ ok: true; data: MemberChangelogEntry[] }>("/member/changelog");
  return response.data ?? [];
}

