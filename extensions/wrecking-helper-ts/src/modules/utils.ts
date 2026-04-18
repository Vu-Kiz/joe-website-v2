export function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export function formatStamp(prefix: string, counter: number): string {
  return `${prefix} #${pad(counter)}`;
}
