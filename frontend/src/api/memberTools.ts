import { apiFetch } from "./auth";

export type MemberToolArea =
  | "jobs"
  | "astrogation"
  | "entity_stats"
  | "hyper_planner"
  | "fleet_command"
  | "galactic_archive"
  | "payments"
  | "droidbrain";

export async function logMemberToolOpen(area: MemberToolArea, pagePath?: string) {
  return apiFetch<{ ok: true }>("/member-tools/access", {
    method: "POST",
    body: JSON.stringify({
      area,
      page_path: pagePath ?? (typeof window !== "undefined" ? window.location.pathname : ""),
    }),
  });
}
