import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange } from "../api/auth";
import { canAccessMembers } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import { getStoredSystem, type StoredSystemDetail } from "../api/universe";
import { formatTimestampAsCgt, getCgtTime, type CgtResponse } from "../api/time";
import NotLoggedInState from "../components/common/NotLoggedInState";
import "../styles/main.sass";
import "../styles/_admin.sass";
import "../styles/_membersuniverse.sass";
import "../styles/_sysuniverse.sass";

type UniverseSystemLocationState = {
  fromUniverseMap?: boolean;
  sectorUid?: string | null;
  galx?: number | null;
  galy?: number | null;
};

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

function formatHyperlanePercent(modifier: number | null | undefined, fallback = "Unknown") {
  if (modifier === null || modifier === undefined || Number.isNaN(modifier)) {
    return fallback;
  }

  return `${((1 - modifier) * 100).toFixed(1).replace(/\.0$/, "")}%`;
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

function bestStationImage(station: StoredSystemDetail["stations"][number]): string | null {
  return (
    station.station_type?.icon_url ??
    station.station_type?.images?.small ??
    station.station_type?.image_url ??
    null
  );
}

function firstStationAtCell(stations: StoredSystemDetail["stations"]) {
  return stations[0] ?? null;
}

function countTerrainCells(planet: StoredSystemDetail["planets"][number]) {
  return Array.isArray(planet.terrain_grid) ? planet.terrain_grid.length : 0;
}

function countPlanetCities(planet: StoredSystemDetail["planets"][number]) {
  return Array.isArray(planet.cities) ? planet.cities.length : 0;
}

function formatNumber(value: number | null | undefined, fallback = "Unknown") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value.toLocaleString();
}

function formatPopulationChange(
  current: number | null | undefined,
  previous: number | null | undefined
) {
  if (current === null || current === undefined) {
    return "0";
  }

  if (previous === null || previous === undefined) {
    return "0";
  }

  const delta = current - previous;
  const prefix = delta > 0 ? "+" : "";

  return `${prefix}${delta.toLocaleString()}`;
}

type SystemBodyKind = "sun" | "moon" | "asteroid" | "planet";

function classifySystemBody(planet: StoredSystemDetail["planets"][number]): SystemBodyKind {
  const planetType = String(planet.planet_type_name ?? "").trim().toLowerCase();

  if (planetType === "sun") {
    return "sun";
  }

  if (planetType === "asteroid field") {
    return "asteroid";
  }

  if (planetType === "moon") {
    return "moon";
  }

  return "planet";
}

