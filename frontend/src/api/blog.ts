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

export type SpellcheckMatch = {
  message: string;
  short_message: string | null;
  offset: number | null;
  length: number | null;
  raw_offset?: number | null;
  raw_length?: number | null;
  context_text: string | null;
  context_offset: number | null;
  context_length: number | null;
  sentence: string | null;
  rule_id: string | null;
  rule_category: string | null;
  replacements: string[];
};

export type JenSpellcheckResult = {
  language: string;
  title_matches: SpellcheckMatch[];
  body_matches: SpellcheckMatch[];
  title_count: number;
  body_count: number;
  total_count: number;
  body_text: string;
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

export function spellcheckBlog(payload: {
  title?: string;
  body?: string;
  language?: string;
}): Promise<{ ok: true; data: JenSpellcheckResult }> {
  return apiFetch<{ ok: true; data: JenSpellcheckResult }>(`/blog/spellcheck`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
