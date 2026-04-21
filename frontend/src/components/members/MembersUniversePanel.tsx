import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GalaxySectorMap from "../maps/GalaxySectorMap";
import {
  saveStoredSearchRecord,
  getStoredMapSystems,
  getStoredMapSystemsInBounds,
  getStoredSearchRecords,
  getStoredSearchRecordsInBounds,
  saveStoredCellAnnotation,
  getStoredCellAnnotations,
  getStoredSectors,
  getStoredSystem,
  type GalaxyBounds,
  type SectorCellAnnotation,
  type SectorSearchRecord,
  type StoredMapSystem,
  type StoredSectorSummary,
  type StoredSystemDetail,
} from "../../api/universe";
import { fetchAuthMe, type SwcUser } from "../../api/auth";
import { canAccessAdmin, canViewAsteroidIntel, canViewScanWindow } from "../../auth/permissions";
import {
  getSwcAuthorizationStatus,
  importSwcPersonalEvents,
  updateSwcAuthorizationPreferences,
  type SwcAuthorizationStatus,
  type SwcPersonalEventsImportResponse,
} from "../../api/swcAuthorization";
import SpinnerLoadingCard from "../common/SpinnerLoadingCard";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
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

type MapScope = "sector" | "galaxy";

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

function sectorBoundsMayTouch(
  left: StoredSectorSummary["bounds"] | null | undefined,
  right: StoredSectorSummary["bounds"] | null | undefined
) {
  if (!left || !right) {
    return false;
  }

  return !(
    left.max_galx < right.min_galx - 1 ||
    left.min_galx > right.max_galx + 1 ||
    left.max_galy < right.min_galy - 1 ||
    left.min_galy > right.max_galy + 1
  );
}

function sectorsAppearToTouch(
  selectedSector: StoredSectorSummary,
  candidateSector: StoredSectorSummary
) {
  if (selectedSector.uid === candidateSector.uid) {
    return true;
  }

  if (!sectorBoundsMayTouch(selectedSector.bounds, candidateSector.bounds)) {
    return false;
  }

  const selectedOutline = selectedSector.outline_coordinates ?? [];
  const candidateOutline = candidateSector.outline_coordinates ?? [];

  if (!selectedOutline.length || !candidateOutline.length) {
    return true;
  }

  const selectedPoints = new Set(selectedOutline.map((point) => `${point.galx}:${point.galy}`));

  return candidateOutline.some((point) => {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (selectedPoints.has(`${point.galx + dx}:${point.galy + dy}`)) {
          return true;
        }
      }
    }

    return false;
  });
}

