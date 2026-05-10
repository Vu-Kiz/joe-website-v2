export function formatMarketName(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
