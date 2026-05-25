/**
 * Format a credit amount with smart unit selection.
 * < 1,000       → raw number  e.g. "500"
 * < 1,000,000   → k suffix    e.g. "750k", "1.25k"
 * >= 1,000,000  → m suffix    e.g. "5m", "1.5m"
 */
export function fmtCredits(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val.toLocaleString(undefined, { maximumFractionDigits: 3 }) + "m";
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 }) + "k";
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Format a credit amount with full comma-separated values.
 * e.g. 43450 -> "43,450", 345534000 -> "345,534,000"
 */
export function fmtCreditsFull(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
