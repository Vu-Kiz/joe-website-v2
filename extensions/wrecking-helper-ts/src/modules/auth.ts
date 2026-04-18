const KEYS = {
  API_BASE_URL: "authApiBaseUrl",
  AUTH_TOKEN: "authBearerToken",
} as const;

const DEFAULTS = {
  API_BASE_URL: "https://api.swc-joe.com",
} as const;

function normalizeApiBaseUrl(value: string): string {
  const trimmed = String(value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

export async function getApiBaseUrl(): Promise<string> {
  const result = await chrome.storage.local.get(KEYS.API_BASE_URL);
  const stored = String(result?.[KEYS.API_BASE_URL] ?? "").trim();
  return normalizeApiBaseUrl(stored || DEFAULTS.API_BASE_URL);
}

export async function setApiBaseUrl(value: string): Promise<string> {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    throw new Error("API base URL cannot be empty.");
  }
  await chrome.storage.local.set({ [KEYS.API_BASE_URL]: normalized });
  return getApiBaseUrl();
}

export async function getAuthToken(): Promise<string> {
  const result = await chrome.storage.local.get(KEYS.AUTH_TOKEN);
  return String(result?.[KEYS.AUTH_TOKEN] ?? "").trim();
}

export async function setAuthToken(token: string): Promise<boolean> {
  const value = String(token ?? "").trim();
  if (!value) {
    throw new Error("Token cannot be empty.");
  }
  await chrome.storage.local.set({ [KEYS.AUTH_TOKEN]: value });
  return true;
}

export async function clearAuthToken(): Promise<void> {
  await chrome.storage.local.remove(KEYS.AUTH_TOKEN);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return token.length > 0;
}

export async function getAuthSummary(): Promise<{ apiBaseUrl: string; hasToken: boolean }> {
  const [apiBaseUrl, hasToken] = await Promise.all([getApiBaseUrl(), isLoggedIn()]);
  return { apiBaseUrl, hasToken };
}

export function buildAuthorizeUrl(apiBaseUrl: string): string {
  const normalized = normalizeApiBaseUrl(apiBaseUrl || DEFAULTS.API_BASE_URL);
  return `${normalized}/api/extension/authorize-action`;
}

export function buildWreckingHelperSettingsUrl(apiBaseUrl: string): string {
  const normalized = normalizeApiBaseUrl(apiBaseUrl || DEFAULTS.API_BASE_URL);
  return `${normalized}/api/extension/wrecking-helper/settings`;
}
