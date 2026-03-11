import { apiFetch } from "./auth";

export type TatooineWeather = {
  id: number;
  weather_date: string | null;
  temperature: number;
  adjective: string;
  advice: string;
  message: string;
  created_at: string | null;
};

export type PublicWeatherResponse = {
  ok: boolean;
  weather: TatooineWeather;
};

export type WeatherSettings = {
  min_temp: number;
  max_temp: number;
};

export type WeatherAdjective = {
  id: number;
  word: string;
  min_temp: number;
  max_temp: number;
};

export type WeatherAdviceItem = {
  id: number;
  advice: string;
  weight: number;
  is_active: boolean;
  created_at: string | null;
};

export type AdminWeatherResponse = {
  ok: boolean;
  settings: WeatherSettings;
  adjectives: WeatherAdjective[];
  advice: WeatherAdviceItem[];
};

export async function getTatooineWeather(): Promise<PublicWeatherResponse> {
  return apiFetch<PublicWeatherResponse>("/weather/tatooine", {
    method: "GET",
  });
}

export async function getAdminWeather(): Promise<AdminWeatherResponse> {
  return apiFetch<AdminWeatherResponse>("/admin/weather", {
    method: "GET",
  });
}

export async function updateWeatherSettings(payload: WeatherSettings) {
  return apiFetch("/admin/weather/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createWeatherAdjective(payload: {
  word: string;
  min_temp: number;
  max_temp: number;
}) {
  return apiFetch("/admin/weather/adjectives", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWeatherAdjective(
  id: number,
  payload: { word: string; min_temp: number; max_temp: number }
) {
  return apiFetch(`/admin/weather/adjectives/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWeatherAdjective(id: number) {
  return apiFetch(`/admin/weather/adjectives/${id}`, {
    method: "DELETE",
  });
}

export async function createWeatherAdvice(payload: {
  advice: string;
  weight: number;
  is_active?: boolean;
}) {
  return apiFetch("/admin/weather/advice", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWeatherAdvice(
  id: number,
  payload: { advice: string; weight: number; is_active: boolean }
) {
  return apiFetch(`/admin/weather/advice/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWeatherAdvice(id: number) {
  return apiFetch(`/admin/weather/advice/${id}`, {
    method: "DELETE",
  });
}