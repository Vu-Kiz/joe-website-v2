import * as State from "./state.js";
export const RECYCLE_URL = "https://www.swcombine.com/members/cockpit/recycling";
export async function findTabByUrl(urlPattern) {
    try {
        const tabs = await chrome.tabs.query({ url: urlPattern });
        return Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
    }
    catch (error) {
        console.error("findTabByUrl failed:", error);
        return null;
    }
}
export async function findRecyclingTab() {
    return findTabByUrl("https://www.swcombine.com/members/cockpit/recycling*");
}
export async function createTab(url) {
    return chrome.tabs.create({ url, active: true });
}
export async function switchToTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { active: true });
        if (tab?.windowId !== undefined) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
        return true;
    }
    catch {
        return false;
    }
}
export async function refreshTab(tabId, url) {
    await chrome.tabs.update(tabId, { url });
}
export async function toggleRecycling(currentTabId) {
    try {
        if (State.isReturnMode()) {
            const previous = State.getReturnTab();
            if (previous === null) {
                State.clearReturnTab();
                return { success: false, action: "return_failed", message: "Previous tab not available." };
            }
            const switched = await switchToTab(previous);
            State.clearReturnTab();
            if (switched) {
                return { success: true, action: "return", message: "← Returned to previous tab" };
            }
            return { success: false, action: "return_failed", message: "⚠️ Previous tab was closed" };
        }
        State.setReturnTab(currentTabId);
        const recyclingTab = await findRecyclingTab();
        if (recyclingTab?.id) {
            await switchToTab(recyclingTab.id);
            await refreshTab(recyclingTab.id, RECYCLE_URL);
            return { success: true, action: "switch", message: "→ Switched to recycling page" };
        }
        await createTab(RECYCLE_URL);
        return { success: true, action: "create", message: "→ Created recycling tab" };
    }
    catch (error) {
        console.error("toggleRecycling failed:", error);
        State.clearReturnTab();
        return { success: false, action: "error", message: "⚠️ Failed to switch tabs" };
    }
}
export function isStampPage(url) {
    const baseUrl = "https://www.swcombine.com/members/position/index.php?action=Travel&subaction=Board";
    return typeof url === "string" && url.startsWith(baseUrl);
}
