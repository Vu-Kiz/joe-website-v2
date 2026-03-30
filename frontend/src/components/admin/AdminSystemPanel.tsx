import React, { useEffect, useState } from "react";
import { ensureCsrfCookie, getApiBaseUrl, getXsrfToken } from "../../api/auth";
import { getStoredSystem, type StoredSystemDetail } from "../../api/universe";
import AdminSystemPullsSection from "./system/AdminSystemPullsSection";
import AdminSystemCatalogsSection from "./system/AdminSystemCatalogsSection";
import AdminSystemRefreshSection from "./system/AdminSystemRefreshSection";

type AdminSystemSection = "pulls" | "catalogs" | "refresh";

type BackgroundSyncRun = {
  id: number;
  mode: string;
  status: string;
  options: Record<string, unknown>;
  progress: Record<string, any>;
  stats: Record<string, any>;
  last_message: string | null;
  error_message: string | null;
  heartbeat?: {
    status?: string;
    message?: string;
    updated_at?: string;
    sector?: Record<string, any>;
    detail?: Record<string, any>;
    stats?: Record<string, any>;
  } | null;
  queued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  next_retry_at: string | null;
  updated_at: string | null;
};

const AdminSystemPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AdminSystemSection>("pulls");
  const [sectorIdentifier, setSectorIdentifier] = useState("Arkanis");
  const [systemIdentifier, setSystemIdentifier] = useState("geonosis");
  const [persist, setPersist] = useState(true);
  const [deep, setDeep] = useState(true);
  const [systemPersist, setSystemPersist] = useState(true);
  const [systemDeep, setSystemDeep] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [persistence, setPersistence] = useState<any | null>(null);
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkPersistence, setBulkPersistence] = useState<any | null>(null);
  const [bulkProgressLines, setBulkProgressLines] = useState<string[]>([]);
  const [stationTypeLoading, setStationTypeLoading] = useState(false);
  const [stationTypeMessage, setStationTypeMessage] = useState<string | null>(null);
  const [stationTypeError, setStationTypeError] = useState<string | null>(null);
  const [stationTypePersistence, setStationTypePersistence] = useState<any | null>(null);
  const [stationTypeProgressLines, setStationTypeProgressLines] = useState<string[]>([]);
  const [facilityTypeLoading, setFacilityTypeLoading] = useState(false);
  const [facilityTypeMessage, setFacilityTypeMessage] = useState<string | null>(null);
  const [facilityTypeError, setFacilityTypeError] = useState<string | null>(null);
  const [facilityTypePersistence, setFacilityTypePersistence] = useState<any | null>(null);
  const [facilityTypeProgressLines, setFacilityTypeProgressLines] = useState<string[]>([]);
  const [itemTypeLoading, setItemTypeLoading] = useState(false);
  const [itemTypeMessage, setItemTypeMessage] = useState<string | null>(null);
  const [itemTypeError, setItemTypeError] = useState<string | null>(null);
  const [itemTypePersistence, setItemTypePersistence] = useState<any | null>(null);
  const [itemTypeProgressLines, setItemTypeProgressLines] = useState<string[]>([]);
  const [planetTypeLoading, setPlanetTypeLoading] = useState(false);
  const [planetTypeMessage, setPlanetTypeMessage] = useState<string | null>(null);
  const [planetTypeError, setPlanetTypeError] = useState<string | null>(null);
  const [planetTypePersistence, setPlanetTypePersistence] = useState<any | null>(null);
  const [planetTypeProgressLines, setPlanetTypeProgressLines] = useState<string[]>([]);
  const [shipTypeLoading, setShipTypeLoading] = useState(false);
  const [shipTypeMessage, setShipTypeMessage] = useState<string | null>(null);
  const [shipTypeError, setShipTypeError] = useState<string | null>(null);
  const [shipTypePersistence, setShipTypePersistence] = useState<any | null>(null);
  const [shipTypeProgressLines, setShipTypeProgressLines] = useState<string[]>([]);
  const [vehicleTypeLoading, setVehicleTypeLoading] = useState(false);
  const [vehicleTypeMessage, setVehicleTypeMessage] = useState<string | null>(null);
  const [vehicleTypeError, setVehicleTypeError] = useState<string | null>(null);
  const [vehicleTypePersistence, setVehicleTypePersistence] = useState<any | null>(null);
  const [vehicleTypeProgressLines, setVehicleTypeProgressLines] = useState<string[]>([]);
  const [droidTypeLoading, setDroidTypeLoading] = useState(false);
  const [droidTypeMessage, setDroidTypeMessage] = useState<string | null>(null);
  const [droidTypeError, setDroidTypeError] = useState<string | null>(null);
  const [droidTypePersistence, setDroidTypePersistence] = useState<any | null>(null);
  const [droidTypeProgressLines, setDroidTypeProgressLines] = useState<string[]>([]);
  const [creatureTypeLoading, setCreatureTypeLoading] = useState(false);
  const [creatureTypeMessage, setCreatureTypeMessage] = useState<string | null>(null);
  const [creatureTypeError, setCreatureTypeError] = useState<string | null>(null);
  const [creatureTypePersistence, setCreatureTypePersistence] = useState<any | null>(null);
  const [creatureTypeProgressLines, setCreatureTypeProgressLines] = useState<string[]>([]);
  const [npcTypeLoading, setNpcTypeLoading] = useState(false);
  const [npcTypeMessage, setNpcTypeMessage] = useState<string | null>(null);
  const [npcTypeError, setNpcTypeError] = useState<string | null>(null);
  const [npcTypePersistence, setNpcTypePersistence] = useState<any | null>(null);
  const [npcTypeProgressLines, setNpcTypeProgressLines] = useState<string[]>([]);
  const [raceLoading, setRaceLoading] = useState(false);
  const [raceMessage, setRaceMessage] = useState<string | null>(null);
  const [raceError, setRaceError] = useState<string | null>(null);
  const [racePersistence, setRacePersistence] = useState<any | null>(null);
  const [raceProgressLines, setRaceProgressLines] = useState<string[]>([]);
  const [weaponTypeLoading, setWeaponTypeLoading] = useState(false);
  const [weaponTypeMessage, setWeaponTypeMessage] = useState<string | null>(null);
  const [weaponTypeError, setWeaponTypeError] = useState<string | null>(null);
  const [weaponTypePersistence, setWeaponTypePersistence] = useState<any | null>(null);
  const [weaponTypeProgressLines, setWeaponTypeProgressLines] = useState<string[]>([]);
  const [terrainTypeLoading, setTerrainTypeLoading] = useState(false);
  const [terrainTypeMessage, setTerrainTypeMessage] = useState<string | null>(null);
  const [terrainTypeError, setTerrainTypeError] = useState<string | null>(null);
  const [terrainTypePersistence, setTerrainTypePersistence] = useState<any | null>(null);
  const [terrainTypeProgressLines, setTerrainTypeProgressLines] = useState<string[]>([]);
  const [materialTypeLoading, setMaterialTypeLoading] = useState(false);
  const [materialTypeMessage, setMaterialTypeMessage] = useState<string | null>(null);
  const [materialTypeError, setMaterialTypeError] = useState<string | null>(null);
  const [materialTypePersistence, setMaterialTypePersistence] = useState<any | null>(null);
  const [materialTypeProgressLines, setMaterialTypeProgressLines] = useState<string[]>([]);
  const [planetRefreshLoading, setPlanetRefreshLoading] = useState(false);
  const [planetRefreshMessage, setPlanetRefreshMessage] = useState<string | null>(null);
  const [planetRefreshError, setPlanetRefreshError] = useState<string | null>(null);
  const [planetRefreshPersistence, setPlanetRefreshPersistence] = useState<any | null>(null);
  const [planetRefreshProgressLines, setPlanetRefreshProgressLines] = useState<string[]>([]);
  const [systemRefreshMessage, setSystemRefreshMessage] = useState<string | null>(null);
  const [systemRefreshError, setSystemRefreshError] = useState<string | null>(null);
  const [systemRefreshPersistence, setSystemRefreshPersistence] = useState<any | null>(null);
  const [systemRefreshRunLoading, setSystemRefreshRunLoading] = useState(false);
  const [systemRefreshRunCancelLoading, setSystemRefreshRunCancelLoading] = useState(false);
  const [systemRefreshRun, setSystemRefreshRun] = useState<BackgroundSyncRun | null>(null);
  const [backgroundSyncLoading, setBackgroundSyncLoading] = useState(false);
  const [backgroundSyncCancelLoading, setBackgroundSyncCancelLoading] = useState(false);
  const [backgroundSyncError, setBackgroundSyncError] = useState<string | null>(null);
  const [backgroundSyncMessage, setBackgroundSyncMessage] = useState<string | null>(null);
  const [backgroundSyncRun, setBackgroundSyncRun] = useState<BackgroundSyncRun | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [systemResult, setSystemResult] = useState<any | null>(null);
  const [systemPersistence, setSystemPersistence] = useState<any | null>(null);
  const [systemProgressLines, setSystemProgressLines] = useState<string[]>([]);
  const [storedSystemDetail, setStoredSystemDetail] = useState<StoredSystemDetail | null>(null);
  const [storedSystemLoading, setStoredSystemLoading] = useState(false);
  const [storedSystemError, setStoredSystemError] = useState<string | null>(null);
  const systemRefreshHeartbeat = systemRefreshRun?.heartbeat ?? null;
  const systemRefreshLiveStats = systemRefreshHeartbeat?.stats ?? systemRefreshRun?.stats ?? {};
  const systemRefreshCurrentSystem = systemRefreshRun?.progress?.current_system ?? null;
  const systemRefreshLastDetail = systemRefreshRun?.progress?.last_detail ?? null;
  const systemRefreshHeartbeatUpdatedAt = systemRefreshHeartbeat?.updated_at ?? null;
  const systemRefreshHeartbeatAgeSeconds = systemRefreshHeartbeatUpdatedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(systemRefreshHeartbeatUpdatedAt).getTime()) / 1000))
    : null;

  const sectorName =
    result?.sector?.name ?? result?.sector?.uid ?? sectorIdentifier.trim() ?? "Unknown";
  const systemsPulled = result?.sector?.system_count ?? 0;
  const coordinatesPulled = result?.sector?.coordinate_count ?? 0;
  const systemsSynced = deep
    ? persistence?.systems_deep_synced ?? 0
    : persistence?.systems_upserted ?? systemsPulled;
  const systemName =
    systemResult?.system?.name ?? systemResult?.system?.uid ?? systemIdentifier.trim() ?? "Unknown";
  const planetsPulled = systemResult?.planet_stubs?.length ?? 0;
  const stationsPulled = systemResult?.station_stubs?.length ?? 0;
  const hyperlanesPulled = systemResult?.hyperlanes?.length ?? 0;
  const backgroundCurrentSector = backgroundSyncRun?.progress?.current_sector ?? null;
  const backgroundLastDetail = backgroundSyncRun?.progress?.last_detail ?? null;
  const backgroundHeartbeat = backgroundSyncRun?.heartbeat ?? null;
  const backgroundLiveStats = backgroundHeartbeat?.stats ?? backgroundSyncRun?.stats ?? {};
  const heartbeatUpdatedAt = backgroundHeartbeat?.updated_at ?? null;
  const heartbeatAgeSeconds = heartbeatUpdatedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(heartbeatUpdatedAt).getTime()) / 1000))
    : null;

  useEffect(() => {
    void loadLatestBackgroundSync();
  }, []);

  useEffect(() => {
    void loadLatestSystemRefreshRun();
  }, []);

  useEffect(() => {
    if (!backgroundSyncRun || !["queued", "running", "waiting_rate_limit"].includes(backgroundSyncRun.status)) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadLatestBackgroundSync(backgroundSyncRun.id);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [backgroundSyncRun?.id, backgroundSyncRun?.status]);

  useEffect(() => {
    if (!systemRefreshRun || !["queued", "running", "waiting_db_lock", "cancel_requested"].includes(systemRefreshRun.status)) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadLatestSystemRefreshRun(systemRefreshRun.id);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [systemRefreshRun?.id, systemRefreshRun?.status]);

  async function loadLatestBackgroundSync(runId?: number) {
    try {
      const response = await fetch(
        runId
          ? `${getApiBaseUrl()}/sys/universe/full-sync-runs/${runId}`
          : `${getApiBaseUrl()}/sys/universe/full-sync-runs/latest`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load background sync status.");
      }

      const payload = await response.json();
      setBackgroundSyncRun(payload.data ?? null);
    } catch (e: any) {
      setBackgroundSyncError(e?.message ?? "Failed to load background sync status.");
    }
  }

  async function loadLatestSystemRefreshRun(runId?: number) {
    try {
      const response = await fetch(
        runId
          ? `${getApiBaseUrl()}/sys/universe/system-refresh-runs/${runId}`
          : `${getApiBaseUrl()}/sys/universe/system-refresh-runs/latest`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load stored-systems refresh status.");
      }

      const payload = await response.json();
      const run = payload.data ?? null;
      setSystemRefreshRun(run);
      setSystemRefreshPersistence(run?.stats ?? null);
    } catch (e: any) {
      setSystemRefreshError(e?.message ?? "Failed to load stored-systems refresh status.");
    }
  }

  async function onStartBackgroundSync() {
    try {
      setBackgroundSyncLoading(true);
      setBackgroundSyncError(null);
      setBackgroundSyncMessage(null);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/full-sync-runs`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
        body: JSON.stringify({
          deep: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to queue background sync.");
      }

      const payload = await response.json();
      setBackgroundSyncMessage(payload.message ?? "Background galaxy sync queued.");
      setBackgroundSyncRun(payload.data ?? null);
    } catch (e: any) {
      setBackgroundSyncError(e?.message ?? "Failed to queue background sync.");
    } finally {
      setBackgroundSyncLoading(false);
    }
  }

  async function onCancelBackgroundSync() {
    if (!backgroundSyncRun) {
      return;
    }

    try {
      setBackgroundSyncCancelLoading(true);
      setBackgroundSyncError(null);
      setBackgroundSyncMessage(null);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/full-sync-runs/${backgroundSyncRun.id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to cancel background sync.");
      }

      setBackgroundSyncMessage(payload.message ?? "Cancellation requested.");
      setBackgroundSyncRun(payload.data ?? null);
    } catch (e: any) {
      setBackgroundSyncError(e?.message ?? "Failed to cancel background sync.");
    } finally {
      setBackgroundSyncCancelLoading(false);
    }
  }

  async function onPullSystem() {
    const identifier = systemIdentifier.trim();
    if (!identifier) {
      setSystemError("System identifier is required.");
      return;
    }

    try {
      setSystemLoading(true);
      setSystemError(null);
      setSystemMessage(null);
      setSystemProgressLines([`Starting system pull for ${identifier}...`]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-system-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
        body: JSON.stringify({
          identifier,
          persist: systemPersist,
          deep: systemPersist ? systemDeep : false,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "System pull failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const chunk = JSON.parse(trimmed);
          const event = chunk.event;
          const payload = chunk.payload ?? {};

          if (event === "started") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Request accepted. Persist: ${payload.persist ? "yes" : "no"}, deep: ${payload.deep ? "yes" : "no"}.`,
            ]);
          } else if (event === "system_pulled") {
            setSystemResult({
              system: payload.system ?? null,
            });
            setSystemProgressLines((prev) => [
              ...prev,
              `System payload pulled. Planets: ${payload.planets ?? 0}, stations: ${payload.stations ?? 0}, hyperlanes: ${payload.hyperlanes ?? 0}.`,
            ]);
          } else if (event === "persist_started") {
            setSystemProgressLines((prev) => [...prev, "Saving system data to the local database..."]);
          } else if (event === "planet_upserted") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Indexed planet: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "planet_pull_started") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Pulling full planet: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "planet_pull_completed") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Completed planet: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "station_upserted") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Indexed station: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "station_pull_started") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Pulling full station: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "station_pull_completed") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Completed station: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "hyperlane_upserted") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Indexed hyperlane: ${payload.name ?? payload.destination_uid ?? "Unknown"}`,
            ]);
          } else if (event === "destination_system_pull_started") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Pulling connected system: ${payload.destination_name ?? payload.destination_uid ?? "Unknown"}`,
            ]);
          } else if (event === "destination_system_pull_completed") {
            setSystemProgressLines((prev) => [
              ...prev,
              `Completed connected system: ${payload.destination_name ?? payload.destination_uid ?? "Unknown"}`,
            ]);
          } else if (event === "completed") {
            setSystemResult(payload.data ?? null);
            setSystemPersistence(payload.persistence ?? null);
            setSystemMessage(payload.message ?? "System pull completed.");
            setSystemProgressLines((prev) => [...prev, "System pull completed."]);
          } else if (event === "error") {
            throw new Error(payload.message ?? "System pull failed.");
          }
        }
      }

      if (systemPersist) {
        await onLoadStoredSystem(identifier);
      }
    } catch (e: any) {
      setSystemError(e?.message ?? "System pull failed.");
    } finally {
      setSystemLoading(false);
    }
  }

  async function onPullAllStationTypes() {
    try {
      setStationTypeLoading(true);
      setStationTypeError(null);
      setStationTypeMessage(null);
      setStationTypePersistence(null);
      setStationTypeProgressLines(["Starting station type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-station-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Station type pull failed.");
      }

      await consumeTypeStream(
        response,
        setStationTypeProgressLines,
        setStationTypeMessage,
        setStationTypePersistence,
        "Station type pull failed."
      );
    } catch (e: any) {
      setStationTypeError(e?.message ?? "Station type pull failed.");
    } finally {
      setStationTypeLoading(false);
    }
  }

  async function onRefreshStoredSystems() {
    try {
      setSystemRefreshRunLoading(true);
      setSystemRefreshError(null);
      setSystemRefreshMessage(null);
      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/system-refresh-runs`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to queue stored-systems refresh.");
      }

      setSystemRefreshMessage(payload.message ?? "Background stored-systems refresh queued.");
      setSystemRefreshRun(payload.data ?? null);
      setSystemRefreshPersistence(payload.data?.stats ?? null);
    } catch (e: any) {
      setSystemRefreshError(e?.message ?? "Failed to queue stored-systems refresh.");
    } finally {
      setSystemRefreshRunLoading(false);
    }
  }

  async function onCancelSystemRefresh() {
    if (!systemRefreshRun) {
      return;
    }

    try {
      setSystemRefreshRunCancelLoading(true);
      setSystemRefreshError(null);
      setSystemRefreshMessage(null);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/system-refresh-runs/${systemRefreshRun.id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to cancel stored-systems refresh.");
      }

      setSystemRefreshMessage(payload.message ?? "Cancellation requested.");
      setSystemRefreshRun(payload.data ?? null);
    } catch (e: any) {
      setSystemRefreshError(e?.message ?? "Failed to cancel stored-systems refresh.");
    } finally {
      setSystemRefreshRunCancelLoading(false);
    }
  }

  async function onPullAllTerrainTypes() {
    try {
      setTerrainTypeLoading(true);
      setTerrainTypeError(null);
      setTerrainTypeMessage(null);
      setTerrainTypePersistence(null);
      setTerrainTypeProgressLines(["Starting terrain type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-terrain-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Terrain type pull failed.");
      }

      await consumeTypeStream(
        response,
        setTerrainTypeProgressLines,
        setTerrainTypeMessage,
        setTerrainTypePersistence,
        "Terrain type pull failed."
      );
    } catch (e: any) {
      setTerrainTypeError(e?.message ?? "Terrain type pull failed.");
    } finally {
      setTerrainTypeLoading(false);
    }
  }

  async function onPullAllFacilityTypes() {
    try {
      setFacilityTypeLoading(true);
      setFacilityTypeError(null);
      setFacilityTypeMessage(null);
      setFacilityTypePersistence(null);
      setFacilityTypeProgressLines(["Starting facility type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-facility-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Facility type pull failed.");
      }

      await consumeTypeStream(
        response,
        setFacilityTypeProgressLines,
        setFacilityTypeMessage,
        setFacilityTypePersistence,
        "Facility type pull failed."
      );
    } catch (e: any) {
      setFacilityTypeError(e?.message ?? "Facility type pull failed.");
    } finally {
      setFacilityTypeLoading(false);
    }
  }

  async function onPullAllItemTypes() {
    try {
      setItemTypeLoading(true);
      setItemTypeError(null);
      setItemTypeMessage(null);
      setItemTypePersistence(null);
      setItemTypeProgressLines(["Starting item type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-item-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Item type pull failed.");
      }

      await consumeTypeStream(
        response,
        setItemTypeProgressLines,
        setItemTypeMessage,
        setItemTypePersistence,
        "Item type pull failed."
      );
    } catch (e: any) {
      setItemTypeError(e?.message ?? "Item type pull failed.");
    } finally {
      setItemTypeLoading(false);
    }
  }

  async function onPullAllPlanetTypes() {
    try {
      setPlanetTypeLoading(true);
      setPlanetTypeError(null);
      setPlanetTypeMessage(null);
      setPlanetTypePersistence(null);
      setPlanetTypeProgressLines(["Starting planet type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-planet-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Planet type pull failed.");
      }

      await consumeTypeStream(
        response,
        setPlanetTypeProgressLines,
        setPlanetTypeMessage,
        setPlanetTypePersistence,
        "Planet type pull failed."
      );
    } catch (e: any) {
      setPlanetTypeError(e?.message ?? "Planet type pull failed.");
    } finally {
      setPlanetTypeLoading(false);
    }
  }

  async function onPullAllShipTypes() {
    try {
      setShipTypeLoading(true);
      setShipTypeError(null);
      setShipTypeMessage(null);
      setShipTypePersistence(null);
      setShipTypeProgressLines(["Starting ship type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-ship-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Ship type pull failed.");
      }

      await consumeTypeStream(
        response,
        setShipTypeProgressLines,
        setShipTypeMessage,
        setShipTypePersistence,
        "Ship type pull failed."
      );
    } catch (e: any) {
      setShipTypeError(e?.message ?? "Ship type pull failed.");
    } finally {
      setShipTypeLoading(false);
    }
  }

  async function onPullAllVehicleTypes() {
    try {
      setVehicleTypeLoading(true);
      setVehicleTypeError(null);
      setVehicleTypeMessage(null);
      setVehicleTypePersistence(null);
      setVehicleTypeProgressLines(["Starting vehicle type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-vehicle-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Vehicle type pull failed.");
      }

      await consumeTypeStream(
        response,
        setVehicleTypeProgressLines,
        setVehicleTypeMessage,
        setVehicleTypePersistence,
        "Vehicle type pull failed."
      );
    } catch (e: any) {
      setVehicleTypeError(e?.message ?? "Vehicle type pull failed.");
    } finally {
      setVehicleTypeLoading(false);
    }
  }

  async function onPullAllDroidTypes() {
    try {
      setDroidTypeLoading(true);
      setDroidTypeError(null);
      setDroidTypeMessage(null);
      setDroidTypePersistence(null);
      setDroidTypeProgressLines(["Starting droid type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-droid-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Droid type pull failed.");
      }

      await consumeTypeStream(
        response,
        setDroidTypeProgressLines,
        setDroidTypeMessage,
        setDroidTypePersistence,
        "Droid type pull failed."
      );
    } catch (e: any) {
      setDroidTypeError(e?.message ?? "Droid type pull failed.");
    } finally {
      setDroidTypeLoading(false);
    }
  }

  async function onPullAllNpcTypes() {
    try {
      setNpcTypeLoading(true);
      setNpcTypeError(null);
      setNpcTypeMessage(null);
      setNpcTypePersistence(null);
      setNpcTypeProgressLines(["Starting NPC type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-npc-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "NPC type pull failed.");
      }

      await consumeTypeStream(
        response,
        setNpcTypeProgressLines,
        setNpcTypeMessage,
        setNpcTypePersistence,
        "NPC type pull failed."
      );
    } catch (e: any) {
      setNpcTypeError(e?.message ?? "NPC type pull failed.");
    } finally {
      setNpcTypeLoading(false);
    }
  }

  async function onPullAllRaces() {
    try {
      setRaceLoading(true);
      setRaceError(null);
      setRaceMessage(null);
      setRacePersistence(null);
      setRaceProgressLines(["Starting race catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-races-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Race pull failed.");
      }

      await consumeTypeStream(
        response,
        setRaceProgressLines,
        setRaceMessage,
        setRacePersistence,
        "Race pull failed."
      );
    } catch (e: any) {
      setRaceError(e?.message ?? "Race pull failed.");
    } finally {
      setRaceLoading(false);
    }
  }

  async function onPullAllWeaponTypes() {
    try {
      setWeaponTypeLoading(true);
      setWeaponTypeError(null);
      setWeaponTypeMessage(null);
      setWeaponTypePersistence(null);
      setWeaponTypeProgressLines(["Starting weapon type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-weapon-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Weapon type pull failed.");
      }

      await consumeTypeStream(
        response,
        setWeaponTypeProgressLines,
        setWeaponTypeMessage,
        setWeaponTypePersistence,
        "Weapon type pull failed."
      );
    } catch (e: any) {
      setWeaponTypeError(e?.message ?? "Weapon type pull failed.");
    } finally {
      setWeaponTypeLoading(false);
    }
  }

  async function onPullAllCreatureTypes() {
    try {
      setCreatureTypeLoading(true);
      setCreatureTypeError(null);
      setCreatureTypeMessage(null);
      setCreatureTypePersistence(null);
      setCreatureTypeProgressLines(["Starting creature type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-creature-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Creature type pull failed.");
      }

      await consumeTypeStream(
        response,
        setCreatureTypeProgressLines,
        setCreatureTypeMessage,
        setCreatureTypePersistence,
        "Creature type pull failed."
      );
    } catch (e: any) {
      setCreatureTypeError(e?.message ?? "Creature type pull failed.");
    } finally {
      setCreatureTypeLoading(false);
    }
  }

  async function onPullAllMaterialTypes() {
    try {
      setMaterialTypeLoading(true);
      setMaterialTypeError(null);
      setMaterialTypeMessage(null);
      setMaterialTypePersistence(null);
      setMaterialTypeProgressLines(["Starting material type catalog pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-material-types-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Material type pull failed.");
      }

      await consumeTypeStream(
        response,
        setMaterialTypeProgressLines,
        setMaterialTypeMessage,
        setMaterialTypePersistence,
        "Material type pull failed."
      );
    } catch (e: any) {
      setMaterialTypeError(e?.message ?? "Material type pull failed.");
    } finally {
      setMaterialTypeLoading(false);
    }
  }

  async function consumeTypeStream(
    response: Response,
    setLines: React.Dispatch<React.SetStateAction<string[]>>,
    setDoneMessage: React.Dispatch<React.SetStateAction<string | null>>,
    setDonePersistence: React.Dispatch<React.SetStateAction<any | null>>,
    defaultError: string
  ) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        consumeTypeStreamChunk(line, setLines, setDoneMessage, setDonePersistence, defaultError);
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      consumeTypeStreamChunk(trailing, setLines, setDoneMessage, setDonePersistence, defaultError);
    }
  }

  function consumeTypeStreamChunk(
    line: string,
    setLines: React.Dispatch<React.SetStateAction<string[]>>,
    setDoneMessage: React.Dispatch<React.SetStateAction<string | null>>,
    setDonePersistence: React.Dispatch<React.SetStateAction<any | null>>,
    defaultError: string
  ) {
    const trimmed = line.trim();
    if (!trimmed) return;

    const chunk = JSON.parse(trimmed);
    const event = chunk.event;
    const payload = chunk.payload ?? {};

    if (event === "started") {
      setLines((prev) => [...prev, `Request accepted for ${payload.entity_type ?? "type"} catalog pull.`]);
    } else if (event === "index_completed") {
      setDonePersistence(payload.persistence ?? null);
      setLines((prev) => [...prev, `Index completed. Total listed: ${payload.total ?? 0}.`]);
    } else if (event === "detail_started") {
      setLines((prev) => [
        ...prev,
        `Hydrating ${payload.current ?? "?"}/${payload.total ?? "?"}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
      ]);
    } else if (event === "detail_completed") {
      setLines((prev) => [
        ...prev,
        `Completed ${payload.current ?? "?"}/${payload.total ?? "?"}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
      ]);
    } else if (event === "completed") {
      setDoneMessage(payload.message ?? "Catalog pull completed.");
      setDonePersistence(payload.persistence ?? null);
      setLines((prev) => [...prev, payload.message ?? "Catalog pull completed."]);
    } else if (event === "error") {
      throw new Error(payload.message ?? defaultError);
    }
  }

  async function onRefreshStoredPlanets() {
    try {
      setPlanetRefreshLoading(true);
      setPlanetRefreshError(null);
      setPlanetRefreshMessage(null);
      setPlanetRefreshPersistence(null);
      setPlanetRefreshProgressLines(["Starting stored planet refresh..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/refresh-planets-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Planet refresh failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const chunk = JSON.parse(trimmed);
          const event = chunk.event;
          const payload = chunk.payload ?? {};

          if (event === "started") {
            setPlanetRefreshProgressLines((prev) => [
              ...prev,
              `Request accepted. Stored planets queued for refresh: ${payload.total ?? 0}.`,
            ]);
          } else if (event === "planet_refresh_started") {
            setPlanetRefreshProgressLines((prev) => [
              ...prev,
              `Refreshing planet ${payload.current ?? "?"}/${payload.total ?? "?"}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "planet_refresh_completed") {
            setPlanetRefreshProgressLines((prev) => [
              ...prev,
              `Completed planet ${payload.current ?? "?"}/${payload.total ?? "?"}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "planet_skipped") {
            setPlanetRefreshProgressLines((prev) => [
              ...prev,
              `Skipped planet ${payload.current ?? "?"}/${payload.total ?? "?"}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"} (${payload.reason ?? "unknown"})`,
            ]);
          } else if (event === "completed") {
            setPlanetRefreshMessage(payload.message ?? "Stored planets refreshed.");
            setPlanetRefreshPersistence(payload.persistence ?? null);
            setPlanetRefreshProgressLines((prev) => [...prev, "Stored planet refresh completed."]);
          } else if (event === "error") {
            throw new Error(payload.message ?? "Planet refresh failed.");
          }
        }
      }
    } catch (e: any) {
      setPlanetRefreshError(e?.message ?? "Planet refresh failed.");
    } finally {
      setPlanetRefreshLoading(false);
    }
  }

  async function onLoadStoredSystem(identifierOverride?: string) {
    const identifier = (identifierOverride ?? systemIdentifier).trim();
    if (!identifier) {
      setStoredSystemError("System identifier is required.");
      return;
    }

    try {
      setStoredSystemLoading(true);
      setStoredSystemError(null);
      const response = await getStoredSystem(identifier);
      setStoredSystemDetail(response.data ?? null);
    } catch (e: any) {
      setStoredSystemDetail(null);
      setStoredSystemError(e?.message ?? "Failed to load stored system.");
    } finally {
      setStoredSystemLoading(false);
    }
  }

  async function onPullSector() {
    const identifier = sectorIdentifier.trim();
    if (!identifier) {
      setError("Sector identifier is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      setProgressLines([
        `Starting sector pull for ${identifier}...`,
      ]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-sector-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
        body: JSON.stringify({
          identifier,
          persist,
          deep: persist ? deep : false,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Sector pull failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const chunk = JSON.parse(trimmed);
          const event = chunk.event;
          const payload = chunk.payload ?? {};

          if (event === "started") {
            setProgressLines((prev) => [
              ...prev,
              `Request accepted. Persist: ${payload.persist ? "yes" : "no"}, deep: ${payload.deep ? "yes" : "no"}.`,
            ]);
          } else if (event === "sector_pulled") {
            setResult({
              sector: payload.sector ?? null,
            });
            setProgressLines((prev) => [
              ...prev,
              `Sector payload pulled. Systems found: ${payload.systems ?? 0}.`,
            ]);
          } else if (event === "persist_started") {
            setProgressLines((prev) => [...prev, "Saving sector data to the local database..."]);
          } else if (event === "system_upserted") {
            setProgressLines((prev) => [
              ...prev,
              `Indexed system ${payload.current}/${payload.total}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "system_pull_started") {
            setProgressLines((prev) => [
              ...prev,
              `Pulling full system ${payload.current}/${payload.total}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "system_pull_completed") {
            setProgressLines((prev) => [
              ...prev,
              `Completed system ${payload.current}/${payload.total}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "completed") {
            setResult(payload.data ?? null);
            setPersistence(payload.persistence ?? null);
            setMessage(payload.message ?? "Sector pull completed.");
            setProgressLines((prev) => [...prev, "Sector pull completed."]);
          } else if (event === "error") {
            throw new Error(payload.message ?? "Sector pull failed.");
          }
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Sector pull failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onPullAllSectors() {
    try {
      setBulkLoading(true);
      setBulkError(null);
      setBulkMessage(null);
      setBulkProgressLines(["Starting full sector index pull..."]);

      await ensureCsrfCookie();
      const xsrf = getXsrfToken();

      const response = await fetch(`${getApiBaseUrl()}/sys/universe/pull-all-sectors-stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson, application/json",
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
        body: JSON.stringify({
          hydrate_details: true,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Bulk sector pull failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const chunk = JSON.parse(trimmed);
          const event = chunk.event;
          const payload = chunk.payload ?? {};

          if (event === "started") {
            setBulkProgressLines((prev) => [
              ...prev,
              `Bulk pull accepted. Hydrate details: ${payload.hydrate_details ? "yes" : "no"}.`,
            ]);
          } else if (event === "index_completed") {
            setBulkPersistence(payload.persistence ?? null);
            setBulkProgressLines((prev) => [
              ...prev,
              `Sector index completed. Total sectors listed: ${payload.total ?? 0}.`,
            ]);
          } else if (event === "sector_detail_started") {
            setBulkProgressLines((prev) => [
              ...prev,
              `Hydrating sector ${payload.current}/${payload.total}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "sector_detail_completed") {
            setBulkProgressLines((prev) => [
              ...prev,
              `Completed sector ${payload.current}/${payload.total}: ${payload.name ?? payload.uid ?? payload.identifier ?? "Unknown"}`,
            ]);
          } else if (event === "completed") {
            setBulkPersistence(payload.persistence ?? null);
            setBulkMessage(payload.message ?? "All sectors pulled.");
            setBulkProgressLines((prev) => [...prev, "Bulk sector sync completed."]);
          } else if (event === "error") {
            throw new Error(payload.message ?? "Bulk sector pull failed.");
          }
        }
      }
    } catch (e: any) {
      setBulkError(e?.message ?? "Bulk sector pull failed.");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>System</h2>
        <p className="small" style={{ margin: 0 }}>
          Sysadmin-only galaxy sync tools.
        </p>
      </div>

      <div className="admin-panel__body">
        <div className="admin-entity-stats__subnav">
          <button
            type="button"
            className={`btn admin-entity-stats__subnav-btn${activeSection === "pulls" ? " is-active" : ""}`}
            onClick={() => setActiveSection("pulls")}
          >
            Pulls
          </button>
          <button
            type="button"
            className={`btn admin-entity-stats__subnav-btn${activeSection === "catalogs" ? " is-active" : ""}`}
            onClick={() => setActiveSection("catalogs")}
          >
            Catalogs
          </button>
          <button
            type="button"
            className={`btn admin-entity-stats__subnav-btn${activeSection === "refresh" ? " is-active" : ""}`}
            onClick={() => setActiveSection("refresh")}
          >
            Refresh
          </button>
        </div>

        {activeSection === "pulls" ? (
          <AdminSystemPullsSection
            sectorIdentifier={sectorIdentifier}
            setSectorIdentifier={setSectorIdentifier}
            persist={persist}
            setPersist={setPersist}
            deep={deep}
            setDeep={setDeep}
            loading={loading}
            onPullSector={onPullSector}
            onStartBackgroundSync={onStartBackgroundSync}
            onCancelBackgroundSync={onCancelBackgroundSync}
            onLoadLatestBackgroundSync={() => void loadLatestBackgroundSync(backgroundSyncRun?.id)}
            backgroundSyncLoading={backgroundSyncLoading}
            backgroundSyncCancelLoading={backgroundSyncCancelLoading}
            backgroundSyncError={backgroundSyncError}
            backgroundSyncMessage={backgroundSyncMessage}
            backgroundSyncRun={backgroundSyncRun}
            backgroundLiveStats={backgroundLiveStats}
            heartbeatAgeSeconds={heartbeatAgeSeconds}
            backgroundCurrentSector={backgroundCurrentSector}
            backgroundLastDetail={backgroundLastDetail}
            backgroundHeartbeat={backgroundHeartbeat}
            bulkLoading={bulkLoading}
            bulkMessage={bulkMessage}
            bulkError={bulkError}
            bulkPersistence={bulkPersistence}
            bulkProgressLines={bulkProgressLines}
            onPullAllSectors={onPullAllSectors}
            message={message}
            error={error}
            progressLines={progressLines}
            result={result}
            sectorName={sectorName}
            systemsPulled={systemsPulled}
            coordinatesPulled={coordinatesPulled}
            systemsSynced={systemsSynced}
          />
        ) : null}

        {activeSection === "catalogs" ? (
          <AdminSystemCatalogsSection
            stationTypeLoading={stationTypeLoading}
            stationTypeMessage={stationTypeMessage}
            stationTypeError={stationTypeError}
            stationTypePersistence={stationTypePersistence}
            stationTypeProgressLines={stationTypeProgressLines}
            onPullAllStationTypes={onPullAllStationTypes}
            shipTypeLoading={shipTypeLoading}
            shipTypeMessage={shipTypeMessage}
            shipTypeError={shipTypeError}
            shipTypePersistence={shipTypePersistence}
            shipTypeProgressLines={shipTypeProgressLines}
            onPullAllShipTypes={onPullAllShipTypes}
            vehicleTypeLoading={vehicleTypeLoading}
            vehicleTypeMessage={vehicleTypeMessage}
            vehicleTypeError={vehicleTypeError}
            vehicleTypePersistence={vehicleTypePersistence}
            vehicleTypeProgressLines={vehicleTypeProgressLines}
            onPullAllVehicleTypes={onPullAllVehicleTypes}
            droidTypeLoading={droidTypeLoading}
            droidTypeMessage={droidTypeMessage}
            droidTypeError={droidTypeError}
            droidTypePersistence={droidTypePersistence}
            droidTypeProgressLines={droidTypeProgressLines}
            onPullAllDroidTypes={onPullAllDroidTypes}
            creatureTypeLoading={creatureTypeLoading}
            creatureTypeMessage={creatureTypeMessage}
            creatureTypeError={creatureTypeError}
            creatureTypePersistence={creatureTypePersistence}
            creatureTypeProgressLines={creatureTypeProgressLines}
            onPullAllCreatureTypes={onPullAllCreatureTypes}
            npcTypeLoading={npcTypeLoading}
            npcTypeMessage={npcTypeMessage}
            npcTypeError={npcTypeError}
            npcTypePersistence={npcTypePersistence}
            npcTypeProgressLines={npcTypeProgressLines}
            onPullAllNpcTypes={onPullAllNpcTypes}
            raceLoading={raceLoading}
            raceMessage={raceMessage}
            raceError={raceError}
            racePersistence={racePersistence}
            raceProgressLines={raceProgressLines}
            onPullAllRaces={onPullAllRaces}
            weaponTypeLoading={weaponTypeLoading}
            weaponTypeMessage={weaponTypeMessage}
            weaponTypeError={weaponTypeError}
            weaponTypePersistence={weaponTypePersistence}
            weaponTypeProgressLines={weaponTypeProgressLines}
            onPullAllWeaponTypes={onPullAllWeaponTypes}
            facilityTypeLoading={facilityTypeLoading}
            facilityTypeMessage={facilityTypeMessage}
            facilityTypeError={facilityTypeError}
            facilityTypePersistence={facilityTypePersistence}
            facilityTypeProgressLines={facilityTypeProgressLines}
            onPullAllFacilityTypes={onPullAllFacilityTypes}
            itemTypeLoading={itemTypeLoading}
            itemTypeMessage={itemTypeMessage}
            itemTypeError={itemTypeError}
            itemTypePersistence={itemTypePersistence}
            itemTypeProgressLines={itemTypeProgressLines}
            onPullAllItemTypes={onPullAllItemTypes}
            planetTypeLoading={planetTypeLoading}
            planetTypeMessage={planetTypeMessage}
            planetTypeError={planetTypeError}
            planetTypePersistence={planetTypePersistence}
            planetTypeProgressLines={planetTypeProgressLines}
            onPullAllPlanetTypes={onPullAllPlanetTypes}
            terrainTypeLoading={terrainTypeLoading}
            terrainTypeMessage={terrainTypeMessage}
            terrainTypeError={terrainTypeError}
            terrainTypePersistence={terrainTypePersistence}
            terrainTypeProgressLines={terrainTypeProgressLines}
            onPullAllTerrainTypes={onPullAllTerrainTypes}
            materialTypeLoading={materialTypeLoading}
            materialTypeMessage={materialTypeMessage}
            materialTypeError={materialTypeError}
            materialTypePersistence={materialTypePersistence}
            materialTypeProgressLines={materialTypeProgressLines}
            onPullAllMaterialTypes={onPullAllMaterialTypes}
          />
        ) : null}

        {activeSection === "refresh" ? (
          <AdminSystemRefreshSection
            planetRefreshLoading={planetRefreshLoading}
            planetRefreshMessage={planetRefreshMessage}
            planetRefreshError={planetRefreshError}
            planetRefreshPersistence={planetRefreshPersistence}
            planetRefreshProgressLines={planetRefreshProgressLines}
            onRefreshStoredPlanets={onRefreshStoredPlanets}
            systemRefreshMessage={systemRefreshMessage}
            systemRefreshError={systemRefreshError}
            systemRefreshPersistence={systemRefreshPersistence}
            onRefreshStoredSystems={onRefreshStoredSystems}
            onLoadLatestSystemRefreshRun={() => void loadLatestSystemRefreshRun(systemRefreshRun?.id)}
            onCancelSystemRefresh={onCancelSystemRefresh}
            systemRefreshRunLoading={systemRefreshRunLoading}
            systemRefreshRunCancelLoading={systemRefreshRunCancelLoading}
            systemRefreshRun={systemRefreshRun}
            systemRefreshLiveStats={systemRefreshLiveStats}
            systemRefreshHeartbeatAgeSeconds={systemRefreshHeartbeatAgeSeconds}
            systemRefreshCurrentSystem={systemRefreshCurrentSystem}
            systemRefreshLastDetail={systemRefreshLastDetail}
            systemRefreshHeartbeat={systemRefreshHeartbeat}
            systemIdentifier={systemIdentifier}
            setSystemIdentifier={setSystemIdentifier}
            systemPersist={systemPersist}
            setSystemPersist={setSystemPersist}
            systemDeep={systemDeep}
            setSystemDeep={setSystemDeep}
            onPullSystem={onPullSystem}
            systemLoading={systemLoading}
            onLoadStoredSystem={() => void onLoadStoredSystem()}
            storedSystemLoading={storedSystemLoading}
            systemMessage={systemMessage}
            systemError={systemError}
            storedSystemError={storedSystemError}
            systemProgressLines={systemProgressLines}
            systemResult={systemResult}
            systemName={systemName}
            planetsPulled={planetsPulled}
            stationsPulled={stationsPulled}
            hyperlanesPulled={hyperlanesPulled}
            systemPersisted={systemPersist}
            systemDeepEnabled={systemDeep}
            systemPersistence={systemPersistence}
            storedSystemDetail={storedSystemDetail}
          />
        ) : null}
      </div>
    </section>
  );
};

export default AdminSystemPanel;
