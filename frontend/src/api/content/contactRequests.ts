import { apiFetch } from "../core/auth";

export type ContactRequestPayload = {
  request_type: "contact" | "diplomacy";
  discord_name: string;
  star_wars_handle: string;
  message: string;
};

export async function submitContactRequest(payload: ContactRequestPayload) {
  return apiFetch<{ ok: true; message: string }>("/contact-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
