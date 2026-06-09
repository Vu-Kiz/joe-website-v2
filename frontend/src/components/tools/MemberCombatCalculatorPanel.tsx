import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimWorkerRequest, SimWorkerResponse } from "./combatSimWorker";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend,
} from "recharts";
import { getDebugCombatSettings } from "../../api/admin/sysDebug";
import {
  getStoredShipType,
  getStoredShipTypes,
  getStoredWeaponType,
  type StoredShipTypeDetail,
  type StoredShipTypeSummary,
  type StoredWeaponTypeDetail,
} from "../../api/universe/universe";
import ReportBugButton from "../support/ReportBugButton";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import Pagination from "../common/Pagination";
import Overlay from "../common/Overlay";

// ─── ID helpers ──────────────────────────────────────────────────────────────

let _uid = 0;
const genId = () => `s${++_uid}`;
function makeSlot(): SquadSlot {
  return { id: genId(), shipUid: null, quantity: 1, combatSkill: 5, pilotingSkill: 5, engagementBearing: null };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SquadSlot = {
  id: string;
  shipUid: string | null;
  quantity: number;
  combatSkill: number;
  pilotingSkill: number;
  engagementBearing: number | null;
};

type ResolvedWeapon = {
  key: string;
  uid: string | null;
  name: string | null;
  quantity: number;
  arc: string | null;
  arcFrom: number | null;
  arcTo: number | null;
  weapon: StoredWeaponTypeDetail;
};

type ShipCacheEntry = {
  detail: StoredShipTypeDetail;
  baseWeapons: ResolvedWeapon[];
};

type ResolvedSlot = {
  id: string;
  shipUid: string;
  shipDetail: StoredShipTypeDetail;
  weapons: ResolvedWeapon[];
  quantity: number;
  combatSkill: number;
  pilotingSkill: number;
  engagementBearing: number | null;
};

type OpponentGroup = {
  id: string;
  label: string;
  slots: SquadSlot[];
};

type SavedSquad = {
  id: string;
  name: string;
  savedAt: string;
  slotsA: SquadSlot[];
  sideBMode: "single" | "multi";
  singleSlotsB: SquadSlot[];
  opponents: OpponentGroup[];
  targeting: "focus" | "random" | "optimal";
  engagementRange: number;
  runCount: number;
};

const STORAGE_KEY = "joe_squad_sim_v1";

function loadSavedSquads(): SavedSquad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedSquads(squads: SavedSquad[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(squads));
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

type Combatant = {
  slotId: string;
  instanceIdx: number;
  side: "a" | "b";
  shipDetail: StoredShipTypeDetail;
  weapons: ResolvedWeapon[];
  combatSkill: number;
  pilotingSkill: number;
  engagementBearing: number | null;
  shield: number;
  shieldByArc: Record<string, number>;
  hull: number;
  ionic: number;
  alive: boolean;
  kills: number;
  damageDealt: number;
  roundDied: number | null;
  roundFirstKill: number | null;
  killedBy: Combatant | null;
};

type OneBattleResult = {
  winner: "a" | "b" | "mutual" | "stalemate";
  rounds: number;
  survivors: Combatant[];
  combatants: Combatant[];
};

type SlotAggregated = {
  slotId: string;
  side: "a" | "b";
  shipName: string;
  shipClass: string;
  quantity: number;
  totalInstances: number;
  avgKills: number;
  avgDeaths: number;
  kda: number;
  surviveRate: number;
  avgRemainingShield: number;
  avgRemainingHull: number;
  avgRemainingIonic: number;
  maxShield: number;
  maxHull: number;
  avgDmgPerRound: number;
  avgRoundsDied: number | null;
  avgRoundsFirstKill: number | null;
};

type AggregatedResults = {
  runs: number;
  winRateA: number;
  winRateB: number;
  mutualKillRate: number;
  stalemateRate: number;
  avgRounds: number;
  p90Rounds: number | null;
  avgALossCount: number;
  avgBLossCount: number;
  avgALossRate: number;
  avgBLossRate: number;
  slots: SlotAggregated[];
  roundDistribution: Array<{ round: number; count: number; pct: number }>;
  sampleRuns: OneBattleResult[];
};

// ─── Math helpers ─────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function formatNumber(v: number | null | undefined, digits = 2, fallback = "—"): string {
  if (v == null || Number.isNaN(v)) return fallback;
  return Number(v)
    .toFixed(digits)
    .replace(/\.00$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatPct(v: number | null | undefined, fallback = "—"): string {
  if (v == null || Number.isNaN(v)) return fallback;
  return `${Math.round(v * 100)}%`;
}


// SWC API doesn't expose firedelay. All SWC combat weapons have a 30-minute fire delay.
// A sim round = 15 minutes, so fire_delay = 30 / 15 = 2 rounds for all weapons.
function resolveKnownFireDelay(_weaponName: string): number {
  return 2;
}

function buildLinkedWeaponKey(item: Record<string, unknown>): string {
  return [item.uid, item.name, item.quantity, item.arc].filter(Boolean).join("_");
}

function bearingInArc(bearing: number, from: number, to: number): boolean {
  const b = ((bearing % 360) + 360) % 360;
  const f = ((from % 360) + 360) % 360;
  const t = ((to % 360) + 360) % 360;
  if (f <= t) return b >= f && b <= t;
  return b >= f || b <= t;
}

const CANONICAL_ARCS: Record<string, string> = {
  fore: "fore", forward: "fore", front: "fore",
  aft: "aft", rear: "aft", back: "aft",
  port: "port", left: "port",
  starboard: "starboard", stbd: "starboard", right: "starboard",
  all: "all", turret: "all", omni: "all", omnidirectional: "all",
};

function normalizeArc(arc: string | null | undefined): string | null {
  if (!arc) return null;
  return CANONICAL_ARCS[arc.trim().toLowerCase()] ?? arc.trim().toLowerCase();
}

function arcLabel(arc: string | null): string {
  if (!arc) return "All";
  return arc.charAt(0).toUpperCase() + arc.slice(1);
}

function buildShieldArcPools(detail: StoredShipTypeDetail): Record<string, number> {
  const arcs = (detail as unknown as Record<string, unknown>).shield_arcs;
  if (!Array.isArray(arcs) || !arcs.length) return {};
  const totalShield = Math.max(0, Number(detail.shield ?? 0));
  const pools: Record<string, number> = {};
  for (const arc of arcs) {
    if (!arc.name) continue;
    const key = normalizeArc(arc.name);
    if (!key || key === "all") continue;
    let value: number;
    if (arc.value != null) {
      value = Math.max(0, Number(arc.value));
    } else if (arc.percent != null) {
      value = Math.round(totalShield * arc.percent / 100);
    } else {
      continue;
    }
    pools[key] = value;
  }
  return pools;
}

function weaponCanFireAtBearing(weapon: ResolvedWeapon, bearing: number): boolean {
  if (weapon.arcFrom != null && weapon.arcTo != null) {
    return bearingInArc(bearing, weapon.arcFrom, weapon.arcTo);
  }
  const norm = normalizeArc(weapon.arc);
  if (!norm || norm === "all") return true;
  const quadrants: Record<string, [number, number]> = {
    fore: [315, 45], aft: [135, 225], starboard: [45, 135], port: [225, 315],
  };
  const q = quadrants[norm];
  if (!q) return true;
  return bearingInArc(bearing, q[0], q[1]);
}

function isCapitalClass(className: string | null | undefined): boolean {
  const c = (className ?? "").toLowerCase();
  return (
    c.includes("capital") ||
    c.includes("dreadnaught") ||
    c.includes("dreadnought") ||
    c.includes("star destroyer") ||
    c.includes("battleship") ||
    c.includes("cruiser") ||
    c.includes("frigate")
  );
}

function resolveSlots(slots: SquadSlot[], shipCache: Map<string, ShipCacheEntry>): ResolvedSlot[] {
  return slots
    .filter((s) => s.shipUid && shipCache.has(s.shipUid))
    .map((s) => {
      const entry = shipCache.get(s.shipUid!)!;
      const bearing = s.engagementBearing;
      const weapons = bearing != null
        ? entry.baseWeapons.filter((w) => weaponCanFireAtBearing(w, bearing))
        : entry.baseWeapons;
      return {
        id: s.id,
        shipUid: s.shipUid!,
        shipDetail: entry.detail,
        weapons,
        quantity: s.quantity,
        combatSkill: s.combatSkill,
        pilotingSkill: s.pilotingSkill,
        engagementBearing: bearing,
      };
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

const MemberCombatCalculatorPanel: React.FC = () => {
  const [ships, setShips] = useState<StoredShipTypeSummary[]>([]);
  const [shipsLoading, setShipsLoading] = useState(true);
  const [shipCache, setShipCache] = useState<Map<string, ShipCacheEntry>>(new Map());
  const [loadedUids, setLoadedUids] = useState<Set<string>>(new Set());

  const [slotsA, setSlotsA] = useState<SquadSlot[]>(() => [makeSlot()]);
  const [sideBMode, setSideBMode] = useState<"single" | "multi">("single");
  const [singleSlotsB, setSingleSlotsB] = useState<SquadSlot[]>(() => [makeSlot()]);
  const [opponents, setOpponents] = useState<OpponentGroup[]>(() => [
    { id: genId(), label: "Opponent 1", slots: [makeSlot()] },
  ]);

  const workerRef = useRef<Worker | null>(null);

  // Terminate any in-flight worker on unmount
  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const [targeting, setTargeting] = useState<"focus" | "random" | "optimal">("focus");
  const [engagementRange, setEngagementRange] = useState(0);
  const [runCount, setRunCount] = useState(100);

  const [dmgTypeMods, setDmgTypeMods] = useState<Record<string, number>>({});
  const [classMods, setClassMods] = useState<Record<string, Record<string, Record<string, number>>>>({});

  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>(() => loadSavedSquads());
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const [simResults, setSimResults] = useState<AggregatedResults | null>(null);
  const [multiResults, setMultiResults] = useState<
    Array<{ opponentId: string; label: string; results: AggregatedResults }> | null
  >(null);
  const [simRunning, setSimRunning] = useState(false);

  const [expandedOpponent, setExpandedOpponent] = useState<string | null>(null);

  // Ship search per slot (slotId -> search string)
  const [shipSearches, setShipSearches] = useState<Record<string, string>>({});
  const [shipSearchOpen, setShipSearchOpen] = useState<Record<string, boolean>>({});

  // Sample runs overlay + pagination
  const [overlayRun, setOverlayRun] = useState<OneBattleResult | null>(null);
  const [overlayRunIndex, setOverlayRunIndex] = useState<number | null>(null);
  const [sampleRunPage, setSampleRunPage] = useState(1);
  const [sampleRunPageSize, setSampleRunPageSize] = useState(10);

  // Load ship list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setShipsLoading(true);
        const res = await getStoredShipTypes();
        if (!cancelled) setShips(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setShips([]);
      } finally {
        if (!cancelled) setShipsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load combat tables
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getDebugCombatSettings();
        if (!cancelled) {
          setDmgTypeMods(res.data?.ship_damage_type_modifiers ?? {});
          setClassMods(res.data?.ship_class_modifiers ?? {});
        }
      } catch {
        // leave defaults
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Collect all referenced ship UIDs across all squads
  const allShipUids = useMemo(() => {
    const uids = new Set<string>();
    const add = (slots: SquadSlot[]) => slots.forEach((s) => s.shipUid && uids.add(s.shipUid));
    add(slotsA);
    add(singleSlotsB);
    opponents.forEach((opp) => add(opp.slots));
    return uids;
  }, [slotsA, singleSlotsB, opponents]);

  // Load missing ship data
  useEffect(() => {
    const toLoad = [...allShipUids].filter((uid) => !loadedUids.has(uid));
    if (!toLoad.length) return;
    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        toLoad.map(async (uid) => {
          try {
            const detailRes = await getStoredShipType(uid);
            const detail = detailRes.data;
            if (!detail) return null;

            const linked = Array.isArray(detail.weapons)
              ? detail.weapons.filter(
                  (w): w is Record<string, unknown> => !!w && typeof w === "object"
                )
              : [];

            const baseWeapons = (
              await Promise.all(
                linked.map(async (item) => {
                  const identifier =
                    typeof item.uid === "string" && item.uid
                      ? item.uid
                      : typeof item.name === "string" && item.name
                      ? item.name
                      : null;
                  if (!identifier) return null;
                  try {
                    const wRes = await getStoredWeaponType(identifier);
                    const w = wRes.data;
                    if (!w) return null;
                    // SWC API doesn't expose firedelay — use known values by name
                    if (w.fire_delay == null && w.name) {
                      w.fire_delay = resolveKnownFireDelay(w.name);
                    }
                    return {
                      key: buildLinkedWeaponKey(item),
                      uid: (typeof item.uid === "string" ? item.uid : (w.uid ?? null)) as
                        | string
                        | null,
                      name: typeof item.name === "string" ? item.name : (w.name ?? null),
                      quantity: Math.max(1, Number(item.quantity ?? 1)),
                      arc: typeof item.arc === "string" ? item.arc : null,
                      arcFrom: typeof item.arc_from === "number" ? item.arc_from : (typeof item.arc_from === "string" ? Number(item.arc_from) || null : null),
                      arcTo: typeof item.arc_to === "number" ? item.arc_to : (typeof item.arc_to === "string" ? Number(item.arc_to) || null : null),
                      weapon: w,
                    } satisfies ResolvedWeapon;
                  } catch {
                    return null;
                  }
                })
              )
            ).filter((w): w is ResolvedWeapon => !!w && (w.weapon.tracking ?? 0) > 0);

            return { uid, detail, baseWeapons };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      setLoadedUids((prev) => new Set([...prev, ...toLoad]));
      setShipCache((prev) => {
        const next = new Map(prev);
        for (const r of results) {
          if (r) next.set(r.uid, { detail: r.detail, baseWeapons: r.baseWeapons });
        }
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [allShipUids, loadedUids]);

  // Resolved slots
  const resolvedSlotsA = useMemo(() => resolveSlots(slotsA, shipCache), [slotsA, shipCache]);
  const resolvedSingleSlotsB = useMemo(
    () => resolveSlots(singleSlotsB, shipCache),
    [singleSlotsB, shipCache]
  );
  const resolvedOpponents = useMemo(
    () =>
      opponents.map((opp) => ({
        ...opp,
        resolvedSlots: resolveSlots(opp.slots, shipCache),
      })),
    [opponents, shipCache]
  );

  const canRun = useMemo(() => {
    if (simRunning) return false;
    const aReady = resolvedSlotsA.length > 0;
    const bReady =
      sideBMode === "single"
        ? resolvedSingleSlotsB.length > 0
        : resolvedOpponents.some((opp) => opp.resolvedSlots.length > 0);
    return aReady && bReady;
  }, [simRunning, resolvedSlotsA, resolvedSingleSlotsB, resolvedOpponents, sideBMode]);

  // Slot mutation helpers
  const updateSlot = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<SquadSlot[]>>,
      id: string,
      changes: Partial<SquadSlot>
    ) => {
      setter((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    },
    []
  );

  const removeSlot = useCallback(
    (setter: React.Dispatch<React.SetStateAction<SquadSlot[]>>, id: string) => {
      setter((prev) => {
        const next = prev.filter((s) => s.id !== id);
        return next.length > 0 ? next : prev;
      });
    },
    []
  );

  // Opponent helpers
  const updateOpponentSlot = useCallback(
    (oppId: string, slotId: string, changes: Partial<SquadSlot>) => {
      setOpponents((prev) =>
        prev.map((opp) =>
          opp.id === oppId
            ? { ...opp, slots: opp.slots.map((s) => (s.id === slotId ? { ...s, ...changes } : s)) }
            : opp
        )
      );
    },
    []
  );

  const removeOpponentSlot = useCallback((oppId: string, slotId: string) => {
    setOpponents((prev) =>
      prev.map((opp) =>
        opp.id === oppId
          ? {
              ...opp,
              slots:
                opp.slots.length > 1 ? opp.slots.filter((s) => s.id !== slotId) : opp.slots,
            }
          : opp
      )
    );
  }, []);

  const handleSave = useCallback(() => {
    const name = saveLabel.trim() || `Squad ${new Date().toLocaleDateString()}`;
    const entry: SavedSquad = {
      id: genId(),
      name,
      savedAt: new Date().toISOString(),
      slotsA,
      sideBMode,
      singleSlotsB,
      opponents,
      targeting,
      engagementRange,
      runCount,
    };
    setSavedSquads((prev) => {
      const next = [entry, ...prev];
      persistSavedSquads(next);
      return next;
    });
    setSaveLabel("");
    setShowSaved(true);
  }, [saveLabel, slotsA, sideBMode, singleSlotsB, opponents, targeting, engagementRange, runCount]);

  const handleLoad = useCallback((saved: SavedSquad) => {
    // Re-key all slots to avoid ID collisions with current state
    const rekeySlots = (slots: SquadSlot[]): SquadSlot[] =>
      slots.map((s) => ({ ...s, id: genId() }));
    const rekeyOpponents = (opps: OpponentGroup[]): OpponentGroup[] =>
      opps.map((o) => ({ ...o, id: genId(), slots: rekeySlots(o.slots) }));

    setSlotsA(rekeySlots(saved.slotsA));
    setSideBMode(saved.sideBMode);
    setSingleSlotsB(rekeySlots(saved.singleSlotsB));
    setOpponents(rekeyOpponents(saved.opponents));
    setTargeting(saved.targeting);
    setEngagementRange(saved.engagementRange);
    setRunCount(saved.runCount);
    setSimResults(null);
    setMultiResults(null);
    setShowSaved(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setSavedSquads((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persistSavedSquads(next);
      return next;
    });
  }, []);

  const spawnSimWorker = useCallback((req: SimWorkerRequest): Promise<AggregatedResults> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./combatSimWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<SimWorkerResponse>) => {
        worker.terminate();
        if (e.data.type === "result") resolve(e.data.result as unknown as AggregatedResults);
        else reject(new Error(e.data.message));
      };
      worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
      worker.postMessage(req);
    });
  }, []);

  const handleRun = useCallback(() => {
    if (!canRun) return;

    // Terminate any previous run
    workerRef.current?.terminate();
    workerRef.current = null;

    setSimRunning(true);
    setSimResults(null);
    setMultiResults(null);
    setOverlayRun(null);
    setOverlayRunIndex(null);
    setSampleRunPage(1);

    const baseReq = { targeting, range: engagementRange, runs: runCount, dmgTypeMods, classMods };

    if (sideBMode === "single") {
      spawnSimWorker({ type: "run", slotsA: resolvedSlotsA, slotsB: resolvedSingleSlotsB, ...baseReq })
        .then((res) => { setSimResults(res); })
        .catch((err) => { console.error("Sim error:", err); })
        .finally(() => { setSimRunning(false); });
    } else {
      const activeOpponents = resolvedOpponents.filter((opp) => opp.resolvedSlots.length > 0);
      Promise.all(
        activeOpponents.map((opp) =>
          spawnSimWorker({ type: "run", slotsA: resolvedSlotsA, slotsB: opp.resolvedSlots, ...baseReq })
            .then((results) => ({ opponentId: opp.id, label: opp.label, results }))
        )
      )
        .then((multi) => { setMultiResults(multi); })
        .catch((err) => { console.error("Sim error:", err); })
        .finally(() => { setSimRunning(false); });
    }
  }, [
    canRun,
    spawnSimWorker,
    sideBMode,
    resolvedSlotsA,
    resolvedSingleSlotsB,
    resolvedOpponents,
    targeting,
    engagementRange,
    runCount,
    dmgTypeMods,
    classMods,
  ]);

  // ─── Style helpers ──────────────────────────────────────────────────────────

  const pillCls = (active: boolean) =>
    `px-[0.8rem] py-2 border rounded-full bg-white/3 text-inherit cursor-pointer transition-[border-color,background] duration-150 hover:border-[rgba(246,163,0,0.3)] hover:bg-[rgba(246,163,0,0.08)] disabled:opacity-50 disabled:cursor-not-allowed ${
      active
        ? "border-[rgba(246,163,0,0.55)] bg-[rgba(246,163,0,0.14)]"
        : "border-white/10"
    }`;

  const statCls =
    "grid gap-[0.25rem] p-[0.8rem] border border-white/8 rounded-xl bg-white/2.5";

  const inputCls =
    "w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/3 px-3 py-2.5 text-inherit";

  // ─── Squad builder slot row ─────────────────────────────────────────────────

  function renderSlotRow(
    slot: SquadSlot,
    onUpdate: (changes: Partial<SquadSlot>) => void,
    onRemove: () => void,
    canRemove: boolean
  ) {
    const loading = slot.shipUid && !loadedUids.has(slot.shipUid);
    const failed = slot.shipUid && loadedUids.has(slot.shipUid) && !shipCache.has(slot.shipUid);

    return (
      <div
        key={slot.id}
        className="grid gap-2 p-3 border border-white/8 rounded-xl bg-white/2"
      >
        <div className="flex items-center gap-2">
          {(() => {
            const searchVal = shipSearches[slot.id] ?? "";
            const selectedName = slot.shipUid ? (shipCache.get(slot.shipUid)?.detail.name ?? ships.find((s) => s.uid === slot.shipUid)?.name ?? slot.shipUid) : "";
            const displayVal = shipSearchOpen[slot.id] ? searchVal : (slot.shipUid ? selectedName : searchVal);
            const filtered = ships.filter((s) => {
              const q = searchVal.toLowerCase();
              return !q || (s.name ?? "").toLowerCase().includes(q) || (s.class_name ?? "").toLowerCase().includes(q);
            }).slice(0, 40);
            return (
              <SearchSuggestionPicker
                className="flex-1"
                value={displayVal}
                placeholder="Search ship…"
                onChange={(v) => setShipSearches((prev) => ({ ...prev, [slot.id]: v }))}
                suggestions={filtered}
                showSuggestions={!!shipSearchOpen[slot.id]}
                onShowSuggestions={(show) => {
                  setShipSearchOpen((prev) => ({ ...prev, [slot.id]: show }));
                  if (!show && !slot.shipUid) setShipSearches((prev) => ({ ...prev, [slot.id]: "" }));
                }}
                getKey={(s) => s.uid}
                isActive={(s) => s.uid === slot.shipUid}
                onSelect={(s) => {
                  onUpdate({ shipUid: s.uid });
                  setShipSearches((prev) => ({ ...prev, [slot.id]: "" }));
                  setShipSearchOpen((prev) => ({ ...prev, [slot.id]: false }));
                }}
                renderSuggestion={(s) => (
                  <>
                    <span>{s.name ?? s.uid}</span>
                    {s.class_name && <span className="text-white/40 text-[0.72rem]">{s.class_name}</span>}
                  </>
                )}
              />
            );
          })()}
          {canRemove && (
            <button
              type="button"
              className="shrink-0 w-8 h-8 flex items-center justify-center border border-white/10 rounded-full bg-white/3 text-white/50 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
              onClick={onRemove}
              aria-label="Remove"
            >
              ×
            </button>
          )}
        </div>
        {loading && (
          <p className="small text-white/40">Loading ship data…</p>
        )}
        {failed && (
          <p className="small text-red-400">Failed to load ship data</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[0.72rem] text-white/50 mb-1">Qty</label>
            <input
              className={inputCls}
              type="number"
              min={1}
              max={99}
              step={1}
              value={slot.quantity}
              onChange={(e) =>
                onUpdate({ quantity: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })
              }
            />
          </div>
          <div>
            <label className="block text-[0.72rem] text-white/50 mb-1">Combat Skill</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              max={10}
              step={1}
              value={slot.combatSkill}
              onChange={(e) =>
                onUpdate({ combatSkill: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })
              }
            />
          </div>
          <div>
            <label className="block text-[0.72rem] text-white/50 mb-1">Piloting</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              max={10}
              step={1}
              value={slot.pilotingSkill}
              onChange={(e) =>
                onUpdate({
                  pilotingSkill: Math.max(0, Math.min(10, Number(e.target.value) || 0)),
                })
              }
            />
          </div>
        </div>
        {/* Engagement bearing — capitals and super capitals only */}
        {isCapitalClass(shipCache.get(slot.shipUid ?? "")?.detail.class_name) && (
          <div>
            <label className="block text-[0.72rem] text-white/50 mb-1">
              Engagement Bearing (°){" "}
              <span className="text-white/30">· 0=Fore 90=Stbd 180=Aft 270=Port</span>
            </label>
            <div className="flex flex-col gap-2">
              <input
                className={`${inputCls} w-[90px]`}
                type="number"
                min={0}
                max={359}
                step={1}
                value={slot.engagementBearing ?? ""}
                placeholder="—"
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Math.max(0, Math.min(359, Number(e.target.value) || 0));
                  onUpdate({ engagementBearing: v });
                }}
              />
              <div className="flex flex-wrap gap-[0.35rem]">
                {([["Fore", 0], ["Stbd", 90], ["Aft", 180], ["Port", 270]] as [string, number][]).map(([label, deg]) => (
                  <button
                    key={deg}
                    type="button"
                    className={`px-[0.55rem] py-[0.3rem] border rounded-full text-[0.72rem] cursor-pointer transition-colors ${
                      slot.engagementBearing === deg
                        ? "border-[rgba(246,163,0,0.55)] bg-[rgba(246,163,0,0.14)] text-[rgba(255,215,145,0.95)]"
                        : "border-white/10 bg-white/3 text-white/60 hover:border-white/30"
                    }`}
                    onClick={() => onUpdate({ engagementBearing: slot.engagementBearing === deg ? null : deg })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Results rendering ──────────────────────────────────────────────────────

  function renderSummaryCards(r: AggregatedResults, labelA: string, labelB: string) {
    return (
      <div className="grid grid-cols-2 gap-[0.65rem] max-[680px]:grid-cols-1">
        <article className={`${statCls} border-[rgba(100,255,120,0.2)] bg-[rgba(100,255,120,0.04)]`}>
          <span className="small">{labelA} Win Rate</span>
          <strong className="text-[1.4rem] leading-none">{formatPct(r.winRateA)}</strong>
          <span className="small">{formatNumber(r.winRateA * r.runs, 0)} wins of {formatNumber(r.runs, 0)} runs</span>
        </article>
        <article className={`${statCls} border-[rgba(255,80,80,0.2)] bg-[rgba(255,80,80,0.04)]`}>
          <span className="small">{labelB} Win Rate</span>
          <strong className="text-[1.4rem] leading-none">{formatPct(r.winRateB)}</strong>
          <span className="small">Mutual {formatPct(r.mutualKillRate)} · Stalemate {formatPct(r.stalemateRate)}</span>
        </article>
        <article className={statCls}>
          <span className="small">Avg Rounds to Resolve</span>
          <strong className="text-[1.4rem] leading-none">{formatNumber(r.avgRounds, 1)}</strong>
          <span className="small">90th pct: {formatNumber(r.p90Rounds, 0, "—")} rounds</span>
        </article>
        <article className={statCls}>
          <span className="small">{labelA} Squad Lost</span>
          <strong className="text-[1.4rem] leading-none">{formatPct(r.avgALossRate)}</strong>
          <span className="small">{formatNumber(r.avgALossCount, 1)} units avg per run</span>
        </article>
        <article className={statCls}>
          <span className="small">{labelB} Squad Lost</span>
          <strong className="text-[1.4rem] leading-none">{formatPct(r.avgBLossRate)}</strong>
          <span className="small">{formatNumber(r.avgBLossCount, 1)} units avg per run</span>
        </article>
        <article className={statCls}>
          <span className="small">Total Runs</span>
          <strong className="text-[1.4rem] leading-none">{formatNumber(r.runs, 0)}</strong>
          <span className="small">{r.runs === 1 ? "Single deterministic run" : "Monte Carlo simulation"}</span>
        </article>
      </div>
    );
  }

  function renderUnitTable(r: AggregatedResults) {
    const aSide = r.slots.filter((s) => s.side === "a");
    const bSide = r.slots.filter((s) => s.side === "b");

    function renderSideTable(slots: SlotAggregated[], label: string, color: string) {
      if (!slots.length) return null;
      return (
        <div className="flex flex-col gap-3">
          <h5
            className="m-0 text-[0.85rem] font-bold uppercase tracking-widest"
            style={{ color }}
          >
            {label}
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.82rem] border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-left">
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap">Ship</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Qty</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Avg Kills</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Avg Deaths</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">KDA</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Survive %</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Avg Dmg/Round</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Avg Shld Left</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Avg Hull Left</th>
                  <th className="pb-2 pr-4 font-medium whitespace-nowrap text-right">Rnd to Kill</th>
                  <th className="pb-2 font-medium whitespace-nowrap text-right">Rnd to Die</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.slotId} className="border-b border-white/5 hover:bg-white/2">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{slot.shipName}</div>
                      <div className="text-white/40 text-[0.72rem]">{slot.shipClass}</div>
                    </td>
                    <td className="py-2 pr-4 text-right">{slot.quantity}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(slot.avgKills, 2)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(slot.avgDeaths, 2)}</td>
                    <td className="py-2 pr-4 text-right font-medium">
                      {slot.avgDeaths > 0 ? formatNumber(slot.kda, 2) : `${formatNumber(slot.avgKills, 2)}K`}
                    </td>
                    <td className="py-2 pr-4 text-right">{formatPct(slot.surviveRate)}</td>
                    <td className="py-2 pr-4 text-right font-medium">{formatNumber(slot.avgDmgPerRound, 0)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(slot.avgRemainingShield, 0)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(slot.avgRemainingHull, 0)}</td>
                    <td className="py-2 pr-4 text-right">
                      {slot.avgRoundsFirstKill != null
                        ? formatNumber(slot.avgRoundsFirstKill, 1)
                        : <span className="text-white/30">No kills</span>}
                    </td>
                    <td className="py-2 text-right">
                      {slot.avgRoundsDied != null
                        ? formatNumber(slot.avgRoundsDied, 1)
                        : <span className="text-white/30">Survived</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        {renderSideTable(aSide, "Your Squad", "rgba(100,255,120,0.85)")}
        {renderSideTable(bSide, "Opponent Squad", "rgba(255,120,100,0.85)")}
      </div>
    );
  }

  function renderMonteCarloChart(r: AggregatedResults, labelA: string, labelB: string) {
    if (r.runs < 2) return null;

    // ── Round distribution bins (max 40) ──────────────────────────────────────
    const dist = [...r.roundDistribution].sort((a, b) => a.round - b.round);
    const MAX_BARS = 40;
    type HistBin = { label: string; count: number; pct: number; minRound: number; maxRound: number };
    let histBins: HistBin[] = [];

    if (dist.length > 0) {
      if (dist.length <= MAX_BARS) {
        histBins = dist.map((d) => ({
          label: String(d.round),
          count: d.count,
          pct: d.pct,
          minRound: d.round,
          maxRound: d.round,
        }));
      } else {
        const minR = dist[0].round;
        const maxR = dist[dist.length - 1].round;
        const binWidth = Math.ceil((maxR - minR + 1) / MAX_BARS);
        for (let i = 0; i < MAX_BARS; i++) {
          const binMin = minR + i * binWidth;
          const binMax = binMin + binWidth - 1;
          const entries = dist.filter((d) => d.round >= binMin && d.round <= binMax);
          if (!entries.length) continue;
          histBins.push({
            label: binMin === binMax ? String(binMin) : `${binMin}–${binMax}`,
            count: entries.reduce((s, d) => s + d.count, 0),
            pct: entries.reduce((s, d) => s + d.pct, 0),
            minRound: binMin,
            maxRound: binMax,
          });
        }
      }
    }

    const medianRound = (() => {
      let cum = 0;
      for (const d of dist) { cum += d.pct; if (cum >= 0.5) return d.round; }
      return null;
    })();

    // ── Radial bar data — health remaining % per unit ─────────────────────────
    const radialData = r.slots
      .filter((s) => (s.maxShield + s.maxHull) > 0)
      .map((s) => {
        const maxTotal = s.maxShield + s.maxHull;
        const remainingTotal = s.avgRemainingShield + s.avgRemainingHull;
        const healthPct = Math.round((remainingTotal / maxTotal) * 100);
        const survived = Math.round(s.surviveRate * s.quantity);
        const fill = s.side === "a" ? "rgba(74,222,128,0.85)" : "rgba(248,113,113,0.85)";
        return {
          name: s.shipName,
          healthPct,
          side: s.side,
          fill,
          // tooltip extras
          avgShield: s.avgRemainingShield,
          avgHull: s.avgRemainingHull,
          maxShield: s.maxShield,
          maxHull: s.maxHull,
          survived,
          quantity: s.quantity,
          avgKills: s.avgKills,
          avgDeaths: s.avgDeaths,
        };
      });

    const COLORS_A = "rgba(74,222,128,0.85)";
    const COLORS_B = "rgba(248,113,113,0.85)";

    const chartTooltipStyle: React.CSSProperties = {
      background: "#111",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "10px",
      fontSize: "0.78rem",
      color: "rgba(255,255,255,0.9)",
      padding: "0.6rem 0.8rem",
    };

    // Custom radial tooltip
    const RadialTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof radialData[0] }> }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div style={chartTooltipStyle}>
          <div className="font-bold mb-1" style={{ color: d.side === "a" ? COLORS_A : COLORS_B }}>{d.name}</div>
          <div className="text-white/60 text-[0.72rem] mb-1.5">
            {d.survived}/{d.quantity} survived · {d.healthPct}% health remaining
          </div>
          <div className="grid gap-0.5 text-[0.72rem]">
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Avg shield left</span>
              <span>{formatNumber(d.avgShield, 0)} / {formatNumber(d.maxShield, 0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Avg hull left</span>
              <span>{formatNumber(d.avgHull, 0)} / {formatNumber(d.maxHull, 0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Avg kills</span>
              <span>{formatNumber(d.avgKills, 2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Avg deaths</span>
              <span>{formatNumber(d.avgDeaths, 2)}</span>
            </div>
          </div>
        </div>
      );
    };

    // Custom histogram tooltip
    const HistTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: HistBin }>; label?: string }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div style={chartTooltipStyle}>
          <div className="font-bold">{d.minRound === d.maxRound ? `Round ${label}` : `Rounds ${label}`}</div>
          <div className="text-white/60">{d.count.toLocaleString()} runs · {(d.pct * 100).toFixed(1)}%</div>
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-6">
        {/* Radial bar — health remaining */}
        {radialData.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[0.78rem] font-semibold text-white/70 uppercase tracking-wider">
              Average Health Remaining (survivors)
            </span>
            <ResponsiveContainer width="100%" height={Math.max(180, radialData.length * 38 + 40)}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="15%"
                outerRadius="95%"
                barSize={18}
                data={radialData}
                startAngle={180}
                endAngle={-180}
              >
                <RadialBar
                  dataKey="healthPct"
                  background={{ fill: "rgba(255,255,255,0.04)" }}
                  label={{
                    position: "insideStart",
                    fill: "rgba(255,255,255,0.55)",
                    fontSize: 11,
                    formatter: (v: import("recharts/types/component/Text").RenderableText) => `${Math.round(Number(v))}%`,
                  }}
                />
                <Tooltip content={<RadialTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={() => ""}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 text-[0.75rem] text-white/50">
              <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: COLORS_A }} />{labelA}</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: COLORS_B }} />{labelB}</span>
            </div>
          </div>
        )}

        {/* Histogram — combat duration */}
        {histBins.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[0.78rem] font-semibold text-white/70 uppercase tracking-wider">
              Combat Duration · {r.runs.toLocaleString()} runs
              {medianRound != null && <> · Median {medianRound}</>}
              {r.avgRounds != null && <> · Mean {formatNumber(r.avgRounds, 1)}</>}
              {r.p90Rounds != null && <> · P90 {r.p90Rounds}</>}
            </span>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={histBins} margin={{ top: 4, right: 8, bottom: 20, left: 32 }} barCategoryGap="10%">
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                  interval="preserveStartEnd"
                  label={{ value: "Round", position: "insideBottom", offset: -10, fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<HistTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="pct" fill="rgba(246,163,0,0.6)" activeBar={{ fill: "rgba(246,163,0,0.95)" }} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  function renderSampleRuns(r: AggregatedResults, labelA: string, labelB: string) {
    if (!r.sampleRuns.length) return null;

    const slotNames = new Map<string, string>();
    r.slots.forEach((s) => slotNames.set(s.slotId, s.shipName));

    const totalSamples = r.sampleRuns.length;
    const startIdx = (sampleRunPage - 1) * sampleRunPageSize;
    const pageRuns = r.sampleRuns.slice(startIdx, startIdx + sampleRunPageSize);

    const winnerColor = (w: OneBattleResult["winner"]) =>
      w === "a" ? "text-green-400" : w === "b" ? "text-red-400" : "text-yellow-400";

    const winnerLabel = (w: OneBattleResult["winner"]) =>
      w === "a" ? `${labelA} wins` : w === "b" ? `${labelB} wins` : w === "mutual" ? "Mutual kill" : "Stalemate";

    return (
      <div className="flex flex-col gap-4">
        <span className="small">
          {totalSamples.toLocaleString()} run{totalSamples !== 1 ? "s" : ""} · click any row for full detail
        </span>

        <div className="overflow-x-auto">
          <table className="w-full text-[0.82rem] border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-left">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Outcome</th>
                <th className="pb-2 pr-4 font-medium text-right">Rounds</th>
                <th className="pb-2 pr-4 font-medium text-right">{labelA} survivors</th>
                <th className="pb-2 font-medium text-right">{labelB} survivors</th>
              </tr>
            </thead>
            <tbody>
              {pageRuns.map((run, pageIdx) => {
                const absIdx = startIdx + pageIdx;
                const aSurvivors = run.survivors.filter((c) => c.side === "a");
                const bSurvivors = run.survivors.filter((c) => c.side === "b");
                return (
                  <tr
                    key={absIdx}
                    className="border-b border-white/5 hover:bg-white/2 cursor-pointer"
                    onClick={() => { setOverlayRun(run); setOverlayRunIndex(absIdx); }}
                  >
                    <td className="py-2 pr-4 text-white/40">{absIdx + 1}</td>
                    <td className={`py-2 pr-4 font-bold ${winnerColor(run.winner)}`}>
                      {winnerLabel(run.winner)}
                    </td>
                    <td className="py-2 pr-4 text-right">{run.rounds}</td>
                    <td className="py-2 pr-4 text-right text-green-400">{aSurvivors.length}</td>
                    <td className="py-2 text-right text-red-400">{bSurvivors.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={sampleRunPage}
          pageSize={sampleRunPageSize}
          totalItems={totalSamples}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={setSampleRunPage}
          onPageSizeChange={(s) => { setSampleRunPageSize(s); setSampleRunPage(1); }}
        />

        {overlayRun && overlayRunIndex != null && (
          <Overlay
            title={`Run ${overlayRunIndex + 1} — ${winnerLabel(overlayRun.winner)}`}
            onClose={() => { setOverlayRun(null); setOverlayRunIndex(null); }}
            maxWidth={820}
            maxHeight={680}
          >
            {(() => {
              const run = overlayRun;
              const aSide = run.combatants.filter((c) => c.side === "a");
              const bSide = run.combatants.filter((c) => c.side === "b");

              function renderCombatantRow(c: Combatant, shipLabel: string) {
                const hasArcShields = Object.keys(c.shieldByArc).length > 0;
                const totalShield = hasArcShields
                  ? Object.values(c.shieldByArc).reduce((s, v) => s + v, 0)
                  : c.shield;
                const maxShield = c.shipDetail.shield ?? 0;
                const maxHull = c.shipDetail.hull ?? 0;
                const shieldPct = maxShield > 0 ? Math.round((totalShield / maxShield) * 100) : 0;
                const hullPct = maxHull > 0 ? Math.round((c.hull / maxHull) * 100) : 0;

                return (
                  <tr
                    key={`${c.slotId}-${c.instanceIdx}`}
                    className={`border-b border-white/5 ${!c.alive ? "opacity-50" : ""}`}
                  >
                    <td className="py-2 pr-3">
                      <div className={`font-medium text-[0.82rem] ${c.side === "a" ? "text-green-300" : "text-red-300"}`}>
                        {shipLabel} #{c.instanceIdx + 1}
                      </div>
                      <div className="text-[0.72rem] text-white/40">{c.shipDetail.class_name ?? ""}</div>
                    </td>
                    <td className="py-2 pr-3 text-center">
                      {c.alive
                        ? <span className="text-green-400 text-[0.78rem] font-bold">Alive</span>
                        : <span className="text-red-400 text-[0.78rem]">KIA R{c.roundDied}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right text-[0.82rem]">
                      {hasArcShields ? (
                        <div className="flex flex-col gap-0.5 items-end">
                          {Object.entries(c.shieldByArc).map(([arc, val]) => (
                            <span key={arc} className="text-[0.72rem] text-white/60">
                              {arcLabel(arc)}: {formatNumber(val, 0)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>{formatNumber(totalShield, 0)}{maxShield > 0 && <span className="text-white/40"> / {formatNumber(maxShield, 0)} ({shieldPct}%)</span>}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-[0.82rem]">
                      {formatNumber(c.hull, 0)}{maxHull > 0 && <span className="text-white/40"> / {formatNumber(maxHull, 0)} ({hullPct}%)</span>}
                    </td>
                    <td className="py-2 pr-3 text-right text-[0.82rem]">{formatNumber(c.ionic, 0)}</td>
                    <td className="py-2 pr-3 text-right text-[0.82rem] font-bold">{c.kills}</td>
                    <td className="py-2 text-right text-[0.72rem] text-white/50">
                      {c.roundFirstKill != null ? `R${c.roundFirstKill}` : "—"}
                    </td>
                  </tr>
                );
              }

              function renderSideTable(combatants: Combatant[], label: string, color: string) {
                if (!combatants.length) return null;
                const survivors = combatants.filter((c) => c.alive).length;
                return (
                  <div className="flex flex-col gap-2">
                    <h4 className="m-0 text-[0.85rem] font-bold uppercase tracking-widest" style={{ color }}>
                      {label} — {survivors}/{combatants.length} survived
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[0.82rem] border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-white/50 text-left text-[0.72rem]">
                            <th className="pb-1.5 pr-3 font-medium">Ship</th>
                            <th className="pb-1.5 pr-3 font-medium text-center">Status</th>
                            <th className="pb-1.5 pr-3 font-medium text-right">Shield</th>
                            <th className="pb-1.5 pr-3 font-medium text-right">Hull</th>
                            <th className="pb-1.5 pr-3 font-medium text-right">Ionic</th>
                            <th className="pb-1.5 pr-3 font-medium text-right">Kills</th>
                            <th className="pb-1.5 font-medium text-right">1st kill</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combatants.map((c) => renderCombatantRow(c, slotNames.get(c.slotId) ?? c.slotId))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-6">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3 max-[500px]:grid-cols-1">
                    <article className={statCls}>
                      <span className="small">Outcome</span>
                      <strong className={`text-[1.3rem] leading-none ${winnerColor(run.winner)}`}>
                        {winnerLabel(run.winner)}
                      </strong>
                    </article>
                    <article className={statCls}>
                      <span className="small">Total rounds</span>
                      <strong className="text-[1.3rem] leading-none">{run.rounds}</strong>
                    </article>
                    <article className={statCls}>
                      <span className="small">Survivors</span>
                      <strong className="text-[1.3rem] leading-none">{run.survivors.length}</strong>
                      <span className="small text-white/40">
                        {run.survivors.filter((c) => c.side === "a").length} {labelA} · {run.survivors.filter((c) => c.side === "b").length} {labelB}
                      </span>
                    </article>
                  </div>

                  {renderSideTable(aSide, labelA, "rgba(74,222,128,0.85)")}
                  {renderSideTable(bSide, labelB, "rgba(248,113,113,0.85)")}
                </div>
              );
            })()}
          </Overlay>
        )}
      </div>
    );
  }

  function renderMultiComparisonTable() {
    if (!multiResults?.length) return null;

    return (
      <div className="flex flex-col gap-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.82rem] border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-left">
                <th className="pb-2 pr-4 font-medium">Opponent</th>
                <th className="pb-2 pr-4 font-medium text-right">Your Win %</th>
                <th className="pb-2 pr-4 font-medium text-right">Opp Win %</th>
                <th className="pb-2 pr-4 font-medium text-right">Avg Rounds</th>
                <th className="pb-2 pr-4 font-medium text-right">Your Losses %</th>
                <th className="pb-2 pr-4 font-medium text-right">Opp Losses %</th>
                <th className="pb-2 font-medium text-right">Mutual Kill %</th>
              </tr>
            </thead>
            <tbody>
              {multiResults.map((entry) => {
                const r = entry.results;
                const expanded = expandedOpponent === entry.opponentId;
                return (
                  <React.Fragment key={entry.opponentId}>
                    <tr
                      className="border-b border-white/5 hover:bg-white/2 cursor-pointer"
                      onClick={() =>
                        setExpandedOpponent(expanded ? null : entry.opponentId)
                      }
                    >
                      <td className="py-2 pr-4 font-medium">{entry.label}</td>
                      <td
                        className={`py-2 pr-4 text-right font-bold ${
                          r.winRateA > 0.6
                            ? "text-green-400"
                            : r.winRateA < 0.4
                            ? "text-red-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {formatPct(r.winRateA)}
                      </td>
                      <td className="py-2 pr-4 text-right">{formatPct(r.winRateB)}</td>
                      <td className="py-2 pr-4 text-right">{formatNumber(r.avgRounds, 1)}</td>
                      <td className="py-2 pr-4 text-right">{formatPct(r.avgALossRate)}</td>
                      <td className="py-2 pr-4 text-right">{formatPct(r.avgBLossRate)}</td>
                      <td className="py-2 text-right">{formatPct(r.mutualKillRate)}</td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-white/5">
                        <td colSpan={7} className="py-4 px-2">
                          <div className="flex flex-col gap-4">
                            {renderUnitTable(r)}
                            {renderMonteCarloChart(r, "Your Squad", entry.label)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const totalA = slotsA.reduce((s, sl) => s + sl.quantity, 0);
  const totalSingleB = singleSlotsB.reduce((s, sl) => s + sl.quantity, 0);

  return (
    <div className="grid gap-4">
      {/* Header */}
      <section className="panel flex flex-col gap-3">
        <div>
          <h2 className="h2 m-0">Squad Combat Simulator</h2>

          <p className="small">Build both sides, set engagement range and targeting doctrine, then simulate.</p>
          <ReportBugButton toolKey="combat_calculator" toolLabel="Squad Combat Simulator" />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-4 items-start max-[1100px]:grid-cols-1">
        {/* Left panel */}
        <div className="flex flex-col gap-4 sticky top-3 max-[1100px]:static">

          {/* Side A squad builder */}
          <section className="panel flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="h3 m-0">Your Squad (Side A)</h3>
                <p className="small m-0">{totalA} unit{totalA !== 1 ? "s" : ""} · {resolvedSlotsA.length}/{slotsA.filter((s) => s.shipUid).length} loaded</p>
              </div>
            </div>
            {shipsLoading && <p className="small">Loading ship list…</p>}
            <div className="flex flex-col gap-2">
              {slotsA.map((slot) =>
                renderSlotRow(
                  slot,
                  (changes) => updateSlot(setSlotsA, slot.id, changes),
                  () => removeSlot(setSlotsA, slot.id),
                  slotsA.length > 1
                )
              )}
            </div>
            <button
              type="button"
              className={`${pillCls(false)} text-[0.82rem]`}
              onClick={() => setSlotsA((prev) => [...prev, makeSlot()])}
            >
              + Add Ship
            </button>
          </section>

          {/* Side B mode toggle */}
          <section className="panel flex flex-col gap-3">
            <div>
              <h3 className="h3 m-0">Opponent (Side B)</h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${pillCls(sideBMode === "single")} text-[0.82rem]`}
                onClick={() => setSideBMode("single")}
              >
                Single Squad
              </button>
              <button
                type="button"
                className={`${pillCls(sideBMode === "multi")} text-[0.82rem]`}
                onClick={() => setSideBMode("multi")}
              >
                Multi-Opponent
              </button>
            </div>

            {sideBMode === "single" && (
              <div className="flex flex-col gap-3">
                <p className="small m-0">
                  {totalSingleB} unit{totalSingleB !== 1 ? "s" : ""} · {resolvedSingleSlotsB.length}/{singleSlotsB.filter((s) => s.shipUid).length} loaded
                </p>
                <div className="flex flex-col gap-2">
                  {singleSlotsB.map((slot) =>
                    renderSlotRow(
                      slot,
                      (changes) => updateSlot(setSingleSlotsB, slot.id, changes),
                      () => removeSlot(setSingleSlotsB, slot.id),
                      singleSlotsB.length > 1
                    )
                  )}
                </div>
                <button
                  type="button"
                  className={`${pillCls(false)} text-[0.82rem]`}
                  onClick={() => setSingleSlotsB((prev) => [...prev, makeSlot()])}
                >
                  + Add Ship
                </button>
              </div>
            )}

            {sideBMode === "multi" && (
              <div className="flex flex-col gap-4">
                <p className="small m-0">
                  Sim your squad against each opponent separately. Results shown as comparison table.
                </p>
                {opponents.map((opp) => {
                  const oppTotal = opp.slots.reduce((s, sl) => s + sl.quantity, 0);
                  const resolved = resolvedOpponents.find((r) => r.id === opp.id);
                  return (
                    <div
                      key={opp.id}
                      className="flex flex-col gap-3 p-[0.85rem] border border-white/8 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          className={`${inputCls} flex-1 text-[0.82rem]`}
                          value={opp.label}
                          onChange={(e) =>
                            setOpponents((prev) =>
                              prev.map((o) =>
                                o.id === opp.id ? { ...o, label: e.target.value } : o
                              )
                            )
                          }
                          placeholder="Opponent label"
                        />
                        <button
                          type="button"
                          className="shrink-0 w-8 h-8 flex items-center justify-center border border-white/10 rounded-full bg-white/3 text-white/50 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
                          onClick={() =>
                            setOpponents((prev) =>
                              prev.length > 1
                                ? prev.filter((o) => o.id !== opp.id)
                                : prev
                            )
                          }
                          aria-label="Remove opponent"
                        >
                          ×
                        </button>
                      </div>
                      <p className="small m-0">
                        {oppTotal} unit{oppTotal !== 1 ? "s" : ""} · {resolved?.resolvedSlots.length ?? 0}/{opp.slots.filter((s) => s.shipUid).length} loaded
                      </p>
                      <div className="flex flex-col gap-2">
                        {opp.slots.map((slot) =>
                          renderSlotRow(
                            slot,
                            (changes) => updateOpponentSlot(opp.id, slot.id, changes),
                            () => removeOpponentSlot(opp.id, slot.id),
                            opp.slots.length > 1
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        className={`${pillCls(false)} text-[0.82rem]`}
                        onClick={() =>
                          setOpponents((prev) =>
                            prev.map((o) =>
                              o.id === opp.id ? { ...o, slots: [...o.slots, makeSlot()] } : o
                            )
                          )
                        }
                      >
                        + Add Ship
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className={`${pillCls(false)} text-[0.82rem]`}
                  onClick={() =>
                    setOpponents((prev) => [
                      ...prev,
                      {
                        id: genId(),
                        label: `Opponent ${prev.length + 1}`,
                        slots: [makeSlot()],
                      },
                    ])
                  }
                >
                  + Add Opponent Group
                </button>
              </div>
            )}
          </section>

          {/* Sim settings */}
          <section className="panel flex flex-col gap-4">
            <h3 className="h3 m-0">Simulation Settings</h3>

            <div className="flex flex-col gap-2">
              <span className="small">Targeting Doctrine</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className={`${pillCls(targeting === "focus")} text-[0.82rem]`}
                  onClick={() => setTargeting("focus")}
                >
                  Focus Fire
                </button>
                <button
                  type="button"
                  className={`${pillCls(targeting === "random")} text-[0.82rem]`}
                  onClick={() => setTargeting("random")}
                >
                  Random Target
                </button>
                <button
                  type="button"
                  className={`${pillCls(targeting === "optimal")} text-[0.82rem]`}
                  onClick={() => setTargeting("optimal")}
                >
                  Optimal Target
                </button>
              </div>
              <p className="text-[0.72rem] text-white/40 m-0">
                {targeting === "focus"
                  ? "All attackers concentrate on one enemy at a time"
                  : targeting === "random"
                  ? "Each unit picks a random live enemy each round"
                  : "Each unit picks the enemy it deals the most expected damage to"}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="small" htmlFor="squad-range">
                Engagement Range
              </label>
              <input
                id="squad-range"
                className={inputCls}
                type="number"
                min={0}
                max={999}
                step={1}
                value={engagementRange}
                onChange={(e) =>
                  setEngagementRange(Math.max(0, Math.min(999, Number(e.target.value) || 0)))
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="small">Simulation Runs</span>
              <div className="flex flex-wrap gap-2">
                {[1, 10, 100, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${pillCls(runCount === n)} text-[0.82rem]`}
                    onClick={() => setRunCount(n)}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
              {runCount >= 1000 && (
                <p className="text-[0.72rem] text-yellow-400/70 m-0">
                  Large run counts with big squads may take a moment to compute.
                </p>
              )}
            </div>

            <button
              type="button"
              className={`w-full min-h-11 rounded-[10px] border font-bold text-[0.9rem] transition-all duration-150 cursor-pointer ${
                canRun
                  ? "border-[rgba(246,163,0,0.55)] bg-[rgba(246,163,0,0.14)] hover:bg-[rgba(246,163,0,0.22)] text-[rgba(255,215,145,0.95)]"
                  : "border-white/10 bg-white/3 text-white/30 cursor-not-allowed"
              }`}
              disabled={!canRun}
              onClick={handleRun}
            >
              {simRunning ? "Simulating…" : "Run Simulation"}
            </button>

            {!canRun && !simRunning && (
              <p className="text-[0.72rem] text-white/40 m-0">
                Select at least one ship on each side to run.
              </p>
            )}
          </section>

          {/* Saved squads */}
          <section className="panel flex flex-col gap-3">
            <button
              type="button"
              className="flex items-center justify-between w-full p-0 border-0 bg-transparent text-inherit cursor-pointer"
              onClick={() => setShowSaved((v) => !v)}
            >
              <h3 className="h3 m-0">Saved Squads</h3>
              <span className="text-white/40 text-[0.82rem]">
                {savedSquads.length > 0 ? `${savedSquads.length} saved` : "None"} {showSaved ? "▲" : "▼"}
              </span>
            </button>

            {/* Save current setup */}
            <div className="flex gap-2">
              <input
                className={`${inputCls} flex-1 text-[0.82rem]`}
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="Name this setup…"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <button
                type="button"
                className={`shrink-0 px-[0.8rem] py-2 border rounded-[10px] text-[0.82rem] font-medium cursor-pointer transition-[border-color,background] duration-150 ${
                  canRun
                    ? "border-[rgba(246,163,0,0.45)] bg-[rgba(246,163,0,0.1)] text-[rgba(255,215,145,0.9)] hover:bg-[rgba(246,163,0,0.18)]"
                    : "border-white/10 bg-white/3 text-white/30 cursor-not-allowed"
                }`}
                disabled={!canRun}
                onClick={handleSave}
              >
                Save
              </button>
            </div>

            {/* Saved list */}
            {showSaved && (
              <div className="flex flex-col gap-2">
                {savedSquads.length === 0 ? (
                  <p className="small text-white/30">No saved squads yet.</p>
                ) : (
                  savedSquads.map((sq) => (
                    <div
                      key={sq.id}
                      className="flex items-center gap-2 p-[0.65rem_0.8rem] border border-white/8 rounded-xl bg-white/2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.85rem] font-medium truncate">{sq.name}</div>
                        <div className="text-[0.7rem] text-white/40">
                          {new Date(sq.savedAt).toLocaleDateString()} ·{" "}
                          {sq.slotsA.reduce((s, sl) => s + sl.quantity, 0)}v
                          {sq.sideBMode === "single"
                            ? sq.singleSlotsB.reduce((s, sl) => s + sl.quantity, 0)
                            : `${sq.opponents.length} opp`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 px-[0.65rem] py-[0.35rem] border border-white/10 rounded-lg bg-white/3 text-[0.75rem] text-white/70 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
                        onClick={() => handleLoad(sq)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="shrink-0 w-7 h-7 flex items-center justify-center border border-white/10 rounded-full bg-white/3 text-white/40 hover:text-red-400 hover:border-red-400/30 transition-colors cursor-pointer text-[0.8rem]"
                        onClick={() => handleDelete(sq.id)}
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right panel — results */}
        <div className="flex flex-col gap-4">
          {!simResults && !multiResults && !simRunning && (
            <section className="panel flex items-center justify-center min-h-50">
              <p className="small text-white/30 text-center">
                Configure both squads and click Run Simulation to see results.
              </p>
            </section>
          )}

          {simRunning && (
            <section className="panel flex items-center justify-center min-h-50">
              <p className="small text-white/50">Running {runCount.toLocaleString()} simulation{runCount !== 1 ? "s" : ""}…</p>
            </section>
          )}

          {/* Single mode results */}
          {simResults && !simRunning && sideBMode === "single" && (
            <>
              <section className="panel flex flex-col gap-4">
                <div>
                  <h3 className="h3 m-0">Simulation Results</h3>
                  <p className="small">
                    Your Squad vs Opponent · {runCount.toLocaleString()} run{runCount !== 1 ? "s" : ""} · Range {engagementRange} · {targeting === "focus" ? "Focus fire" : targeting === "random" ? "Random targeting" : "Optimal targeting"}
                  </p>
                </div>
                {renderSummaryCards(simResults, "Your Squad", "Opponent")}
              </section>

              <section className="panel flex flex-col gap-4">
                <h4 className="m-0">Unit Performance Breakdown</h4>
                <p className="small m-0">
                  Kills, deaths, KDA, and health stats per unit type averaged across {runCount.toLocaleString()} run{runCount !== 1 ? "s" : ""}.
                </p>
                {renderUnitTable(simResults)}
              </section>

              <section className="panel flex flex-col gap-4">
                <h4 className="m-0">Combat Duration</h4>
                {renderMonteCarloChart(simResults, "Your Squad", "Opponent")}
              </section>

              {simResults.runs > 1 && (
                <section className="panel flex flex-col gap-4">
                  <h4 className="m-0">Scenario Samples</h4>
                  {renderSampleRuns(simResults, "Your Squad", "Opponent")}
                </section>
              )}

              {simResults.runs === 1 && simResults.sampleRuns[0] && (
                <section className="panel flex flex-col gap-4">
                  <h4 className="m-0">Run Detail</h4>
                  <div className="grid grid-cols-2 gap-[0.6rem] max-[600px]:grid-cols-1">
                    <article className={statCls}>
                      <span className="small">Winner</span>
                      <strong className={`text-[1.2rem] ${simResults.sampleRuns[0].winner === "a" ? "text-green-400" : simResults.sampleRuns[0].winner === "b" ? "text-red-400" : "text-yellow-400"}`}>
                        {simResults.sampleRuns[0].winner === "a"
                          ? "Your Squad"
                          : simResults.sampleRuns[0].winner === "b"
                          ? "Opponent"
                          : simResults.sampleRuns[0].winner === "mutual"
                          ? "Mutual Kill"
                          : "Stalemate"}
                      </strong>
                    </article>
                    <article className={statCls}>
                      <span className="small">Rounds</span>
                      <strong className="text-[1.2rem]">{simResults.sampleRuns[0].rounds}</strong>
                    </article>
                  </div>
                  {simResults.sampleRuns[0].survivors.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="small">Surviving Units</span>
                      <div className="grid gap-2">
                        {simResults.sampleRuns[0].survivors.map((c, ci) => {
                          const slot = simResults.slots.find((s) => s.slotId === c.slotId);
                          return (
                            <div
                              key={ci}
                              className="flex items-center gap-3 p-[0.65rem_0.8rem] border border-white/8 rounded-[10px] bg-white/2"
                            >
                              <span
                                className={`text-[0.72rem] font-bold uppercase tracking-wider ${
                                  c.side === "a" ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                {c.side === "a" ? "A" : "B"}
                              </span>
                              <div className="flex-1">
                                <div className="text-[0.85rem] font-medium">
                                  {slot?.shipName ?? c.slotId} #{c.instanceIdx + 1}
                                </div>
                                <div className="text-[0.72rem] text-white/50">
                                  {slot?.shipClass}
                                </div>
                              </div>
                              <div className="text-right text-[0.78rem] text-white/60">
                                {Object.keys(c.shieldByArc).length > 0
                                  ? Object.entries(c.shieldByArc).map(([arc, val]) => (
                                      <div key={arc}>{arcLabel(arc)} S: {formatNumber(val, 0)}</div>
                                    ))
                                  : <div>S: {formatNumber(c.shield, 0)}</div>}
                                <div>H: {formatNumber(c.hull, 0)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {/* Multi-opponent results */}
          {multiResults && !simRunning && sideBMode === "multi" && (
            <>
              <section className="panel flex flex-col gap-4">
                <div>
                  <h3 className="h3 m-0">Multi-Opponent Results</h3>
                  <p className="small">
                    Your Squad vs {multiResults.length} opponent{multiResults.length !== 1 ? "s" : ""} · {runCount.toLocaleString()} run{runCount !== 1 ? "s" : ""} each · Range {engagementRange} · {targeting === "focus" ? "Focus fire" : targeting === "random" ? "Random targeting" : "Optimal targeting"}
                  </p>
                </div>
                {renderMultiComparisonTable()}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberCombatCalculatorPanel;