const MembersUniverseSystemPage: React.FC = () => {
  const { systemIdentifier } = useParams<{ systemIdentifier: string }>();
  const location = useLocation();
  const routeState = (location.state ?? null) as UniverseSystemLocationState | null;
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [canSeeMembers, setCanSeeMembers] = useState(false);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<StoredSystemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cgtState, setCgtState] = useState<CgtResponse | null>(null);
  const [systemZoom, setSystemZoom] = useState(1);
  const [systemOffset, setSystemOffset] = useState({ x: 0, y: 0 });
  const [isDraggingSystem, setIsDraggingSystem] = useState(false);
  const [selectedSystemCell, setSelectedSystemCell] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSystemCell, setHoveredSystemCell] = useState<{
    x: number;
    y: number;
    left: number;
    top: number;
    planets: StoredSystemDetail["planets"];
    stations: StoredSystemDetail["stations"];
  } | null>(null);
  const systemDragRef = useRef<{ x: number; y: number } | null>(null);
  const systemViewportRef = useRef<HTMLDivElement | null>(null);

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
        setCanSeeMembers(canAccessMembers(auth?.user ?? null));
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
          setCanSeeMembers(false);
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
    let cancelled = false;

    (async () => {
      try {
        const response = await getCgtTime();
        if (!cancelled) {
          setCgtState(response);
        }
      } catch {
        if (!cancelled) {
          setCgtState(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
    const viewport = systemViewportRef.current;
    if (!viewport || !detail) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const delta = event.deltaY < 0 ? 0.12 : -0.12;
      const nextZoom = Math.min(3.5, Math.max(0.45, Number((systemZoom + delta).toFixed(2))));

      if (nextZoom === systemZoom) return;

      const worldX = (mouseX - systemOffset.x) / systemZoom;
      const worldY = (mouseY - systemOffset.y) / systemZoom;

      setSystemZoom(nextZoom);
      setSystemOffset({
        x: mouseX - worldX * nextZoom,
        y: mouseY - worldY * nextZoom,
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [detail, systemOffset, systemZoom]);

  useEffect(() => {
    setSystemZoom(1);
    setSystemOffset({ x: 0, y: 0 });
    setSelectedSystemCell(null);
    setHoveredSystemCell(null);
  }, [detail?.system.uid, detail?.system.identifier]);

  const mapCells = useMemo(() => {
    const planets = detail?.planets.filter(
      (planet) => planet.sysx != null && planet.sysy != null
    ) ?? [];
    const stations = detail?.stations.filter(
      (station) => station.sysx != null && station.sysy != null
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
        };
      })
    );
  }, [detail]);

  const selectedCellData = selectedSystemCell
    ? mapCells
        .flat()
        .find((cell) => cell.x === selectedSystemCell.x && cell.y === selectedSystemCell.y) ?? null
    : null;

  const systemSummary = useMemo(() => {
    const planets = detail?.planets ?? [];
    const stations = detail?.stations ?? [];
    const hyperlanes = detail?.hyperlanes ?? [];

    const population = planets.reduce((sum, planet) => sum + (planet.population ?? 0), 0);
    const bodyCounts = planets.reduce(
      (acc, planet) => {
        const kind = classifySystemBody(planet);
        acc[kind] += 1;
        return acc;
      },
      { sun: 0, moon: 0, asteroid: 0, planet: 0 }
    );

    const systemOwner = (detail?.system.owner_name ?? "").trim();
    const owners = new Set(
      [...planets.map((planet) => planet.owner_name), ...stations.map((station) => station.owner_name)]
        .map((value) => (value ?? "").trim())
        .filter(Boolean)
    );

    let ownerSummary = systemOwner || "Unknown";
    if (!systemOwner) {
      if (owners.size === 1) {
        ownerSummary = Array.from(owners)[0] ?? "Unknown";
      } else if (owners.size > 1) {
        ownerSummary = "Mixed";
      }
    }

    return {
      ownerSummary,
      population,
      totalBodies: planets.length,
      planets: bodyCounts.planet,
      moons: bodyCounts.moon,
      suns: bodyCounts.sun,
      asteroids: bodyCounts.asteroid,
      stations: stations.length,
      hyperlanes: hyperlanes.length,
    };
  }, [detail]);

  function resetSystemViewport() {
    setSystemZoom(1);
    setSystemOffset({ x: 0, y: 0 });
  }

  if (!routeState?.fromUniverseMap) {
    return <Navigate to="/members" replace />;
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
          <section className="members-universe-system__hero panel admin-card">
            <div className="members-universe-system__hero-copy">
              <span className="members-universe-system__eyebrow">Astrogation System</span>
              <h1 className="members-universe-system__title">
                {detail?.system.name ??
                  detail?.system.identifier ??
                  formatSwcDisplayId(detail?.system.uid) ??
                  "Unknown system"}
              </h1>
              <p className="members-universe-system__subtitle">
                Stored member-facing system data opened directly from the astrogation chart.
              </p>
              <div className="members-universe-system__hero-meta">
                <span>Chart {formatCoords(detail?.system.galx ?? routeState.galx, detail?.system.galy ?? routeState.galy)}</span>
                <span>
                  Sector{" "}
                  {formatValue(
                    detail?.system.sector_name ??
                      formatSwcDisplayId(detail?.system.sector_uid ?? routeState?.sectorUid)
                  )}
                </span>
              </div>
            </div>

            <div className="members-universe-system__hero-actions">
              <Link
                className="btn"
                to="/members"
                state={{ membersView: "universe" }}
              >
                Back to Astrogation
              </Link>
            </div>
          </section>

          {error ? (
            <p className="small" style={{ color: "salmon" }}>
              {error}
            </p>
          ) : null}

          <section className="members-universe-system__summary">
            <article className="members-universe-system__stat">
              <span className="small">UID</span>
              <strong>{formatSwcDisplayId(detail?.system.uid)}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Identifier</span>
              <strong>{formatValue(detail?.system.identifier)}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Owner</span>
              <strong>{systemSummary.ownerSummary}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Population</span>
              <strong>{formatNumber(systemSummary.population, "0")}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Bodies</span>
              <strong>{systemSummary.totalBodies}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Planets</span>
              <strong>{systemSummary.planets}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Moons</span>
              <strong>{systemSummary.moons}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Suns</span>
              <strong>{systemSummary.suns}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Asteroids</span>
              <strong>{systemSummary.asteroids}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Last Pulled</span>
              <strong>{formatTimestampAsCgt(detail?.system.last_pulled_at, cgtState)}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Stations</span>
              <strong>{systemSummary.stations}</strong>
            </article>
            <article className="members-universe-system__stat">
              <span className="small">Hyperlanes</span>
              <strong>{systemSummary.hyperlanes}</strong>
            </article>
          </section>

          <section className="panel admin-card members-universe-system__immersive">
            <div className="admin-card__header">
              <h3 className="admin-card__title">In-System View</h3>
              <p className="admin-card__desc">
                A top-down 20x20 system grid so you can browse the local system layout the same way as the debug view.
              </p>
            </div>

            <div className="sysuniverse-toolbar">
              <strong>
                Grid{" "}
                {detail?.system.name ??
                  detail?.system.identifier ??
                  formatSwcDisplayId(detail?.system.uid) ??
                  "Unknown system"}
              </strong>
              <div className="sysuniverse-toolbar__actions">
                <span className="small">Zoom: {systemZoom.toFixed(2)}x</span>
                <button className="btn" type="button" onClick={resetSystemViewport}>
                  Reset View
                </button>
              </div>
            </div>

            <p className="small sysuniverse-copy-reset">
              Scroll to zoom, drag to move, and click a coordinate cell to inspect the planets and stations placed there.
            </p>

            <div
              ref={systemViewportRef}
              className={`sysuniverse-map-viewport sysuniverse-map-viewport--system ${isDraggingSystem ? "is-dragging" : ""}`}
              style={{ overscrollBehavior: "contain", touchAction: "none" }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                setIsDraggingSystem(true);
                systemDragRef.current = { x: event.clientX, y: event.clientY };
              }}
              onMouseMove={(event) => {
                if (!isDraggingSystem || !systemDragRef.current) return;
                const dx = event.clientX - systemDragRef.current.x;
                const dy = event.clientY - systemDragRef.current.y;
                systemDragRef.current = { x: event.clientX, y: event.clientY };
                setSystemOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
                setHoveredSystemCell(null);
              }}
              onMouseUp={() => {
                setIsDraggingSystem(false);
                systemDragRef.current = null;
              }}
              onMouseLeave={() => {
                setIsDraggingSystem(false);
                systemDragRef.current = null;
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
                              systemViewportRef.current?.getBoundingClientRect() ?? rect;
                            setHoveredSystemCell({
                              x: cell.x,
                              y: cell.y,
                              left: rect.left - viewportRect.left + rect.width / 2,
                              top: rect.top - viewportRect.top - 10,
                              planets: cell.planets,
                              stations: station ? [station] : [],
                            });
                          }}
                          onMouseLeave={() => {
                            setHoveredSystemCell((current) =>
                              current?.x === cell.x && current?.y === cell.y ? null : current
                            );
                          }}
                          style={{
                            minHeight: 72,
                            borderWidth: `${Math.max(1, 1.15 / Math.max(systemZoom, 0.45))}px`,
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
                                  alt={station.station_type?.name ?? station.type_name ?? station.name ?? "Station"}
                                  className="members-universe-system__grid-cell-station-icon"
                                />
                              ) : null}
                            {station && !bestStationImage(station) ? (
                              <span className="members-universe-system__grid-cell-dot" />
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
                    transform: "translate(-50%, -100%)",
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
                          {station.station_type?.name ?? station.type_name ?? "Unknown type"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {hoveredSystemCell.planets.length === 0 && hoveredSystemCell.stations.length === 0 ? (
                    <span className="small">Empty coordinate</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {selectedCellData ? (
              <div className="members-universe-system__cell-panel">
                <strong>
                  Cell {selectedCellData.x}, {selectedCellData.y}
                </strong>
                {selectedCellData.planets.length > 0 ? (
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

                {selectedCellData.stations.length > 0 ? (
                  <div className="members-universe-system__cell-group">
                    <span className="small">Station</span>
                    <div className="members-universe-system__cell-chip-grid">
                      {selectedCellData.stations.slice(0, 1).map((station, index) => (
                        <div
                          key={`${station.uid ?? station.name ?? index}`}
                          className="members-universe-system__cell-chip"
                        >
                          <div>
                            <strong>{station.name ?? formatSwcDisplayId(station.uid) ?? `Station ${index + 1}`}</strong>
                            <span className="small">
                              {station.station_type?.name ?? station.type_name ?? "Unknown type"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedCellData.planets.length === 0 && selectedCellData.stations.length === 0 ? (
                  <p className="small sysuniverse-copy-reset">Nothing is registered at this coordinate.</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="members-universe-system__layout">
            <article className="panel admin-card members-universe-system__panel members-universe-system__panel--planets">
              <div className="admin-card__header">
                <h3 className="admin-card__title">Celestial Bodies</h3>
                <p className="admin-card__desc">
                  Stored suns, planets, moons, and asteroids linked to this system.
                </p>
              </div>
              <div className="members-universe__meta">
                <span className="admin-badge admin-badge--soft">Planets {systemSummary.planets}</span>
                <span className="admin-badge admin-badge--soft">Moons {systemSummary.moons}</span>
                <span className="admin-badge admin-badge--soft">Suns {systemSummary.suns}</span>
                <span className="admin-badge admin-badge--soft">Asteroids {systemSummary.asteroids}</span>
              </div>
              <div className="members-universe-system__entity-grid">
                {detail?.planets.length ? (
                  detail.planets.map((planet, index) => (
                    <div
                      key={planet.uid ?? planet.identifier ?? planet.name ?? `planet-${index}`}
                      className="members-universe-system__entity-card"
                    >
                      {planet.image_small_url ? (
                        <img
                          className="members-universe-system__entity-image"
                          src={planet.image_small_url}
                          alt={planet.name ?? "Planet"}
                        />
                      ) : (
                        <div className="members-universe-system__entity-image members-universe-system__entity-image--placeholder">
                          Planet
                        </div>
                      )}
                      <strong>{planet.name ?? formatSwcDisplayId(planet.uid) ?? "Unknown planet"}</strong>
                      <span className="small">{formatValue(planet.owner_name, "No owner")}</span>
                      <span className="small">
                        {(() => {
                          const kind = classifySystemBody(planet);
                          return kind.charAt(0).toUpperCase() + kind.slice(1);
                        })()}
                      </span>
                      <div className="members-universe-system__stat-mini-grid">
                        <span className="small">UID: {formatSwcDisplayId(planet.uid)}</span>
                        <span className="small">Identifier: {formatValue(planet.identifier)}</span>
                        <span className="small">Chart: {formatCoords(planet.galx, planet.galy)}</span>
                        <span className="small">System: {formatCoords(planet.sysx, planet.sysy)}</span>
                        <span className="small">Size: {formatValue(planet.size, "?")}</span>
                        <span className="small">Population: {formatNumber(planet.population)}</span>
                        <span className="small">
                          Population change: {formatPopulationChange(planet.population, planet.previous_population)}
                        </span>
                        {planet.previous_population !== null && planet.previous_population_recorded_at ? (
                          <span className="small">
                            Change recorded: {formatTimestampAsCgt(planet.previous_population_recorded_at, cgtState)}
                          </span>
                        ) : null}
                        <span className="small">
                          Surface: {planet.surface_bounds?.width && planet.surface_bounds?.height
                            ? `${planet.surface_bounds.width} x ${planet.surface_bounds.height}`
                            : "Unknown"}
                        </span>
                        <span className="small">
                          Terrain cells: {countTerrainCells(planet) > 0 ? countTerrainCells(planet) : "Unknown"}
                        </span>
                        <span className="small">
                          Cities: {countPlanetCities(planet) > 0 ? countPlanetCities(planet) : "None"}
                        </span>
                      </div>
                      <span className="small">
                        Last pulled {formatTimestampAsCgt(planet.last_pulled_at, cgtState)}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="small">No stored planets.</span>
                )}
              </div>
            </article>

            <article className="panel admin-card members-universe-system__panel members-universe-system__panel--stations">
              <div className="admin-card__header">
                <h3 className="admin-card__title">Stations</h3>
                <p className="admin-card__desc">Stored stations linked to this system.</p>
              </div>
              <div className="members-universe-system__entity-grid">
                {detail?.stations.length ? (
                  detail.stations.map((station, index) => (
                    <div
                      key={station.uid ?? station.identifier ?? station.name ?? `station-${index}`}
                      className="members-universe-system__entity-card"
                    >
                      {station.station_type?.icon_url || station.station_type?.images?.small || station.station_type?.image_url ? (
                        <img
                          className="members-universe-system__entity-image"
                          src={station.station_type?.icon_url ?? station.station_type?.images?.small ?? station.station_type?.image_url ?? ""}
                          alt={station.station_type?.name ?? station.type_name ?? "Station type"}
                        />
                      ) : (
                        <div className="members-universe-system__entity-image members-universe-system__entity-image--placeholder">
                          Station
                        </div>
                      )}
                      <strong>{station.name ?? formatSwcDisplayId(station.uid) ?? "Unknown station"}</strong>
                      <span className="small">
                        {station.station_type?.name ?? station.type_name ?? "Unknown type"}
                      </span>
                      <span className="small">Owner {formatValue(station.owner_name, "None")}</span>
                      <span className="small">System coords {formatCoords(station.sysx, station.sysy)}</span>
                      <span className="small">Length {formatValue(station.station_type?.length, "?")}</span>
                      <span className="small">
                        Last pulled {formatTimestampAsCgt(station.last_pulled_at, cgtState)}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="small">No stored stations.</span>
                )}
              </div>
            </article>

            <article className="panel admin-card members-universe-system__panel members-universe-system__panel--hyperlanes">
              <div className="admin-card__header">
                <h3 className="admin-card__title">Hyperlanes</h3>
                <p className="admin-card__desc">Stored outbound hyperlanes for this system.</p>
              </div>
              <div className="members-universe-system__entity-grid">
                {detail?.hyperlanes.length ? (
                  detail.hyperlanes.map((hyperlane) => (
                    <div
                      key={hyperlane.uid ?? hyperlane.name ?? `${hyperlane.destination_uid}-${hyperlane.destination_name}`}
                      className="members-universe-system__entity-card"
                    >
                      <strong>{hyperlane.name ?? "Unnamed hyperlane"}</strong>
                      <span className="small">
                        {hyperlane.destination_name ??
                          formatSwcDisplayId(hyperlane.destination_uid) ??
                          "Unknown destination"}
                      </span>
                      <span className="small">Destination {formatCoords(hyperlane.destination_galx, hyperlane.destination_galy)}</span>
                      <span className="small">Owner {formatValue(hyperlane.owner_name, "Unknown")}</span>
                      <span className="small">Speed Modifier {formatHyperlanePercent(hyperlane.modifier, "?")}</span>
                      <span className="small">Blocks {formatValue(hyperlane.blocks, "Unknown")}</span>
                    </div>
                  ))
                ) : (
                  <span className="small">No stored hyperlanes.</span>
                )}
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
};

export default MembersUniverseSystemPage;
