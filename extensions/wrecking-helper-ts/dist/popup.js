import { formatStamp, pad } from "./modules/utils.js";
async function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
}
function byId(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element not found: ${id}`);
    }
    return element;
}
async function refresh() {
    const counterResponse = await sendMessage({ action: "getCounter" });
    const prefixResponse = await sendMessage({ action: "getPrefix" });
    const authResponse = await sendMessage({ action: "getAuthConfig" });
    const counter = Number(counterResponse?.counter ?? 1);
    const prefix = String(prefixResponse?.prefix ?? "wrecker");
    const hasToken = Boolean(authResponse?.hasToken);
    byId("counterDisplay").textContent = pad(counter);
    byId("previewText").textContent = formatStamp(prefix, counter);
    byId("setCounterInput").value = String(counter);
    byId("prefixInput").value = prefix;
    byId("authStatus").textContent = hasToken ? "Logged in" : "Not logged in";
    byId("authStatus").style.color = hasToken ? "#86efac" : "#fca5a5";
    const prefixStatusEl = byId("prefixStatus");
    if (!hasToken) {
        prefixStatusEl.textContent = "Local prefix mode (no token)";
        prefixStatusEl.style.color = "#9ca3af";
    }
    else if (prefixResponse?.syncedFromWebsite) {
        prefixStatusEl.textContent = "Synced with website";
        prefixStatusEl.style.color = "#86efac";
    }
    else if (prefixResponse?.syncError) {
        prefixStatusEl.textContent = `Website sync failed: ${prefixResponse.syncError}`;
        prefixStatusEl.style.color = "#fca5a5";
    }
    else {
        prefixStatusEl.textContent = "Using local prefix";
        prefixStatusEl.style.color = "#9ca3af";
    }
}
async function setCounterFromInput() {
    const input = byId("setCounterInput");
    const value = Number.parseInt(input.value, 10);
    if (!Number.isFinite(value) || value < 1) {
        return;
    }
    await sendMessage({ action: "setCounter", value });
    await refresh();
}
async function savePrefixFromInput() {
    const input = byId("prefixInput");
    const value = input.value.trim();
    if (!value) {
        return;
    }
    const response = await sendMessage({ action: "setPrefix", value });
    await refresh();
    const prefixStatusEl = byId("prefixStatus");
    if (response?.savedToWebsite) {
        prefixStatusEl.textContent = "Saved to website";
        prefixStatusEl.style.color = "#86efac";
    }
    else if (response?.syncError) {
        prefixStatusEl.textContent = `Saved locally; website failed: ${response.syncError}`;
        prefixStatusEl.style.color = "#fca5a5";
    }
    else {
        prefixStatusEl.textContent = "Saved locally";
        prefixStatusEl.style.color = "#9ca3af";
    }
    const button = byId("savePrefixBtn");
    const original = button.textContent;
    button.textContent = "✓ Saved!";
    window.setTimeout(() => {
        button.textContent = original;
    }, 1200);
}
async function clearAuthToken() {
    await sendMessage({ action: "clearAuthToken" });
    await refresh();
}
byId("resetBtn").addEventListener("click", async () => {
    await sendMessage({ action: "setCounter", value: 1 });
    await refresh();
});
byId("setCounterBtn").addEventListener("click", () => {
    void setCounterFromInput();
});
byId("savePrefixBtn").addEventListener("click", () => {
    void savePrefixFromInput();
});
byId("clearTokenBtn").addEventListener("click", () => {
    void clearAuthToken();
});
byId("setCounterInput").addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        void setCounterFromInput();
    }
});
byId("prefixInput").addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        void savePrefixFromInput();
    }
});
void refresh();
