import { apiFetch } from "../core/auth";

export type XpEventCategory = "travel" | "recycling" | "production" | "combat" | "mining" | "trading" | "other";
export type XpEventType = "xp_gain" | "skill_upgrade" | "level_up";

export type XpEvent = {
  uid: string;
  timestamp: number;
  type: XpEventType;
  amount: number;
  category: XpEventCategory | "skill_upgrade" | "level_up";
  message: string;
  skill_name?: string;
  level?: number;
  points?: number;
};

export type XpTrackerData = {
  events: XpEvent[];
  total_seen: number;
};

export function fetchXpEvents() {
  return apiFetch<{ ok: boolean; data: XpTrackerData }>("/xp-tracker");
}
