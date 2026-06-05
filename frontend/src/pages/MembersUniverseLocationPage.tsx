import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange } from "../api/core/auth";
import { getStoredLocation, getStoredShipTypes, getStoredSystem, type StoredLocationDetail, type StoredShipTypeSummary, type StoredSystemDetail } from "../api/universe/universe";
import { canAccessAdmin, canAccessDroidBrainFull, canAccessMembers, canAccessPublicTools } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import UniverseDetailHero from "../components/common/UniverseDetailHero";
import UniverseDetailImmersive from "../components/common/UniverseDetailImmersive";
import useUniverseViewport from "../components/common/useUniverseViewport";
import SystemIcon from "../assets/map/SystemIcon.png";
import AsteroidsBackground from "../assets/map/AsteroidsBackground.png";
import StationsDuelcon from "../assets/map/StationsDuelcon.png";
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
const gridCellCls = (hasAsteroid: boolean, hasContent: boolean, isActive: boolean) =>
  "relative flex items-center justify-center w-[78px] h-[78px] min-w-[78px] min-h-[78px] p-0 rounded-none border border-solid border-white/[0.08] bg-transparent text-left pointer-events-auto overflow-hidden transition-[border-color,background,box-shadow] duration-[140ms] ease hover:border-white/[0.16] hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" +
  (hasAsteroid ? " has-asteroid" : "") +
  (hasContent ? " has-content" : "") +
  (isActive ? " !border-[rgba(246,163,0,0.68)] !bg-[rgba(246,163,0,0.08)] !shadow-[inset_0_0_0_1px_rgba(246,163,0,0.2)]" : "");
const GRID_CELL_BODY_CLS = "relative flex items-center justify-center w-full h-full z-[1]";
const GRID_CELL_ASTEROID_CLS = "absolute inset-0 bg-no-repeat bg-cover bg-center opacity-[0.74] z-0 pointer-events-none saturate-[1.08] contrast-[1.02]";
const GRID_CELL_STATION_CLS = "absolute right-[6px] top-[6px] w-[34px] h-[34px] rounded-[4px] object-cover opacity-[0.72] z-[2]";
const GRID_CELL_SHIP_CLS = "absolute left-0 bottom-0 w-[39px] h-[39px] object-contain object-left-bottom opacity-100 z-[3] drop-shadow-[0_0_4px_rgba(0,0,0,0.65)] pointer-events-none";
const GRID_HOVER_CLS = "absolute z-[3] grid gap-[0.18rem] min-w-[120px] max-w-[200px] p-[0.55rem_0.75rem] rounded-[12px] border border-[rgba(246,163,0,0.45)] bg-[rgba(14,14,14,0.96)] shadow-[0_14px_32px_rgba(0,0,0,0.34)] pointer-events-none [&_strong]:text-[0.8rem] [&_strong]:text-white/[0.96]";
const GRID_HOVER_GROUP_CLS = "grid gap-[0.15rem]";
const GRID_HOVER_LABEL_CLS = "text-[rgba(246,163,0,0.98)] font-bold tracking-[0]";
const SELECTION_HEAD_CLS = "grid gap-[0.2rem] [&_strong]:text-[1.15rem] [&_strong]:text-white/[0.96]";
const SELECTION_LABEL_CLS = "text-[rgba(246,163,0,0.95)] text-[0.74rem] font-bold tracking-[0.06em] uppercase";
const CELL_PANEL_CLS = "grid gap-3 p-[0.95rem] rounded-[12px] border border-[rgba(108,168,255,0.2)] bg-[linear-gradient(180deg,rgba(73,121,214,0.12),rgba(255,255,255,0.03))]";
const CELL_GROUP_CLS = "grid gap-2";
const CELL_CHIP_GRID_CLS = "grid [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-[0.6rem]";
const CELL_CHIP_CLS = "grid [grid-template-columns:auto_1fr] gap-[0.7rem] items-center p-3 rounded-[10px] border border-white/[0.08] bg-white/[0.04] [&_strong]:block [&_strong]:mb-[0.2rem]";
const SHIP_ICON_CLS = "w-[28px] h-[28px] object-contain opacity-[0.9]";

const LOCATION_GRID_SIZE = 20;
const LOCATION_CELL_SIZE = 78;
const LOCATION_GRID_PIXEL_SIZE = LOCATION_GRID_SIZE * LOCATION_CELL_SIZE;
const LOCATION_CANVAS_PADDING = 16;
const LOCATION_VIEW_PADDING = 24;
const LOCATION_MIN_ZOOM = 0.2;
const LOCATION_MAX_ZOOM = 1.5;
const LOCATION_ZOOM_STEP = 0.05;
const LOCATION_TOOLTIP_WIDTH_ESTIMATE = 180;
const LOCATION_TOOLTIP_HEIGHT_ESTIMATE = 112;
const LOCATION_TOOLTIP_MARGIN = 12;

type UniverseLocationRouteState = {
  fromUniverseMap?: boolean;
  sectorUid?: string | null;
  galx?: number | null;
  galy?: number | null;
};

function formatCoords(x: number | null | undefined, y: number | null | undefined) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "Unknown";
  return `${x}, ${y}`;
}

