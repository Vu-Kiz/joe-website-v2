import { getApiBaseUrl } from "./auth";

export type UploadResponse = {
  ok: true;
  type: string;
  path: string;
  url: string;
};

export async function uploadImage(file: File, type: string): Promise<UploadResponse> {
  const base = getApiBaseUrl();

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${base}/upload?type=${encodeURIComponent(type)}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || `Upload failed (${res.status})`);

  return JSON.parse(text) as UploadResponse;
}
