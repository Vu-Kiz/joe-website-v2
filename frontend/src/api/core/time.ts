import { getBackendOrigin } from "./auth";

export type CgtResponse = {
  ok: boolean;
  cgt: {
    year: number;
    day: number;
    hours: number;
    mins: number;
    secs: number;
    string: string;
  };
  swc_seconds: number;
  refreshed_at: string;
  server_now: string;
};

type CgtParts = {
  year: number;
  day: number;
  hours: number;
  mins: number;
  secs: number;
};

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function splitSwcSeconds(totalSeconds: number): CgtParts {
  const secondsPerMinute = 60;
  const secondsPerHour = 3600;
  const secondsPerDay = 86400;
  const secondsPerYear = 365 * secondsPerDay;

  const safeTotal = Math.max(0, Math.floor(totalSeconds));

  const year = Math.floor(safeTotal / secondsPerYear);
  const yearRemainder = safeTotal % secondsPerYear;

  const day = Math.floor(yearRemainder / secondsPerDay);
  const dayRemainder = yearRemainder % secondsPerDay;

  const hours = Math.floor(dayRemainder / secondsPerHour);
  const hourRemainder = dayRemainder % secondsPerHour;

  const mins = Math.floor(hourRemainder / secondsPerMinute);
  const secs = hourRemainder % secondsPerMinute;

  return {
    year,
    day,
    hours,
    mins,
    secs,
  };
}

export function formatCgtParts(parts: CgtParts): string {
  return `Year ${parts.year} Day ${parts.day} · ${pad(parts.hours)}:${pad(parts.mins)}:${pad(parts.secs)}`;
}

export function formatTimestampAsCgt(
  value: string | null | undefined,
  cgtState: CgtResponse | null | undefined
): string {
  if (!value) {
    return "Unknown";
  }

  const timestampMs = new Date(value).getTime();
  const serverNowMs = cgtState ? new Date(cgtState.server_now).getTime() : NaN;

  if (Number.isNaN(timestampMs) || Number.isNaN(serverNowMs) || !cgtState) {
    return value;
  }

  const deltaSeconds = Math.floor((serverNowMs - timestampMs) / 1000);
  const targetSwcSeconds = cgtState.swc_seconds - deltaSeconds;
  const parts = splitSwcSeconds(targetSwcSeconds);

  if (
    parts.year === 0 &&
    parts.day === 0 &&
    parts.hours === 0 &&
    parts.mins === 0 &&
    parts.secs === 0
  ) {
    return "CGT unavailable";
  }

  return formatCgtParts(parts);
}

export async function getCgtTime(): Promise<CgtResponse> {
  const origin = getBackendOrigin();
  const url = origin ? `${origin}/api/time` : "/api/core/time";

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to load CGT time (${res.status})`);
  }

  return res.json();
}
