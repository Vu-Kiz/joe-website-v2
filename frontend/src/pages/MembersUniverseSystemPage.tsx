import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange } from "../api/auth";
import { canAccessDroidBrainFull, canAccessMembers, canAccessPublicTools } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import { getStoredSystem, type StoredSystemDetail } from "../api/universe";
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
import "../styles/main.sass";
import "../styles/_admin.sass";
import "../styles/_membersuniverse.sass";
import "../styles/_sysuniverse.sass";

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

function resolveShipMapIcon(ship: StoredSystemDetail["ships"][number]): string {
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
    const ships = detail?.ships.filter(
      (ship) => ship.sysx != null && ship.sysy != null
    ) ?? [];

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
  }, [detail]);

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
          <main className="board admin-board">
            <h1>System Detail</h1>
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
          <main className="board admin-board">
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
          <main className="board admin-board">
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
        <main className="board admin-board members-universe-system-page">
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
              <div className="sysuniverse-toolbar">
                <div className="sysuniverse-toolbar__actions">
                  {canSeeDroidBrainShips && (detail?.ships.length ?? 0) > 0 ? (
                    <button
                      className={`btn members-universe-system__layer-toggle ${showDroidBrainShips ? "is-active" : ""}`}
                      type="button"
                      onClick={() => setShowDroidBrainShips((value) => !value)}
                    >
                      DroidBrain Ships
                    </button>
                  ) : null}
                  <span className="small">Zoom: {systemZoom.toFixed(2)}x</span>
                  <button className="btn" type="button" onClick={resetSystemViewport}>
                    Reset View
                  </button>
                </div>
              </div>
            }
            copy="Scroll to zoom, drag to move, and click a coordinate cell to inspect the planets and stations placed there."
            viewport={
              <div
                ref={systemViewportRef}
                className={`sysuniverse-map-viewport sysuniverse-map-viewport--system ${isDraggingSystem ? "is-dragging" : ""}`}
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
                  className="sysuniverse-map-canvas"
                  style={{
                    transform: `translate(${systemOffset.x}px, ${systemOffset.y}px) scale(${systemZoom})`,
                  }}
                >
                  {mapCells.map((row, rowIndex) => (
                    <div
                      key={`member-sys-row-${rowIndex}`}
                      className="sysuniverse-grid-row"
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
                            className={`btn members-universe-system__grid-cell ${occupancy > 0 ? "has-content" : ""} ${isSelected ? "is-active" : ""}`}
                            type="button"
                            onClick={() => setSelectedSystemCell({ x: cell.x, y: cell.y })}
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
                            <div className="members-universe-system__grid-cell-body">
                              {cell.planets.slice(0, 1).map((planet) =>
                                bestPlanetImage(planet) ? (
                                  <img
                                    key={`member-planet-preview-${planet.uid ?? planet.name}`}
                                    src={bestPlanetImage(planet) ?? ""}
                                    alt={planet.name ?? planet.uid ?? "Planet"}
                                    className="members-universe-system__grid-cell-thumb"
                                  />
                                ) : null
                              )}
                              {station && bestStationImage(station) ? (
                                  <img
                                    key={`member-station-preview-${station.uid ?? station.name}`}
                                    src={bestStationImage(station) ?? ""}
                                    alt={stationTypeName(station)}
                                    className="members-universe-system__grid-cell-station-icon"
                                  />
                                ) : null}
                              {station && !bestStationImage(station) ? (
                                <span className="members-universe-system__grid-cell-dot" />
                              ) : null}
                              {showDroidBrainShips && cell.ships[0] ? (
                                <img
                                  key={`member-ship-preview-${cell.ships[0].uid ?? cell.ships[0].name}`}
                                  src={resolveShipMapIcon(cell.ships[0])}
                                  alt={cell.ships[0].class_name ?? cell.ships[0].type_name ?? cell.ships[0].name ?? "Ship"}
                                  className="members-universe-system__grid-cell-ship-icon"
                                />
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {hoveredSystemCell ? (
                  <div
                    className="members-universe-system__grid-hover"
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
                      <div className="members-universe-system__grid-hover-group">
                        <span className="small members-universe-system__grid-hover-label">Planet</span>
                        {hoveredSystemCell.planets.slice(0, 3).map((planet, index) => (
                          <span key={`${planet.uid ?? planet.name ?? index}`} className="small">
                            {planet.name ?? formatSwcDisplayId(planet.uid) ?? `Planet ${index + 1}`}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {hoveredSystemCell.stations.length > 0 ? (
                      <div className="members-universe-system__grid-hover-group">
                        <span className="small members-universe-system__grid-hover-label">Station</span>
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
                      <div className="members-universe-system__grid-hover-group">
                        <span className="small members-universe-system__grid-hover-label">Ship</span>
                        {hoveredSystemCell.ships.slice(0, 3).map((ship, index) => (
                          <span key={`${ship.uid ?? ship.name ?? index}`} className="small">
                            {ship.name ?? formatSwcDisplayId(ship.uid) ?? `Ship ${index + 1}`}
                            {ship.class_name ? ` · ${ship.class_name}` : ""}
                          </span>
                        ))}
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
                <div className="members-universe-system__selection-head">
                  <span className="members-universe-system__selection-label">Selected Location</span>
                  <strong>
                    {selectedCellData ? `${selectedCellData.x}, ${selectedCellData.y}` : "None"}
                  </strong>
                </div>

                {!selectedCellData ? (
                  <p className="small sysuniverse-copy-reset">
                    Click a coordinate on the system chart to inspect what is registered there.
                  </p>
                ) : null}

                {selectedCellData?.planets.length ? (
                  <div className="members-universe-system__cell-group">
                    <span className="small">Planets</span>
                    <div className="members-universe-system__cell-chip-grid">
                      {selectedCellData.planets.map((planet, index) => (
                        <div
                          key={`${planet.uid ?? planet.name ?? index}`}
                          className="members-universe-system__cell-chip"
                        >
                          {bestPlanetImage(planet) ? (
                            <img
                              src={bestPlanetImage(planet) ?? ""}
                              alt={planet.name ?? planet.uid ?? "Planet"}
                              className="sysuniverse-planet-preview__thumb"
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
                  <div className="members-universe-system__cell-group">
                    <span className="small">Stations</span>
                    <div className="members-universe-system__cell-chip-grid">
                      {selectedCellData.stations.slice(0, 1).map((station, index) => (
                        <div
                          key={`${station.uid ?? station.name ?? index}`}
                          className="members-universe-system__cell-chip"
                        >
                          {bestStationImage(station) ? (
                            <img
                              src={bestStationImage(station) ?? ""}
                              alt={stationTypeName(station)}
                              className="members-universe-system__selection-ship-icon"
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

                {showDroidBrainShips && selectedCellData?.ships.length ? (
                  <div className="members-universe-system__cell-group">
                    <span className="small">DroidBrain Ships</span>
                    <div className="members-universe-system__cell-chip-grid">
                      {selectedCellData.ships.map((ship, index) => (
                        <div
                          key={`${ship.uid ?? ship.name ?? index}`}
                          className="members-universe-system__cell-chip"
                        >
                          <img
                            src={resolveShipMapIcon(ship)}
                            alt={ship.class_name ?? ship.type_name ?? ship.name ?? "Ship"}
                            className="members-universe-system__selection-ship-icon"
                          />
                          <div>
                            <strong>{ship.name ?? formatSwcDisplayId(ship.uid) ?? `Ship ${index + 1}`}</strong>
                            <span className="small">
                              {ship.class_name ?? ship.type_name ?? "Unknown class"}
                            </span>
                            <span className="small">{formatValue(ship.owner_name, "No owner")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedCellData &&
                selectedCellData.planets.length === 0 &&
                selectedCellData.stations.length === 0 &&
                selectedCellData.ships.length === 0 ? (
                  <p className="small sysuniverse-copy-reset">Nothing is registered at this coordinate.</p>
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