function formatValue(value: string | number | null | undefined, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatLocationLine(
  item: Pick<
    StoredLocationDetail["ships"][number],
    "system_name" | "planet_name" | "city_name" | "sysx" | "sysy" | "surfx" | "surfy" | "groundx" | "groundy"
  >
) {
  const systemSpaceX = Number.isFinite(item.surfx) ? item.surfx : item.sysx;
  const systemSpaceY = Number.isFinite(item.surfy) ? item.surfy : item.sysy;
  const coordinateLabel = Number.isFinite(item.groundx) && Number.isFinite(item.groundy)
    ? `Ground ${item.groundx},${item.groundy}`
    : item.planet_name || item.city_name
      ? (Number.isFinite(item.surfx) && Number.isFinite(item.surfy) ? `Surface ${item.surfx},${item.surfy}` : null)
      : (Number.isFinite(systemSpaceX) && Number.isFinite(systemSpaceY) ? `System Space ${systemSpaceX},${systemSpaceY}` : null);

  const parts = [
    item.system_name ? `System ${item.system_name}` : null,
    item.planet_name ? `Planet ${item.planet_name}` : null,
    item.city_name ? `City ${item.city_name}` : null,
    coordinateLabel,
  ].filter(Boolean);

  return parts.join(" · ") || "No stored location detail";
}

function resolveLocationGridX(item: Pick<StoredLocationDetail["ships"][number], "sysx" | "surfx">) {
  return Number.isFinite(item.surfx) ? Number(item.surfx) : Number(item.sysx);
}

function resolveLocationGridY(item: Pick<StoredLocationDetail["ships"][number], "sysy" | "surfy">) {
  return Number.isFinite(item.surfy) ? Number(item.surfy) : Number(item.sysy);
}

function resolveLocationShipIcon(ship: StoredLocationDetail["ships"][number]): string {
  const normalizedClass = String(ship.class_name ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const classIconMap: Record<string, string> = {
    bomber: ShipIconBomber, bombers: ShipIconBomber,
    capital: ShipIconCapital, capitalships: ShipIconCapital,
    cargo: ShipIconCargo, cargocontainers: ShipIconCargo,
    fighter: ShipIconFighter, fighters: ShipIconFighter,
    frigate: ShipIconFrigate, frigates: ShipIconFrigate,
    gunboat: ShipIconGunboat, gunboats: ShipIconGunboat,
    hfreighter: ShipIconHFreighter, heavyfreighters: ShipIconHFreighter,
    lfreighter: ShipIconLFreighter, lightfreighters: ShipIconLFreighter,
    sat: ShipIconSat, satellites: ShipIconSat,
    super: ShipIconSuper, supercapitals: ShipIconSuper,
    vette: ShipIconVette, corvettes: ShipIconVette,
    wreck: ShipIconWreck,
  };
  if (normalizedClass && classIconMap[normalizedClass]) return classIconMap[normalizedClass];
  const text = `${ship.class_name ?? ""} ${ship.type_name ?? ""} ${ship.name ?? ""}`.toLowerCase();
  if (text.includes("wreck")) return ShipIconWreck;
  if (text.includes("sat")) return ShipIconSat;
  if (text.includes("super")) return ShipIconSuper;
  if (text.includes("capital") || text.includes("dreadnaught") || text.includes("destroyer") || text.includes("battlecruiser") || text.includes("carrier")) return ShipIconCapital;
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

function resolveLocationStationIcon(station: StoredLocationDetail["stations"][number]): string {
  return station.icon_url ?? station.image_url ?? StationsDuelcon;
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
  return CLASS_PRIORITY[normalizeClass(ship.class_name)] ?? 99;
}

function biggestShip<T extends { class_name: string | null }>(ships: T[]): T {
  return ships.reduce((best, s) => shipClassPriority(s) < shipClassPriority(best) ? s : best, ships[0]);
}

type SystemMapStation = StoredSystemDetail["stations"][number] | StoredSystemDetail["droidbrain_stations"][number];

function isApiSystemStation(s: SystemMapStation): s is StoredSystemDetail["stations"][number] {
  return "station_type" in s;
}

function bestPlanetImage(planet: StoredSystemDetail["planets"][number]): string | null {
  return planet.image_small_url ?? planet.image_large_url ?? planet.image_atmosphere_url ?? planet.image_stratosphere_url ?? planet.image_loworbit_url ?? null;
}

function systemStationImage(station: SystemMapStation): string | null {
  if (isApiSystemStation(station)) return station.station_type?.icon_url ?? (station.station_type?.images as Record<string, string> | null)?.small ?? station.station_type?.image_url ?? null;
  return station.icon_url ?? station.image_url ?? null;
}

function systemStationName(station: SystemMapStation): string {
  if (isApiSystemStation(station)) return station.station_type?.name ?? station.type_name ?? "Unknown type";
  return station.type_name ?? "Unknown type";
}

function stationKey(s: SystemMapStation): string {
  return `${Number(s.sysx)}:${Number(s.sysy)}:${s.uid ?? ""}:${String(s.name ?? "").trim().toLowerCase()}`;
}

const MembersUniverseLocationPage: React.FC = () => {
  const { galx, galy } = useParams<{ galx: string; galy: string }>();
  const location = useLocation();
  const routeState = (location.state ?? null) as UniverseLocationRouteState | null;
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [canSeeMembers, setCanSeeMembers] = useState(false);
  const [canSeeDroidBrain, setCanSeeDroidBrain] = useState(false);
  const [showDroidBrainIntel, setShowDroidBrainIntel] = useState(false);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
  const [detail, setDetail] = useState<StoredLocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationCell, setSelectedLocationCell] = useState<{ x: number; y: number } | null>(null);
  const [shipTypes, setShipTypes] = useState<StoredShipTypeSummary[]>([]);
  const [expandedShips, setExpandedShips] = useState<Set<string>>(new Set());
  const [iffFilter, setIffFilter] = useState<"all" | "Friend" | "Enemy" | "Neutral" | "other">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [systemDetails, setSystemDetails] = useState<StoredSystemDetail[]>([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [showSysShips, setShowSysShips] = useState(false);
  const [selectedSystemCell, setSelectedSystemCell] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSystemCell, setHoveredSystemCell] = useState<{
    x: number; y: number; left: number; top: number; transform: string;
    planets: StoredSystemDetail["planets"];
    stations: SystemMapStation[];
    ships: StoredSystemDetail["ships"];
  } | null>(null);
  const [hoveredLocationCell, setHoveredLocationCell] = useState<{
    x: number;
    y: number;
    left: number;
    top: number;
    transform: string;
    hasAsteroid: boolean;
    stations: StoredLocationDetail["stations"];
    ships: StoredLocationDetail["ships"];
  } | null>(null);

  const parsedGalx = Number(galx);
  const parsedGaly = Number(galy);
  const locationFitKey = Number.isFinite(parsedGalx) && Number.isFinite(parsedGaly)
    ? `${parsedGalx}:${parsedGaly}`
    : null;
  const {
    viewportRef: locationViewportRef,
    viewportEl: locationViewportEl,
    zoom: locationZoom,
    offset: locationOffset,
    isDragging: isDraggingLocation,
    resetViewport: resetLocationViewport,
    handleMouseDown: handleLocationMouseDown,
    handleMouseMove: handleLocationMouseMove,
    handleMouseUp: handleLocationMouseUp,
    handleMouseLeave: handleLocationMouseLeave,
  } = useUniverseViewport({
    fitKey: locationFitKey,
    worldWidth: LOCATION_GRID_SIZE * LOCATION_CELL_SIZE + LOCATION_CANVAS_PADDING * 2,
    worldHeight: LOCATION_GRID_SIZE * LOCATION_CELL_SIZE + LOCATION_CANVAS_PADDING * 2,
    minZoom: LOCATION_MIN_ZOOM,
    maxZoom: LOCATION_MAX_ZOOM,
    zoomStep: LOCATION_ZOOM_STEP,
    viewPadding: LOCATION_VIEW_PADDING,
    onViewportReset: () => {
      setSelectedLocationCell(null);
      setShowDroidBrainIntel(false);
      setHoveredLocationCell(null);
      setIffFilter("all");
      setClassFilter("all");
    },
  });

  const primarySystem = systemDetails[0] ?? null;
  const systemFitKey = primarySystem?.system.uid ?? primarySystem?.system.identifier ?? null;
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
    worldWidth: LOCATION_GRID_SIZE * LOCATION_CELL_SIZE + LOCATION_CANVAS_PADDING * 2,
    worldHeight: LOCATION_GRID_SIZE * LOCATION_CELL_SIZE + LOCATION_CANVAS_PADDING * 2,
    minZoom: LOCATION_MIN_ZOOM,
    maxZoom: LOCATION_MAX_ZOOM,
    zoomStep: LOCATION_ZOOM_STEP,
    viewPadding: LOCATION_VIEW_PADDING,
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
        setCanSeeDroidBrain(canAccessDroidBrainFull(auth?.user ?? null) || canAccessAdmin(auth?.user ?? null));
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
          setCanSeeMembers(false);
          setCanSeeDroidBrain(false);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authRefreshNonce]);

  useEffect(() => {
    if (!authChecked) return;
    if (!isLoggedIn || !canSeeMembers || !Number.isFinite(parsedGalx) || !Number.isFinite(parsedGaly)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getStoredLocation(parsedGalx, parsedGaly);
        if (!cancelled) setDetail(response.data ?? null);
      } catch (e: any) {
        if (!cancelled) {
          setDetail(null);
          setError(e?.message ?? "Failed to load stored location.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authChecked, canSeeMembers, isLoggedIn, parsedGalx, parsedGaly]);

  useEffect(() => {
    if (!canSeeDroidBrain) return;
    void getStoredShipTypes().then((res) => setShipTypes(res.data ?? []));
  }, [canSeeDroidBrain]);

  useEffect(() => {
    setIffFilter("all");
    setClassFilter("all");
  }, [selectedLocationCell?.x, selectedLocationCell?.y]);

  const shipTypeLookup = useMemo(() => {
    const map = new Map<string, StoredShipTypeSummary>();
    shipTypes.forEach((s) => { if (s.name) map.set(s.name.toLowerCase(), s); });
    return map;
  }, [shipTypes]);

  const intelPills = useMemo(() => {
    if (!detail?.search_record) return [];
    const pills: string[] = [];
    if (detail.search_record.is_system_searched) pills.push("Searched");
    if (detail.search_record.has_asteroids) pills.push("Asteroids");
    if (detail.search_record.has_ships) pills.push("Ships");
    if (detail.search_record.has_stations) pills.push("Stations");
    if (detail.search_record.planetoid_1_size) pills.push(`Planetoid 1 ${detail.search_record.planetoid_1_size}`);
    if (detail.search_record.planetoid_2_size) pills.push(`Planetoid 2 ${detail.search_record.planetoid_2_size}`);
    if (detail.search_record.is_rescan_due) pills.push("Rescan Due");
    return pills;
  }, [detail?.search_record]);

  const normalizedError = useMemo(() => {
    const message = String(error ?? "").trim();
    if (/api\/universe\/locations\/\d+\/-?\d+.*could not be found/i.test(message)) {
      return "This backend does not have the location-detail route live yet. Deploy or restart the backend, then try this location again.";
    }
    return error;
  }, [error]);

  useEffect(() => {
    if (!detail?.systems.length || !isLoggedIn || !canSeeMembers) {
      setSystemDetails([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setSystemLoading(true);
        const results = await Promise.all(
          detail.systems.map((sys) => getStoredSystem(sys.identifier ?? sys.uid ?? ""))
        );
        if (!cancelled) setSystemDetails(results.map((r) => r.data).filter(Boolean) as StoredSystemDetail[]);
      } catch {
        if (!cancelled) setSystemDetails([]);
      } finally {
        if (!cancelled) setSystemLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [detail?.systems, isLoggedIn, canSeeMembers]);

  const systemMapCells = useMemo(() => {
    if (!primarySystem) return [] as Array<Array<{ x: number; y: number; planets: StoredSystemDetail["planets"]; stations: SystemMapStation[]; ships: StoredSystemDetail["ships"] }>>;
    const planets = primarySystem.planets.filter((p) => p.sysx != null && p.sysy != null);
    const apiStations = primarySystem.stations.filter((s) => s.sysx != null && s.sysy != null);
    const dbStations = primarySystem.droidbrain_stations.filter((s) => s.sysx != null && s.sysy != null);
    const allStations: SystemMapStation[] = [...apiStations, ...dbStations].filter((s, i, arr) =>
      arr.findIndex((e) => stationKey(e) === stationKey(s)) === i
    );
    const ships = (canSeeDroidBrain && showSysShips ? primarySystem.ships : []).filter((s) => s.sysx != null && s.sysy != null);
    return Array.from({ length: LOCATION_GRID_SIZE }, (_, rowIndex) =>
      Array.from({ length: LOCATION_GRID_SIZE }, (_, colIndex) => ({
        x: colIndex, y: rowIndex,
        planets: planets.filter((p) => Number(p.sysx) === colIndex && Number(p.sysy) === rowIndex),
        stations: allStations.filter((s) => Number(s.sysx) === colIndex && Number(s.sysy) === rowIndex),
        ships: ships.filter((s) => Number(s.sysx) === colIndex && Number(s.sysy) === rowIndex),
      }))
    );
  }, [primarySystem, canSeeDroidBrain, showSysShips]);

  const selectedSystemCellData = selectedSystemCell
    ? systemMapCells.flat().find((c) => c.x === selectedSystemCell.x && c.y === selectedSystemCell.y) ?? null
    : null;

  const mapCells = useMemo(() => {
    const asteroidMask = detail?.asteroid_field?.mask ?? null;
    const stations = detail?.stations
      .map((station) => ({
        ...station,
        placementX: resolveLocationGridX(station),
        placementY: resolveLocationGridY(station),
      }))
      .filter((station) => Number.isFinite(station.placementX) && Number.isFinite(station.placementY)) ?? [];
    const ships = (detail?.ships ?? [])
      .map((ship) => ({
        ...ship,
        placementX: resolveLocationGridX(ship),
        placementY: resolveLocationGridY(ship),
      }))
      .filter((ship) => Number.isFinite(ship.placementX) && Number.isFinite(ship.placementY));

    return Array.from({ length: LOCATION_GRID_SIZE }, (_, rowIndex) =>
      Array.from({ length: LOCATION_GRID_SIZE }, (_, colIndex) => {
        const x = colIndex;
        const y = rowIndex;
        return {
          x,
          y,
          hasAsteroid: !!asteroidMask?.[y]?.[x],
          stations: stations.filter((s) => Number(s.placementX) === x && Number(s.placementY) === y),
          ships: ships.filter((s) => Number(s.placementX) === x && Number(s.placementY) === y),
        };
      })
    );
  }, [detail]);

  const selectedCellData = selectedLocationCell
    ? mapCells.flat().find((cell) => cell.x === selectedLocationCell.x && cell.y === selectedLocationCell.y) ?? null
    : null;

  if (!authChecked || loading) {
    return (
      <section>
        <div className="flex flex-col gap-4">
          <p className="small">Loading location…</p>
        </div>
      </section>
    );
  }

  if (!isLoggedIn) {
    return <NotLoggedInState title="Astrogation" message="Please log in to view stored chart locations." />;
  }

  if (!canSeeMembers) {
    return <ForbiddenState title="Astrogation" message="You do not have access to stored chart locations." />;
  }

  if (!Number.isFinite(parsedGalx) || !Number.isFinite(parsedGaly)) {
    return <Navigate to="/tools" replace />;
  }

  const heading = detail?.location.primary_label ?? "Chart Location";

  return (
    <section>
      <UniverseDetailHero
        eyebrow="Astrogation Location"
        title={heading}
        meta={
          <>
            <span>
              Chart {detail ? formatCoords(detail.location.galx, detail.location.galy) : formatCoords(parsedGalx, parsedGaly)}
            </span>
            <span className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]">
              {detail?.location.sector_name ?? routeState?.sectorUid ?? "Unknown Sector"}
            </span>
            {detail?.location.within_scan_window ? (
              <span className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]">Within Scan Window</span>
            ) : null}
            {intelPills.map((pill) => (
              <span key={pill} className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]">
                {pill}
              </span>
            ))}
          </>
        }
        backLabel="Back to Astrogation"
        backTo="/tools"
        backState={{ membersView: "universe" }}
      />

      {normalizedError ? (
        <div className="flex flex-col gap-4">
          <p className="small" style={{ color: "salmon", margin: 0 }}>
            {normalizedError}
          </p>
        </div>
      ) : null}

      <UniverseDetailImmersive
        title="Location View"
        toolbar={
          <div className="flex justify-between gap-2 items-center flex-wrap">
            <div className="flex gap-2 items-center flex-wrap">
              {canSeeDroidBrain && ((detail?.ships.length ?? 0) > 0 || (detail?.stations.length ?? 0) > 0) ? (
                <button
                  className={layerToggleCls(showDroidBrainIntel)}
                  type="button"
                  onClick={() => setShowDroidBrainIntel((value) => !value)}
                >
                  DroidBrain Intel
                </button>
              ) : null}
              <span className="small">Zoom: {locationZoom.toFixed(2)}x</span>
              <button className={BTN} type="button" onClick={resetLocationViewport}>
                Reset View
              </button>
            </div>
          </div>
        }
        copy="Scroll to zoom, drag to move, and click a coordinate cell to inspect the stations and ships placed there."
        viewport={
          <div className="min-w-0">
            <div
              ref={locationViewportRef}
              className={`relative overflow-hidden rounded-[10px] border border-white/10 bg-[radial-gradient(circle_at_50%_38%,rgba(20,26,38,0.52),transparent_42%),linear-gradient(180deg,rgba(4,6,10,0.98),rgba(9,11,16,0.98))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_28px_72px_rgba(0,0,0,0.32)] w-[min(100%,82vh,980px)] aspect-square mx-auto max-[860px]:w-full ${isDraggingLocation ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ overscrollBehavior: "contain", touchAction: "none" }}
              onMouseDown={handleLocationMouseDown}
              onMouseMove={(event) => {
                if (isDraggingLocation) {
                  handleLocationMouseMove(event);
                  setHoveredLocationCell(null);
                }
              }}
              onMouseUp={handleLocationMouseUp}
              onMouseLeave={() => {
                handleLocationMouseLeave();
                setHoveredLocationCell(null);
              }}
            >
              <div className="sysuniverse-map-viewport__stars" />
              <div
                className="grid gap-0 origin-top-left w-max p-4 select-none"
                style={{ transform: `translate(${locationOffset.x}px, ${locationOffset.y}px) scale(${locationZoom})` }}
              >
                {mapCells.map((row, rowIndex) => (
                  <div
                    key={`location-row-${rowIndex}`}
                    className="grid gap-0"
                    style={{ gap: 0, gridTemplateColumns: `repeat(${row.length}, ${LOCATION_CELL_SIZE}px)` }}
                    aria-hidden="true"
                  >
                    {row.map((cell) => {
                      const occupancy = cell.stations.length + cell.ships.length;
                      const isSelected = selectedLocationCell?.x === cell.x && selectedLocationCell?.y === cell.y;
                      return (
                        <button
                          key={`location-cell-${cell.x}-${cell.y}`}
                          className={gridCellCls(cell.hasAsteroid, occupancy > 0, isSelected)}
                          type="button"
                          onClick={() => setSelectedLocationCell((prev) => prev?.x === cell.x && prev?.y === cell.y ? null : { x: cell.x, y: cell.y })}
                          onMouseEnter={(event) => {
                            if (isDraggingLocation) return;
                            const rect = event.currentTarget.getBoundingClientRect();
                            const viewportRect = locationViewportEl?.getBoundingClientRect() ?? rect;
                            const cellCenterX = rect.left - viewportRect.left + rect.width / 2;
                            const tooltipHalfWidth = LOCATION_TOOLTIP_WIDTH_ESTIMATE / 2;
                            const maxLeft = viewportRect.width - LOCATION_TOOLTIP_MARGIN - tooltipHalfWidth;
                            const minLeft = LOCATION_TOOLTIP_MARGIN + tooltipHalfWidth;
                            const clampedLeft = Math.min(maxLeft, Math.max(minLeft, cellCenterX));
                            const preferredTop = rect.top - viewportRect.top - 10;
                            const canRenderAbove = preferredTop - LOCATION_TOOLTIP_HEIGHT_ESTIMATE >= LOCATION_TOOLTIP_MARGIN;
                            const tooltipTop = canRenderAbove ? preferredTop : rect.bottom - viewportRect.top + 10;
                            setHoveredLocationCell({
                              x: cell.x,
                              y: cell.y,
                              left: clampedLeft,
                              top: tooltipTop,
                              transform: canRenderAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                              hasAsteroid: cell.hasAsteroid,
                              stations: cell.stations,
                              ships: canSeeDroidBrain && showDroidBrainIntel ? cell.ships : [],
                            });
                          }}
                          onMouseLeave={() => {
                            setHoveredLocationCell((current) =>
                              current?.x === cell.x && current?.y === cell.y ? null : current
                            );
                          }}
                          style={{
                            minHeight: 72,
                            borderWidth: `${Math.max(1, 1.15 / Math.max(locationZoom, LOCATION_MIN_ZOOM))}px`,
                          }}
                        >
                          <div className={GRID_CELL_BODY_CLS}>
                            {cell.hasAsteroid ? (
                              <span
                                className={GRID_CELL_ASTEROID_CLS}
                                style={{
                                  backgroundImage: `url(${AsteroidsBackground})`,
                                  backgroundSize: `${LOCATION_GRID_PIXEL_SIZE}px ${LOCATION_GRID_PIXEL_SIZE}px`,
                                  backgroundPosition: `-${cell.x * LOCATION_CELL_SIZE}px -${cell.y * LOCATION_CELL_SIZE}px`,
                                }}
                                aria-hidden="true"
                              />
                            ) : null}
                            {showDroidBrainIntel ? cell.stations.slice(0, 1).map((station, index) => (
                              <img
                                key={`${station.uid ?? station.name ?? index}-station`}
                                src={resolveLocationStationIcon(station)}
                                alt={station.type_name ?? station.name ?? "Station"}
                                className={GRID_CELL_STATION_CLS}
                              />
                            )) : null}
                            {canSeeDroidBrain && showDroidBrainIntel && cell.ships.length ? (() => {
                              const representative = biggestShip(cell.ships);
                              const iffStatuses = new Set(cell.ships.map((s) => s.public_status).filter(Boolean));
                              const isMixed = iffStatuses.size > 1;
                              const singleIff = iffStatuses.size === 1 ? Array.from(iffStatuses)[0] : null;
                              const border = "drop-shadow(1px 0 0 rgba(0,0,0,1)) drop-shadow(-1px 0 0 rgba(0,0,0,1)) drop-shadow(0 1px 0 rgba(0,0,0,1)) drop-shadow(0 -1px 0 rgba(0,0,0,1))";
                              const iffStyle =
                                isMixed ? `sepia(1) hue-rotate(190deg) saturate(600%) brightness(80%) ${border}` :
                                singleIff === "Friend"  ? `sepia(1) hue-rotate(86deg)  saturate(600%) brightness(140%) ${border}` :
                                singleIff === "Enemy"   ? `sepia(1) hue-rotate(316deg) saturate(700%) brightness(135%) ${border}` :
                                singleIff === "Neutral" ? `sepia(1) hue-rotate(226deg) saturate(600%) brightness(145%) ${border}` :
                                `opacity(0.7) ${border}`;
                              return (
                                <img
                                  key={`${representative.uid ?? representative.name}-ship`}
                                  src={resolveLocationShipIcon(representative)}
                                  alt={representative.class_name ?? representative.type_name ?? representative.name ?? "Ship"}
                                  className={GRID_CELL_SHIP_CLS}
                                  style={{ filter: iffStyle }}
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
              {hoveredLocationCell ? (
                <div
                  className={GRID_HOVER_CLS}
                  style={{
                    left: hoveredLocationCell.left,
                    top: hoveredLocationCell.top,
                    transform: hoveredLocationCell.transform,
                  }}
                >
                  <strong>{hoveredLocationCell.x}, {hoveredLocationCell.y}</strong>
                  {hoveredLocationCell.stations.length > 0 ? (
                    <div className={GRID_HOVER_GROUP_CLS}>
                      <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Station</span>
                      {hoveredLocationCell.stations.slice(0, 3).map((station, index) => (
                        <span key={`${station.uid ?? station.name ?? index}`} className="small">
                          {station.name ?? `Station ${index + 1}`}
                          {station.type_name ? ` · ${station.type_name}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {hoveredLocationCell.ships.length > 0 ? (
                    <div className={GRID_HOVER_GROUP_CLS}>
                      <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Ships ({hoveredLocationCell.ships.length})</span>
                      <div className="flex gap-2 flex-wrap">
                        {(["Friend", "Enemy", "Neutral", "unknown"] as const).map((iff) => {
                          const count = iff === "unknown"
                            ? hoveredLocationCell.ships.filter((s) => !s.public_status || !["Friend", "Enemy", "Neutral"].includes(s.public_status)).length
                            : hoveredLocationCell.ships.filter((s) => s.public_status === iff).length;
                          if (count === 0) return null;
                          const colour =
                            iff === "Friend"  ? "text-green-400" :
                            iff === "Enemy"   ? "text-red-400" :
                            iff === "Neutral" ? "text-violet-400" :
                            "text-white/40";
                          return (
                            <span key={iff} className={`small font-semibold ${colour}`}>
                              {count} {iff === "unknown" ? "Unknown" : iff}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {hoveredLocationCell.hasAsteroid ? (
                    <div className={GRID_HOVER_GROUP_CLS}>
                      <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Asteroid</span>
                      <span className="small" style={{ color: "#ff6b6b", fontWeight: 700 }}>
                        Warning: Asteroids detected
                      </span>
                    </div>
                  ) : null}
                  {hoveredLocationCell.stations.length === 0 && hoveredLocationCell.ships.length === 0 && !hoveredLocationCell.hasAsteroid ? (
                    <span className="small">Empty coordinate</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        }
        selection={
          <>
            <div className={SELECTION_HEAD_CLS}>
              <span className={SELECTION_LABEL_CLS}>Selected Location</span>
              <strong>{formatCoords(detail?.location.galx ?? parsedGalx, detail?.location.galy ?? parsedGaly)}</strong>
            </div>

            {detail?.systems.length ? (
              <div className={CELL_PANEL_CLS}>
                <div className={CELL_GROUP_CLS}>
                  <span className="small">Systems At This Location</span>
                  <div className={CELL_CHIP_GRID_CLS}>
                    {detail.systems.map((system, index) => (
                      <div key={`${system.uid ?? system.name ?? index}`} className={CELL_CHIP_CLS}>
                        <img src={SystemIcon} alt={system.name ?? system.identifier ?? system.uid ?? "System"} className={SHIP_ICON_CLS} />
                        <div>
                          <strong>{system.name ?? system.identifier ?? system.uid ?? `System ${index + 1}`}</strong>
                          <span className="small">{system.owner_name ?? "No owner"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {!selectedCellData ? (
              <p className="small m-0">
                Click a coordinate on the location chart to inspect the ships and stations placed there.
              </p>
            ) : null}

            {showDroidBrainIntel && selectedCellData?.stations.length ? (
              <div className={CELL_GROUP_CLS}>
                <span className="small">Stations</span>
                <div className={CELL_CHIP_GRID_CLS}>
                  {selectedCellData.stations.map((station, index) => (
                    <div key={`${station.uid ?? station.name ?? index}`} className={CELL_CHIP_CLS}>
                      <img
                        src={resolveLocationStationIcon(station)}
                        alt={station.type_name ?? station.name ?? "Station"}
                        className={SHIP_ICON_CLS}
                      />
                      <div>
                        <strong>{station.name ?? `Station ${index + 1}`}</strong>
                        <span className="small">{station.type_name ?? "Unknown type"}</span>
                        <span className="small">{formatValue(station.owner_name, "No owner")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showDroidBrainIntel && selectedCellData?.ships.length ? (
              <div className={CELL_GROUP_CLS}>
                {(() => {
                  const cellShips = selectedCellData.ships;
                  const availableClasses = Array.from(
                    new Set(cellShips.map((s) => s.class_name).filter(Boolean) as string[])
                  ).sort((a, b) => shipClassPriority({ class_name: a }) - shipClassPriority({ class_name: b }));
                  return (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="small">DroidBrain Ships</span>
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
                  {selectedCellData.ships.filter((ship) => {
                    if (iffFilter !== "all") {
                      if (iffFilter === "other" && ship.public_status && ["Friend", "Enemy", "Neutral"].includes(ship.public_status)) return false;
                      if (iffFilter !== "other" && ship.public_status !== iffFilter) return false;
                    }
                    if (classFilter !== "all" && ship.class_name !== classFilter) return false;
                    return true;
                  }).sort((a, b) => shipClassPriority(a) - shipClassPriority(b))
                  .map((ship, index) => {
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
                          <img src={resolveLocationShipIcon(ship)} alt={ship.class_name ?? ship.type_name ?? "Ship"} className={SHIP_ICON_CLS} style={{ filter: iffGlow }} />
                          <div className="min-w-0">
                            <strong className="block truncate text-[0.85rem] leading-snug">
                              {ship.name ?? ship.uid ?? `Ship ${index + 1}`}
                            </strong>
                            {ship.class_name && <span className="block text-[0.72rem] opacity-50 leading-snug truncate">{ship.class_name}</span>}
                            {ship.type_name && <span className="block text-[0.68rem] opacity-40 leading-snug truncate">{ship.type_name}</span>}
                            {ship.owner_name && <span className="block text-[0.72rem] opacity-50 leading-snug truncate">{ship.owner_name}</span>}
                            {ship.public_status && (
                              <span className={`inline-block mt-0.5 text-[0.62rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                ship.public_status === "Friend"  ? "text-green-400 border-green-400/40 bg-green-400/10" :
                                ship.public_status === "Enemy"   ? "text-red-400 border-red-400/40 bg-red-400/10" :
                                ship.public_status === "Neutral" ? "text-violet-400 border-violet-400/40 bg-violet-400/10" :
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
                            {ship.uid && <div className="col-span-2 sm:col-span-3 opacity-40 mt-1">UID: {ship.uid}</div>}
                            <div className="col-span-2 sm:col-span-3 opacity-40">
                              {formatLocationLine(ship)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedCellData &&
            !selectedCellData.hasAsteroid &&
            (!showDroidBrainIntel || (selectedCellData.stations.length === 0 && selectedCellData.ships.length === 0)) ? (
              <p className="small m-0">Nothing is registered at this coordinate.</p>
            ) : null}
          </>
        }
      />
      {systemLoading ? (
        <p className="small mt-4">Loading system data…</p>
      ) : null}

      {primarySystem && !systemLoading ? (
        <UniverseDetailImmersive
          title={`In-System View · ${primarySystem.system.name ?? primarySystem.system.identifier ?? "Unknown System"}`}
          toolbar={
            <div className="flex gap-2 items-center flex-wrap">
              {canSeeDroidBrain && primarySystem.ships.length > 0 ? (
                <button className={layerToggleCls(showSysShips)} type="button" onClick={() => setShowSysShips((v) => !v)}>
                  DroidBrain Ships
                </button>
              ) : null}
              <span className="small">Zoom: {systemZoom.toFixed(2)}x</span>
              <button className={BTN} type="button" onClick={resetSystemViewport}>Reset View</button>
            </div>
          }
          copy="Scroll to zoom, drag to move, and click a coordinate to inspect planets and stations."
          viewport={
            <div
              ref={systemViewportRef}
              className={`relative overflow-hidden rounded-[10px] border border-white/10 bg-[radial-gradient(circle_at_50%_38%,rgba(20,26,38,0.52),transparent_42%),linear-gradient(180deg,rgba(4,6,10,0.98),rgba(9,11,16,0.98))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_28px_72px_rgba(0,0,0,0.32)] w-[min(100%,82vh,980px)] aspect-square mx-auto max-[860px]:w-full ${isDraggingSystem ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ overscrollBehavior: "contain", touchAction: "none" }}
              onMouseDown={handleSystemMouseDown}
              onMouseMove={(event) => { if (isDraggingSystem) { handleSystemMouseMove(event); setHoveredSystemCell(null); } }}
              onMouseUp={handleSystemMouseUp}
              onMouseLeave={() => { handleSystemMouseLeave(); setHoveredSystemCell(null); }}
            >
              <div className="sysuniverse-map-viewport__stars" />
              <div
                className="grid gap-0 origin-top-left w-max p-4 select-none"
                style={{ transform: `translate(${systemOffset.x}px, ${systemOffset.y}px) scale(${systemZoom})` }}
              >
                {systemMapCells.map((row, rowIndex) => (
                  <div key={`sys-row-${rowIndex}`} className="grid gap-0" style={{ gridTemplateColumns: `repeat(${row.length}, ${LOCATION_CELL_SIZE}px)` }}>
                    {row.map((cell) => {
                      const occupancy = cell.planets.length + cell.stations.length;
                      const isSelected = selectedSystemCell?.x === cell.x && selectedSystemCell?.y === cell.y;
                      const station = cell.stations[0] ?? null;
                      return (
                        <button
                          key={`sys-cell-${cell.x}-${cell.y}`}
                          className={gridCellCls(false, occupancy > 0, isSelected)}
                          type="button"
                          onClick={() => setSelectedSystemCell((prev) => prev?.x === cell.x && prev?.y === cell.y ? null : { x: cell.x, y: cell.y })}
                          onMouseEnter={(event) => {
                            if (isDraggingSystem) return;
                            const rect = event.currentTarget.getBoundingClientRect();
                            const vr = systemViewportEl?.getBoundingClientRect() ?? rect;
                            const cx = rect.left - vr.left + rect.width / 2;
                            const hw = LOCATION_TOOLTIP_WIDTH_ESTIMATE / 2;
                            const cl = Math.min(vr.width - LOCATION_TOOLTIP_MARGIN - hw, Math.max(LOCATION_TOOLTIP_MARGIN + hw, cx));
                            const pt = rect.top - vr.top - 10;
                            const above = pt - LOCATION_TOOLTIP_HEIGHT_ESTIMATE >= LOCATION_TOOLTIP_MARGIN;
                            setHoveredSystemCell({
                              x: cell.x, y: cell.y, left: cl,
                              top: above ? pt : rect.bottom - vr.top + 10,
                              transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                              planets: cell.planets,
                              stations: station ? [station] : [],
                              ships: showSysShips ? cell.ships : [],
                            });
                          }}
                          onMouseLeave={() => setHoveredSystemCell((cur) => cur?.x === cell.x && cur?.y === cell.y ? null : cur)}
                          style={{ minHeight: 72, borderWidth: `${Math.max(1, 1.15 / Math.max(systemZoom, LOCATION_MIN_ZOOM))}px` }}
                        >
                          <div className={GRID_CELL_BODY_CLS}>
                            {cell.planets.slice(0, 1).map((planet) =>
                              bestPlanetImage(planet) ? (
                                <img key={planet.uid ?? planet.name ?? "planet"} src={bestPlanetImage(planet)!} alt={planet.name ?? "Planet"} className="w-[90%] h-[90%] max-w-[70px] max-h-[70px] rounded-full object-cover opacity-[0.96]" />
                              ) : null
                            )}
                            {station && systemStationImage(station) ? (
                              <img key={station.uid ?? station.name ?? "station"} src={systemStationImage(station)!} alt={systemStationName(station)} className={GRID_CELL_STATION_CLS} />
                            ) : station && !systemStationImage(station) ? (
                              <span className="absolute right-[10px] top-[10px] w-[16px] h-[16px] rounded-full bg-[rgba(246,163,0,0.72)] z-[2]" />
                            ) : null}
                            {showSysShips && cell.ships.length ? (() => {
                              const rep = biggestShip(cell.ships);
                              const iffStatuses = new Set(cell.ships.map((s) => s.public_status).filter(Boolean));
                              const isMixed = iffStatuses.size > 1;
                              const singleIff = iffStatuses.size === 1 ? Array.from(iffStatuses)[0] : null;
                              const border = "drop-shadow(1px 0 0 rgba(0,0,0,1)) drop-shadow(-1px 0 0 rgba(0,0,0,1)) drop-shadow(0 1px 0 rgba(0,0,0,1)) drop-shadow(0 -1px 0 rgba(0,0,0,1))";
                              const iffStyle = isMixed ? `sepia(1) hue-rotate(190deg) saturate(600%) brightness(80%) ${border}` : singleIff === "Friend" ? `sepia(1) hue-rotate(86deg) saturate(600%) brightness(140%) ${border}` : singleIff === "Enemy" ? `sepia(1) hue-rotate(316deg) saturate(700%) brightness(135%) ${border}` : singleIff === "Neutral" ? `sepia(1) hue-rotate(226deg) saturate(600%) brightness(145%) ${border}` : `opacity(0.7) ${border}`;
                              return <img src={resolveLocationShipIcon(rep as any)} alt={rep.class_name ?? "Ship"} className={cell.planets.length > 0 ? "absolute left-0 bottom-0 w-[52px] h-[52px] object-contain object-left-bottom opacity-100 z-[3] drop-shadow-[0_0_6px_rgba(0,0,0,0.8)] pointer-events-none" : GRID_CELL_SHIP_CLS} style={{ filter: iffStyle }} />;
                            })() : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              {hoveredSystemCell ? (
                <div className={GRID_HOVER_CLS} style={{ left: hoveredSystemCell.left, top: hoveredSystemCell.top, transform: hoveredSystemCell.transform }}>
                  <strong>{hoveredSystemCell.x}, {hoveredSystemCell.y}</strong>
                  {hoveredSystemCell.planets.length > 0 ? (
                    <div className={GRID_HOVER_GROUP_CLS}>
                      <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Planet</span>
                      {hoveredSystemCell.planets.slice(0, 3).map((p, i) => <span key={p.uid ?? i} className="small">{p.name ?? p.uid ?? `Planet ${i + 1}`}</span>)}
                    </div>
                  ) : null}
                  {hoveredSystemCell.stations.length > 0 ? (
                    <div className={GRID_HOVER_GROUP_CLS}>
                      <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Station</span>
                      {hoveredSystemCell.stations.slice(0, 3).map((s, i) => <span key={s.uid ?? i} className="small">{s.name ?? s.uid ?? `Station ${i + 1}`} · {systemStationName(s)}</span>)}
                    </div>
                  ) : null}
                  {hoveredSystemCell.ships.length > 0 ? (
                    <div className={GRID_HOVER_GROUP_CLS}>
                      <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Ships ({hoveredSystemCell.ships.length})</span>
                      <div className="flex gap-2 flex-wrap">
                        {(["Friend", "Enemy", "Neutral", "unknown"] as const).map((iff) => {
                          const count = iff === "unknown" ? hoveredSystemCell.ships.filter((s) => !s.public_status || !["Friend","Enemy","Neutral"].includes(s.public_status)).length : hoveredSystemCell.ships.filter((s) => s.public_status === iff).length;
                          if (!count) return null;
                          return <span key={iff} className={`small font-semibold ${iff === "Friend" ? "text-green-400" : iff === "Enemy" ? "text-red-400" : iff === "Neutral" ? "text-violet-400" : "text-white/40"}`}>{count} {iff === "unknown" ? "Unknown" : iff}</span>;
                        })}
                      </div>
                    </div>
                  ) : null}
                  {!hoveredSystemCell.planets.length && !hoveredSystemCell.stations.length && !hoveredSystemCell.ships.length ? <span className="small">Empty coordinate</span> : null}
                </div>
              ) : null}
            </div>
          }
          selection={
            <>
              <div className={SELECTION_HEAD_CLS}>
                <span className={SELECTION_LABEL_CLS}>Selected Coordinate</span>
                <strong>{selectedSystemCell ? `${selectedSystemCell.x}, ${selectedSystemCell.y}` : "None"}</strong>
              </div>
              {!selectedSystemCellData ? (
                <p className="small m-0">Click a coordinate on the system chart to inspect what is registered there.</p>
              ) : null}
              {selectedSystemCellData?.planets.length ? (
                <div className={CELL_GROUP_CLS}>
                  <span className="small">Planets</span>
                  <div className={CELL_CHIP_GRID_CLS}>
                    {selectedSystemCellData.planets.map((planet, index) => (
                      <div key={planet.uid ?? index} className={CELL_CHIP_CLS}>
                        {bestPlanetImage(planet) ? <img src={bestPlanetImage(planet)!} alt={planet.name ?? "Planet"} className="w-9 h-9 rounded-full object-cover border border-white/15" /> : null}
                        <div>
                          <strong>{planet.name ?? planet.uid ?? `Planet ${index + 1}`}</strong>
                          <span className="small">{formatValue(planet.owner_name, "No owner")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedSystemCellData?.stations.length ? (
                <div className={CELL_GROUP_CLS}>
                  <span className="small">Stations</span>
                  <div className={CELL_CHIP_GRID_CLS}>
                    {selectedSystemCellData.stations.slice(0, 1).map((station, index) => (
                      <div key={station.uid ?? index} className={CELL_CHIP_CLS}>
                        {systemStationImage(station) ? <img src={systemStationImage(station)!} alt={systemStationName(station)} className={SHIP_ICON_CLS} /> : null}
                        <div>
                          <strong>{station.name ?? station.uid ?? `Station ${index + 1}`}</strong>
                          <span className="small">{systemStationName(station)}</span>
                          <span className="small">{formatValue(station.owner_name, "No owner")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {showSysShips && selectedSystemCellData?.ships.length ? (
                <div className={CELL_GROUP_CLS}>
                  <span className="small">DroidBrain Ships</span>
                  <div className={CELL_CHIP_GRID_CLS}>
                    {selectedSystemCellData.ships.sort((a, b) => shipClassPriority(a) - shipClassPriority(b)).map((ship, index) => {
                      const iffGlow = ship.public_status === "Friend" ? "sepia(1) hue-rotate(86deg) saturate(600%) brightness(140%)" : ship.public_status === "Enemy" ? "sepia(1) hue-rotate(316deg) saturate(700%) brightness(135%)" : ship.public_status === "Neutral" ? "sepia(1) hue-rotate(226deg) saturate(600%) brightness(145%)" : "opacity(0.7)";
                      return (
                        <div key={ship.uid ?? index} className={CELL_CHIP_CLS}>
                          <img src={resolveLocationShipIcon(ship as any)} alt={ship.class_name ?? "Ship"} className={SHIP_ICON_CLS} style={{ filter: iffGlow }} />
                          <div>
                            <strong className="truncate">{ship.name ?? ship.uid ?? `Ship ${index + 1}`}</strong>
                            {ship.class_name && <span className="small">{ship.class_name}</span>}
                            {ship.owner_name && <span className="small">{ship.owner_name}</span>}
                            {ship.public_status && <span className={`inline-block text-[0.62rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mt-0.5 ${ship.public_status === "Friend" ? "text-green-400 border-green-400/40 bg-green-400/10" : ship.public_status === "Enemy" ? "text-red-400 border-red-400/40 bg-red-400/10" : ship.public_status === "Neutral" ? "text-violet-400 border-violet-400/40 bg-violet-400/10" : "text-white/40 border-white/15 bg-white/5"}`}>{ship.public_status}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {selectedSystemCellData && !selectedSystemCellData.planets.length && !selectedSystemCellData.stations.length && !selectedSystemCellData.ships.length ? (
                <p className="small m-0">Nothing is registered at this coordinate.</p>
              ) : null}
            </>
          }
        />
      ) : null}
    </section>
  );
};

export default MembersUniverseLocationPage;
