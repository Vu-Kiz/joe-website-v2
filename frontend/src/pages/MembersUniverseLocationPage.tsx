import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange } from "../api/core/auth";
import { getStoredLocation, type StoredLocationDetail } from "../api/universe/universe";
import { canAccessAdmin, canAccessDroidBrainFull, canAccessMembers, canAccessPublicTools } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import BBCodeView from "../components/bbcode/BBCodeView";
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
import { BTN, BTN_SM } from "../utils/ui";

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
const META_CLS = "flex gap-3 flex-wrap";
const LOCATION_STACK_CLS = "grid gap-[0.6rem]";
const LOCATION_LINE_CLS = "grid gap-[0.18rem]";
const filterPillCls = (active: boolean) =>
  "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[0.82rem] font-bold cursor-pointer appearance-none transition-[border-color,background,color] duration-[140ms]" +
  (active
    ? " border-[rgba(246,163,0,0.65)] bg-[rgba(246,163,0,0.18)] text-white/[0.98]"
    : " border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]");
const SHIP_CARD_CLS = "grid gap-[0.35rem]";
const LOCATION_NOTE_CLS = "grid gap-[0.4rem] pt-[0.2rem] border-t border-t-white/[0.08]";

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

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatCoords(x: number | null | undefined, y: number | null | undefined) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return "Unknown";
  }

  return `${x}, ${y}`;
}

