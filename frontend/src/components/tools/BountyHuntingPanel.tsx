import React, { useEffect, useMemo, useState } from "react";
import {
  addBountyScan,
  createBountyContract,
  deleteBountyContract,
  deleteBountyScan,
  getBountyContracts,
  getCandidateBountyWorlds,
  updateBountyContract,
  updateBountyScan,
  type BountyContract,
  type BountyContractScan,
  type BountyContractType,
  type BountyRangeBand,
  type CandidateWorld,
} from "../../api/member/bountyHunting";
import type { CharacterLocation } from "../../api/member/characterLocation";
import { getCgtTime, splitSwcSeconds, formatCgtParts, type CgtResponse } from "../../api/core/time";
import { getHyperPlannerRoute, getStoredMapSystemsInBounds, getStoredShipTypes, type StoredMapSystem, type StoredShipTypeSummary } from "../../api/universe/universe";
import { clusterTriangulatedLocations, pointInPolygon, suggestNextScanPositions, triangulateFromScans, RANGE_BAND_DISTANCE, WEDGE_HALF_ANGLE_DEGREES, type LocationCluster } from "../../utils/triangulation";
import BountyTriangulationMap from "./BountyTriangulationMap";
import { BTN, BTN_GHOST, BTN_GHOST_SM, BTN_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import ReportBugButton from "../support/ReportBugButton";

const EMPTY_CLS = "text-white/40 text-[0.9rem] py-8";

const DIFFICULTY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "1 — Trivial" },
  { value: 2, label: "2 — Easy" },
  { value: 3, label: "3 — Standard" },
  { value: 4, label: "4 — Challenging" },
  { value: 5, label: "5 — Daunting" },
];

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Trivial",
  2: "Easy",
  3: "Standard",
  4: "Challenging",
  5: "Daunting",
};

// Easy-to-hard gradient using the site's established accent palette (jen-orange,
// accent yellow/green) plus the existing error-red, rather than introducing new colors.
const DIFFICULTY_COLORS: Record<number, string> = {
  1: "#2ecc71",
  2: "#f5d546",
  3: "#F6A300",
  4: "#fb923c",
  5: "#f87171",
};

const CONTRACT_TYPE_COLORS: Record<BountyContractType, string> = {
  kill: "#f87171",
  rescue: "#2ecc71",
};

// Targets only ever spawn on Darkness- or Quests-owned worlds (see backend
// BountyHuntingController::CANDIDATE_OWNERS) — color-coding which one helps tell
// candidate worlds apart at a glance.
const OWNER_COLORS: Record<string, string> = {
  Darkness: "#a78bfa",
  Quests: "#2ecc71",
};

// The Tracking Fob shows an 8-point compass heading, not a precise degree —
// N=0°, going clockwise, matching the bearing convention used in triangulation.ts.
const COMPASS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "N" },
  { value: 45, label: "NE" },
  { value: 90, label: "E" },
  { value: 135, label: "SE" },
  { value: 180, label: "S" },
  { value: 225, label: "SW" },
  { value: 270, label: "W" },
  { value: 315, label: "NW" },
];

const COMPASS_LABELS: Record<number, string> = Object.fromEntries(
  COMPASS_OPTIONS.map((opt) => [opt.value, opt.label])
);

function formatBearing(degrees: number): string {
  return COMPASS_LABELS[degrees] ?? `${degrees}°`;
}

const RANGE_BAND_OPTIONS: Array<{ value: BountyRangeBand; label: string }> = [
  { value: "bearing_only", label: "Unknown" },
  { value: "inner", label: "Short" },
  { value: "mid", label: "Medium" },
  { value: "outer", label: "Long" },
  { value: "beyond_100", label: "Very Distant" },
];

const RANGE_BAND_LABELS: Record<BountyRangeBand, string> = Object.fromEntries(
  RANGE_BAND_OPTIONS.map((opt) => [opt.value, opt.label])
) as Record<BountyRangeBand, string>;

// Contracts state their deadline in CGT (Coordinated Galactic Time) Year/Day, matching
// how the game presents it — converting that to a real-world date is one-directional
// (real seconds == swc seconds, just offset), so we do it here instead of asking the
// member to work out "days until deadline" themselves.
function cgtYearDayToDeadlineIso(year: number, day: number, cgt: CgtResponse): string {
  const secondsPerDay = 86400;
  const secondsPerYear = 365 * secondsPerDay;
  const targetSwcSeconds = year * secondsPerYear + day * secondsPerDay;

  const serverNowMs = new Date(cgt.server_now).getTime();
  const nowMs = Date.now();
  const currentSwcSeconds = cgt.swc_seconds + (nowMs - serverNowMs) / 1000;
  const deltaSeconds = targetSwcSeconds - currentSwcSeconds;

  return new Date(nowMs + deltaSeconds * 1000).toISOString();
}

function formatDeadline(deadlineAt: string | null): { label: string; expired: boolean } {
  if (!deadlineAt) return { label: "No deadline set", expired: false };
  const ms = new Date(deadlineAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, expired: true };
  if (days === 0) return { label: "Due today", expired: false };
  return { label: `${days}d left`, expired: false };
}

type Props = {
  playerLocation?: CharacterLocation | null;
  // Hands off a "from,to" coordinate pair (plus the ship/skill already set here) to
  // the Hyper Planner tool (a tool switch, not a real navigation — MembersPage owns
  // which tool is currently shown).
  onPlanRoute?: (from: string, to: string, shipUid: string | null, pilotingSkill: number) => void;
  // Gates the computed "suggested next scan" (triangulated recommendation + travel
  // time) behind Public Toolkit subscription / JOE membership. Free-tier users can
  // still log scans and see possible locations, just not the recommendation itself.
  canSeeSuggestedScan?: boolean;
};

