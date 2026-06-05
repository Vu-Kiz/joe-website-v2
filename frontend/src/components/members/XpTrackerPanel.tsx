import { useMemo, useState } from "react";
import { BTN, BTN_GHOST_SM, BTN_SM, SELECT_INPUT } from "../../utils/ui";
import DatePicker from "../common/DatePicker";
import { fetchXpEvents, type XpEvent } from "../../api/member/xpTracker";
import ReportBugButton from "../support/ReportBugButton";

const CATEGORY_LABELS: Record<string, string> = {
  travel:        "Travel",
  recycling:     "Recycling",
  production:    "Production",
  combat:        "Combat",
  mining:        "Mining",
  trading:       "Trading",
  other:         "Other",
  skill_upgrade: "Skill Upgrade",
  level_up:      "Level Up",
};

const CATEGORY_COLOURS: Record<string, string> = {
  travel:        "text-sky-300",
  recycling:     "text-orange-300",
  production:    "text-green-400",
  combat:        "text-red-400",
  mining:        "text-yellow-300",
  trading:       "text-purple-300",
  other:         "text-white/50",
  skill_upgrade: "text-amber-300",
  level_up:      "text-pink-400",
};

const CATEGORY_BG: Record<string, string> = {
  travel:        "bg-sky-400/15",
  recycling:     "bg-orange-400/15",
  production:    "bg-green-400/15",
  combat:        "bg-red-400/15",
  mining:        "bg-yellow-400/15",
  trading:       "bg-purple-400/15",
  other:         "bg-white/5",
  skill_upgrade: "bg-amber-400/15",
  level_up:      "bg-pink-400/15",
};

function fmt(n: number) { return n.toLocaleString(); }

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

type GroupedDay = { date: string; timestamp: number; xp: number; events: number };

