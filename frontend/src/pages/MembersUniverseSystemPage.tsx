import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange } from "../api/core/auth";
import { canAccessDroidBrainFull, canAccessMembers, canAccessPublicTools } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import { getStoredSystem, getStoredShipTypes, type StoredSystemDetail, type StoredShipTypeSummary, type SnapshotShip } from "../api/universe/universe";
import ShipSnapshotSelector from "../components/universe/ShipSnapshotSelector";
import NotLoggedInState from "../components/common/NotLoggedInState";
import UniverseDetailHero from "../components/common/UniverseDetailHero";
import UniverseDetailImmersive from "../components/common/UniverseDetailImmersive";
import useUniverseViewport from "../components/common/useUniverseViewport";
import ShipIconBomber from "../assets/map/ships/Bomber.png";
import ShipIconCapital from "../assets/map/ships/Capital.png";
import ShipIconCargo from "../assets/map/ships/Cargo.png";
import ShipIconFighter from "../assets/map/ships/Fighter.png";
import ShipIconFrigate from "../assets/map/ships/Frigate.png";
import ShipIconGunboat from "../assets/map/ships/Gunboat.png";
import ShipIconHFreighter from "../assets/map/ships/HFreighter.png";
import ShipIconLFreighter from "../assets/map/ships/LFreighter.png";
import ShipIconSat from "../assets/map/ships/Sat.png";
import ShipIconSuper from "../assets/map/ships/Super.png";
import ShipIconVette from "../assets/map/ships/Vette.png";
import ShipIconWreck from "../assets/map/ships/Wreck.png";
import { BTN, SELECT_INPUT } from "../utils/ui";

const layerToggleCls = (active: boolean) =>
  "inline-flex min-h-10 items-center justify-center rounded-[12px] border px-[0.95rem] py-[0.65rem] font-bold leading-none no-underline transition-[border-color,background,transform,box-shadow] duration-150 ease-out cursor-pointer" +
  (active
    ? " border-[rgba(246,163,0,0.6)] bg-[rgba(246,163,0,0.12)] text-white/[0.96]"
    : " border-white/[0.14] bg-transparent text-white/[0.72] hover:border-white/[0.24] hover:bg-white/[0.04]");
const gridCellCls = (hasContent: boolean, isActive: boolean) =>
  "relative flex items-center justify-center w-[78px] h-[78px] min-w-[78px] min-h-[78px] p-0 rounded-none border border-solid border-white/[0.08] bg-transparent text-left pointer-events-auto overflow-hidden transition-[border-color,background,box-shadow] duration-[140ms] ease hover:border-white/[0.16] hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" +
  (hasContent ? " has-content" : "") +
  (isActive ? " !border-[rgba(246,163,0,0.68)] !bg-[rgba(246,163,0,0.08)] !shadow-[inset_0_0_0_1px_rgba(246,163,0,0.2)]" : "");
const GRID_CELL_BODY_CLS = "relative flex items-center justify-center w-full h-full z-[1]";
const GRID_CELL_THUMB_CLS = "w-[90%] h-[90%] max-w-[70px] max-h-[70px] rounded-full object-cover opacity-[0.96]";
const GRID_CELL_STATION_CLS = "absolute right-[6px] top-[6px] w-[34px] h-[34px] rounded-[4px] object-cover opacity-[0.72] z-[2]";
const GRID_CELL_DOT_CLS = "absolute right-[10px] top-[10px] w-[16px] h-[16px] rounded-full bg-[rgba(246,163,0,0.72)] z-[2]";
const GRID_CELL_SHIP_CLS = "absolute left-0 bottom-0 w-[39px] h-[39px] object-contain object-left-bottom opacity-100 z-[3] drop-shadow-[0_0_4px_rgba(0,0,0,0.65)] pointer-events-none";
const GRID_CELL_SHIP_OVER_PLANET_CLS = "absolute left-0 bottom-0 w-[52px] h-[52px] object-contain object-left-bottom opacity-100 z-[3] drop-shadow-[0_0_6px_rgba(0,0,0,0.8)] pointer-events-none";
const GRID_HOVER_CLS = "absolute z-[3] grid gap-[0.18rem] min-w-[120px] max-w-[200px] p-[0.55rem_0.75rem] rounded-[12px] border border-[rgba(246,163,0,0.45)] bg-[rgba(14,14,14,0.96)] shadow-[0_14px_32px_rgba(0,0,0,0.34)] pointer-events-none [&_strong]:text-[0.8rem] [&_strong]:text-white/[0.96]";
const GRID_HOVER_GROUP_CLS = "grid gap-[0.15rem]";
const GRID_HOVER_LABEL_CLS = "text-[rgba(246,163,0,0.98)] font-bold tracking-[0]";
const SELECTION_HEAD_CLS = "grid gap-[0.2rem] [&_strong]:text-[1.15rem] [&_strong]:text-white/[0.96]";
const SELECTION_LABEL_CLS = "text-[rgba(246,163,0,0.95)] text-[0.74rem] font-bold tracking-[0.06em] uppercase";
const CELL_GROUP_CLS = "grid gap-2";
const CELL_CHIP_GRID_CLS = "grid [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-[0.6rem]";
const CELL_CHIP_CLS = "grid [grid-template-columns:auto_1fr] gap-[0.7rem] items-center p-3 rounded-[10px] border border-white/[0.08] bg-white/[0.04] [&_strong]:block [&_strong]:mb-[0.2rem]";
const SHIP_ICON_CLS = "w-[28px] h-[28px] object-contain opacity-[0.9]";

