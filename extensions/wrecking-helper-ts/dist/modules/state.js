const KEYS = {
    COUNTER: "sessionCounter",
    PREFIX: "stampPrefix",
};
const DEFAULTS = {
    COUNTER: 1,
    PREFIX: "wrecker",
};
let returnTabId = null;
export async function initialize() {
    try {
        const counterResult = await chrome.storage.session.get(KEYS.COUNTER);
        if (counterResult?.[KEYS.COUNTER] === undefined) {
            await chrome.storage.session.set({ [KEYS.COUNTER]: DEFAULTS.COUNTER });
        }
        const prefixResult = await chrome.storage.local.get(KEYS.PREFIX);
        if (prefixResult?.[KEYS.PREFIX] === undefined) {
            await chrome.storage.local.set({ [KEYS.PREFIX]: DEFAULTS.PREFIX });
        }
    }
    catch (error) {
        console.error("State initialize failed:", error);
    }
}
export async function getCounter() {
    try {
        const result = await chrome.storage.session.get(KEYS.COUNTER);
        const value = Number(result?.[KEYS.COUNTER]);
        return Number.isFinite(value) && value >= 1 ? value : DEFAULTS.COUNTER;
    }
    catch (error) {
        console.error("getCounter failed:", error);
        return DEFAULTS.COUNTER;
    }
}
export async function setCounter(value) {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 1) {
        throw new Error(`Invalid counter value: ${value}`);
    }
    await chrome.storage.session.set({ [KEYS.COUNTER]: Math.floor(next) });
    return getCounter();
}
export async function incrementCounter() {
    const current = await getCounter();
    return setCounter(current + 1);
}
export async function decrementCounter() {
    const current = await getCounter();
    return setCounter(Math.max(1, current - 1));
}
export async function resetCounter() {
    return setCounter(DEFAULTS.COUNTER);
}
export async function getPrefix() {
    try {
        const result = await chrome.storage.local.get(KEYS.PREFIX);
        const value = String(result?.[KEYS.PREFIX] ?? DEFAULTS.PREFIX).trim();
        return value || DEFAULTS.PREFIX;
    }
    catch (error) {
        console.error("getPrefix failed:", error);
        return DEFAULTS.PREFIX;
    }
}
export async function setPrefix(value) {
    const next = String(value ?? "").trim();
    if (!next) {
        throw new Error("Prefix cannot be empty.");
    }
    await chrome.storage.local.set({ [KEYS.PREFIX]: next });
    return getPrefix();
}
export function getReturnTab() {
    return returnTabId;
}
export function setReturnTab(tabId) {
    returnTabId = tabId;
}
export function clearReturnTab() {
    returnTabId = null;
}
export function isReturnMode() {
    return returnTabId !== null;
}
