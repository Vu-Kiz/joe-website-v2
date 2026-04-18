type WebsiteBridgeRequest = {
  source: "joe-website";
  type: "JOE_EXTENSION_REQUEST";
  requestId: string;
  action: string;
  payload?: Record<string, unknown>;
};

type WebsiteBridgeResponse = {
  source: "joe-wrecking-helper-extension";
  type: "JOE_EXTENSION_RESPONSE";
  requestId: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

let toastEl: HTMLDivElement | null = null;
let toastTimer: number | null = null;
let pendingInsertText: string | null = null;
let pendingInsertAttempts = 0;
let pendingInsertTimer: number | null = null;
let pendingInsertLoadHooked = false;

const EXTENSION_SOURCE = "joe-wrecking-helper-extension";
const WEBSITE_SOURCE = "joe-website";

function showToast(message: string): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.style.cssText = `
      position: fixed;
      bottom: 18px;
      right: 18px;
      z-index: 2147483647;
      background: rgba(20, 20, 35, 0.92);
      color: #e0e0e0;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      padding: 8px 14px;
      border-radius: 8px;
      border-left: 3px solid #f5b400;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      pointer-events: none;
      transition: opacity 0.3s ease;
      opacity: 0;
      white-space: nowrap;
    `;
    document.documentElement.appendChild(toastEl);
  }

  toastEl.textContent = message;
  toastEl.style.opacity = "1";

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    if (toastEl) {
      toastEl.style.opacity = "0";
    }
  }, 2000);
}

function showPrompt(current: number): void {
  const existing = document.getElementById("wrecking-helper-counter-prompt");
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement("div");
  overlay.id = "wrecking-helper-counter-prompt";
  overlay.style.cssText = `
    position: fixed;
    bottom: 18px;
    right: 18px;
    z-index: 2147483647;
    background: rgba(20, 20, 35, 0.96);
    color: #e0e0e0;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    padding: 10px 14px;
    border-radius: 8px;
    border-left: 3px solid #f5b400;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  overlay.innerHTML = `
    <span style="color:#f5b400">Set counter:</span>
    <input id="wrecking-helper-counter-input" type="number" min="1" value="${current}"
      style="width:60px; background:#2d2d4e; border:1px solid #4b4b6e;
             color:#e0e0e0; border-radius:4px; padding:3px 6px; font-size:13px;" />
    <span style="color:#6b7280; font-size:11px">Enter ✓  Esc ✗</span>
  `;

  document.documentElement.appendChild(overlay);
  const input = document.getElementById("wrecking-helper-counter-input") as HTMLInputElement | null;
  if (!input) {
    return;
  }

  input.focus();
  input.select();

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      const value = Number.parseInt(input.value, 10);
      if (Number.isFinite(value) && value >= 1) {
        chrome.runtime.sendMessage({ action: "setCounter", value }, () => {
          showToast(`✏️ Counter set to #${String(value).padStart(3, "0")}`);
        });
      }
      overlay.remove();
      event.preventDefault();
    } else if (event.key === "Escape") {
      overlay.remove();
      event.preventDefault();
    }
  });
}

function dispatchSyntheticEnd(target: HTMLInputElement | HTMLTextAreaElement): void {
  const keydown = new KeyboardEvent("keydown", {
    key: "End",
    code: "End",
    bubbles: true,
    cancelable: true,
  });
  const keyup = new KeyboardEvent("keyup", {
    key: "End",
    code: "End",
    bubbles: true,
    cancelable: true,
  });

  target.dispatchEvent(keydown);
  target.dispatchEvent(keyup);
}

function tryInsertTextNow(text: string): boolean {
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | HTMLElement | null;
  if (!active) {
    return false;
  }

  if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") {
    const input = active as HTMLInputElement | HTMLTextAreaElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
    const position = start + text.length;
    input.setSelectionRange(position, position);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    dispatchSyntheticEnd(input);
    return true;
  }

  if (active.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount < 1) {
      return false;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    active.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  return false;
}

function runPendingInsert(): void {
  if (!pendingInsertText) {
    return;
  }

  const inserted = tryInsertTextNow(pendingInsertText);
  if (inserted) {
    pendingInsertText = null;
    pendingInsertAttempts = 0;
    if (pendingInsertTimer) {
      window.clearTimeout(pendingInsertTimer);
      pendingInsertTimer = null;
    }
    return;
  }

  if (pendingInsertAttempts <= 0) {
    pendingInsertText = null;
    return;
  }

  pendingInsertAttempts -= 1;
  if (pendingInsertTimer) {
    window.clearTimeout(pendingInsertTimer);
  }
  pendingInsertTimer = window.setTimeout(() => {
    runPendingInsert();
  }, 180);
}

function queueInsertForReadyPage(text: string): void {
  pendingInsertText = text;
  pendingInsertAttempts = 18;

  if (!pendingInsertLoadHooked) {
    pendingInsertLoadHooked = true;
    window.addEventListener("load", () => {
      runPendingInsert();
    }, { once: true });
  }

  if (document.readyState === "complete") {
    runPendingInsert();
  }
}

function insertText(text: string): void {
  if (document.readyState !== "complete") {
    queueInsertForReadyPage(text);
    return;
  }

  const inserted = tryInsertTextNow(text);
  if (!inserted) {
    queueInsertForReadyPage(text);
  }
}

chrome.runtime.onMessage.addListener((msg: any) => {
  switch (msg?.action) {
    case "toast":
      showToast(String(msg.message ?? ""));
      break;
    case "promptCounter":
      showPrompt(Number(msg.current ?? 1));
      break;
    case "insertText":
      insertText(String(msg.text ?? ""));
      break;
    default:
      break;
  }
});

function isLocalHotkey(event: KeyboardEvent): boolean {
  return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.repeat;
}

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!isLocalHotkey(event)) {
    return;
  }

  switch (event.code) {
    case "KeyQ":
      event.preventDefault();
      chrome.runtime.sendMessage({ action: "stampNow" }, () => {});
      return;
    case "KeyC":
      event.preventDefault();
      chrome.runtime.sendMessage({ action: "countBack" }, () => {});
      return;
    case "KeyW":
      event.preventDefault();
      chrome.runtime.sendMessage({ action: "toggleRecycle" }, () => {});
      return;
    case "KeyX":
      event.preventDefault();
      chrome.runtime.sendMessage({ action: "getCounter" }, (response: any) => {
        showPrompt(Number(response?.counter ?? 1));
      });
      return;
    default:
      return;
  }
});

function isAllowedWebsiteRequest(event: MessageEvent): event is MessageEvent<WebsiteBridgeRequest> {
  const data = event.data as WebsiteBridgeRequest | undefined;
  if (!data || typeof data !== "object") {
    return false;
  }
  if (data.type !== "JOE_EXTENSION_REQUEST" || data.source !== WEBSITE_SOURCE || !data.requestId) {
    return false;
  }
  return event.origin === window.location.origin;
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || !isAllowedWebsiteRequest(event)) {
    return;
  }

  chrome.runtime.sendMessage({ action: "websiteBridge", request: event.data }, (response: any) => {
    const payload: WebsiteBridgeResponse = {
      source: EXTENSION_SOURCE,
      type: "JOE_EXTENSION_RESPONSE",
      requestId: event.data.requestId,
      ok: Boolean(response?.ok),
      data: response?.data,
      error: response?.error,
    };

    window.postMessage(payload, event.origin);
  });
});

window.postMessage(
  {
    source: EXTENSION_SOURCE,
    type: "JOE_EXTENSION_READY",
    data: { version: chrome.runtime.getManifest().version },
  },
  window.location.origin
);
 
