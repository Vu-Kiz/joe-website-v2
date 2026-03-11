import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCgtTime, type CgtResponse } from "../api/time";

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

  return {
    year,
    day,
    hours,
    mins,
    secs,
  };
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
        if (!cancelled) {
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    hydrate();

    tickIntervalRef.current = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    syncIntervalRef.current = window.setInterval(() => {
      hydrate();
    }, 60000);

    return () => {
      cancelled = true;

      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
      }

      if (syncIntervalRef.current !== null) {
        window.clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  const text = useMemo(() => {
    if (loading && !liveState) return "Loading CGT...";
    if (!liveState) return failed ? "CGT unavailable" : "Loading CGT...";

    const liveSeconds = getLiveSwcSeconds(liveState, nowMs);
    const parts = splitSwcSeconds(liveSeconds);

    if (
      parts.year === 0 &&
      parts.day === 0 &&
      parts.hours === 0 &&
      parts.mins === 0 &&
      parts.secs === 0
    ) {
      return "CGT unavailable";
    }

    return formatCgt(parts);
  }, [liveState, loading, failed, nowMs]);

  return (
    <div
      className={`cgt-pill${loading ? " is-loading" : ""}${failed ? " is-error" : ""}`}
      title="Current Combine Galactic Time"
      aria-label="Current Combine Galactic Time"
    >
      <span className="cgt-pill__dot" aria-hidden="true" />
      <span className="cgt-pill__text">{text}</span>
    </div>
  );
};

export default CgtPill;