export default function XpTrackerPanel() {
  const [events, setEvents] = useState<XpEvent[] | null>(null);
  const [totalSeen, setTotalSeen] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [logPage, setLogPage] = useState(0);
  const LOG_PAGE_SIZE = 50;

  function load() {
    setLoading(true);
    setError(null);
    fetchXpEvents()
      .then((res) => {
        setEvents(res.data.events);
        setTotalSeen(res.data.total_seen);
        setLogPage(0);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to fetch XP events."))
      .finally(() => setLoading(false));
  }

  const fromTs = useMemo(() => dateFrom ? new Date(dateFrom + "T00:00:00Z").getTime() / 1000 : null, [dateFrom]);
  const toTs   = useMemo(() => dateTo   ? new Date(dateTo   + "T23:59:59Z").getTime() / 1000 : null, [dateTo]);

  const rangeFiltered = useMemo(() =>
    (events ?? []).filter((e) =>
      (fromTs === null || e.timestamp >= fromTs) &&
      (toTs   === null || e.timestamp <= toTs)
    ),
  [events, fromTs, toTs]);

  const xpGainEvents = useMemo(() => rangeFiltered.filter((e) => e.type === "xp_gain"), [rangeFiltered]);
  const milestones = useMemo(() => rangeFiltered.filter((e) => e.type === "level_up" || e.type === "skill_upgrade"), [rangeFiltered]);

  const totalXp = useMemo(() => xpGainEvents.reduce((s, e) => s + e.amount, 0), [xpGainEvents]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { xp: number; count: number }>();
    for (const e of xpGainEvents) {
      const cat = e.category;
      const cur = map.get(cat) ?? { xp: 0, count: 0 };
      map.set(cat, { xp: cur.xp + e.amount, count: cur.count + 1 });
    }
    return Array.from(map.entries())
      .map(([cat, v]) => ({ cat, ...v }))
      .sort((a, b) => b.xp - a.xp);
  }, [xpGainEvents]);

  const byDay = useMemo<GroupedDay[]>(() => {
    const map = new Map<string, GroupedDay>();
    for (const e of xpGainEvents) {
      const d = new Date(e.timestamp * 1000);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const cur = map.get(key) ?? { date: formatDate(e.timestamp), timestamp: e.timestamp, xp: 0, events: 0 };
      map.set(key, { ...cur, xp: cur.xp + e.amount, events: cur.events + 1 });
    }

    // Fill every day in the selected range so gaps show as empty bars
    if (fromTs !== null || toTs !== null) {
      const start = new Date((fromTs ?? (xpGainEvents[xpGainEvents.length - 1]?.timestamp ?? toTs!)) * 1000);
      const end   = new Date((toTs   ?? (xpGainEvents[0]?.timestamp ?? fromTs!)) * 1000);
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const endDay  = new Date(Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   end.getUTCDate()));
      while (cursor <= endDay) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
        if (!map.has(key)) {
          map.set(key, { date: formatDate(cursor.getTime() / 1000), timestamp: cursor.getTime() / 1000, xp: 0, events: 0 });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [xpGainEvents, fromTs, toTs]);

  const maxDayXp = useMemo(() => Math.max(...byDay.map((d) => d.xp), 1), [byDay]);

  const avgPerDay = useMemo(() => {
    if (byDay.length === 0) return 0;
    return Math.round(totalXp / byDay.length);
  }, [totalXp, byDay]);

  const filteredLog = useMemo(() => {
    return categoryFilter === "all" ? rangeFiltered : rangeFiltered.filter((e) => e.category === categoryFilter);
  }, [rangeFiltered, categoryFilter]);

  const logSlice = useMemo(() => filteredLog.slice(logPage * LOG_PAGE_SIZE, (logPage + 1) * LOG_PAGE_SIZE), [filteredLog, logPage]);

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold m-0 mb-1">XP Tracker</h1>
            <p className="text-sm opacity-60 m-0">Pull your personal XP events from SWC — up to 4 months of history.</p>
          </div>
          <div className="flex items-center gap-2">
            <ReportBugButton toolKey="xp_tracker" toolLabel="XP Tracker" />
            <button className={BTN} type="button" onClick={load} disabled={loading}>
              {loading ? "Loading…" : events ? "Refresh" : "Load XP History"}
            </button>
          </div>
        </div>
        {events && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs opacity-60 shrink-0">From</label>
              <div className="w-40">
                <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setLogPage(0); }} placeholder="Start date" max={dateTo || undefined} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs opacity-60 shrink-0">To</label>
              <div className="w-40">
                <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setLogPage(0); }} placeholder="End date" min={dateFrom || undefined} />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <button className={BTN_GHOST_SM} type="button" onClick={() => { setDateFrom(""); setDateTo(""); setLogPage(0); }}>
                Clear
              </button>
            )}
          </div>
        )}
        {error && <p className="text-red-400 text-sm mt-3 m-0">{error}</p>}
      </div>

      {events && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="panel space-y-1">
              <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Total XP Gained</p>
              <p className="text-2xl font-bold text-amber-300 m-0">{fmt(totalXp)}</p>
              <p className="text-[0.72rem] opacity-50 m-0">{fmt(totalSeen)} events scanned</p>
            </div>
            <div className="panel space-y-1">
              <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Active Days</p>
              <p className="text-2xl font-bold text-amber-300 m-0">{byDay.length}</p>
              <p className="text-[0.72rem] opacity-50 m-0">{fmt(avgPerDay)} XP/active day avg</p>
            </div>
            <div className="panel space-y-1">
              <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">XP Events</p>
              <p className="text-2xl font-bold text-sky-300 m-0">{fmt(xpGainEvents.length)}</p>
              <p className="text-[0.72rem] opacity-50 m-0">{byCategory.length} categories</p>
            </div>
            <div className="panel space-y-1">
              <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Milestones</p>
              <p className="text-2xl font-bold text-pink-400 m-0">{milestones.length}</p>
              <p className="text-[0.72rem] opacity-50 m-0">level ups &amp; skill upgrades</p>
            </div>
          </div>

          {/* XP by category */}
          {byCategory.length > 0 && (
            <div className="panel">
              <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">XP by Category</h2>
              <div className="space-y-2">
                {byCategory.map(({ cat, xp, count }) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={`text-xs font-semibold w-24 shrink-0 ${CATEGORY_COLOURS[cat] ?? "text-white/50"}`}>
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <div className="flex-1 h-4 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CATEGORY_BG[cat] ?? "bg-white/10"} transition-all`}
                        style={{ width: `${(xp / totalXp) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">{fmt(xp)} XP</span>
                    <span className="text-xs opacity-50 w-16 text-right">{fmt(count)} events</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily scatter chart */}
          {byDay.length > 0 && (() => {
            const W = 1000, H = 280, PAD = 4, PAD_TOP = 60, LABEL_H = 20;
            const cx = (i: number) => byDay.length === 1 ? W / 2 : PAD + (i / (byDay.length - 1)) * (W - PAD * 2);
            const chartH = H - LABEL_H;
            const cy = (xp: number) => xp === 0 ? chartH - 2 : PAD_TOP + (1 - xp / maxDayXp) * (chartH - PAD_TOP - PAD);
            return (
              <div className="panel">
                <h2 className="text-sm font-semibold opacity-80 m-0 mb-2">XP Per Day</h2>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-[calc(100%+28px)] -mx-[14px] block" style={{ height: "280px" }} aria-hidden>
                  {/* Zero line */}
                  <line x1={PAD} y1={chartH - 2} x2={W - PAD} y2={chartH - 2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  {/* Stems + dots */}
                  {byDay.map((d, i) => {
                    const x = cx(i);
                    const y = cy(d.xp);
                    return (
                      <g key={d.date}>
                        {d.xp > 0 && <line x1={x} y1={y} x2={x} y2={chartH - 2} stroke="rgba(245,213,70,0.2)" strokeWidth="1.5" />}
                        <circle
                          cx={x} cy={d.xp > 0 ? y : chartH - 2}
                          r={d.xp > 0 ? 3.5 : 1.5}
                          fill={d.xp > 0 ? "rgb(245,213,70)" : "rgba(255,255,255,0.12)"}
                        >
                          <title>{d.date}: {fmt(d.xp)} XP ({d.events} events)</title>
                        </circle>
                        {d.xp > 0 && (
                          <text
                            transform={`translate(${x}, ${Math.max(PAD_TOP - 4, y - 10)}) rotate(-40)`}
                            fill="rgba(255,255,255,0.85)"
                            fontSize="12"
                            fontWeight="600"
                            textAnchor="start"
                            stroke="rgba(0,0,0,0.8)"
                            strokeWidth="3"
                            paintOrder="stroke"
                          >{fmt(d.xp)}</text>
                        )}
                      </g>
                    );
                  })}
                  {/* Day labels */}
                  {(() => {
                    const step = byDay.length > 60 ? 14 : byDay.length > 30 ? 7 : byDay.length > 14 ? 3 : 1;
                    return byDay.map((d, i) => {
                      if (i % step !== 0 && i !== byDay.length - 1) return null;
                      return (
                        <text key={d.date} x={cx(i)} y={H - 4} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">
                          {d.date}
                        </text>
                      );
                    });
                  })()}
                  {/* Average line — rendered last so it sits on top */}
                  {avgPerDay > 0 && (() => {
                    const avgY = cy(avgPerDay);
                    return (
                      <g>
                        <line x1={PAD} y1={avgY} x2={W - PAD} y2={avgY} stroke="rgba(251,191,36,0.5)" strokeWidth="1" strokeDasharray="4 3" />
                        <text x={W - PAD - 4} y={avgY - 4} fill="rgba(251,191,36,1)" fontSize="11" fontWeight="700" textAnchor="end"
                          stroke="rgba(0,0,0,0.9)" strokeWidth="3" paintOrder="stroke">avg {fmt(avgPerDay)}</text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            );
          })()}

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="panel">
              <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Milestones</h2>
              <div className="space-y-1">
                {milestones.map((e) => (
                  <div key={e.uid} className="flex items-center gap-3 text-sm py-1 border-b border-white/5">
                    <span className="opacity-40 text-xs w-28 shrink-0">{formatDateTime(e.timestamp)}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_BG[e.category]} ${CATEGORY_COLOURS[e.category]}`}>
                      {CATEGORY_LABELS[e.category]}
                    </span>
                    <span className="opacity-80">{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event log */}
          <div className="panel">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h2 className="text-sm font-semibold opacity-80 m-0">Event Log</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className={SELECT_INPUT}
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setLogPage(0); }}
                >
                  <option value="all">All categories</option>
                  {byCategory.map(({ cat }) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
                  ))}
                  {milestones.length > 0 && <option value="level_up">Level Up</option>}
                  {milestones.length > 0 && <option value="skill_upgrade">Skill Upgrade</option>}
                </select>
                <span className="text-xs opacity-50">{fmt(filteredLog.length)} events</span>
              </div>
            </div>
            <div className="space-y-0.5">
              {logSlice.map((e) => (
                <div key={e.uid} className="flex items-start gap-3 text-sm py-1.5 border-b border-white/5 hover:bg-white/3 transition-colors">
                  <span className="opacity-40 text-xs w-28 shrink-0 pt-0.5">{formatDateTime(e.timestamp)}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_BG[e.category]} ${CATEGORY_COLOURS[e.category]}`}>
                    {CATEGORY_LABELS[e.category] ?? e.category}
                  </span>
                  {e.type === "xp_gain" && (
                    <span className="text-green-400 font-semibold tabular-nums shrink-0">+{fmt(e.amount)}</span>
                  )}
                  <span className="opacity-70 text-xs leading-relaxed">{e.message}</span>
                </div>
              ))}
            </div>
            {filteredLog.length > LOG_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3">
                <button className={BTN_GHOST_SM} disabled={logPage === 0} onClick={() => setLogPage((p) => p - 1)}>← Prev</button>
                <span className="text-xs opacity-50">
                  {logPage * LOG_PAGE_SIZE + 1}–{Math.min((logPage + 1) * LOG_PAGE_SIZE, filteredLog.length)} of {fmt(filteredLog.length)}
                </span>
                <button className={BTN_SM} disabled={(logPage + 1) * LOG_PAGE_SIZE >= filteredLog.length} onClick={() => setLogPage((p) => p + 1)}>Next →</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