const SYSTEM_GRID_SIZE = 20;
const SYSTEM_CELL_SIZE = 78;
const SYSTEM_CANVAS_PADDING = 16;
const SYSTEM_VIEW_PADDING = 24;
const SYSTEM_MIN_ZOOM = 0.2;
const SYSTEM_MAX_ZOOM = 1.5;
const SYSTEM_ZOOM_STEP = 0.05;
const SYSTEM_TOOLTIP_WIDTH_ESTIMATE = 180;
const SYSTEM_TOOLTIP_HEIGHT_ESTIMATE = 112;
const SYSTEM_TOOLTIP_MARGIN = 12;

type UniverseSystemLocationState = {
  fromUniverseMap?: boolean;
  sectorUid?: string | null;
  galx?: number | null;
  galy?: number | null;
};

type ApiSystemStation = StoredSystemDetail["stations"][number];
type DroidBrainSystemStation = StoredSystemDetail["droidbrain_stations"][number];
type SystemMapStation = ApiSystemStation | DroidBrainSystemStation;

function formatSwcDisplayId(value: string | null | undefined, fallback = "Unknown") {
  if (!value) {
    return fallback;
  }

  const [prefix, rest] = value.split(":", 2);
  if (rest && /^\d+$/.test(prefix)) {
    return rest;
  }

  return value;
}

function formatValue(value: string | number | null | undefined, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function formatCoords(x: number | null | undefined, y: number | null | undefined) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return "Unknown";
  }

  return `${x}, ${y}`;
}

function bestPlanetImage(planet: StoredSystemDetail["planets"][number]): string | null {
  return (
    planet.image_small_url ??
    planet.image_large_url ??
    planet.image_atmosphere_url ??
    planet.image_stratosphere_url ??
    planet.image_loworbit_url ??
    null
  );
}

function isApiSystemStation(station: SystemMapStation): station is ApiSystemStation {
  return "station_type" in station;
}

function stationTypeName(station: SystemMapStation): string {
  if (isApiSystemStation(station)) {
    return station.station_type?.name ?? station.type_name ?? "Unknown type";
  }

  return station.type_name ?? "Unknown type";
}

function bestStationImage(station: SystemMapStation): string | null {
  if (isApiSystemStation(station)) {
    return (
      station.station_type?.icon_url ??
      station.station_type?.images?.small ??
      station.station_type?.image_url ??
      null
    );
  }

  return station.icon_url ?? station.image_url ?? null;
}

function firstStationAtCell(stations: SystemMapStation[]) {
  return stations[0] ?? null;
}

const CLASS_PRIORITY: Record<string, number> = {
  supercapitals: 0, super: 0,
  capitalships: 1, capital: 1,
  frigates: 2, frigate: 2,
  corvettes: 3, vette: 3,
  gunboats: 4, gunboat: 4,
  bombers: 5, bomber: 5,
  fighters: 6, fighter: 6,
  heavyfreighters: 7, hfreighter: 7,
  lightfreighters: 8, lfreighter: 8,
  cargocontainers: 9, cargo: 9,
  satellites: 10, sat: 10,
  wreck: 11,
};

