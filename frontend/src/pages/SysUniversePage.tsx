import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuthMe, type SwcUser } from "../api/auth";
import {
  getSectorCellAnnotations,
  runUniversePull,
  saveSectorCellAnnotation,
  type SectorCellAnnotation,
} from "../api/sysDebug";
import SectorGridMap from "../components/maps/SectorGridMap";
import NotLoggedInState from "../components/common/NotLoggedInState";
import "../styles/main.sass";
import "../styles/_admin.sass";
import "../styles/_sysuniverse.sass";

type UniverseResource = "system" | "sector" | "planet" | "station";
type UniverseTrailItem = {
  resource: UniverseResource;
  identifier: string;
};
type ExplorerSection = "visualizer" | "navigation" | "payload";

const pretty = (value: any) => JSON.stringify(value, null, 2);

function bestPlanetImage(planet: any): string | null {
  return (
    planet?.image_small_url ??
    planet?.image_large_url ??
    planet?.image_atmosphere_url ??
    planet?.image_stratosphere_url ??
    planet?.image_loworbit_url ??
    null
  );
}

function terrainColor(point: any): string {
  const code = String(point?.code ?? "").toLowerCase();
  const name = String(point?.name ?? "").toLowerCase();

  if (code === "b" || name.includes("desert")) return "#9a7b44";
  if (code === "j" || name.includes("rock")) return "#5f5a57";
  if (code === "n" || name.includes("cave")) return "#2d2a32";
  if (name.includes("forest")) return "#3d6b3d";
  if (name.includes("water") || name.includes("ocean")) return "#275f8d";
  if (name.includes("ice")) return "#89a8c8";
  if (name.includes("mount")) return "#7a6a60";

  return "#4a4a4a";
}

