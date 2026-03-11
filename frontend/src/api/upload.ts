// src/api/upload.ts
import { getApiBaseUrl, ensureCsrfCookie, getXsrfToken } from "./auth";

export type UploadResponse = {
  ok: true;
  type: string;
  path: string;
  url: string;
};

export async function uploadImage(
  file: File,
  type: string
): Promise<UploadResponse> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("VITE_API_BASE_URL is missing");

  const form = new FormData();
  form.append("file", file);

  // CSRF for this write request
  await ensureCsrfCookie();
  const xsrf = getXsrfToken();

  const res = await fetch(
    `${base}/upload?type=${encodeURIComponent(type)}`,
    {
      method: "POST",
      credentials: "include",
      body: form,
      headers: xsrf ? { "X-XSRF-TOKEN": xsrf } : undefined,
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Upload failed (${res.status})`);
  }

  return JSON.parse(text) as UploadResponse;
}