function normalizeClass(className: string | null): string {
  return String(className ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function shipClassPriority(ship: { class_name: string | null }): number {
  const key = normalizeClass(ship.class_name);
  return CLASS_PRIORITY[key] ?? 99;
}

function biggestShip<T extends { class_name: string | null }>(ships: T[]): T {
  return ships.reduce((best, s) => shipClassPriority(s) < shipClassPriority(best) ? s : best, ships[0]);
}

function resolveShipMapIcon(ship: StoredSystemDetail["ships"][number]): string {
  const normalizedClass = String(ship.class_name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const classIconMap: Record<string, string> = {
    bomber: ShipIconBomber,
    bombers: ShipIconBomber,
    capital: ShipIconCapital,
    capitals: ShipIconCapital,
    capitalships: ShipIconCapital,
    cargo: ShipIconCargo,
    cargocontainers: ShipIconCargo,
    fighter: ShipIconFighter,
    fighters: ShipIconFighter,
    frigate: ShipIconFrigate,
    frigates: ShipIconFrigate,
    gunboat: ShipIconGunboat,
    gunboats: ShipIconGunboat,
    hfreighter: ShipIconHFreighter,
    heavyfreighters: ShipIconHFreighter,
    lfreighter: ShipIconLFreighter,
    lightfreighters: ShipIconLFreighter,
    sat: ShipIconSat,
    satellites: ShipIconSat,
    super: ShipIconSuper,
    supercapitals: ShipIconSuper,
    vette: ShipIconVette,
    corvettes: ShipIconVette,
    wreck: ShipIconWreck,
  };

  if (normalizedClass && classIconMap[normalizedClass]) {
    return classIconMap[normalizedClass];
  }

  const text = `${ship.class_name ?? ""} ${ship.type_name ?? ""} ${ship.name ?? ""}`.toLowerCase();

  if (text.includes("wreck")) return ShipIconWreck;
  if (text.includes("sat")) return ShipIconSat;
  if (text.includes("super")) return ShipIconSuper;
  if (
    text.includes("capital") ||
    text.includes("dreadnaught") ||
    text.includes("destroyer") ||
    text.includes("battlecruiser") ||
    text.includes("carrier")
  ) return ShipIconCapital;
  if (text.includes("frigate")) return ShipIconFrigate;
  if (text.includes("corvette") || text.includes("vette")) return ShipIconVette;
  if (text.includes("gunboat")) return ShipIconGunboat;
  if (text.includes("bomber")) return ShipIconBomber;
  if (text.includes("fighter") || text.includes("interceptor") || text.includes("starfighter")) return ShipIconFighter;
  if (text.includes("heavy freighter")) return ShipIconHFreighter;
  if (text.includes("light freighter")) return ShipIconLFreighter;
  if (text.includes("cargo") || text.includes("transport") || text.includes("freighter")) return ShipIconCargo;

  return ShipIconCargo;
}

const MembersUniverseSystemPage: React.FC = () => {
  const { systemIdentifier } = useParams<{ systemIdentifier: string }>();
  const location = useLocation();
  const routeState = (location.state ?? null) as UniverseSystemLocationState | null;
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [canSeeMembers, setCanSeeMembers] = useState(false);
  const [canSeeDroidBrainShips, setCanSeeDroidBrainShips] = useState(false);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<StoredSystemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDroidBrainShips, setShowDroidBrainShips] = useState(false);
  const [shipTypes, setShipTypes] = useState<StoredShipTypeSummary[]>([]);
  const [expandedShips, setExpandedShips] = useState<Set<string>>(new Set());
  const [iffFilter, setIffFilter] = useState<"all" | "Friend" | "Enemy" | "Neutral" | "other">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [snapshotShips, setSnapshotShips] = useState<SnapshotShip[] | null>(null);
  const [snapshotTime, setSnapshotTime] = useState<number | null>(null);

  useEffect(() => {
    setSelectedSystemCell(null);
    setClassFilter("all");
  }, [snapshotTime]);
  const [selectedSystemCell, setSelectedSystemCell] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSystemCell, setHoveredSystemCell] = useState<{
    x: number;
    y: number;
    left: number;
    top: number;
    transform: string;
    planets: StoredSystemDetail["planets"];
    stations: SystemMapStation[];
    ships: StoredSystemDetail["ships"];
  } | null>(null);
  const systemFitKey = detail?.system.uid ?? detail?.system.identifier ?? null;
  const {
    viewportRef: systemViewportRef,
    viewportEl: systemViewportEl,
    zoom: systemZoom,
    offset: systemOffset,
    isDragging: isDraggingSystem,
    resetViewport: resetSystemViewport,
    handleMouseDown: handleSystemMouseDown,
    handleMouseMove: handleSystemMouseMove,
    handleMouseUp: handleSystemMouseUp,
    handleMouseLeave: handleSystemMouseLeave,
  } = useUniverseViewport({
    fitKey: systemFitKey,
    worldWidth: SYSTEM_GRID_SIZE * SYSTEM_CELL_SIZE + SYSTEM_CANVAS_PADDING * 2,
    worldHeight: SYSTEM_GRID_SIZE * SYSTEM_CELL_SIZE + SYSTEM_CANVAS_PADDING * 2,
    minZoom: SYSTEM_MIN_ZOOM,
    maxZoom: SYSTEM_MAX_ZOOM,
    zoomStep: SYSTEM_ZOOM_STEP,
    viewPadding: SYSTEM_VIEW_PADDING,
    onViewportReset: () => {
      setSelectedSystemCell(null);
      setHoveredSystemCell(null);
    },
  });

  useEffect(() => {
    return subscribeToAuthStateChange(() => {
      setAuthRefreshNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const auth = await fetchAuthMe();
        if (cancelled) return;
        setIsLoggedIn(!!auth?.user);
        setCanSeeMembers(canAccessMembers(auth?.user ?? null) || canAccessPublicTools(auth?.user ?? null));
        setCanSeeDroidBrainShips(canAccessDroidBrainFull(auth?.user ?? null));
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
          setCanSeeMembers(false);
          setCanSeeDroidBrainShips(false);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authRefreshNonce]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    if (!isLoggedIn || !canSeeMembers || !systemIdentifier) {
      setLoading(false);
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await getStoredSystem(systemIdentifier);
        if (cancelled) return;
        setDetail(response.data ?? null);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setDetail(null);
          setError(e?.message ?? "Failed to load stored system.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authChecked, canSeeMembers, isLoggedIn, systemIdentifier]);

  useEffect(() => {
    if (!canSeeDroidBrainShips || !(detail?.ships.length ?? 0)) {
      setShowDroidBrainShips(false);
    }
  }, [canSeeDroidBrainShips, detail?.ships.length]);

  useEffect(() => {
    if (!canSeeDroidBrainShips) return;
    void getStoredShipTypes().then((res) => setShipTypes(res.data ?? []));
  }, [canSeeDroidBrainShips]);

  const shipTypeLookup = useMemo(() => {
    const map = new Map<string, StoredShipTypeSummary>();
    shipTypes.forEach((s) => { if (s.name) map.set(s.name.toLowerCase(), s); });
    return map;
  }, [shipTypes]);

  const mapCells = useMemo(() => {
    const planets = detail?.planets.filter(
      (planet) => planet.sysx != null && planet.sysy != null
    ) ?? [];
    const apiStations = detail?.stations.filter(
      (station) => station.sysx != null && station.sysy != null
    ) ?? [];
    const droidbrainStations = (detail?.droidbrain_stations ?? []).filter(
      (station) => station.sysx != null && station.sysy != null
    );
    const stationKey = (station: SystemMapStation): string =>
      `${Number(station.sysx)}:${Number(station.sysy)}:${station.uid ?? ""}:${String(station.name ?? "").trim().toLowerCase()}:${String(station.type_name ?? "").trim().toLowerCase()}`;
    const stations = [...apiStations, ...droidbrainStations].filter((station, index, array) => {
      const key = stationKey(station);
      return array.findIndex((entry) => stationKey(entry) === key) === index;
    });
    const ships = (snapshotShips ?? detail?.ships ?? []).filter(
      (ship) => ship.sysx != null && ship.sysy != null
    );

    return Array.from({ length: 20 }, (_, rowIndex) =>
      Array.from({ length: 20 }, (_, colIndex) => {
        const x = colIndex;
        const y = rowIndex;

        return {
          x,
          y,
          planets: planets.filter(
            (planet) => Number(planet.sysx) === x && Number(planet.sysy) === y
          ),
          stations: stations.filter(
            (station) => Number(station.sysx) === x && Number(station.sysy) === y
          ),
          ships: ships.filter(
            (ship) => Number(ship.sysx) === x && Number(ship.sysy) === y
          ),
        };
      })
    );
  }, [detail, snapshotShips]);

  const selectedCellData = selectedSystemCell
    ? mapCells
        .flat()
        .find((cell) => cell.x === selectedSystemCell.x && cell.y === selectedSystemCell.y) ?? null
    : null;
  if (!routeState?.fromUniverseMap) {
    return <Navigate to="/tools" replace />;
  }

  if (!authChecked || loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board flex flex-col gap-4">
            <h1 className="h1">System Detail</h1>
            <p className="small">Loading stored system data…</p>
          </main>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board flex flex-col gap-4">
            <NotLoggedInState
              title="Not logged in"
              message="You need to sign in to access member tools."
            />
          </main>
        </div>
      </div>
    );
  }

  if (!canSeeMembers) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board flex flex-col gap-4">
            <ForbiddenState
              title="403 Forbidden"
              message="You do not have permission to access member tools."
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board flex flex-col gap-4">
          <UniverseDetailHero
            eyebrow="Astrogation System"
            title={
              detail?.system.name ??
              detail?.system.identifier ??
              formatSwcDisplayId(detail?.system.uid) ??
              "Unknown system"
            }
            meta={
              <>
                <span>Chart {formatCoords(detail?.system.galx ?? routeState.galx, detail?.system.galy ?? routeState.galy)}</span>
                <span>
                  Sector{" "}
                  {formatValue(
                    detail?.system.sector_name ??
                      formatSwcDisplayId(detail?.system.sector_uid ?? routeState?.sectorUid)
                  )}
                </span>
              </>
            }
          />

          {error ? (
            <p className="small" style={{ color: "salmon" }}>
              {error}
            </p>
          ) : null}

          <UniverseDetailImmersive
            title="In-System View"
            toolbar={
              <div className="flex justify-between gap-2 items-center flex-wrap">
                <div className="flex gap-2 items-center flex-wrap">
                  {canSeeDroidBrainShips && (detail?.ships.length ?? 0) > 0 ? (
                    <button
                      className={layerToggleCls(showDroidBrainShips)}
                      type="button"
                      onClick={() => setShowDroidBrainShips((value) => !value)}
                    >
                      DroidBrain Ships
                    </button>
                  ) : null}
                  {showDroidBrainShips && canSeeDroidBrainShips && detail?.system.galx != null && detail?.system.galy != null && (
                    <ShipSnapshotSelector
                      galx={detail.system.galx}
                      galy={detail.system.galy}
                      onSnapshot={(ships, ts) => { setSnapshotShips(ships); setSnapshotTime(ts); }}
                    />
                  )}
                  <span className="small">Zoom: {systemZoom.toFixed(2)}x</span>
                  <button className={BTN} type="button" onClick={resetSystemViewport}>
                    Reset View
                  </button>
                </div>
              </div>
            }
            copy="Scroll to zoom, drag to move, and click a coordinate cell to inspect the planets and stations placed there."
            viewport={
              <div
                ref={systemViewportRef}
                className={`relative overflow-hidden rounded-[10px] border border-white/10 bg-[radial-gradient(circle_at_50%_38%,rgba(20,26,38,0.52),transparent_42%),linear-gradient(180deg,rgba(4,6,10,0.98),rgba(9,11,16,0.98))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_28px_72px_rgba(0,0,0,0.32)] w-[min(100%,82vh,980px)] aspect-square mx-auto max-[860px]:w-full ${isDraggingSystem ? "cursor-grabbing" : "cursor-grab"}`}
                style={{ overscrollBehavior: "contain", touchAction: "none" }}
                onMouseDown={handleSystemMouseDown}
                onMouseMove={(event) => {
                  if (isDraggingSystem) {
                    handleSystemMouseMove(event);
                    setHoveredSystemCell(null);
                  }
                }}
                onMouseUp={handleSystemMouseUp}
                onMouseLeave={() => {
                  handleSystemMouseLeave();
                  setHoveredSystemCell(null);
                }}
              >
                <div className="sysuniverse-map-viewport__stars" />
                <div
                  className="grid gap-0 origin-top-left w-max p-4 select-none"
                  style={{
                    transform: `translate(${systemOffset.x}px, ${systemOffset.y}px) scale(${systemZoom})`,
                  }}
                >
                  {mapCells.map((row, rowIndex) => (
                    <div
                      key={`member-sys-row-${rowIndex}`}
                      className="grid gap-0"
                      style={{ gridTemplateColumns: `repeat(${row.length}, 78px)` }}
                    >
                      {row.map((cell) => {
                        const occupancy = cell.planets.length + cell.stations.length;
                        const isSelected =
                          selectedSystemCell?.x === cell.x && selectedSystemCell?.y === cell.y;
                        const station = firstStationAtCell(cell.stations);

                        return (
                          <button
                            key={`member-sys-cell-${cell.x}-${cell.y}`}
                            className={gridCellCls(occupancy > 0, isSelected)}
                            type="button"
                            onClick={() => setSelectedSystemCell((prev) => prev?.x === cell.x && prev?.y === cell.y ? null : { x: cell.x, y: cell.y })}
                            onMouseEnter={(event) => {
                              if (isDraggingSystem) return;
                              const rect = event.currentTarget.getBoundingClientRect();
                              const viewportRect =
                                systemViewportEl?.getBoundingClientRect() ?? rect;
                              const cellCenterX = rect.left - viewportRect.left + rect.width / 2;
                              const tooltipHalfWidth = SYSTEM_TOOLTIP_WIDTH_ESTIMATE / 2;
                              const maxLeft =
                                viewportRect.width - SYSTEM_TOOLTIP_MARGIN - tooltipHalfWidth;
                              const minLeft = SYSTEM_TOOLTIP_MARGIN + tooltipHalfWidth;
                              const clampedLeft = Math.min(maxLeft, Math.max(minLeft, cellCenterX));
                              const preferredTop = rect.top - viewportRect.top - 10;
                              const canRenderAbove =
                                preferredTop - SYSTEM_TOOLTIP_HEIGHT_ESTIMATE >= SYSTEM_TOOLTIP_MARGIN;
                              const tooltipTop = canRenderAbove
                                ? preferredTop
                                : rect.bottom - viewportRect.top + 10;
                              setHoveredSystemCell({
                                x: cell.x,
                                y: cell.y,
                                left: clampedLeft,
                                top: tooltipTop,
                                transform: canRenderAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                                planets: cell.planets,
                                stations: station ? [station] : [],
                                ships: showDroidBrainShips ? cell.ships : [],
                              });
                            }}
                            onMouseLeave={() => {
                              setHoveredSystemCell((current) =>
                                current?.x === cell.x && current?.y === cell.y ? null : current
                              );
                            }}
                            style={{
                              minHeight: 72,
                              borderWidth: `${Math.max(1, 1.15 / Math.max(systemZoom, SYSTEM_MIN_ZOOM))}px`,
                            }}
                          >
                            <div className={GRID_CELL_BODY_CLS}>
                              {cell.planets.slice(0, 1).map((planet) =>
                                bestPlanetImage(planet) ? (
                                  <img
                                    key={`member-planet-preview-${planet.uid ?? planet.name}`}
                                    src={bestPlanetImage(planet) ?? ""}
                                    alt={planet.name ?? planet.uid ?? "Planet"}
                                    className={GRID_CELL_THUMB_CLS}
                                  />
                                ) : null
                              )}
                              {station && bestStationImage(station) ? (
                                  <img
                                    key={`member-station-preview-${station.uid ?? station.name}`}
                                    src={bestStationImage(station) ?? ""}
                                    alt={stationTypeName(station)}
                                    className={GRID_CELL_STATION_CLS}
                                  />
                                ) : null}
                              {station && !bestStationImage(station) ? (
                                <span className={GRID_CELL_DOT_CLS} />
                              ) : null}
                              {showDroidBrainShips && cell.ships[0] ? (() => {
                                const representative = biggestShip(cell.ships);
                                const iffStatuses = new Set(cell.ships.map((s) => s.public_status).filter(Boolean));
                                const isMixed = iffStatuses.size > 1;
                                const singleIff = iffStatuses.size === 1 ? Array.from(iffStatuses)[0] : null;
                                const border = "drop-shadow(1px 0 0 rgba(0,0,0,1)) drop-shadow(-1px 0 0 rgba(0,0,0,1)) drop-shadow(0 1px 0 rgba(0,0,0,1)) drop-shadow(0 -1px 0 rgba(0,0,0,1))";
                                const iffFilter =
                                  isMixed ? `sepia(1) hue-rotate(190deg) saturate(600%) brightness(80%) ${border}` :
                                  singleIff === "Friend"  ? `sepia(1) hue-rotate(86deg)  saturate(600%) brightness(140%) ${border}` :
                                  singleIff === "Enemy"   ? `sepia(1) hue-rotate(316deg) saturate(700%) brightness(135%) ${border}` :
                                  singleIff === "Neutral" ? `sepia(1) hue-rotate(226deg) saturate(600%) brightness(145%) ${border}` :
                                  `opacity(0.7) ${border}`;
                                return (
                                  <img
                                    key={`member-ship-preview-${representative.uid ?? representative.name}`}
                                    src={resolveShipMapIcon(representative)}
                                    alt={representative.class_name ?? representative.type_name ?? representative.name ?? "Ship"}
                                    className={cell.planets.length > 0 ? GRID_CELL_SHIP_OVER_PLANET_CLS : GRID_CELL_SHIP_CLS}
                                    style={{ filter: iffFilter }}
                                  />
                                );
                              })() : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {hoveredSystemCell ? (
                  <div
                    className={GRID_HOVER_CLS}
                    style={{
                      left: hoveredSystemCell.left,
                      top: hoveredSystemCell.top,
                      transform: hoveredSystemCell.transform,
                    }}
                  >
                    <strong>
                      {hoveredSystemCell.x}, {hoveredSystemCell.y}
                    </strong>
                    {hoveredSystemCell.planets.length > 0 ? (
                      <div className={GRID_HOVER_GROUP_CLS}>
                        <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Planet</span>
                        {hoveredSystemCell.planets.slice(0, 3).map((planet, index) => (
                          <span key={`${planet.uid ?? planet.name ?? index}`} className="small">
                            {planet.name ?? formatSwcDisplayId(planet.uid) ?? `Planet ${index + 1}`}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {hoveredSystemCell.stations.length > 0 ? (
                      <div className={GRID_HOVER_GROUP_CLS}>
                        <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Station</span>
                        {hoveredSystemCell.stations.slice(0, 3).map((station, index) => (
                          <span key={`${station.uid ?? station.name ?? index}`} className="small">
                            {station.name ?? formatSwcDisplayId(station.uid) ?? `Station ${index + 1}`}
                            {" · "}
                            {stationTypeName(station)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {hoveredSystemCell.ships.length > 0 ? (
                      <div className={GRID_HOVER_GROUP_CLS}>
                        <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Ships ({hoveredSystemCell.ships.length})</span>
                        <div className="flex gap-2 flex-wrap">
                          {(["Friend", "Enemy", "Neutral", "unknown"] as const).map((iff) => {
                            const count = iff === "unknown"
                              ? hoveredSystemCell.ships.filter((s) => !s.public_status || !["Friend","Enemy","Neutral"].includes(s.public_status)).length
                              : hoveredSystemCell.ships.filter((s) => s.public_status === iff).length;
                            if (count === 0) return null;
                            const colour =
                              iff === "Friend"  ? "text-green-400" :
                              iff === "Enemy"   ? "text-red-400" :
                              iff === "Neutral" ? "text-violet-400" :
                              "text-white/40";
                            const label = iff === "unknown" ? "Unknown" : iff;
                            return (
                              <span key={iff} className={`small font-semibold ${colour}`}>{count} {label}</span>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {hoveredSystemCell.planets.length === 0 && hoveredSystemCell.stations.length === 0 && hoveredSystemCell.ships.length === 0 ? (
                      <span className="small">Empty coordinate</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            }
            selection={
              <>
                <div className={SELECTION_HEAD_CLS}>
                  <span className={SELECTION_LABEL_CLS}>Selected Location</span>
                  <strong>
                    {selectedCellData ? `${selectedCellData.x}, ${selectedCellData.y}` : "None"}
                  </strong>
                </div>

                {!selectedCellData ? (
                  <p className="small m-0">
                    Click a coordinate on the system chart to inspect what is registered there.
                  </p>
                ) : null}

                {selectedCellData?.planets.length ? (
                  <div className={CELL_GROUP_CLS}>
                    <span className="small">Planets</span>
                    <div className={CELL_CHIP_GRID_CLS}>
                      {selectedCellData.planets.map((planet, index) => (
                        <div
                          key={`${planet.uid ?? planet.name ?? index}`}
                          className={CELL_CHIP_CLS}
                        >
                          {bestPlanetImage(planet) ? (
                            <img
                              src={bestPlanetImage(planet) ?? ""}
                              alt={planet.name ?? planet.uid ?? "Planet"}
                              className="w-9 h-9 rounded-full object-cover border border-white/15"
                            />
                          ) : null}
                          <div>
                            <strong>{planet.name ?? formatSwcDisplayId(planet.uid) ?? `Planet ${index + 1}`}</strong>
                            <span className="small">{formatValue(planet.owner_name, "No owner")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedCellData?.stations.length ? (
                  <div className={CELL_GROUP_CLS}>
                    <span className="small">Stations</span>
                    <div className={CELL_CHIP_GRID_CLS}>
                      {selectedCellData.stations.slice(0, 1).map((station, index) => (
                        <div
                          key={`${station.uid ?? station.name ?? index}`}
                          className={CELL_CHIP_CLS}
                        >
                          {bestStationImage(station) ? (
                            <img
                              src={bestStationImage(station) ?? ""}
                              alt={stationTypeName(station)}
                              className={SHIP_ICON_CLS}
                            />
                          ) : null}
                          <div>
                            <strong>{station.name ?? formatSwcDisplayId(station.uid) ?? `Station ${index + 1}`}</strong>
                            <span className="small">
                              {stationTypeName(station)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showDroidBrainShips && (selectedCellData?.ships.length || snapshotShips?.length) ? (
                  <div className={CELL_GROUP_CLS}>
                    {(() => {
                      const cellShips = (snapshotShips
                        ? snapshotShips.filter((s) => Number(s.sysx) === selectedCellData?.x && Number(s.sysy) === selectedCellData?.y)
                        : (selectedCellData?.ships ?? [])
                      );
                      const availableClasses = Array.from(
                        new Set(cellShips.map((s) => s.class_name).filter(Boolean) as string[])
                      ).sort((a, b) => shipClassPriority({ class_name: a }) - shipClassPriority({ class_name: b }));
                      return (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="small">
                            DroidBrain Ships
                            {snapshotTime && <span className="opacity-50 ml-1 text-[0.65rem]">(snapshot)</span>}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {availableClasses.length > 1 && (
                              <select
                                className={SELECT_INPUT + " text-xs py-1 min-h-0"}
                                value={classFilter}
                                onChange={(e) => setClassFilter(e.target.value)}
                              >
                                <option value="all">All Classes</option>
                                {availableClasses.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            )}
                            <div className="flex gap-1 flex-wrap">
                              {(["all", "Friend", "Neutral", "Enemy", "other"] as const).map((f) => {
                                const label = f === "all" ? "All" : f === "other" ? "Unknown" : f;
                                const colour = f === "Friend" ? "text-green-400 border-green-400/40 bg-green-400/10" : f === "Enemy" ? "text-red-400 border-red-400/40 bg-red-400/10" : f === "Neutral" ? "text-violet-400 border-violet-400/40 bg-violet-400/10" : "text-white/50 border-white/20 bg-white/5";
                                return (
                                  <button key={f} type="button"
                                    onClick={() => setIffFilter(f)}
                                    className={`text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${iffFilter === f ? colour : "text-white/30 border-white/10 bg-transparent"}`}>
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <div className={CELL_CHIP_GRID_CLS}>
                      {(snapshotShips
                          ? snapshotShips.filter((s) => Number(s.sysx) === selectedCellData?.x && Number(s.sysy) === selectedCellData?.y)
                          : (selectedCellData?.ships ?? [])
                      ).filter((ship) => {
                        if (iffFilter !== "all") {
                          if (iffFilter === "other" && ship.public_status && ["Friend","Enemy","Neutral"].includes(ship.public_status)) return false;
                          if (iffFilter !== "other" && ship.public_status !== iffFilter) return false;
                        }
                        if (classFilter !== "all" && ship.class_name !== classFilter) return false;
                        return true;
                      }).sort((a, b) => shipClassPriority(a) - shipClassPriority(b))
                      .map((ship, index) => {
                        return (() => {
                          const key = ship.uid ?? ship.name ?? String(index);
                          const isExpanded = expandedShips.has(key);
                          const typeData = ship.type_name ? shipTypeLookup.get(ship.type_name.toLowerCase()) : null;
                          const iffGlow =
                            ship.public_status === "Friend"  ? "sepia(1) hue-rotate(86deg)  saturate(600%) brightness(140%)" :
                            ship.public_status === "Enemy"   ? "sepia(1) hue-rotate(316deg) saturate(700%) brightness(135%)" :
                            ship.public_status === "Neutral" ? "sepia(1) hue-rotate(226deg) saturate(600%) brightness(145%)" :
                            "opacity(0.7)";
                          return (
                            <div key={key} className="rounded-[10px] border border-white/8 bg-white/4 overflow-hidden">
                              <button
                                type="button"
                                className="w-full grid grid-cols-[auto_1fr_auto] gap-[0.7rem] items-center p-3 text-left cursor-pointer hover:bg-white/3 transition-colors"
                                onClick={() => setExpandedShips((prev) => {
                                  const next = new Set(prev);
                                  next.has(key) ? next.delete(key) : next.add(key);
                                  return next;
                                })}
                              >
                                <img src={resolveShipMapIcon(ship)} alt={ship.class_name ?? ship.type_name ?? "Ship"} className={SHIP_ICON_CLS} style={{ filter: iffGlow }} />
                                <div className="min-w-0">
                                  <strong className="block truncate text-[0.85rem] leading-snug">
                                    {ship.name ?? formatSwcDisplayId(ship.uid) ?? `Ship ${index + 1}`}
                                  </strong>
                                  {ship.class_name && <span className="block text-[0.72rem] opacity-50 leading-snug truncate">{ship.class_name}</span>}
                                  {ship.type_name && <span className="block text-[0.68rem] opacity-40 leading-snug truncate">{ship.type_name}</span>}
                                  {ship.owner_name && (
                                    <span className="block text-[0.72rem] opacity-50 leading-snug truncate">{ship.owner_name}</span>
                                  )}
                                  {ship.public_status && (
                                    <span className={`inline-block mt-0.5 text-[0.62rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                      ship.public_status === "Friend" ? "text-green-400 border-green-400/40 bg-green-400/10" :
                                      ship.public_status === "Enemy"  ? "text-red-400 border-red-400/40 bg-red-400/10" :
                                      ship.public_status === "Neutral"? "text-violet-400 border-violet-400/40 bg-violet-400/10" :
                                      "text-white/40 border-white/15 bg-white/5"
                                    }`}>{ship.public_status}</span>
                                  )}
                                </div>
                                <span className="text-[0.7rem] opacity-30 pr-1">{isExpanded ? "▲" : "▼"}</span>
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 border-t border-white/6 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[0.72rem]">
                                  {typeData ? (
                                    <>
                                      {typeData.length != null && <div><span className="opacity-40">Length</span> <span className="font-semibold">{typeData.length}m</span></div>}
                                      {typeData.hull != null && <div><span className="opacity-40">Hull</span> <span className="font-semibold">{typeData.hull.toLocaleString()}</span></div>}
                                      {typeData.shield != null && <div><span className="opacity-40">Shield</span> <span className="font-semibold">{typeData.shield.toLocaleString()}</span></div>}
                                      {typeData.armour != null && <div><span className="opacity-40">Armour</span> <span className="font-semibold">{typeData.armour.toLocaleString()}</span></div>}
                                      {typeData.hyperdrive != null && <div><span className="opacity-40">Hyperdrive</span> <span className="font-semibold">×{typeData.hyperdrive}</span></div>}
                                      {typeData.max_speed != null && <div><span className="opacity-40">Speed</span> <span className="font-semibold">{typeData.max_speed}</span></div>}
                                      {typeData.sensors != null && <div><span className="opacity-40">Sensors</span> <span className="font-semibold">{typeData.sensors}</span></div>}
                                      {typeData.manoeuvrability != null && <div><span className="opacity-40">Manoeuvrability</span> <span className="font-semibold">{typeData.manoeuvrability}</span></div>}
                                      {typeData.max_passengers != null && <div><span className="opacity-40">Passengers</span> <span className="font-semibold">{typeData.max_passengers.toLocaleString()}</span></div>}
                                    </>
                                  ) : (
                                    <div className="col-span-3 opacity-40">No type data available</div>
                                  )}
                                  {ship.uid && <div className="col-span-2 sm:col-span-3 opacity-40 mt-1">UID: {formatSwcDisplayId(ship.uid)}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })();
                      })}
                    </div>
                  </div>
                ) : null}

                {selectedCellData &&
                selectedCellData.planets.length === 0 &&
                selectedCellData.stations.length === 0 &&
                selectedCellData.ships.length === 0 ? (
                  <p className="small m-0">Nothing is registered at this coordinate.</p>
                ) : null}
              </>
            }
          />

        </main>
      </div>
    </div>
  );
};

export default MembersUniverseSystemPage;