const BountyHuntingPanel: React.FC<Props> = ({ playerLocation, onPlanRoute, canSeeSuggestedScan = true }) => {
  const myGalx = playerLocation?.galx ?? null;
  const myGaly = playerLocation?.galy ?? null;
  const hasPlayerLocation = myGalx != null && myGaly != null;

  // --- Contracts list ---
  const [contracts, setContracts] = useState<BountyContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Multiple contracts can have Tracking open at once — everything below keyed by
  // contract id is what makes that safe (each contract's scan form, candidate worlds/
  // systems, and suggested-scan state are fully independent).
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  async function loadContracts() {
    setLoading(true);
    setError(null);
    try {
      const res = await getBountyContracts();
      if (res.ok) setContracts(res.data);
      else setError("Failed to load bounty contracts.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadContracts(); }, []);

  // --- Current CGT clock, for the deadline Year/Day inputs below ---
  const [cgtNow, setCgtNow] = useState<CgtResponse | null>(null);
  useEffect(() => {
    getCgtTime().then(setCgtNow).catch(() => {});
  }, []);
  const cgtNowLabel = cgtNow ? formatCgtParts(splitSwcSeconds(cgtNow.swc_seconds)) : null;

  // --- New contract form ---
  const [targetName, setTargetName] = useState("");
  const [newDifficulty, setNewDifficulty] = useState(1);
  const [newType, setNewType] = useState<BountyContractType>("kill");
  const [deadlineYear, setDeadlineYear] = useState<number | "">("");
  const [deadlineDay, setDeadlineDay] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAddContract(e: React.FormEvent) {
    e.preventDefault();
    if (!targetName.trim()) {
      setFormError("Target name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const deadlineAt = deadlineYear !== "" && deadlineDay !== "" && cgtNow
        ? cgtYearDayToDeadlineIso(deadlineYear, deadlineDay, cgtNow)
        : null;
      const res = await createBountyContract({
        target_name: targetName.trim(),
        difficulty: newDifficulty,
        contract_type: newType,
        deadline_at: deadlineAt,
        notes: notes.trim() || null,
        accepted_galx: myGalx,
        accepted_galy: myGaly,
      });
      if (res.ok) {
        await loadContracts();
        setTargetName("");
        setNewDifficulty(1);
        setNewType("kill");
        setDeadlineYear("");
        setDeadlineDay("");
        setNotes("");
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to add contract.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetStatus(contract: BountyContract, status: "completed" | "failed") {
    if (status === "failed" && !window.confirm(`Mark "${contract.target_name}" as Failed? This can't be undone.`)) {
      return;
    }
    try {
      const res = await updateBountyContract(contract.id, { status });
      if (res.ok) {
        setContracts((current) => current.map((c) => (c.id === contract.id ? res.data : c)));
      }
    } catch {
      // surfaced via list staying unchanged; not critical enough to block the UI
    }
  }

  async function handleDeleteContract(contract: BountyContract) {
    if (!window.confirm(`Delete "${contract.target_name}"? This can't be undone.`)) {
      return;
    }
    try {
      await deleteBountyContract(contract.id);
      setContracts((current) => current.filter((c) => c.id !== contract.id));
      setExpandedIds((current) => {
        if (!current.has(contract.id)) return current;
        const next = new Set(current);
        next.delete(contract.id);
        return next;
      });
    } catch {
      // ignore — list refresh on next load will reconcile
    }
  }

  // --- Per-contract scan tracking ---
  // Independent per contract — without this, two contracts expanded at once would
  // share one set of form fields, so typing into one contract's scan form would show
  // up in another's.
  type ScanFormState = {
    bearing: number;
    rangeBand: BountyRangeBand;
    galx: number | "";
    galy: number | "";
    submitting: boolean;
    error: string | null;
    editingScanId: number | null;
  };
  const DEFAULT_SCAN_FORM: ScanFormState = {
    bearing: 0,
    rangeBand: "bearing_only",
    galx: "",
    galy: "",
    submitting: false,
    error: null,
    editingScanId: null,
  };
  const [scanForms, setScanForms] = useState<Record<number, ScanFormState>>({});

  function getScanForm(contractId: number): ScanFormState {
    return scanForms[contractId] ?? DEFAULT_SCAN_FORM;
  }

  function updateScanForm(contractId: number, patch: Partial<ScanFormState>) {
    setScanForms((current) => ({ ...current, [contractId]: { ...(current[contractId] ?? DEFAULT_SCAN_FORM), ...patch } }));
  }

  // Full candidate-world list per contract, used to resolve a triangulated cluster to
  // its nearest named world (independent of the Worlds tab, which may be showing a
  // different contract's percentile-limited slice).
  const [trackingWorlds, setTrackingWorlds] = useState<Record<number, CandidateWorld[]>>({});
  // Real systems near each contract's location — used both to label a possible/
  // confirmed location that lands on a system but isn't a Darkness/Quests candidate
  // world, and as extra candidates for the next-scan suggestion (see refreshSuggestedScan).
  const [trackingSystems, setTrackingSystems] = useState<Record<number, StoredMapSystem[]>>({});

  function resetScanForm(contractId: number) {
    setScanForms((current) => ({ ...current, [contractId]: DEFAULT_SCAN_FORM }));
  }

  function handleStartEditScan(contractId: number, scan: BountyContractScan) {
    updateScanForm(contractId, {
      editingScanId: scan.id,
      bearing: scan.bearing_degrees,
      rangeBand: scan.range_band ?? "bearing_only",
      galx: scan.scan_galx,
      galy: scan.scan_galy,
      error: null,
    });
  }

  // Real systems near the contract's scans — shared by computePossibleLocations (to
  // name a location that lands on a system but isn't a Darkness/Quests candidate
  // world) and refreshSuggestedScan (as extra candidates). Bounded by the actual
  // spread of `points` (every scan position, plus the accepted/player location as a
  // fallback anchor when there are no scans yet) rather than a fixed-size box around
  // a single point — a hunt's scans can spread across the galaxy as the player travels
  // and takes more readings, and a fixed pad around only the *first* point (e.g. where
  // the contract was accepted) can miss systems near scans taken far from it later,
  // even though those are exactly the ones most likely to need a name.
  async function fetchNearbySystems(points: Array<{ galx: number; galy: number }>): Promise<StoredMapSystem[]> {
    if (points.length === 0) return [];
    const pad = 250;
    try {
      const res = await getStoredMapSystemsInBounds({
        min_galx: Math.max(-500, Math.min(...points.map((p) => p.galx)) - pad),
        max_galx: Math.min(500, Math.max(...points.map((p) => p.galx)) + pad),
        min_galy: Math.max(-500, Math.min(...points.map((p) => p.galy)) - pad),
        max_galy: Math.min(500, Math.max(...points.map((p) => p.galy)) + pad),
      });
      return res.ok ? res.data.filter((s) => s.galx != null && s.galy != null) : [];
    } catch {
      return [];
    }
  }

  // Recomputes trackingSystems against the contract's current scans (a new scan can
  // land outside the box fetched when Tracking was first expanded) and returns the
  // fresh value directly, so callers can pass it straight into refreshSuggestedScan
  // instead of reading the not-yet-updated state value in the same tick.
  async function refreshTrackingSystems(contract: BountyContract): Promise<StoredMapSystem[]> {
    const galx = contract.accepted_galx ?? myGalx;
    const galy = contract.accepted_galy ?? myGaly;
    const searchPoints = [
      ...(galx != null && galy != null ? [{ galx, galy }] : []),
      ...contract.scans.map((s) => ({ galx: s.scan_galx, galy: s.scan_galy })),
    ];
    const systems = await fetchNearbySystems(searchPoints);
    setTrackingSystems((current) => ({ ...current, [contract.id]: systems }));
    return systems;
  }

  async function handleExpand(contract: BountyContract) {
    const opening = !expandedIds.has(contract.id);
    setExpandedIds((current) => {
      const next = new Set(current);
      if (opening) next.add(contract.id); else next.delete(contract.id);
      return next;
    });
    resetScanForm(contract.id);

    if (!opening) {
      updateSuggestedScanState(contract.id, { scan: null, travelTime: null });
      return;
    }

    const galx = contract.accepted_galx ?? myGalx;
    const galy = contract.accepted_galy ?? myGaly;
    const searchPoints = [
      ...(galx != null && galy != null ? [{ galx, galy }] : []),
      ...contract.scans.map((s) => ({ galx: s.scan_galx, galy: s.scan_galy })),
    ];

    if (galx == null || galy == null) {
      // Candidate worlds need an anchor point for the distance sort (the backend
      // returns every Darkness/Quests world galaxy-wide regardless, but still requires
      // galx/galy to compute "units away"), so that fetch is skipped without one — but
      // systems can still be searched around the scans alone.
      setTrackingWorlds((current) => ({ ...current, [contract.id]: [] }));
      const systems = await fetchNearbySystems(searchPoints);
      setTrackingSystems((current) => ({ ...current, [contract.id]: systems }));
      await refreshSuggestedScan(contract, [], undefined, undefined, systems);
      return;
    }
    try {
      const [worldsRes, systems] = await Promise.all([
        getCandidateBountyWorlds({ galx, galy, difficulty: contract.difficulty }),
        fetchNearbySystems(searchPoints),
      ]);
      const worlds = worldsRes.ok ? worldsRes.data : [];
      setTrackingWorlds((current) => ({ ...current, [contract.id]: worlds }));
      setTrackingSystems((current) => ({ ...current, [contract.id]: systems }));
      await refreshSuggestedScan(contract, worlds, undefined, undefined, systems);
    } catch {
      setTrackingWorlds((current) => ({ ...current, [contract.id]: [] }));
      setTrackingSystems((current) => ({ ...current, [contract.id]: [] }));
      await refreshSuggestedScan(contract, [], undefined, undefined, []);
    }
  }

  // With only one scan logged there's nothing to triangulate yet, but the bearing and
  // range band alone already rule out most worlds — the same ±22.5° compass wedge used
  // for triangulation narrows by direction, and the logged range band (if any) narrows
  // by distance too.
  function worldsInScanWedge(scan: BountyContractScan, worlds: CandidateWorld[]): CandidateWorld[] {
    const { min, max } = RANGE_BAND_DISTANCE[scan.range_band ?? "bearing_only"];
    return worlds
      .filter((world) => {
        const dx = world.galx - scan.scan_galx;
        const dy = world.galy - scan.scan_galy;
        const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
        const diff = Math.abs(bearing - scan.bearing_degrees) % 360;
        if (Math.min(diff, 360 - diff) > WEDGE_HALF_ANGLE_DEGREES) return false;
        const distance = Math.hypot(dx, dy);
        return distance >= min && distance <= max;
      })
      .sort((a, b) => Math.hypot(a.galx - scan.scan_galx, a.galy - scan.scan_galy) - Math.hypot(b.galx - scan.scan_galx, b.galy - scan.scan_galy));
  }

  // Picking just the nearest world to a cluster's centroid was misleading whenever the
  // region was still wide enough to plausibly hold several different worlds — list
  // every candidate world that actually falls inside the region instead, so "Possible
  // locations" reflects the genuine uncertainty rather than one arbitrary guess.
  function worldsInClusterPolygon(cluster: LocationCluster, worlds: CandidateWorld[]): CandidateWorld[] {
    return worlds
      .filter((world) => pointInPolygon({ galx: world.galx, galy: world.galy }, cluster.polygon))
      .sort((a, b) => Math.hypot(a.galx - cluster.galx, a.galy - cluster.galy) - Math.hypot(b.galx - cluster.galx, b.galy - cluster.galy));
  }

  // Where the player actually is in the fiction of the hunt — wherever the last scan
  // was taken — used as the Hyper Planner's starting point for "Plan Route" links.
  function lastScanCoords(contract: BountyContract): string | null {
    if (contract.scans.length === 0) return null;
    const lastScan = [...contract.scans].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )[0];
    return `${lastScan.scan_galx},${lastScan.scan_galy}`;
  }

  // A logged scan is often taken from right at a system the player is standing in —
  // worth naming rather than just showing raw coordinates. Exact match only, since
  // scan positions are entered as the precise galx/galy the player was at.
  function systemAtCoords(galx: number, galy: number, systems: StoredMapSystem[]): StoredMapSystem | null {
    return systems.find((system) => system.galx === galx && system.galy === galy) ?? null;
  }

  // A possible/confirmed location with no matching Darkness/Quests candidate world
  // might still land on a real system worth naming — find the nearest one actually
  // inside the region, if any.
  function systemInClusterPolygon(cluster: LocationCluster, systems: StoredMapSystem[]): StoredMapSystem | null {
    const matches = systems.filter(
      (system) => system.galx != null && system.galy != null && pointInPolygon({ galx: system.galx, galy: system.galy }, cluster.polygon)
    );
    if (matches.length === 0) return null;
    return matches.reduce((closest, system) =>
      Math.hypot(system.galx! - cluster.galx, system.galy! - cluster.galy) < Math.hypot(closest.galx! - cluster.galx, closest.galy! - cluster.galy)
        ? system
        : closest
    );
  }

  // Shared by the render-time "Possible locations" list and the async suggested-scan
  // refresh below, so the two can never disagree about what's already confirmed.
  function computePossibleLocations(contract: BountyContract, worlds: CandidateWorld[], systems: StoredMapSystem[] = []) {
    const clusters: LocationCluster[] = clusterTriangulatedLocations(
      contract.scans.map((s) => ({ scanGalx: s.scan_galx, scanGaly: s.scan_galy, bearingDegrees: s.bearing_degrees, rangeBand: s.range_band }))
    );
    const resolvedClusters = clusters.map((cluster) => ({
      ...cluster,
      worlds: worldsInClusterPolygon(cluster, worlds),
      systemName: systemInClusterPolygon(cluster, systems)?.name ?? null,
    }));
    // Flatten to one entry per candidate world actually inside a region (or one
    // generic coordinate entry if the region holds none we know of) — this is the
    // real count of "places it could be", not just the count of geometric regions.
    const possibleLocationEntries = resolvedClusters.flatMap((cluster) =>
      cluster.worlds.length > 0
        ? cluster.worlds.map((world) => ({ cluster, world }))
        : [{ cluster, world: null as CandidateWorld | null }]
    );
    // Only call it confirmed when every scan agrees AND that agreement narrows down to
    // exactly one known candidate world — anything less is still a guess.
    const isConfident = possibleLocationEntries.length === 1 && resolvedClusters[0]?.supportCount === contract.scans.length;
    return { clusters, resolvedClusters, possibleLocationEntries, isConfident };
  }

  // --- Travel speed, for estimating suggested-scan travel time via the Hyper Planner ---
  // There's no ship/piloting data tied to the player's profile, and the Hyper Planner
  // itself requires an explicit ship (no sane universal default — hyperspeed 1 makes a
  // routine ~280-unit hop take 33 days). Persisted locally so it's a one-time setup.
  const SHIP_STORAGE_KEY = "joe.bountyHunting.travelShip";
  const PILOTING_STORAGE_KEY = "joe.bountyHunting.pilotingSkill";
  const [ships, setShips] = useState<StoredShipTypeSummary[]>([]);
  const [shipQuery, setShipQuery] = useState("");
  const [selectedShip, setSelectedShip] = useState<StoredShipTypeSummary | null>(null);
  const [pilotingSkill, setPilotingSkill] = useState<number>(() => {
    const stored = Number(localStorage.getItem(PILOTING_STORAGE_KEY));
    return Number.isFinite(stored) && stored >= 0 && stored <= 5 ? stored : 0;
  });

  useEffect(() => {
    getStoredShipTypes()
      .then((res) => {
        if (!res.ok) return;
        const withHyperdrive = res.data.filter((ship) => ship.hyperdrive != null && Number(ship.hyperdrive) > 0);
        setShips(withHyperdrive);
        const storedUid = localStorage.getItem(SHIP_STORAGE_KEY);
        const restored = storedUid ? withHyperdrive.find((ship) => ship.uid === storedUid) ?? null : null;
        if (restored) {
          setSelectedShip(restored);
          setShipQuery(formatShipDisplay(restored));
        }
      })
      .catch(() => {});
  }, []);

  function formatShipDisplay(ship: Pick<StoredShipTypeSummary, "name" | "class_name" | "hyperdrive">) {
    const name = ship.name ?? "Unknown ship";
    const shipClass = ship.class_name ? ` · ${ship.class_name}` : "";
    const hyper = ship.hyperdrive != null ? ` · Hyper ${Math.round(ship.hyperdrive)}` : "";
    return `${name}${shipClass}${hyper}`;
  }

  function resolveShipHyperspeed(ship: Pick<StoredShipTypeSummary, "hyperdrive"> | null): number | null {
    if (!ship?.hyperdrive) return null;
    return Math.max(1, Math.round(ship.hyperdrive));
  }

  // Mirrors UniverseController::calculatePlannerJourneyLength/DirectTravelSeconds — the
  // Hyper Planner returns ok:false (no error, just no route) when no stored hyperlane
  // beats a plain direct jump between two close points, which is a GOOD outcome (the
  // direct hop is already optimal), not a failure. Replicated here so that case can be
  // timed instead of treated as unreachable.
  function calculateDirectTravelSeconds(fromGalx: number, fromGaly: number, toGalx: number, toGaly: number, pilotingSkill: number, hyperspeed: number): number {
    const journeyLength = Math.max(Math.abs(toGalx - fromGalx), Math.abs(toGaly - fromGaly));
    if (journeyLength <= 0) return 0;
    const speedWithPiloting = 1 * (1 + pilotingSkill * 0.05);
    const intervalSeconds = Math.floor(7200 / speedWithPiloting);
    const hyperspeedModifier = 1 / Math.max(1, hyperspeed);
    return Math.ceil(Math.ceil(journeyLength * intervalSeconds) * hyperspeedModifier);
  }

  function formatDirectTravelSeconds(totalSeconds: number): string {
    if (totalSeconds < 1) return "Less than a second";
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const days = Math.floor(totalSeconds / 86400);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} Day${days === 1 ? "" : "s"}`);
    if (hours > 0 || days > 0) parts.push(`${hours} Hour${hours === 1 ? "" : "s"}`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes} Minute${minutes === 1 ? "" : "s"}`);
    parts.push(`${seconds} Second${seconds === 1 ? "" : "s"}`);
    return parts.join(", ");
  }

  const shipSuggestions = useMemo(() => {
    const query = shipQuery.trim().toLowerCase();
    if (!query) return [];
    return ships
      .filter((ship) => [ship.name, ship.class_name].filter(Boolean).join(" ").toLowerCase().includes(query))
      .slice(0, 6);
  }, [ships, shipQuery]);

  function handleSelectShip(ship: StoredShipTypeSummary) {
    setSelectedShip(ship);
    setShipQuery(formatShipDisplay(ship));
    localStorage.setItem(SHIP_STORAGE_KEY, ship.uid);
  }

  function handleSetPilotingSkill(skill: number) {
    setPilotingSkill(skill);
    localStorage.setItem(PILOTING_STORAGE_KEY, String(skill));
  }

  // --- Suggested next scan (geometry + real travel time via the Hyper Planner) ---
  // Per contract, like the scan form — two contracts expanded at once shouldn't share
  // a single "is this loading" flag or stomp on each other's suggested spot.
  type SuggestedScanState = {
    scan: { galx: number; galy: number; systemName?: string | null } | null;
    travelTime: string | null;
    loading: boolean;
    needsShip: boolean;
  };
  const DEFAULT_SUGGESTED_SCAN: SuggestedScanState = { scan: null, travelTime: null, loading: false, needsShip: false };
  const [suggestedScans, setSuggestedScans] = useState<Record<number, SuggestedScanState>>({});
  const [shipSettingsOpen, setShipSettingsOpen] = useState<Record<number, boolean>>({});

  function getSuggestedScanState(contractId: number): SuggestedScanState {
    return suggestedScans[contractId] ?? DEFAULT_SUGGESTED_SCAN;
  }

  function updateSuggestedScanState(contractId: number, patch: Partial<SuggestedScanState>) {
    setSuggestedScans((current) => ({ ...current, [contractId]: { ...(current[contractId] ?? DEFAULT_SUGGESTED_SCAN), ...patch } }));
  }

  // How long a suggested next scan is allowed to take before it's discarded in favor
  // of a less-tight-but-actually-practical option — this tool exists to save hunting
  // time, not send the player on a half-galaxy detour for a marginally better cone.
  // SWC's actual hyperlane travel times run in days, not minutes, even at a decent
  // hyperspeed/piloting skill (confirmed against the real Hyper Planner — a routine
  // ~300-400 unit hop takes 4-5 days at hyperspeed 6/skill 2), so the budget has to
  // match that real scale rather than a real-world commute.
  const SUGGESTED_SCAN_TIME_BUDGET_SECONDS = 24 * 60 * 60;

  async function refreshSuggestedScan(
    contract: BountyContract,
    worlds: CandidateWorld[],
    shipOverride?: StoredShipTypeSummary | null,
    skillOverride?: number,
    systemsOverride?: StoredMapSystem[]
  ) {
    if (!canSeeSuggestedScan) {
      return;
    }

    // Accept explicit overrides rather than always reading selectedShip/pilotingSkill/
    // trackingSystems from state — callers that just changed those via setState in the
    // same handler would otherwise see the stale pre-update value (state updates
    // aren't synchronous).
    const ship = shipOverride !== undefined ? shipOverride : selectedShip;
    const skill = skillOverride !== undefined ? skillOverride : pilotingSkill;
    const systems = systemsOverride !== undefined ? systemsOverride : (trackingSystems[contract.id] ?? []);
    const { possibleLocationEntries, isConfident } = computePossibleLocations(contract, worlds, systems);
    if (isConfident || contract.scans.length === 0) {
      updateSuggestedScanState(contract.id, { scan: null, travelTime: null, needsShip: false });
      return;
    }

    const knownPoints = possibleLocationEntries
      .map((entry) => entry.world ?? entry.cluster)
      .map((p) => ({ galx: p.galx, galy: p.galy }));

    // Real systems are evaluated as candidates alongside the generic search ring, so a
    // well-positioned one can be suggested directly — travel to it can ride the actual
    // hyperlane network most of the way, instead of always ending in a slow direct jump
    // through empty space.
    const nearbySystems = systems
      .filter((system) => system.galx != null && system.galy != null)
      .map((system) => ({ galx: system.galx as number, galy: system.galy as number, name: system.name }));

    const candidates = suggestNextScanPositions(
      contract.scans.map((s) => ({ scanGalx: s.scan_galx, scanGaly: s.scan_galy, bearingDegrees: s.bearing_degrees, rangeBand: s.range_band })),
      knownPoints,
      8,
      nearbySystems
    );
    if (candidates.length === 0) {
      updateSuggestedScanState(contract.id, { scan: null, travelTime: null, needsShip: false });
      return;
    }

    const hyperspeed = resolveShipHyperspeed(ship);
    if (hyperspeed == null) {
      // No real ship picked — showing a "best" position based on a meaningless
      // travel-time guess would be worse than not showing a time at all. Fall back to
      // the purely geometric best candidate and prompt for a ship instead.
      updateSuggestedScanState(contract.id, { scan: candidates[0], travelTime: null, needsShip: true });
      return;
    }
    updateSuggestedScanState(contract.id, { needsShip: false });

    // Travel time is measured from wherever the last scan was taken — that's where
    // the player actually is in the fiction of the hunt, not necessarily their live
    // location right now.
    const lastScan = [...contract.scans].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )[0];
    const origin = `${lastScan.scan_galx},${lastScan.scan_galy}`;

    updateSuggestedScanState(contract.id, { loading: true });
    try {
      const results = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const res = await getHyperPlannerRoute(origin, `${candidate.galx},${candidate.galy}`, { pilotingSkill: skill, hyperspeed });
            if (res.ok) {
              return { candidate, seconds: res.data.summary.total_seconds, formatted: res.data.summary.formatted_time };
            }
            return { candidate, seconds: Infinity, formatted: null as string | null };
          } catch (err: unknown) {
            // "No stored hyperlane route beats direct travel" isn't a failure — it
            // means the candidate is close enough that a plain direct jump is already
            // optimal, which the planner doesn't bother quoting a time for. Compute it
            // ourselves rather than treating a genuinely good, close option as unreachable.
            if (err instanceof Error && err.message.includes("beat direct travel")) {
              const seconds = calculateDirectTravelSeconds(lastScan.scan_galx, lastScan.scan_galy, candidate.galx, candidate.galy, skill, hyperspeed);
              return { candidate, seconds, formatted: formatDirectTravelSeconds(seconds) };
            }
            return { candidate, seconds: Infinity, formatted: null as string | null };
          }
        })
      );

      // Results stay in the candidates' geometric best-to-worst order, so the first
      // one within budget is both the most informative AND actually practical to reach.
      const reachable = results.find((r) => r.seconds <= SUGGESTED_SCAN_TIME_BUDGET_SECONDS);
      const chosen = reachable ?? results.reduce((fastest, r) => (r.seconds < fastest.seconds ? r : fastest), results[0]);
      updateSuggestedScanState(contract.id, { scan: chosen.candidate, travelTime: chosen.formatted });
    } finally {
      updateSuggestedScanState(contract.id, { loading: false });
    }
  }

  function handleUseMyLocationForScan(contractId: number) {
    if (!hasPlayerLocation) return;
    updateScanForm(contractId, { galx: myGalx as number, galy: myGaly as number });
  }

  async function syncTriangulatedEstimate(contract: BountyContract) {
    const estimate = triangulateFromScans(
      contract.scans.map((s) => ({ scanGalx: s.scan_galx, scanGaly: s.scan_galy, bearingDegrees: s.bearing_degrees, rangeBand: s.range_band }))
    );
    if (!estimate) return;
    try {
      const res = await updateBountyContract(contract.id, {
        estimated_galx: estimate.galx,
        estimated_galy: estimate.galy,
      });
      if (res.ok) {
        setContracts((current) => current.map((c) => (c.id === contract.id ? res.data : c)));
      }
    } catch {
      // estimate display will just be stale until next successful sync
    }
  }

  async function handleAddScan(contract: BountyContract, e: React.FormEvent) {
    e.preventDefault();
    const form = getScanForm(contract.id);
    if (form.galx === "" || form.galy === "") {
      updateScanForm(contract.id, { error: "Scan position is required." });
      return;
    }
    updateScanForm(contract.id, { submitting: true, error: null });
    try {
      const payload = {
        scan_galx: form.galx,
        scan_galy: form.galy,
        bearing_degrees: form.bearing,
        range_band: form.rangeBand,
      };
      const res = form.editingScanId != null
        ? await updateBountyScan(contract.id, form.editingScanId, payload)
        : await addBountyScan(contract.id, payload);
      if (res.ok) {
        setContracts((current) => current.map((c) => (c.id === contract.id ? res.data : c)));
        resetScanForm(contract.id);
        await syncTriangulatedEstimate(res.data);
        const systems = await refreshTrackingSystems(res.data);
        await refreshSuggestedScan(res.data, trackingWorlds[contract.id] ?? [], undefined, undefined, systems);
      }
    } catch (err: unknown) {
      updateScanForm(contract.id, { error: err instanceof Error ? err.message : (form.editingScanId != null ? "Failed to update scan." : "Failed to log scan.") });
    } finally {
      updateScanForm(contract.id, { submitting: false });
    }
  }

  async function handleDeleteScan(contract: BountyContract, scanId: number) {
    try {
      const res = await deleteBountyScan(contract.id, scanId);
      if (res.ok) {
        setContracts((current) => current.map((c) => (c.id === contract.id ? res.data : c)));
        if (getScanForm(contract.id).editingScanId === scanId) resetScanForm(contract.id);
        await syncTriangulatedEstimate(res.data);
        const systems = await refreshTrackingSystems(res.data);
        await refreshSuggestedScan(res.data, trackingWorlds[contract.id] ?? [], undefined, undefined, systems);
      }
    } catch {
      // ignore — list refresh on next load will reconcile
    }
  }

  // --- Combine tracking: opt-in multi-contract route, built entirely on top of the
  // existing per-contract suggestion (nothing about that logic changes) — each
  // selected contract's own already-computed best suggested scan becomes one stop,
  // and this just finds the travel-optimal order to visit all of them.
  const [combineSelection, setCombineSelection] = useState<Set<number>>(new Set());
  const [combiningLoading, setCombiningLoading] = useState(false);
  const [combinedRoute, setCombinedRoute] = useState<{
    stops: Array<{ contractId: number; targetName: string; galx: number; galy: number; systemName?: string | null; legSeconds: number; legFormatted: string }>;
    totalSeconds: number;
    totalFormatted: string;
  } | null>(null);
  const [combineError, setCombineError] = useState<string | null>(null);

  function toggleCombineSelection(contractId: number) {
    setCombineSelection((current) => {
      const next = new Set(current);
      if (next.has(contractId)) next.delete(contractId); else next.add(contractId);
      return next;
    });
    setCombinedRoute(null);
  }

  // Visits each selected contract's suggested scan in whichever order minimizes total
  // travel time — a small traveling-salesman-style search, brute-forced since the
  // realistic stop count (a handful of contracts at once) keeps the permutation count
  // tiny. Travel times between every pair of stops are fetched once and reused across
  // every candidate ordering, rather than re-querying per permutation.
  async function computeCombinedRoute() {
    const selected = contracts.filter((c) => combineSelection.has(c.id));
    const stopsInput = selected
      .map((c) => ({ contract: c, suggested: getSuggestedScanState(c.id).scan }))
      .filter((s): s is { contract: BountyContract; suggested: { galx: number; galy: number; systemName?: string | null } } => s.suggested != null);

    if (stopsInput.length < 2) {
      setCombineError("Pick at least 2 contracts that already have a suggested next scan (expand Tracking on each first).");
      return;
    }

    const hyperspeed = resolveShipHyperspeed(selectedShip);
    if (hyperspeed == null) {
      setCombineError("Set your ship (in any contract's Tracking panel) before combining routes.");
      return;
    }

    setCombineError(null);
    setCombiningLoading(true);
    try {
      // Origin: the player's live location if available, otherwise whichever
      // selected contract's last scan is most recent — mirrors the single-contract
      // suggestion's own "where the player actually is" logic.
      const allLastScans = selected
        .flatMap((c) => c.scans)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      const origin = hasPlayerLocation
        ? { galx: myGalx as number, galy: myGaly as number }
        : allLastScans.length > 0
          ? { galx: allLastScans[0].scan_galx, galy: allLastScans[0].scan_galy }
          : null;
      if (!origin) {
        setCombineError("No starting location available — enable Location access or log at least one scan first.");
        return;
      }

      const points = [{ key: "origin", galx: origin.galx, galy: origin.galy }, ...stopsInput.map((s) => ({ key: String(s.contract.id), galx: s.suggested.galx, galy: s.suggested.galy }))];

      // Every unordered pair's travel time, fetched once and reused for every
      // candidate ordering below.
      const legTimes = new Map<string, { seconds: number; formatted: string }>();
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          let seconds = Infinity;
          let formatted = "Unknown";
          try {
            const res = await getHyperPlannerRoute(`${a.galx},${a.galy}`, `${b.galx},${b.galy}`, { pilotingSkill, hyperspeed });
            if (res.ok) {
              seconds = res.data.summary.total_seconds;
              formatted = res.data.summary.formatted_time;
            }
          } catch (err: unknown) {
            if (err instanceof Error && err.message.includes("beat direct travel")) {
              seconds = calculateDirectTravelSeconds(a.galx, a.galy, b.galx, b.galy, pilotingSkill, hyperspeed);
              formatted = formatDirectTravelSeconds(seconds);
            }
          }
          legTimes.set(`${a.key}|${b.key}`, { seconds, formatted });
          legTimes.set(`${b.key}|${a.key}`, { seconds, formatted });
        }
      }

      // Brute-force every visiting order of the (non-origin) stops — fine for the
      // realistic stop counts this feature is meant for.
      function permutations<T>(items: T[]): T[][] {
        if (items.length <= 1) return [items];
        const result: T[][] = [];
        for (let i = 0; i < items.length; i++) {
          const rest = [...items.slice(0, i), ...items.slice(i + 1)];
          for (const perm of permutations(rest)) result.push([items[i], ...perm]);
        }
        return result;
      }

      let best: { order: typeof stopsInput; totalSeconds: number } | null = null;
      for (const order of permutations(stopsInput)) {
        let totalSeconds = 0;
        let from = "origin";
        for (const stop of order) {
          const leg = legTimes.get(`${from}|${stop.contract.id}`);
          totalSeconds += leg?.seconds ?? Infinity;
          from = String(stop.contract.id);
        }
        if (!best || totalSeconds < best.totalSeconds) best = { order, totalSeconds };
      }

      if (!best) {
        setCombineError("Couldn't find a viable route between the selected contracts.");
        return;
      }

      let from = "origin";
      const stops = best.order.map((stop) => {
        const leg = legTimes.get(`${from}|${stop.contract.id}`) ?? { seconds: Infinity, formatted: "Unknown" };
        from = String(stop.contract.id);
        return {
          contractId: stop.contract.id,
          targetName: stop.contract.target_name,
          galx: stop.suggested.galx,
          galy: stop.suggested.galy,
          systemName: stop.suggested.systemName,
          legSeconds: leg.seconds,
          legFormatted: leg.formatted,
        };
      });
      setCombinedRoute({
        stops,
        totalSeconds: best.totalSeconds,
        totalFormatted: formatDirectTravelSeconds(best.totalSeconds),
      });
    } finally {
      setCombiningLoading(false);
    }
  }

  const activeContracts = contracts.filter((c) => c.status === "active");
  const closedContracts = contracts.filter((c) => c.status !== "active");

  return (
    <div className="flex flex-col gap-6 font-tektur">
      <div>
        <ReportBugButton toolKey="bounty_hunting" toolLabel="Bounty Hunting Helper" />
      </div>

      {/* --- Add contract --- */}
      <article className="panel flex flex-col gap-4">
        <h3 className="m-0">Log a New Contract</h3>
        <form onSubmit={handleAddContract} className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-[0.35rem] min-w-[200px] flex-1">
            <span className="small">Target Name</span>
            <input className={INPUT} value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="e.g. Rogue Slicer" />
          </label>
          <label className="flex flex-col gap-[0.35rem] min-w-[170px]">
            <span className="small">Difficulty</span>
            <select className={SELECT_INPUT} value={newDifficulty} onChange={(e) => setNewDifficulty(Number(e.target.value))}>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-[0.35rem] min-w-[140px]">
            <span className="small">Type</span>
            <select className={SELECT_INPUT} value={newType} onChange={(e) => setNewType(e.target.value as BountyContractType)}>
              <option value="kill">Kill</option>
              <option value="rescue">Rescue</option>
            </select>
          </label>
          <label className="flex flex-col gap-[0.35rem] min-w-[200px]">
            <span className="small">Deadline (CGT Yr / Day){cgtNowLabel ? ` — now ${cgtNowLabel}` : ""}</span>
            <div className="flex gap-2">
              <input
                className={INPUT}
                type="number"
                min={0}
                placeholder="Yr"
                value={deadlineYear}
                onChange={(e) => setDeadlineYear(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <input
                className={INPUT}
                type="number"
                min={0}
                max={364}
                placeholder="Day"
                value={deadlineDay}
                onChange={(e) => setDeadlineDay(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </label>
          <label className="flex flex-col gap-[0.35rem] min-w-[220px] flex-1">
            <span className="small">Notes</span>
            <input className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </label>
          <button className={BTN} type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add Contract"}</button>
        </form>
        {formError && <p className="small" style={{ color: "#f87171" }}>{formError}</p>}
      </article>

      {/* --- Contracts list --- */}
      {error && <p className={EMPTY_CLS} style={{ color: "#f87171" }}>{error}</p>}
      {loading && <p className={EMPTY_CLS}>Loading contracts…</p>}

      {!loading && !error && contracts.length === 0 && (
        <p className={EMPTY_CLS}>No tracked contracts yet — log one above when you pick up a puck.</p>
      )}

      {!loading && activeContracts.filter((c) => expandedIds.has(c.id)).length >= 2 && (
        <article className="panel flex flex-col gap-3">
          <div>
            <h3 className="m-0">Combine Tracking</h3>
            <p className="small muted">
              Optional — pick 2+ contracts you're already tracking and find the travel-optimal order to visit each
              one's suggested next scan, instead of planning each trip separately.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {activeContracts.filter((c) => expandedIds.has(c.id)).map((contract) => {
              const suggested = getSuggestedScanState(contract.id).scan;
              return (
                <label key={contract.id} className="flex items-center gap-[0.4rem] text-[0.85rem]">
                  <input
                    type="checkbox"
                    checked={combineSelection.has(contract.id)}
                    disabled={!suggested}
                    onChange={() => toggleCombineSelection(contract.id)}
                  />
                  <span className={suggested ? "" : "text-white/30"}>
                    {contract.target_name}{!suggested && " (no suggestion yet)"}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <button className={BTN_GHOST} type="button" onClick={computeCombinedRoute} disabled={combiningLoading || combineSelection.size < 2}>
              {combiningLoading ? "Finding best route…" : "Find Combined Route"}
            </button>
            {combineError && <p className="small" style={{ color: "#f87171", margin: 0 }}>{combineError}</p>}
          </div>
          {combinedRoute && (
            <div className="flex flex-col gap-1">
              <p className="small" style={{ margin: 0, color: "var(--accent)" }}>
                Combined route — total {combinedRoute.totalFormatted}
              </p>
              {combinedRoute.stops.map((stop, i) => (
                <p key={stop.contractId} className="small" style={{ margin: 0 }}>
                  {i + 1}. <strong>{stop.targetName}</strong>{" "}
                  {stop.systemName && <span style={{ color: "var(--jen-orange)" }}>({stop.systemName}) </span>}
                  ({stop.galx}, {stop.galy})
                  <span className="text-white/40"> · {stop.legFormatted} from previous stop</span>
                </p>
              ))}
            </div>
          )}
        </article>
      )}

      {!loading && activeContracts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="m-0">Active Contracts</h3>
          {activeContracts.map((contract) => {
            const deadline = formatDeadline(contract.deadline_at);
            const isExpanded = expandedIds.has(contract.id);
            return (
              <article key={contract.id} className="panel flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-[0.2rem]">
                    <p className="m-0 text-[0.95rem] font-semibold">{contract.target_name}</p>
                    <p className="small muted" style={{ margin: 0 }}>
                      <span style={{ color: DIFFICULTY_COLORS[contract.difficulty] }}>{DIFFICULTY_LABELS[contract.difficulty]}</span> ·{" "}
                      <span style={{ color: CONTRACT_TYPE_COLORS[contract.contract_type] }}>{contract.contract_type === "rescue" ? "Rescue" : "Kill"}</span> ·{" "}
                      <span style={{ color: deadline.expired ? "#f87171" : undefined }}>{deadline.label}</span>
                    </p>
                    {contract.notes && <p className="small" style={{ margin: 0, opacity: 0.75 }}>{contract.notes}</p>}
                    {contract.scans.length > 0 && (
                      <p className="small muted" style={{ margin: 0 }}>
                        {contract.scans.length} scan{contract.scans.length === 1 ? "" : "s"} logged
                        {contract.estimated_galx != null && contract.estimated_galy != null ? " — see Tracking for possible locations" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-[0.4rem] flex-wrap">
                    <button className={BTN_GHOST_SM} type="button" onClick={() => handleExpand(contract)}>
                      {isExpanded ? "Hide Tracking" : "Track"}
                    </button>
                    <button className={BTN_GHOST_SM} type="button" onClick={() => handleSetStatus(contract, "completed")}>Mark Completed</button>
                    <button className={BTN_GHOST_SM} type="button" onClick={() => handleSetStatus(contract, "failed")}>Mark Failed</button>
                    <button className={BTN_GHOST_SM} type="button" onClick={() => handleDeleteContract(contract)}>Delete</button>
                  </div>
                </div>

                {isExpanded && (() => {
                  const contractWorlds = trackingWorlds[contract.id] ?? [];
                  const contractSystems = trackingSystems[contract.id] ?? [];
                  const { clusters, resolvedClusters, possibleLocationEntries, isConfident } = computePossibleLocations(contract, contractWorlds, contractSystems);
                  const wedgeWorlds = contract.scans.length === 1 ? worldsInScanWedge(contract.scans[0], contractWorlds) : [];
                  const mapCandidateWorlds = (contract.scans.length === 1 ? wedgeWorlds : resolvedClusters.flatMap((c) => c.worlds))
                    .map((world) => ({ ...world, isConfirmed: isConfident && possibleLocationEntries[0]?.world?.id === world.id }));
                  const suggested = getSuggestedScanState(contract.id);
                  const scanForm = getScanForm(contract.id);
                  const shipSettingsShown = shipSettingsOpen[contract.id] ?? false;

                  return (
                  <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
                    {(clusters.length > 0 || contract.scans.length === 1) && (
                      <div className="flex flex-col gap-2">
                        <BountyTriangulationMap
                          scans={contract.scans}
                          clusters={resolvedClusters.map((c) => ({
                            galx: c.galx,
                            galy: c.galy,
                            supportCount: c.supportCount,
                            polygon: c.polygon,
                            hasResolvedWorlds: c.worlds.length > 0,
                          }))}
                          candidateWorlds={mapCandidateWorlds}
                          suggestedScan={canSeeSuggestedScan ? suggested.scan : null}
                        />
                        {!canSeeSuggestedScan ? (
                          <p className="small muted" style={{ margin: 0 }}>
                            Suggested next scan is available to Public Toolkit subscribers and JOE members.{" "}
                            <a href="/tools/store" style={{ color: "var(--accent)" }}>Subscribe</a> to unlock it.
                          </p>
                        ) : (
                          <>
                            {suggested.loading && (
                              <p className="small muted" style={{ margin: 0 }}>Checking travel time to the best nearby scan spots…</p>
                            )}
                            {!suggested.loading && suggested.scan && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="small" style={{ margin: 0 }}>
                                  <span style={{ color: "#4ade80" }}>Suggested next scan:</span>{" "}
                                  {suggested.scan.systemName && <strong style={{ color: "var(--jen-orange)" }}>{suggested.scan.systemName} </strong>}
                                  ({suggested.scan.galx}, {suggested.scan.galy})
                                  {suggested.travelTime && <span className="text-white/40"> · {suggested.travelTime} away</span>}
                                </p>
                                {onPlanRoute && lastScanCoords(contract) && (
                                  <button
                                    className={BTN_GHOST_SM}
                                    type="button"
                                    onClick={() => onPlanRoute(lastScanCoords(contract) as string, `${suggested.scan!.galx},${suggested.scan!.galy}`, selectedShip?.uid ?? null, pilotingSkill)}
                                  >
                                    Plan Route
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="small muted" style={{ margin: 0 }}>
                                  {selectedShip
                                    ? <>Travel speed: <span style={{ color: "var(--accent)" }}>{formatShipDisplay(selectedShip)}</span> · Piloting {pilotingSkill}</>
                                    : <span style={{ color: "#f87171" }}>No ship set — travel time for the suggested scan can't be estimated.</span>}
                                </p>
                                <button className={BTN_GHOST_SM} type="button" onClick={() => setShipSettingsOpen((current) => ({ ...current, [contract.id]: !shipSettingsShown }))}>
                                  {shipSettingsShown ? "Done" : selectedShip ? "Change" : "Set Ship"}
                                </button>
                              </div>
                              {(shipSettingsShown || suggested.needsShip) && (
                                <div className="flex flex-wrap gap-3 items-end">
                                  <label className="flex flex-col gap-[0.35rem] min-w-[220px] flex-1">
                                    <span className="small">Ship</span>
                                    <input
                                      className={INPUT}
                                      value={shipQuery}
                                      onChange={(e) => { setShipQuery(e.target.value); setSelectedShip(null); }}
                                      placeholder="Search a stored ship type"
                                    />
                                    {shipSuggestions.length > 0 && (
                                      <div className="flex flex-col gap-1">
                                        {shipSuggestions.map((ship) => (
                                          <button
                                            key={ship.uid}
                                            type="button"
                                            className={BTN_GHOST_SM}
                                            onClick={() => { handleSelectShip(ship); setShipSettingsOpen((current) => ({ ...current, [contract.id]: false })); refreshSuggestedScan(contract, contractWorlds, ship, pilotingSkill); }}
                                          >
                                            {formatShipDisplay(ship)}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </label>
                                  <label className="flex flex-col gap-[0.35rem] min-w-[140px]">
                                    <span className="small">Piloting Skill</span>
                                    <select
                                      className={SELECT_INPUT}
                                      value={pilotingSkill}
                                      onChange={(e) => { const skill = Number(e.target.value); handleSetPilotingSkill(skill); refreshSuggestedScan(contract, contractWorlds, selectedShip, skill); }}
                                    >
                                      {[0, 1, 2, 3, 4, 5].map((value) => (
                                        <option key={value} value={value}>{value}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {clusters.length > 0 && (
                          <>
                            <p className="small" style={{ margin: 0, color: isConfident ? "#4ade80" : "var(--accent)" }}>
                              {isConfident ? "Confirmed location:" : `Possible locations: ${possibleLocationEntries.length}`}
                            </p>
                            <div className="flex flex-col gap-1">
                              {possibleLocationEntries.map(({ cluster, world }, i) => {
                                const target = world ?? cluster;
                                return (
                                  <div key={i} className="flex items-center gap-2 flex-wrap">
                                    <p className="small" style={{ margin: 0 }}>
                                      {isConfident && <span style={{ color: "#4ade80" }}>✓ </span>}
                                      {world ? (
                                        <>
                                          <strong>{world.name}</strong> ({world.galx}, {world.galy})
                                        </>
                                      ) : cluster.systemName ? (
                                        <>
                                          <strong>{cluster.systemName}</strong> ({cluster.galx}, {cluster.galy})
                                        </>
                                      ) : (
                                        <>({cluster.galx}, {cluster.galy})</>
                                      )}
                                    </p>
                                    {onPlanRoute && lastScanCoords(contract) && (
                                      <button
                                        className={BTN_GHOST_SM}
                                        type="button"
                                        onClick={() => onPlanRoute(lastScanCoords(contract) as string, `${target.galx},${target.galy}`, selectedShip?.uid ?? null, pilotingSkill)}
                                      >
                                        Plan Route
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {contract.scans.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {contract.scans.map((scan) => {
                          const scanSystem = systemAtCoords(scan.scan_galx, scan.scan_galy, contractSystems);
                          return (
                          <div key={scan.id} className="flex items-center gap-3 text-[0.82rem]">
                            <span className="text-white/75 flex-1">
                              From {scanSystem && <strong style={{ color: "var(--jen-orange)" }}>{scanSystem.name} </strong>}
                              ({scan.scan_galx}, {scan.scan_galy}) — bearing <span style={{ color: "var(--jen-orange)" }}>{formatBearing(scan.bearing_degrees)}</span>
                              {scan.range_band ? ` · ${RANGE_BAND_LABELS[scan.range_band]}` : ""}
                              {scanForm.editingScanId === scan.id ? <span style={{ color: "#f5d546" }}> · editing</span> : ""}
                            </span>
                            <button className={BTN_GHOST_SM} type="button" onClick={() => handleStartEditScan(contract.id, scan)}>Edit</button>
                            <button className={BTN_GHOST_SM} type="button" onClick={() => handleDeleteScan(contract, scan.id)}>Remove</button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                    {contract.scans.length === 1 && (
                      <div className="flex flex-col gap-2">
                        <p className="small muted" style={{ margin: 0 }}>
                          Log a second scan from a different position to triangulate a location. For now, here's every
                          candidate world along that bearing: {wedgeWorlds.length}
                        </p>
                        {wedgeWorlds.length > 0 && (
                          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                            {wedgeWorlds.map((world) => (
                              <div key={world.id} className="flex items-center gap-3 text-[0.82rem]">
                                <span className="text-white/75 flex-1">
                                  <strong>{world.name}</strong> <span style={{ color: OWNER_COLORS[world.owner_name] ?? undefined }}>({world.owner_name})</span> — ({world.galx}, {world.galy}) · {world.distance} units away
                                </span>
                                <span className="text-white/40 shrink-0">{world.valid_cell_count}/{world.total_cell_count} cells huntable</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <form onSubmit={(e) => handleAddScan(contract, e)} className="flex flex-wrap gap-3 items-end">
                      <label className="flex flex-col gap-[0.35rem] min-w-[140px]">
                        <span className="small">Bearing</span>
                        <select className={SELECT_INPUT} value={scanForm.bearing} onChange={(e) => updateScanForm(contract.id, { bearing: Number(e.target.value) })}>
                          {COMPASS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-[0.35rem] min-w-[220px]">
                        <span className="small">Range Band</span>
                        <select className={SELECT_INPUT} value={scanForm.rangeBand} onChange={(e) => updateScanForm(contract.id, { rangeBand: e.target.value as BountyRangeBand })}>
                          {RANGE_BAND_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-[0.35rem] min-w-[110px]">
                        <span className="small">Scan X</span>
                        <input className={INPUT} type="number" value={scanForm.galx} onChange={(e) => updateScanForm(contract.id, { galx: e.target.value === "" ? "" : Number(e.target.value) })} />
                      </label>
                      <label className="flex flex-col gap-[0.35rem] min-w-[110px]">
                        <span className="small">Scan Y</span>
                        <input className={INPUT} type="number" value={scanForm.galy} onChange={(e) => updateScanForm(contract.id, { galy: e.target.value === "" ? "" : Number(e.target.value) })} />
                      </label>
                      {hasPlayerLocation && (
                        <button className={BTN_SM} type="button" onClick={() => handleUseMyLocationForScan(contract.id)}>Use My Location</button>
                      )}
                      <button className={BTN_GHOST} type="submit" disabled={scanForm.submitting}>
                        {scanForm.submitting ? "Saving…" : scanForm.editingScanId != null ? "Save Changes" : "Log Scan"}
                      </button>
                      {scanForm.editingScanId != null && (
                        <button className={BTN_GHOST_SM} type="button" onClick={() => resetScanForm(contract.id)}>Cancel</button>
                      )}
                    </form>
                    {scanForm.error && <p className="small" style={{ color: "#f87171" }}>{scanForm.error}</p>}
                  </div>
                  );
                })()}
              </article>
            );
          })}
        </div>
      )}

      {!loading && closedContracts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="m-0">Completed / Failed</h3>
          {closedContracts.map((contract) => (
            <div key={contract.id} className="flex items-center justify-between gap-3 text-[0.85rem] opacity-70">
              <span>
                {contract.target_name} — {DIFFICULTY_LABELS[contract.difficulty]} ·{" "}
                {contract.status === "completed" ? "Completed" : contract.status === "failed" ? "Failed" : contract.status}
              </span>
              <button className={BTN_GHOST_SM} type="button" onClick={() => handleDeleteContract(contract)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BountyHuntingPanel;