function pointInSectorOutline(
  galx: number,
  galy: number,
  outline: StoredSectorSummary["outline_coordinates"] | null | undefined
) {
  if (!outline || outline.length < 3) {
    return false;
  }

  const x = galx + 0.5;
  const y = galy + 0.5;
  let inside = false;

  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const xi = outline[i]?.galx;
    const yi = outline[i]?.galy;
    const xj = outline[j]?.galx;
    const yj = outline[j]?.galy;

    if (
      !Number.isFinite(xi) ||
      !Number.isFinite(yi) ||
      !Number.isFinite(xj) ||
      !Number.isFinite(yj)
    ) {
      continue;
    }

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function sectorContainsCoordinates(
  sector: StoredSectorSummary,
  galx: number,
  galy: number
) {
  const bounds = sector.bounds;
  if (
    bounds &&
    (galx < bounds.min_galx ||
      galx > bounds.max_galx ||
      galy < bounds.min_galy ||
      galy > bounds.max_galy)
  ) {
    return false;
  }

  if (sector.outline_coordinates?.length) {
    return pointInSectorOutline(galx, galy, sector.outline_coordinates);
  }

  return Boolean(bounds);
}

function dedupeByKey<T>(items: T[], keyOf: (item: T) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

const MembersUniversePanel: React.FC = () => {
  const navigate = useNavigate();
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<StoredSectorSummary[]>([]);
  const [mapSystems, setMapSystems] = useState<StoredMapSystem[]>([]);
  const [systemSearchOptions, setSystemSearchOptions] = useState<StoredMapSystem[]>([]);
  const [mapScope, setMapScope] = useState<MapScope>("sector");
  const [selectedSectorUid, setSelectedSectorUid] = useState("");
  const [sectorQuery, setSectorQuery] = useState("");
  const [showSectorMatches, setShowSectorMatches] = useState(false);
  const [systemQuery, setSystemQuery] = useState("");
  const [showSystemMatches, setShowSystemMatches] = useState(false);
  const [selectedSystemIdentifier, setSelectedSystemIdentifier] = useState("");
  const [systemDetailCache, setSystemDetailCache] = useState<Record<string, StoredSystemDetail>>({});
  const [sectorScopeSystemsData, setSectorScopeSystemsData] = useState<StoredMapSystem[]>([]);
  const [sectorScopeAnnotationsData, setSectorScopeAnnotationsData] = useState<SectorCellAnnotation[]>([]);
  const [sectorScopeSearchRecordsData, setSectorScopeSearchRecordsData] = useState<SectorSearchRecord[]>([]);
  const [annotationCacheBySector, setAnnotationCacheBySector] = useState<
    Record<string, SectorCellAnnotation[]>
  >({});
  const [mapSearchRecords, setMapSearchRecords] = useState<SectorSearchRecord[]>([]);
  const [globalMapDataLoading, setGlobalMapDataLoading] = useState(false);
  const [globalMapDataLoaded, setGlobalMapDataLoaded] = useState(false);
  const [globalMapTransitioning, setGlobalMapTransitioning] = useState(false);
  const [locationX, setLocationX] = useState("");
  const [locationY, setLocationY] = useState("");
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const [eventsImportLoading, setEventsImportLoading] = useState(false);
  const [eventsImportError, setEventsImportError] = useState<string | null>(null);
  const [eventsImportResult, setEventsImportResult] = useState<SwcPersonalEventsImportResponse | null>(null);
  const universePreferencesSaveTimerRef = useRef<number | null>(null);
  const annotationLoadPromisesRef = useRef<Record<string, Promise<SectorCellAnnotation[]>>>({});
  const systemSearchLoadedRef = useRef(false);
  const systemSearchLoadPromiseRef = useRef<Promise<void> | null>(null);
  const oauthParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const swcOauthError = oauthParams.get("swc_oauth_error");
  const mapAnnotations = useMemo(
    () => Object.values(annotationCacheBySector).flat(),
    [annotationCacheBySector]
  );
  const loadedAnnotationSectorUids = useMemo(
    () => Object.keys(annotationCacheBySector),
    [annotationCacheBySector]
  );
  const canSeeAsteroidIntel = canViewAsteroidIntel(viewer);
  const canSeeScanWindow = canViewScanWindow(viewer);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [authResponse, swcAuthResponse, sectorsResponse] = await Promise.all([
          fetchAuthMe(),
          getSwcAuthorizationStatus(),
          getStoredSectors(),
        ]);

        if (cancelled) return;

        setViewer(authResponse.user ?? null);
        setSwcAuth(swcAuthResponse.data ?? null);
        const nextSectors = sectorsResponse.data ?? [];
        const persistedState = swcAuthResponse.data?.member_tool_preferences?.universe ?? null;
        const preferredSectorUid =
          persistedState?.selected_sector_uid &&
          nextSectors.some((sector) => sector.uid === persistedState.selected_sector_uid)
            ? persistedState.selected_sector_uid
            : null;
        const firstSectorUid = preferredSectorUid ?? nextSectors[0]?.uid ?? "";

        setSectors(nextSectors);
        setSelectedSectorUid(firstSectorUid);
        setSectorQuery("");
        setError(null);

        if (persistedState?.map_scope) {
          setMapScope(persistedState.map_scope);
        }

        if (persistedState?.selected_system_identifier) {
          setSelectedSystemIdentifier(persistedState.selected_system_identifier);
        }

        if (persistedState?.focus_request) {
          const restoredFocus = persistedState.focus_request;
          setFocusRequest({
            ...restoredFocus,
            zoom: restoredFocus.zoom ?? undefined,
            nonce: Date.now(),
          });
        } else if (firstSectorUid) {
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
    if (!viewer || !swcAuth) {
      return;
    }

    const nextUniversePreferences = {
      map_scope: mapScope,
      selected_sector_uid: selectedSectorUid || null,
      selected_system_identifier: selectedSystemIdentifier || null,
      focus_request: focusRequest
        ? focusRequest.kind === "sector"
          ? {
              kind: "sector" as const,
              sectorUid: focusRequest.sectorUid,
              zoom: focusRequest.zoom ?? null,
            }
          : {
              kind: "coords" as const,
              galx: focusRequest.galx,
              galy: focusRequest.galy,
              zoom: focusRequest.zoom ?? null,
            }
        : null,
    };

    const currentUniversePreferences = swcAuth.member_tool_preferences?.universe;
    if (JSON.stringify(currentUniversePreferences ?? null) === JSON.stringify(nextUniversePreferences)) {
      return;
    }

    if (universePreferencesSaveTimerRef.current) {
      window.clearTimeout(universePreferencesSaveTimerRef.current);
    }

    universePreferencesSaveTimerRef.current = window.setTimeout(() => {
      void updateSwcAuthorizationPreferences({
        galaxy: swcAuth.member_tool_preferences?.galaxy ?? true,
        payments: swcAuth.member_tool_preferences?.payments ?? true,
        universe: nextUniversePreferences,
      })
        .then((response) => {
          setSwcAuth((current) =>
            current
              ? {
                  ...current,
                  member_tool_preferences: response.data.member_tool_preferences,
                }
              : current
          );
        })
        .catch(() => {});
    }, 400);

    return () => {
      if (universePreferencesSaveTimerRef.current) {
        window.clearTimeout(universePreferencesSaveTimerRef.current);
      }
    };
  }, [focusRequest, mapScope, selectedSectorUid, selectedSystemIdentifier, swcAuth, viewer]);

  const selectedSectorSummary = useMemo(
    () => sectors.find((sector) => sector.uid === selectedSectorUid) ?? null,
    [selectedSectorUid, sectors]
  );
  const selectedSectorCluster = useMemo(() => {
    if (!selectedSectorSummary) {
      return [];
    }

    return sectors.filter((sector) => sectorsAppearToTouch(selectedSectorSummary, sector));
  }, [selectedSectorSummary, sectors]);
  const selectedSectorClusterUids = useMemo(
    () => selectedSectorCluster.map((sector) => sector.uid),
    [selectedSectorCluster]
  );
  const selectedSectorClusterBounds = useMemo<GalaxyBounds | null>(() => {
    const bounds = selectedSectorCluster
      .map((sector) => sector.bounds)
      .filter((value): value is NonNullable<StoredSectorSummary["bounds"]> => !!value);

    if (!bounds.length) {
      return null;
    }

    return {
      min_galx: Math.min(...bounds.map((bound) => bound.min_galx)),
      max_galx: Math.max(...bounds.map((bound) => bound.max_galx)),
      min_galy: Math.min(...bounds.map((bound) => bound.min_galy)),
      max_galy: Math.max(...bounds.map((bound) => bound.max_galy)),
    };
  }, [selectedSectorCluster]);
  const selectedSectorClusterBoundsKey = useMemo(
    () =>
      selectedSectorClusterBounds
        ? [
            selectedSectorClusterBounds.min_galx,
            selectedSectorClusterBounds.max_galx,
            selectedSectorClusterBounds.min_galy,
            selectedSectorClusterBounds.max_galy,
          ].join(":")
        : "none",
    [selectedSectorClusterBounds]
  );
  const availableSystemSearchOptions = useMemo(
    () =>
      dedupeByKey(
        [
          ...systemSearchOptions,
          ...sectorScopeSystemsData,
          ...mapSystems,
        ],
        (system) =>
          system.uid ??
          system.identifier ??
          `${system.sector_uid ?? "unknown"}:${system.galx ?? "?"}:${system.galy ?? "?"}:${system.name ?? ""}`
      ),
    [mapSystems, sectorScopeSystemsData, systemSearchOptions]
  );
  const sectorScopeSystems = useMemo(
    () =>
      dedupeByKey(
        sectorScopeSystemsData,
        (system) =>
          system.uid ??
          system.identifier ??
          `${system.sector_uid ?? "unknown"}:${system.galx ?? "?"}:${system.galy ?? "?"}:${system.name ?? ""}`
      ),
    [sectorScopeSystemsData]
  );
  const sectorScopeAnnotations = useMemo(
    () =>
      dedupeByKey(
        sectorScopeAnnotationsData,
        (annotation) => String(annotation.id ?? `${annotation.sector_uid}:${annotation.galx}:${annotation.galy}`)
      ),
    [sectorScopeAnnotationsData]
  );
  const sectorScopeSearchRecords = useMemo(
    () =>
      dedupeByKey(
        sectorScopeSearchRecordsData,
        (record) => String(record.id ?? `${record.galx}:${record.galy}`)
      ),
    [sectorScopeSearchRecordsData]
  );
  async function loadSectorScopeData(bounds: GalaxyBounds | null) {
    if (!bounds) {
      setSectorScopeSystemsData([]);
      setSectorScopeAnnotationsData([]);
      setSectorScopeSearchRecordsData([]);
      return;
    }

    const [systemsResponse, annotationsResponse, searchRecordsResponse] = await Promise.all([
      getStoredMapSystemsInBounds(bounds),
      getStoredCellAnnotations({ bounds }),
      getStoredSearchRecordsInBounds(bounds),
    ]);

    const nextSystems = systemsResponse.data ?? [];
    const nextAnnotations = annotationsResponse.data ?? [];
    const nextSearchRecords = searchRecordsResponse.data ?? [];

    setSectorScopeSystemsData(nextSystems);
    setSectorScopeAnnotationsData(nextAnnotations);
    setSectorScopeSearchRecordsData(nextSearchRecords);
    setAnnotationCacheBySector((current) => {
      const grouped = nextAnnotations.reduce<Record<string, SectorCellAnnotation[]>>((acc, annotation) => {
        const sectorUid = annotation.sector_uid ?? "";
        if (!sectorUid) {
          return acc;
        }

        const existing = acc[sectorUid] ?? [];
        acc[sectorUid] = [...existing, annotation];
        return acc;
      }, {});

      return {
        ...current,
        ...grouped,
      };
    });
  }

  async function ensureSystemSearchOptionsLoaded() {
    if (systemSearchLoadedRef.current) {
      return;
    }

    if (!systemSearchLoadPromiseRef.current) {
      systemSearchLoadPromiseRef.current = (async () => {
        const systemsResponse = await getStoredMapSystems();
        setSystemSearchOptions(systemsResponse.data ?? []);
        systemSearchLoadedRef.current = true;
      })()
        .catch((loadError) => {
          systemSearchLoadPromiseRef.current = null;
          throw loadError;
        })
        .finally(() => {
          systemSearchLoadPromiseRef.current = null;
        });
    }

    await systemSearchLoadPromiseRef.current;
  }

  useEffect(() => {
    if (!selectedSectorUid) {
      setSelectedSystemIdentifier("");
      return;
    }
    setSelectedSystemIdentifier((current) => {
      const matchingSystem = sectorScopeSystems.find(
        (system: StoredMapSystem) => system.identifier === current || system.uid === current
      );

      if (matchingSystem) {
        return current;
      }

      return (
        sectorScopeSystems.find((system) => system.sector_uid === selectedSectorUid)?.identifier ??
        sectorScopeSystems.find((system) => system.sector_uid === selectedSectorUid)?.uid ??
        sectorScopeSystems[0]?.identifier ??
        sectorScopeSystems[0]?.uid ??
        ""
      );
    });
  }, [sectorScopeSystems, selectedSectorUid]);

  useEffect(() => {
    if (mapScope !== "sector") {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadSectorScopeData(selectedSectorClusterBounds);

        if (!cancelled) {
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load connected sector detail.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapScope, selectedSectorClusterBoundsKey]);

  async function handleEnableWholeGalaxy() {
    if (mapScope === "galaxy" || globalMapDataLoading) {
      return;
    }

    if (globalMapDataLoaded) {
      setGlobalMapTransitioning(true);
      setMapScope("galaxy");
      return;
    }

    try {
      setError(null);
      setGlobalMapDataLoading(true);
      setGlobalMapTransitioning(true);

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });

      const [systemsResponse, searchRecordsResponse] = await Promise.all([
        getStoredMapSystems(),
        getStoredSearchRecords(),
      ]);

      startTransition(() => {
        setMapSystems(systemsResponse.data ?? []);
        setMapSearchRecords(searchRecordsResponse.data ?? []);
        setGlobalMapDataLoaded(true);
        setMapScope("galaxy");
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load full galaxy map data.");
      setGlobalMapTransitioning(false);
    } finally {
      setGlobalMapDataLoading(false);
    }
  }

  useEffect(() => {
    if (!(mapScope === "galaxy" && globalMapTransitioning)) {
      return;
    }

    let cancelled = false;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          setGlobalMapTransitioning(false);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [globalMapTransitioning, mapScope]);

  async function ensureSectorAnnotationsLoaded(sectorUid: string) {
    if (!sectorUid) {
      return [];
    }

    const cached =
      mapScope === "sector"
        ? sectorScopeAnnotations.filter((annotation) => annotation.sector_uid === sectorUid)
        : annotationCacheBySector[sectorUid];
    if (cached) {
      return cached;
    }

    const pending = annotationLoadPromisesRef.current[sectorUid];
    if (pending) {
      return pending;
    }

    const nextPromise = getStoredCellAnnotations({ sectorUid })
      .then((response) => response.data ?? [])
      .finally(() => {
        delete annotationLoadPromisesRef.current[sectorUid];
      });

    annotationLoadPromisesRef.current[sectorUid] = nextPromise;
    return nextPromise;
  }

  async function refreshSelectedSectorDetail() {
    if (!selectedSectorClusterBounds) {
      return null;
    }

    await loadSectorScopeData(selectedSectorClusterBounds);
    return null;
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
      return availableSystemSearchOptions.slice(0, 12);
    }

    return availableSystemSearchOptions
      .filter((system: StoredMapSystem) => {
        const name = String(system.name ?? "").toLowerCase();
        const identifier = String(system.identifier ?? "").toLowerCase();
        const uid = String(system.uid ?? "").toLowerCase();
        return (
          name.includes(query) || identifier.includes(query) || uid.includes(query)
        );
      })
      .slice(0, 12);
  }, [availableSystemSearchOptions, systemQuery]);

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

  async function handleGoToSystem() {
    try {
      await ensureSystemSearchOptionsLoaded();
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stored systems.");
      return;
    }

    const query = systemQuery.trim().toLowerCase();
    const resolvedSystem =
      availableSystemSearchOptions.find((system: StoredMapSystem) => {
        const identifier = String(system.identifier ?? "").toLowerCase();
        const uid = String(system.uid ?? "").toLowerCase();
        return identifier === query || uid === query;
      }) ??
      availableSystemSearchOptions.find((system: StoredMapSystem) => String(system.name ?? "").toLowerCase() === query) ??
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
    const containingSector =
      sectors.find((sector) => sectorContainsCoordinates(sector, galx, galy)) ?? null;

    if (containingSector) {
      commitSectorSelection(containingSector);
      setMapScope("sector");
    }

    setFocusRequest({
      kind: "coords",
      galx,
      galy,
      nonce: Date.now(),
      zoom: 1,
    });
  }

  function handleMapSystemSelect(systemIdentifier: string, sectorUid?: string | null) {
    const availableSystems =
      mapScope === "sector"
        ? sectorScopeSystems
        : mapSystems;
    const mapSystem =
      availableSystems.find(
        (system: StoredMapSystem) => system.identifier === systemIdentifier || system.uid === systemIdentifier
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

  function handleMapLocationSelect(galx: number, galy: number, sectorUid?: string | null) {
    navigate(`/members/universe/location/${encodeURIComponent(String(galx))}/${encodeURIComponent(String(galy))}`, {
      state: {
        fromUniverseMap: true,
        sectorUid: sectorUid ?? null,
        galx,
        galy,
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

      const nextSectorAnnotations = response.data ? [...filtered, response.data] : filtered;

      return {
        ...current,
        [payload.sector_uid]: nextSectorAnnotations,
      };
    });

    setSectorScopeAnnotationsData((current) => {
      const filtered = current.filter(
        (entry) => !(entry.galx === payload.galx && entry.galy === payload.galy)
      );
      return response.data ? [...filtered, response.data] : filtered;
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
    setSectorScopeSearchRecordsData((current) => {
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
    if (mapScope === "sector") {
      await refreshSelectedSectorDetail();
      return;
    }

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
      const statusCode = Number(e?.status ?? 0);
      const isReconnectStatus = statusCode === 401 || statusCode === 403 || statusCode === 422;
      const normalizedMessage =
        isReconnectStatus || /timed out|expired|reconnect|not connected|unauthenticated|forbidden/i.test(message)
          ? "Your SWC Astrogation access session has timed out. Please reconnect your access and try again."
          : message;

      setEventsImportError(normalizedMessage);
    } finally {
      setEventsImportLoading(false);
    }
  }

  const mapElement = (
    <GalaxySectorMap
      sectors={
        mapScope === "sector"
          ? selectedSectorCluster
          : sectors
      }
      systemMarkers={
        mapScope === "sector"
          ? sectorScopeSystems
          : mapSystems
      }
      activeSectorUid={selectedSectorUid || undefined}
      annotations={
        mapScope === "sector"
          ? sectorScopeAnnotations
          : mapAnnotations
      }
      loadedAnnotationSectorUids={
        mapScope === "sector"
          ? selectedSectorClusterUids
          : loadedAnnotationSectorUids
      }
      searchRecords={
        mapScope === "sector"
          ? sectorScopeSearchRecords
          : mapSearchRecords
      }
      canViewCellIntel={canSeeAsteroidIntel}
      canViewScanWindow={canSeeScanWindow}
      onSelectSector={setSelectedSectorUid}
      onSystemSelect={handleMapSystemSelect}
      onLocationSelect={handleMapLocationSelect}
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

            <div className="members-universe__field">
              <label className="small">Map Scope</label>
              <div className="members-universe__inline">
                <button
                  className={`btn${mapScope === "sector" ? "" : " btn--ghost"}`}
                  type="button"
                  onClick={() => setMapScope("sector")}
                  disabled={globalMapDataLoading}
                >
                  Selected Sector
                </button>
                <button
                  className={`btn${mapScope === "galaxy" ? "" : " btn--ghost"}`}
                  type="button"
                  onClick={() => {
                    void handleEnableWholeGalaxy();
                  }}
                  disabled={globalMapDataLoading}
                >
                  {globalMapDataLoading ? "Loading Galaxy…" : "Whole Galaxy"}
                </button>
              </div>
              <p className="small" style={{ margin: 0 }}>
                {mapScope === "sector"
                  ? "Selected Sector loads the active sector plus the sectors touching it, so edge cells keep their intel."
                  : "Whole Galaxy loads the full map the way it works today."}
              </p>
              {globalMapDataLoading || globalMapTransitioning ? (
                <p className="small" style={{ margin: 0 }}>
                  Loading full galaxy systems and intel…
                </p>
              ) : null}
            </div>

            <div className="members-universe__controls">
              <div className="members-universe__field">
                <label className="small" htmlFor="members-universe-sector">
                  Sector
                </label>
                <div className="members-universe__inline members-universe__sector-picker">
                  <SearchSuggestionPicker
                    id="members-universe-sector"
                    value={sectorQuery}
                    onChange={setSectorQuery}
                    onSubmit={handleGoToSector}
                    placeholder="Type a sector name"
                    suggestions={filteredSectors}
                    showSuggestions={showSectorMatches}
                    onShowSuggestions={setShowSectorMatches}
                    getKey={(sector) => sector.uid}
                    isActive={(sector) => sector.uid === selectedSectorUid}
                    onSelect={commitSectorSelection}
                    renderSuggestion={(sector) => (
                      <>
                        <strong>{sector.name ?? formatSwcDisplayId(sector.uid)}</strong>
                        <span className="small">{formatSwcDisplayId(sector.uid)}</span>
                      </>
                    )}
                  />
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
                        void ensureSystemSearchOptionsLoaded().catch(() => {});
                      }}
                      onFocus={() => {
                        setShowSystemMatches(true);
                        void ensureSystemSearchOptionsLoaded().catch(() => {});
                      }}
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
                        {filteredSystems.map((system: StoredMapSystem) => {
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
    <div className="members-universe">
      <div style={{ position: "relative" }}>
        {mapElement}
        {globalMapDataLoading || globalMapTransitioning ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              background: "rgba(2,3,4,0.72)",
              backdropFilter: "blur(2px)",
            }}
          >
            <SpinnerLoadingCard
              compact
              title="Building Full Galaxy View"
              tip="Long-range astrogation charts are being stitched together. Selected Sector mode is lighter, but Whole Galaxy needs the full intel set."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MembersUniversePanel;
