import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCgtTime, type CgtResponse } from "../api/core/time";

type LiveCgtState = {
  baseSwcSeconds: number;
  refreshedAtMs: number;
  serverNowMs: number;
  fetchedClientNowMs: number;
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

function splitSwcSeconds(totalSeconds: number): CgtParts {
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

  return { year, day, hours, mins, secs };
}

function formatCgt(parts: CgtParts): string {
  return `Year ${parts.year} Day ${parts.day} · ${pad(parts.hours)}:${pad(parts.mins)}:${pad(parts.secs)}`;
}

function buildLiveState(data: CgtResponse): LiveCgtState {
  return {
    baseSwcSeconds: data.swc_seconds,
    refreshedAtMs: new Date(data.refreshed_at).getTime(),
    serverNowMs: new Date(data.server_now).getTime(),
    fetchedClientNowMs: Date.now(),
  };
}

function getLiveSwcSeconds(state: LiveCgtState, nowMs: number): number {
  const clientElapsedMs = nowMs - state.fetchedClientNowMs;
  const estimatedServerNowMs = state.serverNowMs + clientElapsedMs;
  const elapsedSinceRefreshSeconds = Math.floor(
    (estimatedServerNowMs - state.refreshedAtMs) / 1000
  );
  return state.baseSwcSeconds + Math.max(0, elapsedSinceRefreshSeconds);
}

const pillBg: React.CSSProperties = {
  backgroundColor: "#111",
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.94) 35%, rgba(40,32,0,0.98) 100%)",
  backgroundSize: "6px 6px, 100% 100%",
};

const pillBgError: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(20,10,10,0.96) 0%, rgba(30,12,12,0.96) 100%)",
  backgroundSize: "6px 6px, 100% 100%",
};

const CgtPill: React.FC = () => {
  const [liveState, setLiveState] = useState<LiveCgtState | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const tickIntervalRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const data = await getCgtTime();
        if (cancelled) return;
        setLiveState(buildLiveState(data));
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();
    tickIntervalRef.current = window.setInterval(() => setNowMs(Date.now()), 1000);
    syncIntervalRef.current = window.setInterval(hydrate, 60000);

    return () => {
      cancelled = true;
      if (tickIntervalRef.current !== null) window.clearInterval(tickIntervalRef.current);
      if (syncIntervalRef.current !== null) window.clearInterval(syncIntervalRef.current);
    };
  }, []);

  const text = useMemo(() => {
    if (loading && !liveState) return "Loading CGT...";
    if (!liveState) return failed ? "CGT unavailable" : "Loading CGT...";

    const liveSeconds = getLiveSwcSeconds(liveState, nowMs);
    const parts = splitSwcSeconds(liveSeconds);

    if (parts.year === 0 && parts.day === 0 && parts.hours === 0 && parts.mins === 0 && parts.secs === 0) {
      return "CGT unavailable";
    }

    return formatCgt(parts);
  }, [liveState, loading, failed, nowMs]);

  return (
    <div
      className={[
        "relative inline-flex items-center justify-center gap-[0.55rem]",
        "min-h-[38px] min-w-[260px] px-[0.9rem] py-2",
        "rounded-full whitespace-nowrap overflow-hidden shrink-0",
        "border shadow-[0_6px_18px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.04)]",
        "font-tektur",
        failed
          ? "border-[rgba(255,120,120,0.28)] text-[#ffb3b3]"
          : "border-[rgba(245,213,70,0.35)] text-[#f2c46f]",
        loading ? "opacity-90" : "",
        "max-md:min-h-[34px] max-md:min-w-0 max-md:px-[0.75rem] max-md:py-[0.45rem] max-md:max-w-full",
      ].filter(Boolean).join(" ")}
      style={failed ? { ...pillBg, ...pillBgError } : pillBg}
      title="Current Combine Galactic Time"
      aria-label="Current Combine Galactic Time"
    >
      <span
        className="w-[0.52rem] h-[0.52rem] rounded-full bg-current shrink-0"
        style={{
          boxShadow: failed
            ? "0 0 10px rgba(255,179,179,0.45)"
            : "0 0 10px rgba(242,196,111,0.55)",
        }}
        aria-hidden="true"
      />
      <span
        className={[
          "block text-[0.84rem] font-bold leading-none tracking-[0.01em] tabular-nums",
          "[text-shadow:0_0_8px_rgba(242,196,111,0.12)]",
          failed ? "text-[#ffb3b3]" : "text-[#f2c46f]",
          "max-md:text-[0.78rem] max-md:overflow-hidden max-md:text-ellipsis",
        ].join(" ")}
      >
        {text}
      </span>
    </div>
  );
};

export default CgtPill;
