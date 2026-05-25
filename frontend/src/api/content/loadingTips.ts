// frontend/src/api/loadingTip.ts

export interface LoadingTipResponse {
  ok: boolean;
  tip: string;
  error?: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export async function getLoadingTip(): Promise<LoadingTipResponse> {
  const res = await fetch(`${API_BASE_URL}/loading-tip`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch loading tip (${res.status})`);
  }

  const data = (await res.json()) as LoadingTipResponse;

  if (!data.ok || !data.tip) {
    throw new Error(data.error || "Invalid loading tip response");
  }

  return data;
}
