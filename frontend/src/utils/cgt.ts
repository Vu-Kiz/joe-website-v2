function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatCgt(swcSeconds: number): string {
  const secondsPerMinute = 60;
  const secondsPerHour = 3600;
  const secondsPerDay = 86400;
  const secondsPerYear = 365 * secondsPerDay;

  const safeTotal = Math.max(0, Math.floor(swcSeconds));
  const year = Math.floor(safeTotal / secondsPerYear);
  const yearRemainder = safeTotal % secondsPerYear;
  const day = Math.floor(yearRemainder / secondsPerDay);
  const dayRemainder = yearRemainder % secondsPerDay;
  const hours = Math.floor(dayRemainder / secondsPerHour);
  const hourRemainder = dayRemainder % secondsPerHour;
  const mins = Math.floor(hourRemainder / secondsPerMinute);
  const secs = hourRemainder % secondsPerMinute;

  return `Year ${year} Day ${day} · ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}
