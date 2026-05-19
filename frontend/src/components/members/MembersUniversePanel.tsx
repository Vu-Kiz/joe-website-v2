import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  saveStoredSearchRecord,
  saveSubscriberCellRecord,
  getSubscriberCellRecords,
  adminGetAllSubscriberCellRecords,
  getStoredMapSystems,
  saveStoredCellAnnotation,
  getStoredSectors,
  getStoredSystem,
  type SectorCellAnnotation,
  type SectorSearchRecord,
  type StoredMapSystem,
  type StoredSectorSummary,
  type StoredSystemDetail,
} from "../../api/universe";
import { getApiBaseUrl, getBackendOrigin } from "../../api/auth";
import type { SwcUser } from "../../api/auth";
import { canAccessAdmin, canAccessDroidBrain, canViewAsteroidIntel, canViewScanWindow, getToolAccessTier } from "../../auth/permissions";
import { uploadDroidBrainFile, type DroidBrainUploadResult } from "../../api/droidbrain";
import {
  getSwcAuthorizationStatus,
  getSwcImportLogs,
  clearSwcImportLogs,
  importSwcPersonalEvents,
  updateSwcAuthorizationPreferences,
  type ImportLogEntry,
  type SwcAuthorizationStatus,
  type SwcPersonalEventsImportResponse,
} from "../../api/swcAuthorization";
import SpinnerLoadingCard from "../common/SpinnerLoadingCard";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import DroidBrainUploadPanel from "../droidbrain/DroidBrainUploadPanel";
import "../../styles/_membersuniverse.sass";

const DeckGalaxyMap = lazy(() => import("../maps/DeckGalaxyMap"));
const SHOW_PERF_QUERY = "map_perf";
const MAX_DROIDBRAIN_UPLOAD_FILES = 10;

type GalaxySnapshotResult = {
  systems: StoredMapSystem[];
  searchRecords: SectorSearchRecord[];
  annotationsBySector: Record<string, SectorCellAnnotation[]>;
};

type CachedGalaxySnapshot = {
  key: string;
  revision: string;
  systems: StoredMapSystem[];
  searchRecords: SectorSearchRecord[];
  annotationsBySector: Record<string, SectorCellAnnotation[]>;
  updated_at: string;
};

type GalaxyWorkerInbound =
  | { type: "load"; requestId: number; apiBase: string }
  | { type: "cancel" };

type GalaxyWorkerOutbound =
  | {
      type: "result";
      requestId: number;
      revision: string;
      systems: StoredMapSystem[];
      searchRecords: SectorSearchRecord[];
      annotationsBySector: Record<string, SectorCellAnnotation[]>;
    }
  | { type: "error"; requestId: number; message: string; status?: number };

const GALAXY_SNAPSHOT_DB_NAME = "joe-galaxy-snapshot-cache";
const GALAXY_SNAPSHOT_DB_VERSION = 1;
const GALAXY_SNAPSHOT_STORE = "snapshots";
const GALAXY_SNAPSHOT_CACHE_KEY = "galaxy:latest";

function openGalaxySnapshotDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(GALAXY_SNAPSHOT_DB_NAME, GALAXY_SNAPSHOT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GALAXY_SNAPSHOT_STORE)) {
        db.createObjectStore(GALAXY_SNAPSHOT_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readCachedGalaxySnapshot(key: string): Promise<CachedGalaxySnapshot | null> {
  const db = await openGalaxySnapshotDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(GALAXY_SNAPSHOT_STORE, "readonly");
    const store = tx.objectStore(GALAXY_SNAPSHOT_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as CachedGalaxySnapshot | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

async function writeCachedGalaxySnapshot(snapshot: CachedGalaxySnapshot): Promise<void> {
  const db = await openGalaxySnapshotDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(GALAXY_SNAPSHOT_STORE, "readwrite");
    const store = tx.objectStore(GALAXY_SNAPSHOT_STORE);
    store.put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

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
      highlightCell?: boolean;
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

type MembersUniversePanelProps = {
  viewer: SwcUser | null;
  swcAuthFromParent: SwcAuthorizationStatus | null;
  onSwcAuthChange?: (next: SwcAuthorizationStatus | null) => void;
  forcePublicTier?: boolean;
};

const MembersUniversePanel: React.FC<MembersUniversePanelProps> = ({
  viewer,
  swcAuthFromParent,
  onSwcAuthChange,
  forcePublicTier = false,
}) => {
  const navigate = useNavigate();
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(swcAuthFromParent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<StoredSectorSummary[]>([]);
  const [mapSystems, setMapSystems] = useState<StoredMapSystem[]>([]);
  const [systemSearchOptions, setSystemSearchOptions] = useState<StoredMapSystem[]>([]);
  const [selectedSectorUid, setSelectedSectorUid] = useState("");
  const [sectorQuery, setSectorQuery] = useState("");
  const [showSectorMatches, setShowSectorMatches] = useState(false);
  const [systemQuery, setSystemQuery] = useState("");
  const [showSystemMatches, setShowSystemMatches] = useState(false);
  const [selectedSystemIdentifier, setSelectedSystemIdentifier] = useState("");
  const [systemDetailCache, setSystemDetailCache] = useState<Record<string, StoredSystemDetail>>({});
  const systemDetailCacheRef = useRef<Record<string, StoredSystemDetail>>({});
  useEffect(() => { systemDetailCacheRef.current = systemDetailCache; }, [systemDetailCache]);
  const [annotationCacheBySector, setAnnotationCacheBySector] = useState<
    Record<string, SectorCellAnnotation[]>
  >({});
  const [mapSearchRecords, setMapSearchRecords] = useState<SectorSearchRecord[]>([]);
  const [globalMapDataLoading, setGlobalMapDataLoading] = useState(false);
  const [globalMapDataLoaded, setGlobalMapDataLoaded] = useState(false);
  const showPerfDebug = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get(SHOW_PERF_QUERY) === "1";
  }, []);
  const [locationX, setLocationX] = useState("");
  const [locationY, setLocationY] = useState("");
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const [galaxyCameraPosition, setGalaxyCameraPosition] = useState<{ galx: number; galy: number; zoom: number } | null>(null);
  const [eventsImportLoading, setEventsImportLoading] = useState(false);
  const [eventsImportError, setEventsImportError] = useState<string | null>(null);
  const [eventsImportResult, setEventsImportResult] = useState<SwcPersonalEventsImportResponse | null>(null);
  const [droidbrainUploading, setDroidbrainUploading] = useState(false);
  const [droidbrainUploadStatus, setDroidbrainUploadStatus] = useState<string | null>(null);
  const [droidbrainUploadResults, setDroidbrainUploadResults] = useState<DroidBrainUploadResult[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLogEntry[]>([]);
  const [importLogsLoading, setImportLogsLoading] = useState(false);
  const [subscriberOverlayActive, setSubscriberOverlayActive] = useState(false);
  const [subscriberOverlayLoading, setSubscriberOverlayLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const universePreferencesSaveTimerRef = useRef<number | null>(null);
  const swcAuthRef = useRef(swcAuth);
  useEffect(() => { swcAuthRef.current = swcAuth; }, [swcAuth]);
  const systemSearchLoadedRef = useRef(false);
  const systemSearchLoadPromiseRef = useRef<Promise<void> | null>(null);
  const galaxyWorkerRef = useRef<Worker | null>(null);
  const galaxyWorkerRequestIdRef = useRef(0);
  const subscriberRecordsRef = useRef<SectorSearchRecord[]>([]);
  const oauthParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const swcOauthError = oauthParams.get("swc_oauth_error");
  const mapAnnotations = useMemo(
    () => Object.values(annotationCacheBySector).flat(),
    [annotationCacheBySector]
  );
  const canSeeAsteroidIntel = canViewAsteroidIntel(viewer);
  const canSeeScanWindow = canViewScanWindow(viewer) || !!(viewer?.is_joe_member);
  const isPublicTier = forcePublicTier || getToolAccessTier(viewer) === "public";

  useEffect(() => {
    setSwcAuth(swcAuthFromParent);
  }, [swcAuthFromParent]);

  useEffect(() => {
    const worker = new Worker(
      new URL("../../workers/galaxySnapshotWorker.ts", import.meta.url),
      { type: "module" }
    );
    galaxyWorkerRef.current = worker;

    worker.onmessage = (event: MessageEvent<GalaxyWorkerOutbound>) => {
      const msg = event.data;

      if (msg.type === "result") {
        if (msg.requestId !== galaxyWorkerRequestIdRef.current) return;
        applyGalaxySnapshotResult(msg);
        setGlobalMapDataLoaded(true);
        setGlobalMapDataLoading(false);
        void writeCachedGalaxySnapshot({
          key: GALAXY_SNAPSHOT_CACHE_KEY,
          revision: msg.revision,
          systems: msg.systems,
          searchRecords: msg.searchRecords,
          annotationsBySector: msg.annotationsBySector,
          updated_at: new Date().toISOString(),
        });
      }

      if (msg.type === "error") {
        if (msg.requestId !== galaxyWorkerRequestIdRef.current) return;
        setError(msg.message);
        setGlobalMapDataLoading(false);
      }
    };

    worker.onerror = () => {
      setError("Galaxy snapshot worker crashed. Please refresh the page.");
      setGlobalMapDataLoading(false);
    };

    return () => {
      worker.terminate();
      galaxyWorkerRef.current = null;
    };
  }, []);

  function applyGalaxySnapshotResult(result: GalaxySnapshotResult) {
    setMapSystems(result.systems);
    const subRecords = subscriberRecordsRef.current;
    if (subRecords.length > 0) {
      const byKey = new Map(result.searchRecords.map((r) => [`${r.galx},${r.galy}`, r]));
      for (const r of subRecords) {
        const key = `${r.galx},${r.galy}`;
        if (!byKey.has(key)) byKey.set(key, r);
      }
      setMapSearchRecords(Array.from(byKey.values()));
    } else {
      setMapSearchRecords(result.searchRecords);
    }
    setAnnotationCacheBySector((current) => ({
      ...current,
      ...result.annotationsBySector,
    }));
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [swcAuthResponse, sectorsResponse] = await Promise.all([
          swcAuthFromParent ? Promise.resolve({ data: swcAuthFromParent }) : getSwcAuthorizationStatus(),
          getStoredSectors(),
          getSwcImportLogs().then((r) => { if (r?.ok) setImportLogs(r.data ?? []); }).catch(() => {}),
        ]);

        if (cancelled) return;

        setSwcAuth(swcAuthResponse.data ?? null);
        onSwcAuthChange?.(swcAuthResponse.data ?? null);
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
          // Seed galaxyCameraPosition so the preference-saving effect has a valid
          // position when focusRequest is consumed and cleared by DeckGalaxyMap.
          if (restoredFocus.kind === "coords") {
            setGalaxyCameraPosition({
              galx: restoredFocus.galx,
              galy: restoredFocus.galy,
              zoom: restoredFocus.zoom ?? 3.5,
            });
          }
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
    const auth = swcAuthRef.current;
    if (!viewer || !auth) {
      return;
    }

    const nextUniversePreferences = {
      selected_sector_uid: selectedSectorUid || null,
      selected_system_identifier: selectedSystemIdentifier || null,
      focus_request: galaxyCameraPosition
        ? {
            kind: "coords" as const,
            galx: galaxyCameraPosition.galx,
            galy: galaxyCameraPosition.galy,
            zoom: galaxyCameraPosition.zoom,
          }
        : focusRequest
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

    const currentUniversePreferences = auth.member_tool_preferences?.universe;
    if (JSON.stringify(currentUniversePreferences ?? null) === JSON.stringify(nextUniversePreferences)) {
      return;
    }

    if (universePreferencesSaveTimerRef.current) {
      window.clearTimeout(universePreferencesSaveTimerRef.current);
    }

    universePreferencesSaveTimerRef.current = window.setTimeout(() => {
      const latestAuth = swcAuthRef.current;
      if (!latestAuth) return;
      void updateSwcAuthorizationPreferences({
        galaxy: latestAuth.member_tool_preferences?.galaxy ?? true,
        payments: latestAuth.member_tool_preferences?.payments ?? true,
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
  }, [focusRequest, galaxyCameraPosition, selectedSectorUid, selectedSystemIdentifier, viewer]);

  const availableSystemSearchOptions = useMemo(
    () =>
      dedupeByKey(
        [...systemSearchOptions, ...mapSystems],
        (system) =>
          system.uid ??
          system.identifier ??
          `${system.sector_uid ?? "unknown"}:${system.galx ?? "?"}:${system.galy ?? "?"}:${system.name ?? ""}`
      ),
    [mapSystems, systemSearchOptions]
  );

  async function loadGalaxySnapshotData({ silent = false }: { silent?: boolean } = {}) {
    const worker = galaxyWorkerRef.current;
    const apiBase = getApiBaseUrl();
    const requestId = ++galaxyWorkerRequestIdRef.current;

    if (!silent) {
      setGlobalMapDataLoading(true);
    }
    setError(null);

    const cached = await readCachedGalaxySnapshot(GALAXY_SNAPSHOT_CACHE_KEY);
    if (cached && galaxyWorkerRequestIdRef.current === requestId) {
      applyGalaxySnapshotResult(cached);
      setGlobalMapDataLoaded(true);
      setGlobalMapDataLoading(false);
    }

    worker?.postMessage({ type: "load", requestId, apiBase } as GalaxyWorkerInbound);
  }

  useEffect(() => {
    if (!globalMapDataLoaded && !globalMapDataLoading) {
      void loadGalaxySnapshotData().catch((e: any) => {
        setError(e?.message ?? "Failed to load galaxy data.");
        setGlobalMapDataLoading(false);
      });
    }
  }, [globalMapDataLoaded, globalMapDataLoading]);

  // After snapshot loads, merge in subscriber's own cell records
  useEffect(() => {
    if (!globalMapDataLoaded || !isPublicTier) return;
    void getSubscriberCellRecords().then((res) => {
      if (res.data?.length) {
        subscriberRecordsRef.current = res.data;
        setMapSearchRecords((current) => {
          const byKey = new Map(current.map((r) => [`${r.galx},${r.galy}`, r]));
          for (const r of res.data) byKey.set(`${r.galx},${r.galy}`, r);
          return Array.from(byKey.values());
        });
      }
    }).catch(() => {});
  }, [globalMapDataLoaded, isPublicTier]);

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

  const loadSystemDetailForMap = useCallback(async (systemIdentifier: string) => {
    const cached = systemDetailCacheRef.current[systemIdentifier];
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
  }, []);

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
      zoom: 4,
      highlightCell: true,
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
    }

    setFocusRequest({
      kind: "coords",
      galx,
      galy,
      nonce: Date.now(),
      zoom: 4,
      highlightCell: true,
    });
  }

  function handleMapSystemSelect(systemIdentifier: string, sectorUid?: string | null) {
    const mapSystem =
      mapSystems.find(
        (system: StoredMapSystem) => system.identifier === systemIdentifier || system.uid === systemIdentifier
      ) ?? null;
    const nextIdentifier = mapSystem?.uid ?? mapSystem?.identifier ?? systemIdentifier;

    navigate(`/tools/universe/system/${encodeURIComponent(nextIdentifier)}`, {
      state: {
        fromUniverseMap: true,
        sectorUid: sectorUid ?? mapSystem?.sector_uid ?? null,
        galx: mapSystem?.galx ?? null,
        galy: mapSystem?.galy ?? null,
      },
    });
  }

  function handleMapLocationSelect(galx: number, galy: number, sectorUid?: string | null) {
    navigate(`/tools/universe/location/${encodeURIComponent(String(galx))}/${encodeURIComponent(String(galy))}`, {
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
    const response = isPublicTier
      ? await saveSubscriberCellRecord(payload)
      : await saveStoredSearchRecord(payload);
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

  async function refreshSearchRecords({ silent = false }: { silent?: boolean } = {}) {
    if (isPublicTier) {
      const res = await getSubscriberCellRecords();
      if (res.data) {
        subscriberRecordsRef.current = res.data;
        setMapSearchRecords(res.data);
      }
      return;
    }
    await loadGalaxySnapshotData({ silent });
  }

  function handleResyncSwcAccess() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;

    if (isPublicTier) {
      const savedPreferences = swcAuth?.public_tool_preferences;
      const selectedTools = [
        savedPreferences?.astrogation !== false ? "astrogation" : null,
        savedPreferences?.payments !== false ? "payments" : null,
      ].filter((value): value is string => value !== null);
      const query = new URLSearchParams({
        return_to: "/tools",
        ...(selectedTools.length > 0 ? { tools: selectedTools.join(",") } : {}),
      });
      window.location.href = `${backendOrigin}/oauth/public-tools?${query.toString()}`;
      return;
    }

    const savedPreferences = swcAuth?.member_tool_preferences;
    const selectedTools = [
      savedPreferences?.galaxy !== false ? "galaxy" : null,
      savedPreferences?.payments !== false ? "payments" : null,
    ].filter((value): value is string => value !== null);
    const query = new URLSearchParams({
      return_to: "/tools",
      ...(selectedTools.length > 0 ? { tools: selectedTools.join(",") } : {}),
    });
    window.location.href = `${backendOrigin}/oauth/member-tools?${query.toString()}`;
  }

  async function loadImportLogs() {
    setImportLogsLoading(true);
    try {
      const response = await getSwcImportLogs();
      if (response?.ok) {
        setImportLogs(response.data ?? []);
      }
    } catch {
      // non-critical
    } finally {
      setImportLogsLoading(false);
    }
  }

  async function handleToggleSubscriberOverlay() {
    if (subscriberOverlayActive) {
      setSubscriberOverlayActive(false);
      await refreshSearchRecords({ silent: true });
      return;
    }
    setSubscriberOverlayLoading(true);
    try {
      const res = await adminGetAllSubscriberCellRecords();
      if (res.data) {
        setMapSearchRecords((current) => {
          const existing = new Map(current.map((r) => [`${r.galx},${r.galy}`, r]));
          for (const r of res.data!) {
            const key = `${r.galx},${r.galy}`;
            if (!existing.has(key)) existing.set(key, r);
          }
          return Array.from(existing.values());
        });
        setSubscriberOverlayActive(true);
      }
    } catch {
      // non-critical
    } finally {
      setSubscriberOverlayLoading(false);
    }
  }

  async function handleImportPersonalEvents() {
    if (!swcAuth?.has_personal_events_access) {
      setEventsImportError(
        "Astrogation access not granted. Please connect your SWC account and grant access before uploading data."
      );
      return;
    }
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
        refreshSearchRecords({ silent: true }),
        getSwcAuthorizationStatus().then((authResponse) => {
          const nextAuthState = authResponse.data ?? null;
          setSwcAuth(nextAuthState);
          onSwcAuthChange?.(nextAuthState);
        }),
        loadImportLogs(),
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

  const perfDebugStats = useMemo(() => {
    return {
      renderer: "DeckGL Galaxy Renderer",
      sectorsLoaded: sectors.length,
      systemsLoaded: mapSystems.length,
      recordsLoaded: mapSearchRecords.length,
      notesLoaded: mapAnnotations.length,
      loading: globalMapDataLoading,
    };
  }, [
    globalMapDataLoading,
    mapAnnotations.length,
    mapSearchRecords.length,
    mapSystems.length,
    sectors.length,
  ]);

  const controlsOverlay = (
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
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <p className="small" style={{ color: "salmon", margin: 0 }}>
              {eventsImportError}
            </p>
            <button className="btn btn--small" type="button" onClick={handleResyncSwcAccess}>
              Grant Astrogation Access
            </button>
          </div>
        ) : null}
        {eventsImportResult?.import ? (
          <p className="small" style={{ margin: 0 }}>
            Imported {eventsImportResult.import.created} new, updated {eventsImportResult.import.updated}, unchanged {eventsImportResult.import.unchanged}, skipped {eventsImportResult.import.skipped}.
          </p>
        ) : null}
      </section>

      {importLogs.length > 0 ? (
        <section className="members-universe__controller-section">
          <div className="members-universe__top-actions-copy">
            <h4 className="admin-card__title">Upload History</h4>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                await clearSwcImportLogs();
                setImportLogs([]);
              }}
            >
              Clear history
            </button>
          </div>
          <div className="members-universe__import-log">
            {importLogsLoading ? (
              <p className="small" style={{ margin: 0 }}>Loading…</p>
            ) : importLogs.map((log) => (
              <div key={log.id} className="members-universe__import-log-entry">
                <button
                  type="button"
                  className="members-universe__import-log-header"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                >
                  <span className="small">
                    {new Date(log.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <span className="small members-universe__import-log-counts">
                    {log.created > 0 ? <span className="members-universe__import-log-new">+{log.created} new</span> : null}
                    {log.updated > 0 ? <span className="members-universe__import-log-updated">{log.updated} updated</span> : null}
                    {log.created === 0 && log.updated === 0 ? <span>{log.unchanged} unchanged</span> : null}
                  </span>
                </button>
                {expandedLogId === log.id && log.areas.length > 0 ? (
                  <ul className="members-universe__import-log-areas">
                    {log.areas.map((area, i) => (
                      <li key={i} className="small">
                        <span className={`members-universe__import-log-action members-universe__import-log-action--${area.action}`}>
                          {area.action === "created" ? "+" : "~"}
                        </span>
                        {area.square_name ?? `(${area.galx}, ${area.galy})`}
                        <span className="members-universe__import-log-coords"> ({area.galx}, {area.galy})</span>
                        {area.has_asteroids ? <span className="members-universe__import-log-asteroid"> ★</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {viewer?.is_admin ? (
        <section className="members-universe__controller-section">
          <div className="members-universe__top-actions-copy">
            <h4 className="admin-card__title">Subscriber Scout Data</h4>
            <p className="small" style={{ margin: 0 }}>
              {subscriberOverlayActive
                ? "Subscriber cell records are merged into the map. Click to remove them."
                : "Merge all subscriber-uploaded cell records into the map view."}
            </p>
          </div>
          <div className="members-universe__top-actions-controls">
            <button
              className={`btn${subscriberOverlayActive ? " btn--ghost" : ""}`}
              type="button"
              onClick={handleToggleSubscriberOverlay}
              disabled={subscriberOverlayLoading}
            >
              {subscriberOverlayLoading
                ? "Loading..."
                : subscriberOverlayActive
                  ? "Remove Subscriber Data"
                  : "Show Subscriber Data"}
            </button>
          </div>
        </section>
      ) : null}

      {canAccessDroidBrain(viewer) ? (
        <section className="members-universe__controller-section">
          <DroidBrainUploadPanel
            compact
            uploading={droidbrainUploading}
            uploadStatus={droidbrainUploadStatus}
            uploadResults={droidbrainUploadResults}
            isSysadmin={Boolean(viewer?.is_sysadmin)}
            onUpload={async (files) => {
              try {
                setDroidbrainUploading(true);
                setDroidbrainUploadStatus(null);
                setDroidbrainUploadResults([]);
                const batch = files.slice(0, MAX_DROIDBRAIN_UPLOAD_FILES);
                const results: DroidBrainUploadResult[] = [];

                for (let index = 0; index < batch.length; index += 1) {
                  const file = batch[index];
                  setDroidbrainUploadStatus(`Uploading file ${index + 1} of ${batch.length}: ${file.name}`);
                  const response = await uploadDroidBrainFile(file);
                  results.push(response.data);
                  setDroidbrainUploadResults([...results]);
                }

                setDroidbrainUploadStatus("Refreshing map intel after upload…");
                await refreshSearchRecords({ silent: true });
              } catch (e: any) {
                setError(e?.message ?? "Failed to upload DroidBrain file.");
              } finally {
                setDroidbrainUploading(false);
                setDroidbrainUploadStatus(null);
              }
            }}
          />
        </section>
      ) : null}

      <section className="members-universe__controller-section">
        <div className="members-universe__top-actions-copy">
          <h4 className="admin-card__title">Navigation</h4>
          <p className="small" style={{ margin: 0 }}>
            Plot a course straight to a sector, system, or star chart coordinate.
          </p>
        </div>

        <div className="members-universe__controls">
          <div className="members-universe__field">
            <label className="small" htmlFor="deck-universe-sector">
              Sector
            </label>
            <div className="members-universe__inline members-universe__sector-picker">
              <SearchSuggestionPicker
                id="deck-universe-sector"
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
            <label className="small" htmlFor="deck-universe-system">
              System
            </label>
            <div className="members-universe__inline members-universe__sector-picker">
              <div className="members-universe__typeahead">
                <input
                  id="deck-universe-system"
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
                      void handleGoToSystem();
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
                            {system.sector_name ?? formatSwcDisplayId(system.sector_uid, "Unknown sector")}
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
        <Suspense
          fallback={
            <SpinnerLoadingCard
              title="Loading Galaxy Renderer"
              tip="Preparing DeckGL engine for whole-galaxy astrogation."
            />
          }
        >
          <DeckGalaxyMap
            sectors={sectors}
            systemMarkers={mapSystems}
            searchRecords={mapSearchRecords}
            annotations={mapAnnotations}
            canViewCellIntel={canSeeAsteroidIntel || isPublicTier}
            canViewScanWindow={canSeeScanWindow}
            canEditCellIntel={canAccessAdmin(viewer)}
            canViewSystemIds={canAccessAdmin(viewer)}
            isFullTier={!isPublicTier && getToolAccessTier(viewer) === "full"}
            activeSectorUid={selectedSectorUid || undefined}
            focusRequest={focusRequest}
            onClearFocusRequest={() => setFocusRequest(null)}
            onCameraChange={(galx, galy, zoom) => setGalaxyCameraPosition({ galx, galy, zoom })}
            onSelectSector={setSelectedSectorUid}
            onSystemSelect={handleMapSystemSelect}
            onLocationSelect={handleMapLocationSelect}
            onSaveAnnotation={handleSaveMapAnnotation}
            onSaveSearchRecord={handleSaveSearchRecord}
            loadSystemDetail={loadSystemDetailForMap}
            controlsOverlay={controlsOverlay}
          />
        </Suspense>
        {showPerfDebug ? (
          <div
            className="members-universe-map__status"
            style={{
              left: "0.85rem",
              right: "auto",
              top: "0.85rem",
              bottom: "auto",
              zIndex: 5,
              display: "grid",
              gap: "0.2rem",
            }}
          >
            <span className="small"><strong>Perf Debug Enabled</strong></span>
            <span className="small">Renderer: {perfDebugStats.renderer}</span>
            <span className="small">Sectors Loaded: {perfDebugStats.sectorsLoaded}</span>
            <span className="small">Systems Loaded: {perfDebugStats.systemsLoaded}</span>
            <span className="small">Search Records: {perfDebugStats.recordsLoaded}</span>
            <span className="small">Notes Loaded: {perfDebugStats.notesLoaded}</span>
            <span className="small">Loading: {perfDebugStats.loading ? "Yes" : "No"}</span>
          </div>
        ) : null}
        {globalMapDataLoading ? (
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
              title="Building Galaxy View"
              tip="Long-range astrogation charts are being stitched together."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MembersUniversePanel;
