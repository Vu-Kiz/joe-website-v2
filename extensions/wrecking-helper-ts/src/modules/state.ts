const KEYS = {
  COUNTER: "sessionCounter",
  PREFIX: "stampPrefix",
} as const;

const DEFAULTS = {
  COUNTER: 1,
  PREFIX: "wrecker",
} as const;

let returnTabId: number | null = null;

export async function initialize(): Promise<void> {
  try {
    const counterResult = await chrome.storage.session.get(KEYS.COUNTER);
    if (counterResult?.[KEYS.COUNTER] === undefined) {
      await chrome.storage.session.set({ [KEYS.COUNTER]: DEFAULTS.COUNTER });
    }

    const prefixResult = await chrome.storage.local.get(KEYS.PREFIX);
    if (prefixResult?.[KEYS.PREFIX] === undefined) {
      await chrome.storage.local.set({ [KEYS.PREFIX]: DEFAULTS.PREFIX });
    }
  } catch (error) {
    console.error("State initialize failed:", error);
  }
}

export async function getCounter(): Promise<number> {
  try {
    const result = await chrome.storage.session.get(KEYS.COUNTER);
    const value = Number(result?.[KEYS.COUNTER]);
    return Number.isFinite(value) && value >= 1 ? value : DEFAULTS.COUNTER;
  } catch (error) {
    console.error("getCounter failed:", error);
    return DEFAULTS.COUNTER;
  }
}

export async function setCounter(value: number): Promise<number> {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 1) {
    throw new Error(`Invalid counter value: ${value}`);
  }

  await chrome.storage.session.set({ [KEYS.COUNTER]: Math.floor(next) });
  return getCounter();
}

export async function incrementCounter(): Promise<number> {
  const current = await getCounter();
  return setCounter(current + 1);
}

export async function decrementCounter(): Promise<number> {
  const current = await getCounter();
  return setCounter(Math.max(1, current - 1));
}

export async function resetCounter(): Promise<number> {
  return setCounter(DEFAULTS.COUNTER);
}

export async function getPrefix(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(KEYS.PREFIX);
    const value = String(result?.[KEYS.PREFIX] ?? DEFAULTS.PREFIX).trim();
    return value || DEFAULTS.PREFIX;
  } catch (error) {
    console.error("getPrefix failed:", error);
    return DEFAULTS.PREFIX;
  }
}

export async function setPrefix(value: string): Promise<string> {
  const next = String(value ?? "").trim();
  if (!next) {
    throw new Error("Prefix cannot be empty.");
  }
  await chrome.storage.local.set({ [KEYS.PREFIX]: next });
  return getPrefix();
}

export function getReturnTab(): number | null {
  return returnTabId;
}

export function setReturnTab(tabId: number): void {
  returnTabId = tabId;
}

export function clearReturnTab(): void {
  returnTabId = null;
}

export function isReturnMode(): boolean {
  return returnTabId !== null;
}
