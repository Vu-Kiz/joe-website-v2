import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GalaxySectorMap from "../maps/GalaxySectorMap";
import {
  saveStoredSearchRecord,
  getStoredMapSystems,
  getStoredSearchRecords,
  saveStoredCellAnnotation,
  getStoredSector,
  getStoredSectors,
  getStoredSystem,
  type SectorCellAnnotation,
  type SectorSearchRecord,
  type StoredMapSystem,
  type StoredSectorSummary,
  type StoredSystemDetail,
} from "../../api/universe";
import { fetchAuthMe, type SwcUser } from "../../api/auth";
import { canAccessAdmin } from "../../auth/permissions";
import {
  getSwcAuthorizationStatus,
  importSwcPersonalEvents,
  type SwcAuthorizationStatus,
  type SwcPersonalEventsImportResponse,
} from "../../api/swcAuthorization";
import SpinnerLoadingCard from "../common/SpinnerLoadingCard";
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

const MembersUniversePanel: React.FC = () => {
  const navigate = useNavigate();
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<StoredSectorSummary[]>([]);
  const [mapSystems, setMapSystems] = useState<StoredMapSystem[]>([]);
  const [selectedSectorUid, setSelectedSectorUid] = useState("");
  const [sectorQuery, setSectorQuery] = useState("");
  const [showSectorMatches, setShowSectorMatches] = useState(false);
  const [systemQuery, setSystemQuery] = useState("");
  const [showSystemMatches, setShowSystemMatches] = useState(false);
  const [selectedSystemIdentifier, setSelectedSystemIdentifier] = useState("");
  const [systemDetailCache, setSystemDetailCache] = useState<Record<string, StoredSystemDetail>>({});
  const [annotationCacheBySector, setAnnotationCacheBySector] = useState<
    Record<string, SectorCellAnnotation[]>
  >({});
  const [mapSearchRecords, setMapSearchRecords] = useState<SectorSearchRecord[]>([]);
  const [locationX, setLocationX] = useState("");
  const [locationY, setLocationY] = useState("");
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const [eventsImportLoading, setEventsImportLoading] = useState(false);
  const [eventsImportError, setEventsImportError] = useState<string | null>(null);
  const [eventsImportResult, setEventsImportResult] = useState<SwcPersonalEventsImportResponse | null>(null);
  const annotationLoadPromisesRef = useRef<Record<string, Promise<SectorCellAnnotation[]>>>({});
  const oauthParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const swcOauthError = oauthParams.get("swc_oauth_error");
  const swcOauthSuccess = oauthParams.get("swc_oauth_success") === "1";
  const mapAnnotations = useMemo(
    () => Object.values(annotationCacheBySector).flat(),
    [annotationCacheBySector]
  );
  const loadedAnnotationSectorUids = useMemo(
    () => Object.keys(annotationCacheBySector),
    [annotationCacheBySector]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [authResponse, swcAuthResponse, sectorsResponse, systemsResponse, searchRecordsResponse] = await Promise.all([
          fetchAuthMe(),
          getSwcAuthorizationStatus(),
          getStoredSectors(),
          getStoredMapSystems(),
          getStoredSearchRecords(),
        ]);

        if (cancelled) return;

        setViewer(authResponse.user ?? null);
        setSwcAuth(swcAuthResponse.data ?? null);
        const nextSectors = sectorsResponse.data ?? [];
        const firstSectorUid = nextSectors[0]?.uid ?? "";

        setSectors(nextSectors);
        setMapSystems(systemsResponse.data ?? []);
        setMapSearchRecords(searchRecordsResponse.data ?? []);
        setSelectedSectorUid(firstSectorUid);
        setSectorQuery("");
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
      setSelectedSystemIdentifier("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await getStoredSector(selectedSectorUid);

        if (cancelled) return;

        const nextDetail = response.data ?? null;
        setAnnotationCacheBySector((current) => ({
          ...current,
          [selectedSectorUid]: nextDetail?.annotations ?? [],
        }));
        setSelectedSystemIdentifier((current) => {
          const matchingSystem = nextDetail?.systems?.find(
            (system) => system.identifier === current || system.uid === current
          );

          if (matchingSystem) {
            return current;
          }

          return (
            nextDetail?.systems?.[0]?.identifier ??
            nextDetail?.systems?.[0]?.uid ??
            ""
          );
        });
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setSelectedSystemIdentifier("");
          setError(e?.message ?? "Failed to load sector detail.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSectorUid]);

  async function ensureSectorAnnotationsLoaded(sectorUid: string) {
    if (!sectorUid) {
      return [];
    }

    const cached = annotationCacheBySector[sectorUid];
    if (cached) {
      return cached;
    }

    const pending = annotationLoadPromisesRef.current[sectorUid];
    if (pending) {
      return pending;
    }

    const nextPromise = getStoredSector(sectorUid)
      .then((response) => {
        const nextAnnotations = response.data?.annotations ?? [];
        setAnnotationCacheBySector((current) => ({
          ...current,
          [sectorUid]: nextAnnotations,
        }));
        return nextAnnotations;
      })
      .finally(() => {
        delete annotationLoadPromisesRef.current[sectorUid];
      });

    annotationLoadPromisesRef.current[sectorUid] = nextPromise;
    return nextPromise;
  }

  async function loadSystemDetailForMap(systemIdentifier: string) {
    const cached = systemDetailCache[systemIdentifier];
    if (cached) {
      return cached;
    }

    const response = await getStoredSystem(systemIdentifier);
    const nextDetail = response.data ?? null;

    if (nextDetail) {
      setSystemDetailCache((current) => ({
        ...current,
        [systemIdentifier]: nextDetail,
        ...(nextDetail.system.uid ? { [nextDetail.system.uid]: nextDetail } : {}),
        ...(nextDetail.system.identifier ? { [nextDetail.system.identifier]: nextDetail } : {}),
      }));
    }

    return nextDetail;
  }

  const filteredSectors = useMemo(() => {
    const query = sectorQuery.trim().toLowerCase();
    if (!query) {
      return sectors.slice(0, 12);
    }

    return sectors
      .filter((sector) => {
        const name = String(sector.name ?? "").toLowerCase();
        const uid = String(sector.uid ?? "").toLowerCase();
        return name.includes(query) || uid.includes(query);
      })
      .slice(0, 12);
  }, [sectorQuery, sectors]);

  const filteredSystems = useMemo(() => {
    const query = systemQuery.trim().toLowerCase();
    if (!query) {
      return mapSystems.slice(0, 12);
    }

    return mapSystems
      .filter((system) => {
        const name = String(system.name ?? "").toLowerCase();
        const identifier = String(system.identifier ?? "").toLowerCase();
        const uid = String(system.uid ?? "").toLowerCase();
        return (
          name.includes(query) || identifier.includes(query) || uid.includes(query)
        );
      })
      .slice(0, 12);
  }, [mapSystems, systemQuery]);

  function commitSectorSelection(nextSector: StoredSectorSummary | null) {
    if (!nextSector) return;
    setSelectedSectorUid(nextSector.uid);
    setSectorQuery(nextSector.name ?? nextSector.uid ?? "");
    setShowSectorMatches(false);
    setError(null);
  }

  function commitSystemSelection(nextSystem: StoredMapSystem | null) {
    if (!nextSystem) return;

    const nextIdentifier = nextSystem.identifier ?? nextSystem.uid ?? "";
    if (!nextIdentifier) return;

    if (nextSystem.sector_uid) {
      setSelectedSectorUid(nextSystem.sector_uid);
    }
    setSelectedSystemIdentifier(nextIdentifier);
    setSystemQuery(nextSystem.name ?? nextIdentifier);
    setShowSystemMatches(false);
    setError(null);
  }

  function handleGoToSector() {
    const query = sectorQuery.trim().toLowerCase();
    const resolvedSector =
      sectors.find((sector) => sector.uid === selectedSectorUid) ??
      sectors.find((sector) => String(sector.uid).toLowerCase() === query) ??
      sectors.find((sector) => String(sector.name ?? "").toLowerCase() === query) ??
      filteredSectors[0] ??
      null;

    if (!resolvedSector) {
      setError("Select a valid sector before jumping.");
      return;
    }

    commitSectorSelection(resolvedSector);

    setFocusRequest({
      kind: "sector",
      sectorUid: resolvedSector.uid,
      nonce: Date.now(),
    });
  }

  function handleGoToSystem() {
    const query = systemQuery.trim().toLowerCase();
    const resolvedSystem =
      mapSystems.find((system) => {
        const identifier = String(system.identifier ?? "").toLowerCase();
        const uid = String(system.uid ?? "").toLowerCase();
        return identifier === query || uid === query;
      }) ??
      mapSystems.find((system) => String(system.name ?? "").toLowerCase() === query) ??
      filteredSystems[0] ??
      null;

    if (!resolvedSystem) {
      setError("Select a valid system before jumping.");
      return;
    }

    if (
      resolvedSystem.galx == null ||
      resolvedSystem.galy == null
    ) {
      setError("This stored system does not have galaxy coordinates yet.");
      return;
    }

    commitSystemSelection(resolvedSystem);

    setFocusRequest({
      kind: "coords",
      galx: resolvedSystem.galx,
      galy: resolvedSystem.galy,
      nonce: Date.now(),
      zoom: 1.2,
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

    setAnnotationCacheBySector((current) => {
      const sectorAnnotations = current[payload.sector_uid] ?? [];
      const filtered = sectorAnnotations.filter(
        (entry) => !(entry.galx === payload.galx && entry.galy === payload.galy)
      );

      return {
        ...current,
        [payload.sector_uid]: response.data ? [...filtered, response.data] : filtered,
      };
    });

    return response.data ?? null;
  }

  async function handleSaveSearchRecord(payload: {
    sector_uid?: string | null;
    galx: number;
    galy: number;
    planetoids_checked?: boolean | null;
    planetoid_1_type?: string | null;
    planetoid_1_size?: "1x1" | "2x2" | null;
    planetoid_2_type?: string | null;
    planetoid_2_size?: "1x1" | "2x2" | null;
    has_ships?: boolean | null;
    has_stations?: boolean | null;
  }) {
    const response = await saveStoredSearchRecord(payload);
    const saved = response.data;

    setMapSearchRecords((current) => {
      const next = [...current];
      const index = next.findIndex(
        (record) => record.galx === saved.galx && record.galy === saved.galy
      );

      if (index >= 0) {
        next[index] = saved;
      } else {
        next.push(saved);
      }

      return next;
    });

    return saved;
  }

  async function refreshSearchRecords() {
    const searchRecordsResponse = await getStoredSearchRecords();
    setMapSearchRecords(searchRecordsResponse.data ?? []);
  }

  async function handleImportPersonalEvents() {
    try {
      setEventsImportLoading(true);
      setEventsImportError(null);
      setEventsImportResult(null);
      const response = await importSwcPersonalEvents();

      if (!response?.ok) {
        throw new Error(
          "Your SWC Astrogation access session has timed out. Please reconnect your access and try again."
        );
      }

      setEventsImportResult(response);
      await Promise.all([
        refreshSearchRecords(),
        getSwcAuthorizationStatus().then((authResponse) => {
          setSwcAuth(authResponse.data ?? null);
        }),
      ]);
    } catch (e: any) {
      const message = String(e?.message ?? "Failed to pull personal events.");
      const normalizedMessage =
        /timed out|expired|reconnect|not connected/i.test(message)
          ? "Your SWC Astrogation access session has timed out. Please reconnect your access and try again."
          : message;

      setEventsImportError(normalizedMessage);
    } finally {
      setEventsImportLoading(false);
    }
  }

  const mapElement = (
    <GalaxySectorMap
      sectors={sectors}
      systemMarkers={mapSystems}
      activeSectorUid={selectedSectorUid || undefined}
      annotations={mapAnnotations}
      loadedAnnotationSectorUids={loadedAnnotationSectorUids}
      searchRecords={mapSearchRecords}
      onSelectSector={setSelectedSectorUid}
      onSystemSelect={handleMapSystemSelect}
      onSaveAnnotation={handleSaveMapAnnotation}
      onSaveSearchRecord={handleSaveSearchRecord}
      ensureSectorAnnotationsLoaded={ensureSectorAnnotationsLoaded}
      canEditCellIntel={canAccessAdmin(viewer)}
      loadSystemDetail={loadSystemDetailForMap}
      focusRequest={focusRequest}
      onClearFocusRequest={() => setFocusRequest(null)}
      controlsOverlay={
        <div className="members-universe__controllers-overlay">
          <section className="members-universe__controller-section">
            <div className="members-universe__top-actions-copy">
              <p className="small" style={{ margin: 0 }}>
                Astrogation Access: {swcAuth?.has_personal_events_access ? "Yes" : "No"}
              </p>
            </div>
            <div className="members-universe__top-actions-controls">
              <button
                className="btn"
                type="button"
                onClick={handleImportPersonalEvents}
                disabled={eventsImportLoading}
              >
                {eventsImportLoading ? "Uploading..." : "Upload Astrogation Data"}
              </button>
            </div>
            {swcOauthError ? (
              <p className="small" style={{ margin: 0 }}>
                OAuth error: {swcOauthError}
              </p>
            ) : null}
            {eventsImportError ? (
              <p className="small" style={{ color: "salmon", margin: 0 }}>
                {eventsImportError}
              </p>
            ) : null}
            {eventsImportResult?.import ? (
              <p className="small" style={{ margin: 0 }}>
                Imported {eventsImportResult.import.created} new, updated {eventsImportResult.import.updated}, unchanged {eventsImportResult.import.unchanged}, skipped {eventsImportResult.import.skipped}.
              </p>
            ) : null}
          </section>

          <section className="members-universe__controller-section">
            <div className="members-universe__top-actions-copy">
              <h4 className="admin-card__title">Navigation</h4>
              <p className="small" style={{ margin: 0 }}>
                Plot a course straight to a sector, system, or star chart coordinate.
              </p>
            </div>

            <div className="members-universe__controls">
              <div className="members-universe__field">
                <label className="small" htmlFor="members-universe-sector">
                  Sector
                </label>
                <div className="members-universe__inline members-universe__sector-picker">
                  <div className="members-universe__typeahead">
                    <input
                      id="members-universe-sector"
                      className="input"
                      value={sectorQuery}
                      onChange={(event) => {
                        setSectorQuery(event.target.value);
                        setShowSectorMatches(true);
                      }}
                      onFocus={() => setShowSectorMatches(true)}
                      onBlur={() => {
                        window.setTimeout(() => setShowSectorMatches(false), 120);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleGoToSector();
                        }
                      }}
                      placeholder="Type a sector name"
                      autoComplete="off"
                    />
                    {showSectorMatches && filteredSectors.length ? (
                      <div className="members-universe__typeahead-list">
                        {filteredSectors.map((sector) => (
                          <button
                            key={sector.uid}
                            type="button"
                            className={`members-universe__typeahead-option${
                              sector.uid === selectedSectorUid ? " is-active" : ""
                            }`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              commitSectorSelection(sector);
                            }}
                          >
                            <strong>{sector.name ?? formatSwcDisplayId(sector.uid)}</strong>
                            <span className="small">{formatSwcDisplayId(sector.uid)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button className="btn" type="button" onClick={handleGoToSector}>
                    Go to Sector
                  </button>
                </div>
              </div>

              <div className="members-universe__field">
                <label className="small">Star Chart Coordinates</label>
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

              <div className="members-universe__field">
                <label className="small" htmlFor="members-universe-system">
                  System
                </label>
                <div className="members-universe__inline members-universe__sector-picker">
                  <div className="members-universe__typeahead">
                    <input
                      id="members-universe-system"
                      className="input"
                      value={systemQuery}
                      onChange={(event) => {
                        setSystemQuery(event.target.value);
                        setShowSystemMatches(true);
                      }}
                      onFocus={() => setShowSystemMatches(true)}
                      onBlur={() => {
                        window.setTimeout(() => setShowSystemMatches(false), 120);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleGoToSystem();
                        }
                      }}
                      placeholder="Type a system name"
                      autoComplete="off"
                    />
                    {showSystemMatches && filteredSystems.length ? (
                      <div className="members-universe__typeahead-list">
                        {filteredSystems.map((system) => {
                          const systemKey = system.identifier ?? system.uid ?? "";
                          return (
                            <button
                              key={systemKey}
                              type="button"
                              className={`members-universe__typeahead-option${
                                systemKey === selectedSystemIdentifier ? " is-active" : ""
                              }`}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                commitSystemSelection(system);
                              }}
                            >
                              <strong>{system.name ?? systemKey}</strong>
                              <span className="small">
                                {system.sector_name ??
                                  formatSwcDisplayId(system.sector_uid, "Unknown sector")}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <button className="btn" type="button" onClick={handleGoToSystem}>
                    Go to System
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
        </div>
      }
    />
  );

  if (loading) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Astrogation</h2>
          <p className="small" style={{ margin: 0 }}>
            Preparing navigation charts…
          </p>
        </div>
        <div className="admin-panel__body">
          <SpinnerLoadingCard
            compact
            title="Preparing Astrogation Chart"
            tip="Scouts are aligning star charts, checking hyperspace lanes, and clearing mass shadows."
          />
        </div>
      </section>
    );
  }

  if (error && sectors.length === 0) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Astrogation</h2>
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
    <div className="members-universe">{mapElement}</div>
  );
};

export default MembersUniversePanel;