function formatValue(value: string | number | null | undefined, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

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

function resolveLocationGridX(
  item: Pick<StoredLocationDetail["ships"][number], "sysx" | "surfx">
) {
  return Number.isFinite(item.surfx) ? Number(item.surfx) : Number(item.sysx);
}

function resolveLocationGridY(
  item: Pick<StoredLocationDetail["ships"][number], "sysy" | "surfy">
) {
  return Number.isFinite(item.surfy) ? Number(item.surfy) : Number(item.sysy);
}

function resolveLocationShipIcon(ship: StoredLocationDetail["ships"][number]): string {
  const normalizedClass = String(ship.class_name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const classIconMap: Record<string, string> = {
    bomber: ShipIconBomber,
    capital: ShipIconCapital,
    cargo: ShipIconCargo,
    fighter: ShipIconFighter,
    frigate: ShipIconFrigate,
    gunboat: ShipIconGunboat,
    hfreighter: ShipIconHFreighter,
    lfreighter: ShipIconLFreighter,
    sat: ShipIconSat,
    super: ShipIconSuper,
    vette: ShipIconVette,
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

function resolveLocationShipRole(ship: StoredLocationDetail["ships"][number]): string {
  const normalizedClass = String(ship.class_name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const classLabelMap: Record<string, string> = {
    bomber: "Bomber",
    capital: "Capital",
    cargo: "Cargo",
    fighter: "Fighter",
    frigate: "Frigate",
    gunboat: "Gunboat",
    hfreighter: "Heavy Freighter",
    lfreighter: "Light Freighter",
    sat: "Satellite",
    super: "Super Capital",
    vette: "Corvette",
    wreck: "Wreck",
  };

  if (normalizedClass && classLabelMap[normalizedClass]) {
    return classLabelMap[normalizedClass];
  }

  const text = `${ship.class_name ?? ""} ${ship.type_name ?? ""} ${ship.name ?? ""}`.toLowerCase();

  if (text.includes("wreck")) return "Wreck";
  if (text.includes("sat") || text.includes("satellite") || text.includes("probe")) return "Satellite";
  if (text.includes("super")) return "Super Capital";
  if (
    text.includes("capital") ||
    text.includes("dreadnaught") ||
    text.includes("destroyer") ||
    text.includes("battlecruiser") ||
    text.includes("carrier") ||
    text.includes("cruiser") ||
    text.includes("bulk cruiser")
  ) return "Capital";
  if (text.includes("frigate")) return "Frigate";
  if (text.includes("corvette") || text.includes("vette")) return "Corvette";
  if (text.includes("gunboat")) return "Gunboat";
  if (text.includes("bomber")) return "Bomber";
  if (text.includes("fighter") || text.includes("interceptor") || text.includes("starfighter")) return "Fighter";
  if (text.includes("heavy freighter")) return "Heavy Freighter";
  if (text.includes("light freighter")) return "Light Freighter";
  if (
    text.includes("cargo") ||
    text.includes("transport") ||
    text.includes("freighter") ||
    text.includes("yt-") ||
    text.includes("action ")
  ) return "Cargo";

  return "Ship";
}

function resolveLocationStationIcon(station: StoredLocationDetail["stations"][number]): string {
  return station.icon_url ?? station.image_url ?? StationsDuelcon;
}

function resolveLocationShipTitle(ship: StoredLocationDetail["ships"][number], index: number): string {
  const trimmedName = String(ship.name ?? "").trim();
  if (trimmedName && trimmedName.toLowerCase() !== "[no name]") {
    return trimmedName;
  }

  return ship.type_name ?? ship.class_name ?? ship.uid ?? `Ship ${index + 1}`;
}

const MembersUniverseLocationPage: React.FC = () => {
  const { galx, galy } = useParams<{ galx: string; galy: string }>();
  const location = useLocation();
  const routeState = (location.state ?? null) as UniverseLocationRouteState | null;
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [canSeeMembers, setCanSeeMembers] = useState(false);
  const [isSysadmin, setIsSysadmin] = useState(false);
  const [canSeeDroidBrain, setCanSeeDroidBrain] = useState(false);
  const [showDroidBrainIntel, setShowDroidBrainIntel] = useState(false);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
  const [detail, setDetail] = useState<StoredLocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationCell, setSelectedLocationCell] = useState<{ x: number; y: number } | null>(null);
  const [selectedShipRoleFilter, setSelectedShipRoleFilter] = useState<string | null>(null);
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
      setSelectedShipRoleFilter(null);
      setShowDroidBrainIntel(false);
      setHoveredLocationCell(null);
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
        setIsSysadmin(!!auth?.user?.is_sysadmin);
        setCanSeeDroidBrain(
          canAccessDroidBrainFull(auth?.user ?? null) || canAccessAdmin(auth?.user ?? null)
        );
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
          setCanSeeMembers(false);
          setIsSysadmin(false);
          setCanSeeDroidBrain(false);
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

    if (
      !isLoggedIn ||
      !canSeeMembers ||
      !Number.isFinite(parsedGalx) ||
      !Number.isFinite(parsedGaly)
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getStoredLocation(parsedGalx, parsedGaly);

        if (!cancelled) {
          setDetail(response.data ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setDetail(null);
          setError(e?.message ?? "Failed to load stored location.");
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
  }, [authChecked, canSeeMembers, isLoggedIn, parsedGalx, parsedGaly]);

  const intelPills = useMemo(() => {
    if (!detail?.search_record) {
      return [];
    }

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

  const mapCells = useMemo(() => {
    const asteroidMask = detail?.asteroid_field?.mask ?? null;
    const stations = detail?.stations
      .map((station) => ({
        ...station,
        placementX: resolveLocationGridX(station),
        placementY: resolveLocationGridY(station),
      }))
      .filter((station) => Number.isFinite(station.placementX) && Number.isFinite(station.placementY)) ?? [];
    const ships = detail?.ships
      .map((ship) => ({
        ...ship,
        placementX: resolveLocationGridX(ship),
        placementY: resolveLocationGridY(ship),
      }))
      .filter((ship) => Number.isFinite(ship.placementX) && Number.isFinite(ship.placementY)) ?? [];

    return Array.from({ length: LOCATION_GRID_SIZE }, (_, rowIndex) =>
      Array.from({ length: LOCATION_GRID_SIZE }, (_, colIndex) => {
        const x = colIndex;
        const y = rowIndex;

        return {
          x,
          y,
          hasAsteroid: !!asteroidMask?.[y]?.[x],
          stations: stations.filter(
            (station) => Number(station.placementX) === x && Number(station.placementY) === y
          ),
          ships: ships.filter(
            (ship) => Number(ship.placementX) === x && Number(ship.placementY) === y
          ),
        };
      })
    );
  }, [detail]);

  const selectedCellData = selectedLocationCell
    ? mapCells
        .flat()
        .find((cell) => cell.x === selectedLocationCell.x && cell.y === selectedLocationCell.y) ?? null
    : null;
  const selectedShipRoleGroups = selectedCellData
    ? Array.from(
        selectedCellData.ships.reduce((groups, ship) => {
          const role = resolveLocationShipRole(ship);
          groups.set(role, (groups.get(role) ?? 0) + 1);
          return groups;
        }, new Map<string, number>())
      ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    : [];
  const filteredSelectedShips = selectedCellData?.ships.filter((ship) =>
    !selectedShipRoleFilter || resolveLocationShipRole(ship) === selectedShipRoleFilter
  ) ?? [];

  useEffect(() => {
    setSelectedShipRoleFilter(null);
  }, [selectedLocationCell?.x, selectedLocationCell?.y]);

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
      <div className="flex mb-4">
        <Link className={BTN_SM} to="/tools">
          Back To Tools Overview
        </Link>
      </div>

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
        copy="Scroll to zoom, drag to move, and inspect the stored chart square the same way as the system view."
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
                style={{
                  transform: `translate(${locationOffset.x}px, ${locationOffset.y}px) scale(${locationZoom})`,
                }}
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
                      const isSelected =
                        selectedLocationCell?.x === cell.x && selectedLocationCell?.y === cell.y;

                      return (
                        <button
                          key={`location-cell-${cell.x}-${cell.y}`}
                          className={gridCellCls(cell.hasAsteroid, occupancy > 0, isSelected)}
                          type="button"
                          onClick={() => setSelectedLocationCell({ x: cell.x, y: cell.y })}
                          onMouseEnter={(event) => {
                            if (isDraggingLocation) return;
                            const rect = event.currentTarget.getBoundingClientRect();
                            const viewportRect =
                              locationViewportEl?.getBoundingClientRect() ?? rect;
                            const cellCenterX = rect.left - viewportRect.left + rect.width / 2;
                            const tooltipHalfWidth = LOCATION_TOOLTIP_WIDTH_ESTIMATE / 2;
                            const maxLeft =
                              viewportRect.width - LOCATION_TOOLTIP_MARGIN - tooltipHalfWidth;
                            const minLeft = LOCATION_TOOLTIP_MARGIN + tooltipHalfWidth;
                            const clampedLeft = Math.min(maxLeft, Math.max(minLeft, cellCenterX));
                            const preferredTop = rect.top - viewportRect.top - 10;
                            const canRenderAbove =
                              preferredTop - LOCATION_TOOLTIP_HEIGHT_ESTIMATE >= LOCATION_TOOLTIP_MARGIN;
                            const tooltipTop = canRenderAbove
                              ? preferredTop
                              : rect.bottom - viewportRect.top + 10;
                            setHoveredLocationCell({
                              x: cell.x,
                              y: cell.y,
                              left: clampedLeft,
                              top: tooltipTop,
                              transform: canRenderAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                              hasAsteroid: cell.hasAsteroid,
                              stations: cell.stations,
                              ships: canSeeDroidBrain ? cell.ships : [],
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
                            {canSeeDroidBrain && showDroidBrainIntel
                              ? cell.ships.slice(0, 1).map((ship, index) => (
                                  <img
                                    key={`${ship.uid ?? ship.name ?? index}-ship`}
                                    src={resolveLocationShipIcon(ship)}
                                    alt={ship.class_name ?? ship.type_name ?? ship.name ?? "Ship"}
                                    className={GRID_CELL_SHIP_CLS}
                                  />
                                ))
                              : null}
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
                  <strong>
                    {hoveredLocationCell.x}, {hoveredLocationCell.y}
                  </strong>
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
                  {showDroidBrainIntel && hoveredLocationCell.ships.length > 0 ? (
                    <div className={GRID_HOVER_GROUP_CLS}>
                      <span className={`small ${GRID_HOVER_LABEL_CLS}`}>Ship</span>
                      <span className="small">
                        {hoveredLocationCell.ships.length} ship{hoveredLocationCell.ships.length === 1 ? "" : "s"}
                      </span>
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

            <div className={CELL_PANEL_CLS}>
              <div className={CELL_GROUP_CLS}>
                <span className="small">Sector</span>
                <strong>{detail?.location.sector_name ?? routeState?.sectorUid ?? "Unknown Sector"}</strong>
              </div>
              <div className={CELL_GROUP_CLS}>
                <span className="small">Primary Label</span>
                <strong>{heading}</strong>
              </div>
              {detail?.location.within_scan_window ? (
                <div className={META_CLS}>
                  <span className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]">Within Scan Window</span>
                </div>
              ) : null}
              {intelPills.length > 0 ? (
                <div className={META_CLS}>
                  {intelPills.map((pill) => (
                    <span key={pill} className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]">
                      {pill}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {detail?.systems.length ? (
              <div className={CELL_PANEL_CLS}>
                <div className={CELL_GROUP_CLS}>
                  <span className="small">Systems At This Location</span>
                  <div className={CELL_CHIP_GRID_CLS}>
                    {detail.systems.map((system, index) => (
                      <div
                        key={`${system.uid ?? system.name ?? index}`}
                        className={CELL_CHIP_CLS}
                      >
                        <img
                          src={SystemIcon}
                          alt={system.name ?? system.identifier ?? system.uid ?? "System"}
                          className={SHIP_ICON_CLS}
                        />
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

            <div className={CELL_PANEL_CLS}>
              <div className={CELL_GROUP_CLS}>
                <span className="small">Location Intel</span>
                {detail?.search_record ? (
                  <div className={LOCATION_STACK_CLS}>
                    {detail.search_record.square_name ? (
                      <div className={LOCATION_LINE_CLS}>
                        <span className="small">Label</span>
                        <strong>{detail.search_record.square_name}</strong>
                      </div>
                    ) : null}
                    {detail.search_record.asteroid_uid ? (
                      <div className={LOCATION_LINE_CLS}>
                        <span className="small">Asteroid UID</span>
                        <strong>{detail.search_record.asteroid_uid}</strong>
                      </div>
                    ) : null}
                    {detail.search_record.handle ? (
                      <div className={LOCATION_LINE_CLS}>
                        <span className="small">Recorded By</span>
                        <strong>{detail.search_record.handle}</strong>
                      </div>
                    ) : null}
                    {detail.search_record.legacy_recorded_at ? (
                      <div className={LOCATION_LINE_CLS}>
                        <span className="small">Recorded</span>
                        <strong>{formatTimestamp(detail.search_record.legacy_recorded_at)}</strong>
                      </div>
                    ) : null}
                    {detail.search_record.rescan_due_at ? (
                      <div className={LOCATION_LINE_CLS}>
                        <span className="small">Rescan Due</span>
                        <strong>{formatTimestamp(detail.search_record.rescan_due_at)}</strong>
                      </div>
                    ) : null}
                    {isSysadmin && detail.asteroid_field ? (
                      <div className={LOCATION_LINE_CLS}>
                        <span className="small">Asteroid Grid Source</span>
                        <strong>
                          {detail.asteroid_field.object_name
                            ?? detail.asteroid_field.object_type
                            ?? "XML fieldString"}
                          {detail.asteroid_field.snapshot_unixtime
                            ? ` · ${formatTimestamp(new Date(detail.asteroid_field.snapshot_unixtime * 1000).toISOString())}`
                            : ""}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="small">No stored asteroid or scan record for this chart location.</p>
                )}
              </div>

              {detail?.annotation?.notes ? (
                <div className={LOCATION_NOTE_CLS}>
                  <span className="small">Location Note</span>
                  <BBCodeView value={detail.annotation.notes} className="small leading-[1.55] text-white/[0.82] whitespace-normal [&_p]:m-0 [&_p+p]:mt-[0.45rem]" />
                </div>
              ) : null}
            </div>

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
                    <div
                      key={`${station.uid ?? station.name ?? index}`}
                      className={CELL_CHIP_CLS}
                    >
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
                <span className="small">DroidBrain Ships</span>
                {selectedShipRoleGroups.length ? (
                  <div className={META_CLS}>
                    {selectedShipRoleGroups.map(([role, count]) => (
                      <button
                        key={role}
                        type="button"
                        className={filterPillCls(selectedShipRoleFilter === role)}
                        onClick={() =>
                          setSelectedShipRoleFilter((current) => (current === role ? null : role))
                        }
                      >
                        {role}
                        {count > 1 ? ` x${count}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!selectedShipRoleFilter ? (
                  <p className="small">Click a ship-type pill to expand that ship list.</p>
                ) : null}
                {selectedShipRoleFilter ? (
                  <div className={CELL_CHIP_GRID_CLS}>
                    {filteredSelectedShips.map((ship, index) => (
                      <div key={`${ship.uid ?? ship.name ?? index}`} className={CELL_CHIP_CLS}>
                        <img
                          src={resolveLocationShipIcon(ship)}
                          alt={ship.class_name ?? ship.type_name ?? ship.name ?? "Ship"}
                          className={SHIP_ICON_CLS}
                        />
                        <div className={SHIP_CARD_CLS}>
                          <strong>{resolveLocationShipTitle(ship, index)}</strong>
                          <div className={META_CLS}>
                            <span className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]">
                              {resolveLocationShipRole(ship)}
                            </span>
                            {ship.type_name ? (
                              <span className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold border-[#78b4ff]/30 bg-[#78b4ff]/10 text-[#b9d8ff]">
                                {ship.type_name}
                              </span>
                            ) : null}
                          </div>
                          {ship.uid ? (
                            <span className="small">
                              UID: {ship.uid}
                            </span>
                          ) : null}
                          <span className="small">
                            Owner: {formatValue(ship.owner_name, "No owner")}
                          </span>
                          <span className="small">
                            Position: {formatLocationLine(ship)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedShipRoleFilter && filteredSelectedShips.length === 0 ? (
                  <p className="small">No ships in this coordinate match `{selectedShipRoleFilter}`.</p>
                ) : null}
              </div>
            ) : null}

            {selectedCellData &&
            !selectedCellData.hasAsteroid &&
            (!showDroidBrainIntel ||
              (selectedCellData.stations.length === 0 &&
                selectedCellData.ships.length === 0)) ? (
              <p className="small m-0">Nothing is registered at this coordinate.</p>
            ) : null}
          </>
        }
      />
    </section>
  );
};

export default MembersUniverseLocationPage;
