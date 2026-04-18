import { formatStamp, pad } from "./modules/utils.js";

async function sendMessage<T = any>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element not found: ${id}`);
  }
  return element as T;
}

async function refresh(): Promise<void> {
  const counterResponse = await sendMessage<{ counter: number }>({ action: "getCounter" });
  const prefixResponse = await sendMessage<{ prefix: string; syncedFromWebsite?: boolean; syncError?: string }>({ action: "getPrefix" });
  const authResponse = await sendMessage<{ apiBaseUrl: string; hasToken: boolean }>({ action: "getAuthConfig" });
  const counter = Number(counterResponse?.counter ?? 1);
  const prefix = String(prefixResponse?.prefix ?? "wrecker");
  const hasToken = Boolean(authResponse?.hasToken);

  byId<HTMLElement>("counterDisplay").textContent = pad(counter);
  byId<HTMLElement>("previewText").textContent = formatStamp(prefix, counter);
  byId<HTMLInputElement>("setCounterInput").value = String(counter);
  byId<HTMLInputElement>("prefixInput").value = prefix;
  byId<HTMLElement>("authStatus").textContent = hasToken ? "Logged in" : "Not logged in";
  byId<HTMLElement>("authStatus").style.color = hasToken ? "#86efac" : "#fca5a5";
  const prefixStatusEl = byId<HTMLElement>("prefixStatus");
  if (!hasToken) {
    prefixStatusEl.textContent = "Local prefix mode (no token)";
    prefixStatusEl.style.color = "#9ca3af";
  } else if (prefixResponse?.syncedFromWebsite) {
    prefixStatusEl.textContent = "Synced with website";
    prefixStatusEl.style.color = "#86efac";
  } else if (prefixResponse?.syncError) {
    prefixStatusEl.textContent = `Website sync failed: ${prefixResponse.syncError}`;
    prefixStatusEl.style.color = "#fca5a5";
  } else {
    prefixStatusEl.textContent = "Using local prefix";
    prefixStatusEl.style.color = "#9ca3af";
  }
}

async function setCounterFromInput(): Promise<void> {
  const input = byId<HTMLInputElement>("setCounterInput");
  const value = Number.parseInt(input.value, 10);
  if (!Number.isFinite(value) || value < 1) {
    return;
  }
  await sendMessage({ action: "setCounter", value });
  await refresh();
}

async function savePrefixFromInput(): Promise<void> {
  const input = byId<HTMLInputElement>("prefixInput");
  const value = input.value.trim();
  if (!value) {
    return;
  }
  const response = await sendMessage<{ prefix: string; savedToWebsite?: boolean; syncError?: string }>({ action: "setPrefix", value });
  await refresh();
  const prefixStatusEl = byId<HTMLElement>("prefixStatus");
  if (response?.savedToWebsite) {
    prefixStatusEl.textContent = "Saved to website";
    prefixStatusEl.style.color = "#86efac";
  } else if (response?.syncError) {
    prefixStatusEl.textContent = `Saved locally; website failed: ${response.syncError}`;
    prefixStatusEl.style.color = "#fca5a5";
  } else {
    prefixStatusEl.textContent = "Saved locally";
    prefixStatusEl.style.color = "#9ca3af";
  }
  const button = byId<HTMLButtonElement>("savePrefixBtn");
  const original = button.textContent;
  button.textContent = "✓ Saved!";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

async function clearAuthToken(): Promise<void> {
  await sendMessage({ action: "clearAuthToken" });
  await refresh();
}

byId<HTMLButtonElement>("resetBtn").addEventListener("click", async () => {
  await sendMessage({ action: "setCounter", value: 1 });
  await refresh();
});

byId<HTMLButtonElement>("setCounterBtn").addEventListener("click", () => {
  void setCounterFromInput();
});

byId<HTMLButtonElement>("savePrefixBtn").addEventListener("click", () => {
  void savePrefixFromInput();
});
byId<HTMLButtonElement>("clearTokenBtn").addEventListener("click", () => {
  void clearAuthToken();
});

byId<HTMLInputElement>("setCounterInput").addEventListener("keypress", (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    void setCounterFromInput();
  }
});

byId<HTMLInputElement>("prefixInput").addEventListener("keypress", (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    void savePrefixFromInput();
  }
});

void refresh();
