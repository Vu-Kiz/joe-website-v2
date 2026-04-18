export function pad(n) {
    return String(n).padStart(3, "0");
}
export function formatStamp(prefix, counter) {
    return `${prefix} #${pad(counter)}`;
}
