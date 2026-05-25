import { apiFetch } from "../core/auth";

export type AdminNavPreferencesResponse = {
  ok: boolean;
  data: {
    recents: string[];
    favorites: string[];
  };
};

export async function getAdminNavPreferences(): Promise<AdminNavPreferencesResponse> {
  return apiFetch<AdminNavPreferencesResponse>("/admin/nav-preferences", {
    method: "GET",
  });
}

export async function updateAdminNavRecents(recents: string[]): Promise<AdminNavPreferencesResponse> {
  return apiFetch<AdminNavPreferencesResponse>("/admin/nav-preferences/recents", {
    method: "PUT",
    body: JSON.stringify({ recents }),
  });
}

export async function updateAdminNavFavorites(favorites: string[]): Promise<AdminNavPreferencesResponse> {
  return apiFetch<AdminNavPreferencesResponse>("/admin/nav-preferences/favorites", {
    method: "PUT",
    body: JSON.stringify({ favorites }),
  });
}

