import { getBackendOrigin } from "./auth";

export type CgtResponse = {
  ok: boolean;
  cgt: {
    year: number;
    day: number;
    hours: number;
    mins: number;
    secs: number;
    string: string;
  };
  swc_seconds: number;
  refreshed_at: string;
  server_now: string;
};

export async function getCgtTime(): Promise<CgtResponse> {
  const origin = getBackendOrigin();
  const url = origin ? `${origin}/api/time` : "/api/time";

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to load CGT time (${res.status})`);
  }

  return res.json();
}