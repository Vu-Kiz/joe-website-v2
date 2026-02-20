import { getApiBaseUrl } from "./auth";

export type BlogPost = {
  id: number;
  title: string;
  body: string;
  image_path: string | null;
  image_url: string | null;
  author_uid: string;
  author_handle: string;
  created_at: string;
  updated_at: string | null;
  cgt_created: string | null;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed (${res.status})`);

  return (text ? JSON.parse(text) : null) as T;
}

export function listBlog(): Promise<{ ok: true; posts: BlogPost[] }> {
  return apiFetch("/blog");
}

export function createBlog(payload: {
  title: string;
  body: string;
  image_path?: string | null;
  image_url?: string | null;
}): Promise<{ ok: true; post: BlogPost }> {
  return apiFetch("/blog", { method: "POST", body: JSON.stringify(payload) });
}
