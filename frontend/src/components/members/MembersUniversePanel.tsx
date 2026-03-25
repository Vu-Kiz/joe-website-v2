import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GalaxySectorMap from "../maps/GalaxySectorMap";
import {
  getStoredMapSystems,
  saveStoredCellAnnotation,
  getStoredSector,
  getStoredSectors,
  getStoredSystem,
  type SectorCellAnnotation,
  type StoredMapSystem,
  type StoredSectorDetail,
  type StoredSectorSummary,
  type StoredSystemDetail,
} from "../../api/universe";
import "../../styles/_membersuniverse.sass";

type FocusRequest =
  | {
      kind: "sector";
      sectorUid: string;
      nonce: number;
      zoom?: number;
    }
  | {
      kind: "coords";
      galx: number;
      galy: number;
      nonce: number;
      zoom?: number;
    }
  | null;

const MembersUniversePanel: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<StoredSectorSummary[]>([]);
  const [mapSystems, setMapSystems] = useState<StoredMapSystem[]>([]);
  const [selectedSectorUid, setSelectedSectorUid] = useState("");
  const [sectorDetail, setSectorDetail] = useState<StoredSectorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSystemIdentifier, setSelectedSystemIdentifier] = useState("");
  const [systemDetail, setSystemDetail] = useState<StoredSystemDetail | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [mapAnnotations, setMapAnnotations] = useState<SectorCellAnnotation[]>([]);
  const [locationX, setLocationX] = useState("");
  const [locationY, setLocationY] = useState("");
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [sectorsResponse, systemsResponse] = await Promise.all([
          getStoredSectors(),
          getStoredMapSystems(),
        ]);

        if (cancelled) return;

        const nextSectors = sectorsResponse.data ?? [];
        const firstSectorUid = nextSectors[0]?.uid ?? "";

        setSectors(nextSectors);
        setMapSystems(systemsResponse.data ?? []);
        setSelectedSectorUid(firstSectorUid);
        setError(null);

        if (firstSectorUid) {
          setFocusRequest({
            kind: "sector",
            sectorUid: firstSectorUid,
            nonce: Date.now(),
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load stored sectors.");
          setSectors([]);
          setMapSystems([]);
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
  }, []);

  useEffect(() => {
    if (!selectedSectorUid) {
      setSectorDetail(null);
      setSelectedSystemIdentifier("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setDetailLoading(true);
        const response = await getStoredSector(selectedSectorUid);

        if (cancelled) return;

        const nextDetail = response.data ?? null;
        setSectorDetail(nextDetail);
        setMapAnnotations(nextDetail?.annotations ?? []);
        setSelectedSystemIdentifier(
          nextDetail?.systems?.[0]?.identifier ??
            nextDetail?.systems?.[0]?.uid ??
            ""
        );
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setSectorDetail(null);
          setMapAnnotations([]);
          setSelectedSystemIdentifier("");
          setError(e?.message ?? "Failed to load sector detail.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSectorUid]);

  useEffect(() => {
    if (!selectedSystemIdentifier) {
      setSystemDetail(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSystemLoading(true);
        const response = await getStoredSystem(selectedSystemIdentifier);

        if (cancelled) return;

        setSystemDetail(response.data ?? null);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setSystemDetail(null);
          setError(e?.message ?? "Failed to load system detail.");
        }
      } finally {
        if (!cancelled) {
          setSystemLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSystemIdentifier]);

  const selectedSector = useMemo(
    () => sectors.find((sector) => sector.uid === selectedSectorUid) ?? null,
    [sectors, selectedSectorUid]
  );

  function handleGoToSector() {
    if (!selectedSectorUid) return;

    setFocusRequest({
      kind: "sector",
      sectorUid: selectedSectorUid,
      nonce: Date.now(),
    });
  }

  function handleGoToCoordinates() {
    const galx = Number(locationX);
    const galy = Number(locationY);

    if (!Number.isFinite(galx) || !Number.isFinite(galy)) {
      setError("Enter valid galaxy coordinates before jumping.");
      return;
    }

    setError(null);
    setFocusRequest({
      kind: "coords",
      galx,
      galy,
      nonce: Date.now(),
      zoom: 1,
    });
  }

  function handleMapSystemSelect(systemIdentifier: string, sectorUid?: string | null) {
    const mapSystem =
      mapSystems.find(
        (system) => system.identifier === systemIdentifier || system.uid === systemIdentifier
      ) ?? null;
    const nextIdentifier = mapSystem?.identifier ?? mapSystem?.uid ?? systemIdentifier;

    navigate(`/members/universe/system/${encodeURIComponent(nextIdentifier)}`, {
      state: {
        fromUniverseMap: true,
        sectorUid: sectorUid ?? mapSystem?.sector_uid ?? null,
        galx: mapSystem?.galx ?? null,
        galy: mapSystem?.galy ?? null,
      },
    });
  }

  async function handleSaveMapAnnotation(payload: {
    sector_uid: string;
    galx: number;
    galy: number;
    notes?: string | null;
  }) {
    const response = await saveStoredCellAnnotation({
      sector_uid: payload.sector_uid,
      galx: payload.galx,
      galy: payload.galy,
      marker_type: null,
      label: null,
      notes: payload.notes ?? null,
    });

    setMapAnnotations((current) => {
      const filtered = current.filter(
        (entry) =>
          !(
            entry.sector_uid === payload.sector_uid &&
            entry.galx === payload.galx &&
            entry.galy === payload.galy
          )
      );

      return response.data ? [...filtered, response.data] : filtered;
    });

    return response.data ?? null;
  }

  if (loading) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Universe</h2>
          <p className="small" style={{ margin: 0 }}>
            Loading stored universe data…
          </p>
        </div>
      </section>
    );
  }

  if (error && sectors.length === 0) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Universe</h2>
        </div>
        <div className="admin-panel__body">
          <p className="small" style={{ color: "salmon", margin: 0 }}>
            {error}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>Universe</h2>
        <p className="small" style={{ margin: 0 }}>
          Browse synced sector data from the local database with a galaxy-wide map.
        </p>
      </div>

      <div className="admin-panel__body members-universe">
        <section className="panel admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Navigation</h3>
            <p className="admin-card__desc">
              Jump straight to a sector or galaxy coordinate instead of manually panning
              across the full map.
            </p>
          </div>

          <div className="members-universe__controls">
            <div className="members-universe__field">
              <label className="small" htmlFor="members-universe-sector">
                Sector
              </label>
              <div className="members-universe__inline">
                <select
                  id="members-universe-sector"
                  className="input"
                  value={selectedSectorUid}
                  onChange={(event) => setSelectedSectorUid(event.target.value)}
                >
                  {sectors.map((sector) => (
                    <option key={sector.uid} value={sector.uid}>
                      {sector.name ?? sector.uid}
                    </option>
                  ))}
                </select>
                <button className="btn" type="button" onClick={handleGoToSector}>
                  Go to Sector
                </button>
              </div>
            </div>

            <div className="members-universe__field">
              <label className="small">Galaxy Coordinates</label>
              <div className="members-universe__inline">
                <input
                  className="input"
                  inputMode="numeric"
                  value={locationX}
                  onChange={(event) => setLocationX(event.target.value)}
                  placeholder="galx"
                />
                <input
                  className="input"
                  inputMode="numeric"
                  value={locationY}
                  onChange={(event) => setLocationY(event.target.value)}
                  placeholder="galy"
                />
                <button className="btn" type="button" onClick={handleGoToCoordinates}>
                  Go to Coordinates
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <p className="small" style={{ color: "salmon", margin: 0 }}>
              {error}
            </p>
          ) : null}
        </section>

        <GalaxySectorMap
          sectors={sectors}
          systemMarkers={mapSystems}
          activeSectorUid={selectedSectorUid || undefined}
          annotations={mapAnnotations}
          onSystemSelect={handleMapSystemSelect}
          onSaveAnnotation={handleSaveMapAnnotation}
          focusRequest={focusRequest}
        />

        <section className="admin-grid">
          <article className="panel admin-card">
            <div className="admin-card__header">
              <h3 className="admin-card__title">Selected Sector</h3>
              <p className="admin-card__desc">
                {detailLoading
                  ? "Loading stored sector detail…"
                  : "Sector details from the local database."}
              </p>
            </div>

            <div className="members-universe__selected">
              <div className="members-universe__meta">
                <span className="admin-badge admin-badge--soft">
                  {selectedSector?.name ?? selectedSector?.uid ?? "No sector selected"}
                </span>
                {selectedSector?.owner_name ? (
                  <span className="admin-badge admin-badge--intel">
                    {selectedSector.owner_name}
                  </span>
                ) : null}
              </div>

              <div className="admin-grid">
                <div className="admin-card">
                  <span className="small">UID</span>
                  <strong>{selectedSector?.uid ?? "Unknown"}</strong>
                </div>
                <div className="admin-card">
                  <span className="small">Population</span>
                  <strong>{selectedSector?.population?.toLocaleString() ?? "Unknown"}</strong>
                </div>
                <div className="admin-card">
                  <span className="small">Known Systems</span>
                  <strong>{selectedSector?.known_systems ?? 0}</strong>
                </div>
                <div className="admin-card">
                  <span className="small">Coordinates</span>
                  <strong>{selectedSector?.coordinate_count ?? 0}</strong>
                </div>
              </div>
            </div>
          </article>

          <article className="panel admin-card">
            <div className="admin-card__header">
              <h3 className="admin-card__title">Stored Detail</h3>
              <p className="admin-card__desc">
                Summary of the saved shape and linked systems for the selected sector.
              </p>
            </div>

            <div className="admin-grid">
              <div className="admin-card">
                <span className="small">Map Bounds</span>
                <strong>
                  {sectorDetail?.bounds
                    ? `${sectorDetail.bounds.width} x ${sectorDetail.bounds.height}`
                    : "Unknown"}
                </strong>
              </div>
              <div className="admin-card">
                <span className="small">Outline Points</span>
                <strong>{sectorDetail?.outline_coordinates?.length ?? 0}</strong>
              </div>
              <div className="admin-card">
                <span className="small">Stored Systems</span>
                <strong>{sectorDetail?.systems?.length ?? 0}</strong>
              </div>
              <div className="admin-card">
                <span className="small">Cell Notes</span>
                <strong>{sectorDetail?.annotations?.length ?? 0}</strong>
              </div>
            </div>
          </article>

          <article className="panel admin-card">
            <div className="admin-card__header">
              <h3 className="admin-card__title">System Data</h3>
              <p className="admin-card__desc">
                Stored systems in the selected sector, with planets, stations, and hyperlanes from the local database.
              </p>
            </div>

            <div className="members-universe__selected">
              <div className="members-universe__field">
                <label className="small" htmlFor="members-universe-system">
                  System
                </label>
                <select
                  id="members-universe-system"
                  className="input"
                  value={selectedSystemIdentifier}
                  onChange={(event) => setSelectedSystemIdentifier(event.target.value)}
                  disabled={!sectorDetail?.systems?.length}
                >
                  {sectorDetail?.systems?.length ? (
                    sectorDetail.systems.map((system) => {
                      const value = system.identifier ?? system.uid ?? "";
                      return (
                        <option key={value} value={value}>
                          {system.name ?? system.uid ?? value}
                        </option>
                      );
                    })
                  ) : (
                    <option value="">No stored systems</option>
                  )}
                </select>
              </div>

              <div className="members-universe__system-grid">
                {sectorDetail?.systems?.map((system) => {
                  const value = system.identifier ?? system.uid ?? "";

                  return (
                    <button
                      key={value}
                      type="button"
                      className={`members-universe__system-tile ${
                        value === selectedSystemIdentifier ? "is-active" : ""
                      }`}
                      onClick={() => setSelectedSystemIdentifier(value)}
                    >
                      <strong>{system.name ?? system.uid ?? value}</strong>
                      <span className="small">
                        {system.identifier ?? system.uid ?? "Unknown ID"}
                      </span>
                      <span className="small">
                        {system.galx ?? "?"}, {system.galy ?? "?"}
                      </span>
                      <span className="small">
                        Sys {system.sysx ?? "?"}, {system.sysy ?? "?"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="admin-grid">
                <div className="admin-card">
                  <span className="small">Status</span>
                  <strong>{systemLoading ? "Loading…" : systemDetail?.system.name ?? "No system selected"}</strong>
                </div>
                <div className="admin-card">
                  <span className="small">Planets</span>
                  <strong>{systemDetail?.planets.length ?? 0}</strong>
                </div>
                <div className="admin-card">
                  <span className="small">Stations</span>
                  <strong>{systemDetail?.stations.length ?? 0}</strong>
                </div>
                <div className="admin-card">
                  <span className="small">Hyperlanes</span>
                  <strong>{systemDetail?.hyperlanes.length ?? 0}</strong>
                </div>
              </div>

              {systemDetail ? (
                <div className="admin-grid">
                  <div className="admin-card">
                    <span className="small">Planets</span>
                    <div className="members-universe__entity-list">
                      {systemDetail.planets.length ? (
                        systemDetail.planets.map((planet, index) => (
                          <div key={planet.uid ?? planet.identifier ?? planet.name ?? `planet-${index}`} className="members-universe__entity-row">
                            <strong>{planet.name ?? planet.uid ?? "Unknown planet"}</strong>
                            <span className="small">
                              {planet.owner_name ?? "No owner"} · {planet.sysx ?? "?"},{planet.sysy ?? "?"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="small">No stored planets</span>
                      )}
                    </div>
                  </div>

                  <div className="admin-card">
                    <span className="small">Stations</span>
                    <div className="members-universe__entity-list">
                      {systemDetail.stations.length ? (
                        systemDetail.stations.map((station, index) => (
                          <div key={station.uid ?? station.identifier ?? station.name ?? `station-${index}`} className="members-universe__entity-row">
                            <strong>{station.name ?? station.uid ?? "Unknown station"}</strong>
                            <span className="small">
                              {station.station_type?.name ?? station.type_name ?? "Unknown type"} · {station.sysx ?? "?"},{station.sysy ?? "?"}
                            </span>
                            {station.station_type?.hull || station.station_type?.shield ? (
                              <span className="small">
                                Hull {station.station_type?.hull ?? "?"} · Shield {station.station_type?.shield ?? "?"}
                              </span>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <span className="small">No stored stations</span>
                      )}
                    </div>
                  </div>

                  <div className="admin-card">
                    <span className="small">Hyperlanes</span>
                    <div className="members-universe__entity-list">
                      {systemDetail.hyperlanes.length ? (
                        systemDetail.hyperlanes.map((hyperlane) => (
                          <div key={hyperlane.uid ?? hyperlane.name ?? `${hyperlane.destination_uid}-${hyperlane.destination_name}`} className="members-universe__entity-row">
                            <strong>{hyperlane.name ?? "Unnamed hyperlane"}</strong>
                            <span className="small">
                              {hyperlane.destination_name ?? hyperlane.destination_uid ?? "Unknown destination"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="small">No stored hyperlanes</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </section>
  );
};

export default MembersUniversePanel;