const SysUniversePage: React.FC = () => {
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [pullResource, setPullResource] = useState<UniverseResource>("sector");
  const [pullIdentifier, setPullIdentifier] = useState("Arkanis");
  const [persistPull, setPersistPull] = useState(false);
  const [deepPersistPull, setDeepPersistPull] = useState(false);
  const [trail, setTrail] = useState<UniverseTrailItem[]>([]);
  const [activeSection, setActiveSection] = useState<ExplorerSection>("visualizer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [persistenceSummary, setPersistenceSummary] = useState<any | null>(null);
  const [sectorAnnotations, setSectorAnnotations] = useState<SectorCellAnnotation[]>([]);
  const [systemZoom, setSystemZoom] = useState(1);
  const [systemOffset, setSystemOffset] = useState({ x: 0, y: 0 });
  const [isDraggingSystem, setIsDraggingSystem] = useState(false);
  const [planetZoom, setPlanetZoom] = useState(1);
  const [planetOffset, setPlanetOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPlanet, setIsDraggingPlanet] = useState(false);
  const [selectedPlanetCell, setSelectedPlanetCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedSystemCell, setSelectedSystemCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const systemDragRef = useRef<{ x: number; y: number } | null>(null);
  const planetDragRef = useRef<{ x: number; y: number } | null>(null);
  const systemViewportRef = useRef<HTMLDivElement | null>(null);
  const planetViewportRef = useRef<HTMLDivElement | null>(null);
  const resource = result?.resource as UniverseResource | undefined;
  const sectorSystems = Array.isArray(result?.systems) ? result.systems : [];
  const sectorOutlineCoordinates = Array.isArray(result?.outline_coordinates)
    ? result.outline_coordinates
    : Array.isArray(result?.coordinates)
      ? result.coordinates
      : [];
  const sectorBounds = result?.bounds as
    | {
        min_galx: number;
        max_galx: number;
        min_galy: number;
        max_galy: number;
        width: number;
        height: number;
      }
    | null
    | undefined;

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPageLoading(true);
        const authRes = await fetchAuthMe();

        if (cancelled) return;

        setViewer(authRes.user);
        setPageError(null);
      } catch (e: any) {
        if (!cancelled) {
          setViewer(null);
          setPageError(e?.message ?? "Failed to load galaxy explorer.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (resource !== "sector" || !result?.sector?.uid) {
      setSectorAnnotations([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await getSectorCellAnnotations(String(result.sector.uid));
        if (!cancelled) {
          setSectorAnnotations(response.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setSectorAnnotations([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resource, result?.sector?.uid]);

  React.useEffect(() => {
    const viewport = systemViewportRef.current;
    if (!viewport || resource !== "system") return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const delta = event.deltaY < 0 ? 0.12 : -0.12;
      const nextZoom = Math.min(
        3.5,
        Math.max(0.45, Number((systemZoom + delta).toFixed(2)))
      );

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
  }, [resource, result, systemZoom, systemOffset]);

  React.useEffect(() => {
    const viewport = planetViewportRef.current;
    if (!viewport || resource !== "planet") return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const delta = event.deltaY < 0 ? 0.12 : -0.12;
      const nextZoom = Math.min(
        4,
        Math.max(0.45, Number((planetZoom + delta).toFixed(2)))
      );

      if (nextZoom === planetZoom) return;

      const worldX = (mouseX - planetOffset.x) / planetZoom;
      const worldY = (mouseY - planetOffset.y) / planetZoom;

      setPlanetZoom(nextZoom);
      setPlanetOffset({
        x: mouseX - worldX * nextZoom,
        y: mouseY - worldY * nextZoom,
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [resource, result, planetZoom, planetOffset]);

  async function runPull(resource: UniverseResource, identifier: string) {
    const nextIdentifier = identifier.trim();

    if (!nextIdentifier) {
      setError("Identifier is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await runUniversePull({
        resource,
        identifier: nextIdentifier,
        persist: persistPull,
        deep: persistPull ? deepPersistPull : false,
      });

      setPullResource(resource);
      setPullIdentifier(nextIdentifier);
      setResult(res.data);
      setPersistenceSummary(res.persistence ?? null);
      setTrail((prev) => [...prev, { resource, identifier: nextIdentifier }]);
      setActiveSection("visualizer");
      setSelectedSystemCell(null);
      setSelectedPlanetCell(null);
      if (resource === "system") {
        setSystemZoom(1);
        setSystemOffset({ x: 0, y: 0 });
      } else if (resource === "planet") {
        setPlanetZoom(1);
        setPlanetOffset({ x: 0, y: 0 });
      }
    } catch (e: any) {
      setError(e?.message ?? "Galaxy pull failed.");
    } finally {
      setLoading(false);
    }
  }

  function resetTrail() {
    setTrail([]);
  }

  function resetSystemViewport() {
    setSystemZoom(1);
    setSystemOffset({ x: 0, y: 0 });
  }

  function resetPlanetViewport() {
    setPlanetZoom(1);
    setPlanetOffset({ x: 0, y: 0 });
  }

  async function onSubmit() {
    await runPull(pullResource, pullIdentifier);
  }

  function renderValue(label: string, value: React.ReactNode) {
    return (
      <div className="sysuniverse-card">
        <span className="small sysuniverse-muted">
          {label}
        </span>
        <strong>{value || "Unknown"}</strong>
      </div>
    );
  }

  function renderActionButton(
    label: string,
    nextResource: UniverseResource,
    identifier?: string | null
  ) {
    const nextIdentifier = (identifier ?? "").trim();
    if (!nextIdentifier) return null;

    return (
      <button
        className="btn"
        type="button"
        onClick={() => runPull(nextResource, nextIdentifier)}
      >
        {label}
      </button>
    );
  }

  function renderSectorVisualizer() {
    if (resource !== "sector") return null;
    const systems = sectorSystems;

    return (
      <div className="sysuniverse-stack">
        <div className="sysuniverse-stat-grid">
          {renderValue("Sector", result?.sector?.name ?? result?.sector?.uid ?? pullIdentifier)}
          {renderValue("UID", result?.sector?.uid ?? "Unknown")}
          {renderValue("Systems Returned", systems.length)}
          {renderValue(
            "Grid Size",
            sectorBounds ? `${sectorBounds.width} x ${sectorBounds.height}` : "Unknown"
          )}
        </div>

        <SectorGridMap
          bounds={sectorBounds}
          outlineCoordinates={sectorOutlineCoordinates}
          systems={systems}
          annotations={sectorAnnotations}
          color={result?.sector}
          onSystemSelect={(identifier) => runPull("system", identifier)}
          onSaveAnnotation={async (payload) => {
            if (!result?.sector?.uid) return;

            const response = await saveSectorCellAnnotation({
              sector_uid: String(result.sector.uid),
              ...payload,
            });

            setSectorAnnotations((prev) => {
              const key = `${payload.galx}:${payload.galy}`;
              const remaining = prev.filter((entry) => `${entry.galx}:${entry.galy}` !== key);

              return response.data ? [...remaining, response.data] : remaining;
            });
          }}
        />

        <details className="sysuniverse-card sysuniverse-card--foldout">
          <summary>System List</summary>
          <p className="small sysuniverse-copy-reset">
            Keep the flat list too, in case you want to jump by name instead of coordinates.
          </p>
          <div className="sysuniverse-chip-row">
            {systems.slice(0, 80).map((system: any, index: number) => (
              <button
                key={`${system.uid ?? system.name ?? index}`}
                className="btn"
                type="button"
                onClick={() =>
                  runPull(
                    "system",
                    system.identifier ?? system.uid ?? system.name ?? ""
                  )
                }
              >
                {system.name ?? system.uid ?? `System ${index + 1}`}
                {system.galx != null && system.galy != null
                  ? ` (${system.galx}, ${system.galy})`
                  : ""}
              </button>
            ))}
          </div>
        </details>
      </div>
    );
  }

  function renderSystemVisualizer() {
    if (resource !== "system") return null;

    const planets = Array.isArray(result?.planet_stubs) ? result.planet_stubs : [];
    const stations = Array.isArray(result?.station_stubs) ? result.station_stubs : [];
    const hyperlanes = Array.isArray(result?.hyperlanes) ? result.hyperlanes : [];
    const system = result?.system;
    const positionedPlanets = planets.filter(
      (planet: any) => planet?.sysx != null && planet?.sysy != null
    );
    const positionedStations = stations.filter(
      (station: any) => station?.sysx != null && station?.sysy != null
    );
    const systemGridLineWidth = Math.max(1.25, 1.5 / Math.max(systemZoom, 0.45));
    const mapBounds = {
      minX: 0,
      maxX: 19,
      minY: 0,
      maxY: 19,
    };
    const mapCells = Array.from(
      { length: mapBounds.maxY - mapBounds.minY + 1 },
      (_, rowIndex) =>
        Array.from({ length: mapBounds.maxX - mapBounds.minX + 1 }, (_, colIndex) => {
          const x = mapBounds.minX + colIndex;
          const y = mapBounds.minY + rowIndex;

          return {
            x,
            y,
            planets: positionedPlanets.filter(
              (planet: any) => Number(planet.sysx) === x && Number(planet.sysy) === y
            ),
            stations: positionedStations.filter(
              (station: any) => Number(station.sysx) === x && Number(station.sysy) === y
            ),
          };
        })
    );
    const selectedCellData = selectedSystemCell
      ? mapCells
          .flat()
          .find(
            (cell) =>
              cell.x === selectedSystemCell.x && cell.y === selectedSystemCell.y
          ) ?? null
      : null;

    function drillFromSystemCell(cell: {
      x: number;
      y: number;
      planets: any[];
      stations: any[];
    }) {
      const totalEntities = cell.planets.length + cell.stations.length;

      if (totalEntities === 1 && cell.planets.length === 1) {
        const planet = cell.planets[0];
        void runPull(
          "planet",
          planet.identifier ?? planet.uid ?? planet.name ?? ""
        );
        return;
      }

      if (totalEntities === 1 && cell.stations.length === 1) {
        const station = cell.stations[0];
        void runPull(
          "station",
          station.identifier ?? station.uid ?? station.name ?? ""
        );
        return;
      }

      setSelectedSystemCell({ x: cell.x, y: cell.y });
    }

    return (
      <div className="sysuniverse-stack">
        <div className="sysuniverse-stat-grid">
          {renderValue("System", system?.name ?? system?.uid ?? pullIdentifier)}
          {renderValue("UID", system?.uid ?? "Unknown")}
          {renderValue("Sector", system?.sector_name ?? system?.sector_uid ?? "Unknown")}
          {renderValue(
            "Coordinates",
            system?.galx != null && system?.galy != null
              ? `${system.galx}, ${system.galy}`
              : "Unknown"
          )}
          {renderValue(
            "System Grid",
            system?.sysx != null && system?.sysy != null
              ? `${system.sysx}, ${system.sysy}`
              : "Unknown"
          )}
          {renderValue("Planets", planets.length)}
          {renderValue("Stations", stations.length)}
          {renderValue("Hyperlanes", hyperlanes.length)}
        </div>

        <div className="sysuniverse-card">
          <strong>System Links</strong>
          <div className="sysuniverse-chip-row">
            {renderActionButton("Open Sector", "sector", system?.sector_name ?? system?.sector_uid)}
          </div>
        </div>

        <div className="sysuniverse-card">
          <div className="sysuniverse-toolbar">
            <strong>Top-Down System Map</strong>
            <div className="sysuniverse-toolbar__actions">
              <span className="small">
                Grid:
                {" "}
                {mapBounds.minX},{mapBounds.minY}
                {" -> "}
                {mapBounds.maxX},{mapBounds.maxY}
              </span>
              <span className="small">Zoom: {systemZoom.toFixed(2)}x</span>
              <button className="btn" type="button" onClick={resetSystemViewport}>
                Reset View
              </button>
            </div>
          </div>
          <p className="small sysuniverse-copy-reset">
            Scroll to zoom, drag to move, and click a coordinate cell to inspect everything located there.
          </p>
          <div
            ref={systemViewportRef}
            className={`sysuniverse-map-viewport sysuniverse-map-viewport--system ${isDraggingSystem ? "is-dragging" : ""}`}
            style={{
              overscrollBehavior: "contain",
              touchAction: "none",
            }}
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
            }}
            onMouseUp={() => {
              setIsDraggingSystem(false);
              systemDragRef.current = null;
            }}
            onMouseLeave={() => {
              setIsDraggingSystem(false);
              systemDragRef.current = null;
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
                  key={`sys-row-${rowIndex}`}
                  className="sysuniverse-grid-row"
                  style={{
                    gridTemplateColumns: `repeat(${row.length}, 88px)`,
                  }}
                >
                  {row.map((cell) => {
                    const isSelected =
                      selectedSystemCell?.x === cell.x &&
                      selectedSystemCell?.y === cell.y;
                    const occupancy = cell.planets.length + cell.stations.length;

                    return (
                      <button
                        key={`cell-${cell.x}-${cell.y}`}
                        className="btn sysuniverse-system-cell"
                        type="button"
                        onClick={() => drillFromSystemCell(cell)}
                        style={{
                          minHeight: 104,
                          border: `${systemGridLineWidth}px solid rgba(255,255,255,0.22)`,
                          borderColor: isSelected
                            ? "rgba(245, 213, 70, 0.7)"
                            : undefined,
                          background:
                            occupancy > 0
                              ? "rgba(245, 213, 70, 0.08)"
                              : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div className="sysuniverse-system-cell__header">
                          <strong>{cell.x}, {cell.y}</strong>
                          <span className="small">{occupancy}</span>
                        </div>
                        {cell.planets.slice(0, 2).map((planet: any) => (
                          <span
                            key={`planet-preview-${planet.uid ?? planet.name}`}
                            className="sysuniverse-planet-preview"
                          >
                            {bestPlanetImage(planet) ? (
                              <img
                                src={bestPlanetImage(planet) ?? ""}
                                alt={planet.name ?? planet.uid ?? "Planet"}
                                className="sysuniverse-planet-preview__thumb sysuniverse-planet-preview__thumb--small"
                              />
                            ) : null}
                            <span className="small sysuniverse-planet-preview__name">
                              {planet.name ?? planet.uid}
                            </span>
                          </span>
                        ))}
                        {cell.planets.length > 2 ? (
                          <span className="small">+{cell.planets.length - 2} more planets</span>
                        ) : null}
                        {cell.stations.length > 0 ? (
                          <span className="small">Stations: {cell.stations.length}</span>
                        ) : null}
                        {occupancy > 1 ? (
                          <span className="small sysuniverse-muted">
                            {occupancy} objects
                          </span>
                        ) : null}
                    </button>
                  );
                })}
                </div>
              ))}
            </div>
          </div>
          {selectedCellData ? (
            <div className="sysuniverse-card sysuniverse-card--highlight">
              <strong>
                Cell {selectedCellData.x}, {selectedCellData.y}
              </strong>
              {selectedCellData.planets.length > 0 ? (
                <div className="sysuniverse-stack--tight">
                  <span className="small">Planets</span>
                  <div className="sysuniverse-chip-row">
                    {selectedCellData.planets.map((planet: any, index: number) => (
                      <button
                        key={`${planet.uid ?? planet.name ?? index}`}
                        className="btn sysuniverse-entity-button"
                        type="button"
                        onClick={() =>
                          runPull(
                            "planet",
                            planet.identifier ?? planet.uid ?? planet.name ?? ""
                          )
                        }
                        style={{
                          gridTemplateColumns: bestPlanetImage(planet)
                            ? "36px 1fr"
                            : "1fr",
                        }}
                      >
                        {bestPlanetImage(planet) ? (
                          <img
                            src={bestPlanetImage(planet) ?? ""}
                            alt={planet.name ?? planet.uid ?? "Planet"}
                            className="sysuniverse-planet-preview__thumb"
                          />
                        ) : null}
                        <span>{planet.name ?? planet.uid ?? `Planet ${index + 1}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedCellData.stations.length > 0 ? (
                <div className="sysuniverse-stack--tight">
                  <span className="small">Stations</span>
                  <div className="sysuniverse-chip-row">
                    {selectedCellData.stations.map((station: any, index: number) => (
                      <button
                        key={`${station.uid ?? station.name ?? index}`}
                        className="btn"
                        type="button"
                        onClick={() =>
                          runPull(
                            "station",
                            station.identifier ?? station.uid ?? station.name ?? ""
                          )
                        }
                      >
                        {station.name ?? station.uid ?? `Station ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedCellData.planets.length === 0 &&
              selectedCellData.stations.length === 0 ? (
                <p className="small sysuniverse-copy-reset">
                  Nothing is registered at this coordinate.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {planets.length > 0 && (
          <details className="sysuniverse-card sysuniverse-card--foldout">
            <summary>Planet Layer</summary>
            <div className="sysuniverse-chip-row">
              {planets.slice(0, 80).map((planet: any, index: number) => (
                <button
                  key={`${planet.uid ?? planet.name ?? index}`}
                    className="btn sysuniverse-entity-button"
                    type="button"
                    onClick={() =>
                      runPull(
                        "planet",
                        planet.identifier ?? planet.uid ?? planet.name ?? ""
                      )
                    }
                    style={{
                      gridTemplateColumns: bestPlanetImage(planet)
                        ? "32px 1fr"
                        : "1fr",
                    }}
                  >
                  {bestPlanetImage(planet) ? (
                    <img
                      src={bestPlanetImage(planet) ?? ""}
                      alt={planet.name ?? planet.uid ?? "Planet"}
                      className="sysuniverse-planet-preview__thumb sysuniverse-planet-preview__thumb--medium"
                    />
                  ) : null}
                  <span>{planet.name ?? planet.uid ?? `Planet ${index + 1}`}</span>
                </button>
              ))}
            </div>
          </details>
        )}

        {stations.length > 0 && (
          <details className="sysuniverse-card sysuniverse-card--foldout">
            <summary>Station Layer</summary>
            <div className="sysuniverse-chip-row">
              {stations.slice(0, 80).map((station: any, index: number) => (
                <button
                  key={`${station.uid ?? station.name ?? index}`}
                    className="btn"
                    type="button"
                    onClick={() =>
                      runPull(
                        "station",
                        station.identifier ?? station.uid ?? station.name ?? ""
                      )
                    }
                  >
                  {station.name ?? station.uid ?? `Station ${index + 1}`}
                </button>
              ))}
            </div>
          </details>
        )}

        {hyperlanes.length > 0 && (
          <details className="sysuniverse-card sysuniverse-card--foldout">
            <summary>Hyperlane Layer</summary>
            <div className="sysuniverse-stack--tight">
              {hyperlanes.slice(0, 40).map((hyperlane: any, index: number) => (
                <div
                  key={`${hyperlane.uid ?? hyperlane.name ?? index}`}
                  className="sysuniverse-hyperlane-row"
                >
                  <span>
                    {hyperlane.name ?? hyperlane.uid ?? `Hyperlane ${index + 1}`}
                  </span>
                  <span className="small sysuniverse-muted">
                    {hyperlane.destination_name ??
                      hyperlane.system_name ??
                      hyperlane.destination_uid ??
                      "Unknown destination"}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  function renderPlanetVisualizer() {
    if (resource !== "planet") return null;
    const planet = result?.planet;
    const terrainGrid = Array.isArray(planet?.terrain_grid) ? planet.terrain_grid : [];
    const surfaceBounds = planet?.surface_bounds;
    const cities = Array.isArray(planet?.cities) ? planet.cities : [];
    const cityMap = new Map<string, any[]>();

    cities.forEach((city: any) => {
      if (city?.x == null || city?.y == null) return;
      const key = `${city.x}:${city.y}`;
      const existing = cityMap.get(key) ?? [];
      existing.push(city);
      cityMap.set(key, existing);
    });

    const mapCells =
      surfaceBounds &&
      Number.isFinite(surfaceBounds.width) &&
      Number.isFinite(surfaceBounds.height) &&
      surfaceBounds.width > 0 &&
      surfaceBounds.height > 0
        ? Array.from({ length: surfaceBounds.height }, (_, rowIndex) =>
            Array.from({ length: surfaceBounds.width }, (_, colIndex) => {
              const x = surfaceBounds.min_x + colIndex;
              const y = surfaceBounds.min_y + rowIndex;
              const terrain =
                terrainGrid.find(
                  (point: any) => Number(point.x) === x && Number(point.y) === y
                ) ?? null;
              const cellCities = cityMap.get(`${x}:${y}`) ?? [];

              return { x, y, terrain, cities: cellCities };
            })
          )
        : [];
    const selectedSurfaceCell = selectedPlanetCell
      ? mapCells
          .flat()
          .find(
            (cell) =>
              cell.x === selectedPlanetCell.x && cell.y === selectedPlanetCell.y
          ) ?? null
      : null;

    return (
      <div className="sysuniverse-stack">
        <div className="sysuniverse-stat-grid">
          {renderValue("Planet", planet?.name ?? planet?.uid ?? pullIdentifier)}
          {renderValue("UID", planet?.uid ?? "Unknown")}
          {renderValue("System", planet?.system_name ?? planet?.system_uid ?? "Unknown")}
          {renderValue("Owner", planet?.owner_name ?? planet?.owner_uid ?? "Unowned")}
          {renderValue(
            "Surface Grid",
            surfaceBounds ? `${surfaceBounds.width} x ${surfaceBounds.height}` : "Unknown"
          )}
          {renderValue("Cities", cities.length)}
        </div>

        {mapCells.length > 0 ? (
          <div className="sysuniverse-card">
            <div className="sysuniverse-toolbar">
              <strong>Planet Surface Map</strong>
              <div className="sysuniverse-toolbar__actions">
                <span className="small">
                  Grid: {surfaceBounds.min_x},{surfaceBounds.min_y}
                  {" -> "}
                  {surfaceBounds.max_x},{surfaceBounds.max_y}
                </span>
                <span className="small">Zoom: {planetZoom.toFixed(2)}x</span>
                <button className="btn" type="button" onClick={resetPlanetViewport}>
                  Reset View
                </button>
              </div>
            </div>
            <p className="small sysuniverse-copy-reset">
              Scroll to zoom, drag to move, and click a terrain cell to inspect its terrain and any cities on it.
            </p>
            <div
              ref={planetViewportRef}
              className={`sysuniverse-map-viewport sysuniverse-map-viewport--planet ${isDraggingPlanet ? "is-dragging" : ""}`}
              style={{
                overscrollBehavior: "contain",
                touchAction: "none",
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                setIsDraggingPlanet(true);
                planetDragRef.current = { x: event.clientX, y: event.clientY };
              }}
              onMouseMove={(event) => {
                if (!isDraggingPlanet || !planetDragRef.current) return;
                const dx = event.clientX - planetDragRef.current.x;
                const dy = event.clientY - planetDragRef.current.y;
                planetDragRef.current = { x: event.clientX, y: event.clientY };
                setPlanetOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
              }}
              onMouseUp={() => {
                setIsDraggingPlanet(false);
                planetDragRef.current = null;
              }}
              onMouseLeave={() => {
                setIsDraggingPlanet(false);
                planetDragRef.current = null;
              }}
            >
              <div className="sysuniverse-map-canvas" style={{ transform: `translate(${planetOffset.x}px, ${planetOffset.y}px) scale(${planetZoom})` }}>
                {mapCells.map((row, rowIndex) => (
                  <div
                    key={`planet-row-${rowIndex}`}
                    className="sysuniverse-grid-row"
                    style={{ gridTemplateColumns: `repeat(${row.length}, 42px)` }}
                  >
                    {row.map((cell) => {
                      const isSelected =
                        selectedPlanetCell?.x === cell.x &&
                        selectedPlanetCell?.y === cell.y;
                      return (
                        <button
                          key={`planet-cell-${cell.x}-${cell.y}`}
                          className="btn sysuniverse-planet-cell"
                          type="button"
                          onClick={() => setSelectedPlanetCell({ x: cell.x, y: cell.y })}
                          style={{
                            background: cell.terrain ? terrainColor(cell.terrain) : "#1d1d1d",
                            borderColor: isSelected ? "rgba(245,213,70,0.85)" : "rgba(255,255,255,0.18)",
                          }}
                          title={`${cell.x}, ${cell.y}${cell.terrain?.name ? ` · ${cell.terrain.name}` : ""}`}
                        >
                          {cell.cities.length > 0 ? <span className="sysuniverse-planet-cell__city-dot" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {selectedSurfaceCell ? (
              <div className="sysuniverse-card sysuniverse-card--highlight">
                <strong>
                  Surface Cell {selectedSurfaceCell.x}, {selectedSurfaceCell.y}
                </strong>
                <div className="sysuniverse-stat-grid">
                  {renderValue("Terrain", selectedSurfaceCell.terrain?.name ?? "Unknown")}
                  {renderValue("Code", selectedSurfaceCell.terrain?.code ?? "Unknown")}
                  {renderValue("Cities", selectedSurfaceCell.cities.length)}
                </div>
                {selectedSurfaceCell.cities.length > 0 ? (
                  <div className="sysuniverse-stack--tight">
                    <span className="small">Cities</span>
                    <div className="sysuniverse-chip-row">
                      {selectedSurfaceCell.cities.map((city: any, index: number) => (
                        <a
                          key={`${city.uid ?? city.name ?? index}`}
                          className="btn"
                          href={city.href ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {city.name ?? city.uid ?? `City ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {bestPlanetImage(planet) ? (
          <div className="sysuniverse-card">
            <strong>Planet Image</strong>
            <img
              src={planet?.image_large_url ?? bestPlanetImage(planet) ?? ""}
              alt={planet?.name ?? planet?.uid ?? "Planet"}
              className="sysuniverse-planet-image"
            />
            <div className="sysuniverse-chip-row">
              {planet?.image_small_url ? (
                <a className="btn" href={planet.image_small_url} target="_blank" rel="noreferrer">
                  Small Image
                </a>
              ) : null}
              {planet?.image_large_url ? (
                <a className="btn" href={planet.image_large_url} target="_blank" rel="noreferrer">
                  Large Image
                </a>
              ) : null}
              {planet?.image_atmosphere_url ? (
                <a className="btn" href={planet.image_atmosphere_url} target="_blank" rel="noreferrer">
                  Atmosphere
                </a>
              ) : null}
              {planet?.image_stratosphere_url ? (
                <a className="btn" href={planet.image_stratosphere_url} target="_blank" rel="noreferrer">
                  Stratosphere
                </a>
              ) : null}
              {planet?.image_loworbit_url ? (
                <a className="btn" href={planet.image_loworbit_url} target="_blank" rel="noreferrer">
                  Low Orbit
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="sysuniverse-card">
          <strong>Planet Actions</strong>
          <div className="sysuniverse-chip-row">
            {renderActionButton("Open Parent System", "system", planet?.system_uid)}
          </div>
        </div>
      </div>
    );
  }

  function renderStationVisualizer() {
    if (resource !== "station") return null;
    const station = result?.station;

    return (
      <div className="sysuniverse-stack">
        <div className="sysuniverse-stat-grid">
          {renderValue("Station", station?.name ?? station?.uid ?? pullIdentifier)}
          {renderValue("UID", station?.uid ?? "Unknown")}
          {renderValue("Type", station?.station_type?.name ?? station?.type_name ?? "Unknown")}
          {station?.station_type?.length ? renderValue("Length", station.station_type.length) : null}
          {station?.station_type?.hull ? renderValue("Hull", station.station_type.hull) : null}
          {station?.station_type?.shield ? renderValue("Shield", station.station_type.shield) : null}
          {station?.station_type?.sensors ? renderValue("Sensors", station.station_type.sensors) : null}
          {renderValue("System", station?.system_name ?? station?.system_uid ?? "Unknown")}
          {renderValue("Owner", station?.owner_name ?? station?.owner_uid ?? "Unowned")}
        </div>

        <div className="sysuniverse-card">
          <strong>Station Actions</strong>
          <div className="sysuniverse-chip-row">
            {renderActionButton("Open Parent System", "system", station?.system_uid)}
          </div>
        </div>
      </div>
    );
  }

  function renderExplorer() {
    if (!result) return null;

    return (
      <div className="sysuniverse-explorer">
        <strong>Quick Links</strong>

        {resource === "sector" && Array.isArray(result.systems) && (
          <div className="sysuniverse-stack--tight">
            <strong>Systems In Sector</strong>
            <div className="sysuniverse-chip-row">
              {result.systems.slice(0, 60).map((system: any, index: number) => (
                <button
                  key={`${system.uid ?? system.name ?? index}`}
                  className="btn"
                  type="button"
                  onClick={() => runPull("system", system.uid ?? system.name ?? "")}
                >
                  {system.name ?? system.uid ?? `System ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {resource === "system" && (
          <>
            {Array.isArray(result.planet_stubs) && result.planet_stubs.length > 0 && (
              <div className="sysuniverse-stack--tight">
                <strong>Planets In System</strong>
                <div className="sysuniverse-chip-row">
                  {result.planet_stubs.slice(0, 60).map((planet: any, index: number) => (
                    <button
                      key={`${planet.uid ?? planet.name ?? index}`}
                      className="btn"
                      type="button"
                      onClick={() => runPull("planet", planet.uid ?? planet.name ?? "")}
                    >
                      {planet.name ?? planet.uid ?? `Planet ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(result.station_stubs) && result.station_stubs.length > 0 && (
              <div className="sysuniverse-stack--tight">
                <strong>Stations In System</strong>
                <div className="sysuniverse-chip-row">
                  {result.station_stubs.slice(0, 60).map((station: any, index: number) => (
                    <button
                      key={`${station.uid ?? station.name ?? index}`}
                      className="btn"
                      type="button"
                      onClick={() => runPull("station", station.uid ?? station.name ?? "")}
                    >
                      {station.name ?? station.uid ?? `Station ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {resource === "planet" && result.planet?.system_uid && (
          <div className="sysuniverse-chip-row">
            <button
              className="btn"
              type="button"
              onClick={() => runPull("system", result.planet.system_uid)}
            >
              Open Parent System
            </button>
          </div>
        )}

        {resource === "station" && result.station?.system_uid && (
          <div className="sysuniverse-chip-row">
            <button
              className="btn"
              type="button"
              onClick={() => runPull("system", result.station.system_uid)}
            >
              Open Parent System
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderLayerVisualizer() {
    if (!result) return null;

    return (
      <div className="panel">
        <h2>Layer Visualizer</h2>
        <p className="small">
          Each layer gets its own quick summary so you can inspect the shape before drilling deeper.
        </p>
        {renderSectorVisualizer()}
        {renderSystemVisualizer()}
        {renderPlanetVisualizer()}
        {renderStationVisualizer()}
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Galaxy Explorer</h1>
            <p className="small">Loading galaxy tools…</p>
          </main>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Galaxy Explorer</h1>
            <p className="small sysuniverse-error">
              {pageError}
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (!viewer) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <NotLoggedInState
              title="Not logged in"
              message="You need to sign in to access the galaxy explorer."
            />
          </main>
        </div>
      </div>
    );
  }

  if (!viewer.is_sysadmin) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Galaxy Explorer</h1>
            <p className="small">Sysadmin access required.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board admin-board sysuniverse-board">
          <div className="sysuniverse-pagehead">
            <div className="sysuniverse-pagehead__copy">
              <h1>Galaxy Explorer</h1>
              <p className="small">
                Start from a sector, then drill down into systems, planets, and stations.
              </p>
            </div>
            <Link to="/sys/debug" className="btn">
              Back to Sys Debug
            </Link>
          </div>

          <div className="sysuniverse-shell">
            <aside className="panel sysuniverse-sidebar">
              <div className="sysuniverse-stack">
                <div className="sysuniverse-form">
                  <select
                    className="input"
                    value={pullResource}
                    onChange={(e) => setPullResource(e.target.value as UniverseResource)}
                  >
                    <option value="sector">Sector</option>
                    <option value="system">System</option>
                    <option value="planet">Planet</option>
                    <option value="station">Station</option>
                  </select>

                  <input
                    className="input"
                    value={pullIdentifier}
                    onChange={(e) => setPullIdentifier(e.target.value)}
                    placeholder="UID or name, e.g. Arkanis, Tatoo, or 9:178"
                  />

                  <label className="small" style={{ display: "grid", gap: 6, alignContent: "center" }}>
                    <span>
                      <input
                        type="checkbox"
                        checked={persistPull}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setPersistPull(checked);
                          if (!checked) {
                            setDeepPersistPull(false);
                          }
                        }}
                      />{" "}
                      Persist to DB
                    </span>
                    <span>
                      <input
                        type="checkbox"
                        checked={deepPersistPull}
                        disabled={!persistPull || pullResource !== "sector"}
                        onChange={(e) => setDeepPersistPull(e.target.checked)}
                      />{" "}
                      Deep sector sync
                    </span>
                  </label>

                  <div>
                    <button className="btn" type="button" onClick={onSubmit} disabled={loading}>
                      Run galaxy pull
                    </button>
                  </div>
                </div>

                {loading ? <p className="small">Running…</p> : null}
                {error ? (
                  <p className="small sysuniverse-error">
                    {error}
                  </p>
                ) : null}

                {trail.length > 0 ? (
                  <div className="sysuniverse-card">
                    <strong>Path</strong>
                    <span className="small sysuniverse-muted">
                      {trail.map((item) => `${item.resource}:${item.identifier}`).join(" -> ")}
                    </span>
                    <div>
                      <button className="btn" type="button" onClick={resetTrail}>
                        Clear path
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>

            <section className="sysuniverse-main">
              <div className="sysuniverse-subnav">
                <button
                  type="button"
                  className={`btn sysuniverse-subnav__btn${activeSection === "visualizer" ? " is-active" : ""}`}
                  onClick={() => setActiveSection("visualizer")}
                >
                  Visualizer
                </button>
                <button
                  type="button"
                  className={`btn sysuniverse-subnav__btn${activeSection === "navigation" ? " is-active" : ""}`}
                  onClick={() => setActiveSection("navigation")}
                >
                  Navigation
                </button>
                <button
                  type="button"
                  className={`btn sysuniverse-subnav__btn${activeSection === "payload" ? " is-active" : ""}`}
                  onClick={() => setActiveSection("payload")}
                >
                  Payload
                </button>
              </div>

              {activeSection === "visualizer" ? renderLayerVisualizer() : null}
              {activeSection === "navigation" ? renderExplorer() : null}
              {activeSection === "payload" ? (
                <div className="sysuniverse-stack">
                  {persistenceSummary ? (
                    <div className="sysuniverse-card">
                      <strong>Persistence</strong>
                      <pre className="small sysuniverse-json">
                        {pretty(persistenceSummary)}
                      </pre>
                    </div>
                  ) : null}

                  <div className="sysuniverse-card">
                    <strong>Raw Response</strong>
                    <pre className="small sysuniverse-json">
                      {result ? pretty(result) : "No data yet."}
                    </pre>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SysUniversePage;
