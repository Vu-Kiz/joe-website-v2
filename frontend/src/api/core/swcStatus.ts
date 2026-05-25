import { getApiBaseUrl } from "./auth";

export type SwcStatusResponse = {
  ok: boolean;
  down: boolean;
  monitor_name: string;
  checked_at: string | null;
};

export async function fetchSwcStatus(): Promise<SwcStatusResponse> {
  const res = await fetch(`${getApiBaseUrl()}/swc-status`);
  if (!res.ok) throw new Error("Failed to fetch SWC status");
  return res.json();
}
