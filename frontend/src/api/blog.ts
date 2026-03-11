import { apiFetch } from "./auth";

export type BlogPost = {
  id: number;
  title: string;
  body: string;
  image_path: string | null;
  image_url: string | null;
  author_uid: string | null;
  author_handle: string | null;
  cgt_created: string | null;
  created_at: string;
};

export function listBlog(): Promise<{ ok: true; posts: BlogPost[] }> {
  return apiFetch<{ ok: true; posts: BlogPost[] }>("/blog");
}

export function getBlogPost(id: number): Promise<{ ok: true; post: BlogPost }> {
  return apiFetch<{ ok: true; post: BlogPost }>(`/blog/${id}`);
}

export function createBlog(payload: {
  title: string;
  body: string;
  image_path?: string | null;
  image_url?: string | null;
}): Promise<{ ok: true; post: BlogPost }> {
  return apiFetch<{ ok: true; post: BlogPost }>("/blog", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBlog(
  id: number,
  payload: {
    title?: string;
    body?: string;
    image_path?: string | null;
    image_url?: string | null;
  }
): Promise<{ ok: true; post: BlogPost }> {
  return apiFetch<{ ok: true; post: BlogPost }>(`/blog/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteBlog(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/blog/${id}`, {
    method: "DELETE",
  });
}