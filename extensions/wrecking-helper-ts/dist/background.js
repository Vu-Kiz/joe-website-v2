import * as State from "./modules/state.js";
import * as Tabs from "./modules/tabs.js";
import * as Auth from "./modules/auth.js";
import { formatStamp, pad } from "./modules/utils.js";
State.initialize();
function isExtensionTab(tab) {
    return Boolean(tab && typeof tab.id === "number");
}
async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const [tab] = tabs;
    return isExtensionTab(tab) ? tab : null;
}
function toast(tabId, message) {
    chrome.tabs.sendMessage(tabId, { action: "toast", message }).catch(() => { });
}
async function fetchWebsitePrefix() {
    const token = await Auth.getAuthToken();
    if (!token) {
        return { ok: false, reason: "Not logged in." };
    }
    const apiBaseUrl = await Auth.getApiBaseUrl();
    const url = Auth.buildWreckingHelperSettingsUrl(apiBaseUrl);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        const body = (await response.json().catch(() => ({})));
        if (!response.ok || !body?.ok) {
            return { ok: false, reason: String(body?.message ?? "Failed to load website prefix.") };
        }
        const prefix = String(body?.prefix ?? "").trim();
        if (!prefix) {
            return { ok: false, reason: "Website returned an empty prefix." };
        }
        return { ok: true, prefix };
    }
    catch (error) {
        return { ok: false, reason: error?.message ?? "Failed to load website prefix." };
    }
}
async function saveWebsitePrefix(prefix) {
    const token = await Auth.getAuthToken();
    if (!token) {
        return { ok: false, reason: "Not logged in." };
    }
    const apiBaseUrl = await Auth.getApiBaseUrl();
    const url = Auth.buildWreckingHelperSettingsUrl(apiBaseUrl);
    try {
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ prefix }),
        });
        const body = (await response.json().catch(() => ({})));
        if (!response.ok || !body?.ok) {
            return { ok: false, reason: String(body?.message ?? "Failed to save website prefix.") };
        }
        const resolved = String(body?.prefix ?? "").trim();
        return { ok: true, prefix: resolved || prefix };
    }
    catch (error) {
        return { ok: false, reason: error?.message ?? "Failed to save website prefix." };
    }
}
async function authorizeAction(action, context = {}) {
    const token = await Auth.getAuthToken();
    if (!token) {
        return {
            allowed: false,
            reason: "Not logged in. Save your API token in the extension popup.",
        };
    }
    const apiBaseUrl = await Auth.getApiBaseUrl();
    const url = Auth.buildAuthorizeUrl(apiBaseUrl);
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 3500);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action, context }),
            signal: abortController.signal,
        });
        const body = (await response.json().catch(() => ({})));
        if (response.ok && body.allowed === true) {
            return { allowed: true, reason: String(body.reason ?? "Authorized.") };
        }
        if (response.status === 401) {
            return { allowed: false, reason: "Token is invalid or expired. Re-authenticate in popup." };
        }
        if (response.status === 429) {
            return { allowed: false, reason: String(body.message ?? "Rate limited by server. Wait a moment and retry.") };
        }
        return {
            allowed: false,
            reason: String(body.reason ?? body.message ?? `Action denied by server policy (HTTP ${response.status}).`),
        };
    }
    catch (error) {
        const errorMessage = String(error?.message ?? "").trim();
        return {
            allowed: false,
            reason: error?.name === "AbortError"
                ? "Authorization timed out. Try again."
                : `Authorization check failed. ${errorMessage || "Verify API base URL and network."}`,
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
async function handleReset(tabId) {
    await State.resetCounter();
    toast(tabId, "↺ Reset → #001");
}
async function handleSetCount(tabId) {
    const counter = await State.getCounter();
    chrome.tabs.sendMessage(tabId, { action: "promptCounter", current: counter }).catch(() => { });
}
async function handleRecycle(tabId) {
    const auth = await authorizeAction("recycle", { tabId });
    if (!auth.allowed) {
        toast(tabId, `⛔ ${auth.reason}`);
        return;
    }
    const result = await Tabs.toggleRecycling(tabId);
    if (result.success || result.action === "error") {
        toast(tabId, result.message);
    }
}
async function handleStamp(tabId, currentUrl) {
    if (!Tabs.isStampPage(currentUrl)) {
        toast(tabId, "Open a SWCombine board page first, then use Alt+Q.");
        return;
    }
    const auth = await authorizeAction("stamp", {
        tabId,
        url: currentUrl ?? "",
    });
    if (!auth.allowed) {
        toast(tabId, `⛔ ${auth.reason}`);
        return;
    }
    const counter = await State.getCounter();
    const prefix = await State.getPrefix();
    const text = formatStamp(prefix, counter);
    chrome.tabs.sendMessage(tabId, { action: "insertText", text }).catch(() => { });
    const nextCounter = await State.incrementCounter();
    toast(tabId, `✓ Pasted #${pad(counter)}  →  next: #${pad(nextCounter)}`);
}
async function handleCountBack(tabId, currentUrl) {
    if (!Tabs.isStampPage(currentUrl)) {
        toast(tabId, "Open a SWCombine board page first, then use Alt+C.");
        return;
    }
    const auth = await authorizeAction("countback", {
        tabId,
        url: currentUrl ?? "",
    });
    if (!auth.allowed) {
        toast(tabId, `⛔ ${auth.reason}`);
        return;
    }
    const next = await State.decrementCounter();
    toast(tabId, `⏪ Back → now at #${pad(next)}`);
}
chrome.commands.onCommand.addListener(async (command) => {
    const activeTab = await getActiveTab();
    if (!activeTab) {
        return;
    }
    try {
        switch (command) {
            case "reset":
                await handleReset(activeTab.id);
                break;
            case "setcount":
                await handleSetCount(activeTab.id);
                break;
            case "recycle":
                await handleRecycle(activeTab.id);
                break;
            case "stamp":
                await handleStamp(activeTab.id, activeTab.url);
                break;
            case "countback":
                await handleCountBack(activeTab.id, activeTab.url);
                break;
            default:
                break;
        }
    }
    catch (error) {
        console.error("Command handling failed:", error);
        toast(activeTab.id, "⚠️ An error occurred");
    }
});
async function handleWebsiteBridge(request) {
    try {
        switch (request.action) {
            case "ping":
                return { ok: true, data: { connected: true, version: chrome.runtime.getManifest().version } };
            case "getAuthConfig":
                return { ok: true, data: await Auth.getAuthSummary() };
            case "setAuthConfig": {
                const apiBaseUrl = String(request.payload?.apiBaseUrl ?? "");
                const token = String(request.payload?.token ?? "").trim();
                if (!apiBaseUrl || !token) {
                    return { ok: false, error: "apiBaseUrl and token are required." };
                }
                await Auth.setApiBaseUrl(apiBaseUrl);
                await Auth.setAuthToken(token);
                const websiteResult = await fetchWebsitePrefix();
                if (websiteResult.ok && websiteResult.prefix) {
                    await State.setPrefix(websiteResult.prefix);
                }
                return { ok: true, data: await Auth.getAuthSummary() };
            }
            case "clearAuthToken":
                await Auth.clearAuthToken();
                return { ok: true, data: await Auth.getAuthSummary() };
            case "getCounter":
                return { ok: true, data: { counter: await State.getCounter() } };
            case "setCounter":
                return { ok: true, data: { counter: await State.setCounter(Number(request.payload?.value ?? 1)) } };
            case "getPrefix":
                return { ok: true, data: { prefix: await State.getPrefix() } };
            case "setPrefix":
                return { ok: true, data: { prefix: await State.setPrefix(String(request.payload?.value ?? "")) } };
            case "resetCounter":
                return { ok: true, data: { counter: await State.resetCounter() } };
            case "getState": {
                const counter = await State.getCounter();
                const prefix = await State.getPrefix();
                return { ok: true, data: { counter, prefix, preview: formatStamp(prefix, counter) } };
            }
            case "countBack": {
                const activeTab = await getActiveTab();
                if (activeTab) {
                    await handleCountBack(activeTab.id, activeTab.url);
                }
                return { ok: true, data: { counter: await State.getCounter() } };
            }
            case "stampNow": {
                const activeTab = await getActiveTab();
                if (activeTab) {
                    await handleStamp(activeTab.id, activeTab.url);
                }
                return { ok: true, data: { counter: await State.getCounter() } };
            }
            case "toggleRecycle": {
                const activeTab = await getActiveTab();
                if (activeTab) {
                    await handleRecycle(activeTab.id);
                }
                return { ok: true };
            }
            default:
                return { ok: false, error: `Unsupported action: ${request.action}` };
        }
    }
    catch (error) {
        return { ok: false, error: error?.message ?? "Bridge request failed" };
    }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        try {
            switch (message.action) {
                case "getCounter":
                    sendResponse({ counter: await State.getCounter() });
                    return;
                case "setCounter":
                    sendResponse({ counter: await State.setCounter(message.value) });
                    return;
                case "getPrefix":
                    {
                        const localPrefix = await State.getPrefix();
                        const hasToken = await Auth.isLoggedIn();
                        if (!hasToken) {
                            sendResponse({ prefix: localPrefix, syncedFromWebsite: false });
                            return;
                        }
                        const websiteResult = await fetchWebsitePrefix();
                        if (websiteResult.ok && websiteResult.prefix) {
                            const resolved = await State.setPrefix(websiteResult.prefix);
                            sendResponse({ prefix: resolved, syncedFromWebsite: true });
                            return;
                        }
                        sendResponse({
                            prefix: localPrefix,
                            syncedFromWebsite: false,
                            syncError: websiteResult.reason ?? "Website prefix sync failed.",
                        });
                    }
                    return;
                case "setPrefix":
                    {
                        const localPrefix = await State.setPrefix(message.value);
                        const hasToken = await Auth.isLoggedIn();
                        if (!hasToken) {
                            sendResponse({ prefix: localPrefix, savedToWebsite: false });
                            return;
                        }
                        const saveResult = await saveWebsitePrefix(localPrefix);
                        if (saveResult.ok && saveResult.prefix) {
                            const resolved = await State.setPrefix(saveResult.prefix);
                            sendResponse({ prefix: resolved, savedToWebsite: true });
                            return;
                        }
                        sendResponse({
                            prefix: localPrefix,
                            savedToWebsite: false,
                            syncError: saveResult.reason ?? "Website save failed.",
                        });
                    }
                    return;
                case "stampNow": {
                    const activeTab = await getActiveTab();
                    if (activeTab) {
                        await handleStamp(activeTab.id, activeTab.url);
                    }
                    sendResponse({ counter: await State.getCounter() });
                    return;
                }
                case "countBack": {
                    const activeTab = await getActiveTab();
                    if (activeTab) {
                        await handleCountBack(activeTab.id, activeTab.url);
                    }
                    sendResponse({ counter: await State.getCounter() });
                    return;
                }
                case "toggleRecycle": {
                    const activeTab = await getActiveTab();
                    if (activeTab) {
                        await handleRecycle(activeTab.id);
                    }
                    sendResponse({ ok: true });
                    return;
                }
                case "getAuthConfig":
                    sendResponse(await Auth.getAuthSummary());
                    return;
                case "setAuthConfig": {
                    const apiBaseUrl = await Auth.setApiBaseUrl(message.apiBaseUrl);
                    if (typeof message.token === "string") {
                        const trimmedToken = message.token.trim();
                        if (trimmedToken) {
                            await Auth.setAuthToken(trimmedToken);
                        }
                    }
                    const authSummary = await Auth.getAuthSummary();
                    if (authSummary.hasToken) {
                        const websiteResult = await fetchWebsitePrefix();
                        if (websiteResult.ok && websiteResult.prefix) {
                            await State.setPrefix(websiteResult.prefix);
                        }
                    }
                    sendResponse(await Auth.getAuthSummary());
                    return;
                }
                case "clearAuthToken":
                    await Auth.clearAuthToken();
                    sendResponse(await Auth.getAuthSummary());
                    return;
                case "websiteBridge":
                    sendResponse(await handleWebsiteBridge(message.request));
                    return;
                default:
                    sendResponse({ error: "Unknown action" });
            }
        }
        catch (error) {
            sendResponse({ error: error?.message ?? "Request failed" });
        }
    })();
    return true;
});
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    (async () => {
        if (!message || message.type !== "JOE_EXTENSION_REQUEST" || message.source !== "joe-website") {
            sendResponse({ ok: false, error: "Invalid external message format" });
            return;
        }
        sendResponse(await handleWebsiteBridge(message));
    })();
    return true;
});
