import * as State from "./state.js";

export const RECYCLE_URL = "https://www.swcombine.com/members/cockpit/recycling";

export type ToggleResult = {
  success: boolean;
  action: "return" | "return_failed" | "switch" | "create" | "error";
  message: string;
};

export async function findTabByUrl(urlPattern: string): Promise<any | null> {
  try {
    const tabs = await chrome.tabs.query({ url: urlPattern });
    return Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
  } catch (error) {
    console.error("findTabByUrl failed:", error);
    return null;
  }
}

export async function findRecyclingTab(): Promise<any | null> {
  return findTabByUrl("https://www.swcombine.com/members/cockpit/recycling*");
}

export async function createTab(url: string): Promise<any> {
  return chrome.tabs.create({ url, active: true });
}

export async function switchToTab(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab?.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return true;
  } catch {
    return false;
  }
}

export async function refreshTab(tabId: number, url: string): Promise<void> {
  await chrome.tabs.update(tabId, { url });
}

export async function toggleRecycling(currentTabId: number): Promise<ToggleResult> {
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
  } catch (error) {
    console.error("toggleRecycling failed:", error);
    State.clearReturnTab();
    return { success: false, action: "error", message: "⚠️ Failed to switch tabs" };
  }
}

export function isStampPage(url: string | undefined | null): boolean {
  const baseUrl = "https://www.swcombine.com/members/position/index.php?action=Travel&subaction=Board";
  return typeof url === "string" && url.startsWith(baseUrl);
}
