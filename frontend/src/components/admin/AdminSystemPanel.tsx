import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ensureCsrfCookie, getApiBaseUrl, getXsrfToken } from "../../api/auth";
import { getStoredSystem, type StoredSystemDetail } from "../../api/universe";

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
  const [shipTypeLoading, setShipTypeLoading] = useState(false);
  const [shipTypeMessage, setShipTypeMessage] = useState<string | null>(null);
  const [shipTypeError, setShipTypeError] = useState<string | null>(null);
  const [shipTypePersistence, setShipTypePersistence] = useState<any | null>(null);
  const [shipTypeProgressLines, setShipTypeProgressLines] = useState<string[]>([]);
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
    if (!backgroundSyncRun || !["queued", "running", "waiting_rate_limit"].includes(backgroundSyncRun.status)) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadLatestBackgroundSync(backgroundSyncRun.id);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [backgroundSyncRun?.id, backgroundSyncRun?.status]);

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
      setBackgroundSyncMessage(payload.message ?? "Background universe sync queued.");
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
          Sysadmin-only universe sync tools.
        </p>
      </div>

      <div className="admin-panel__body">
        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Sector Pull</h3>
            <p className="admin-card__desc">
              Pull sector data from SWC and optionally save it into the local database.
              This panel is for syncing data, not for displaying the map.
            </p>
          </div>

          <div className="admin-card__actions">
            <Link to="/sys/debug/universe" className="btn">
              Open Universe Explorer
            </Link>
          </div>

          <div className="admin-grid">
            <div className="admin-card">
              <label className="small" htmlFor="admin-sector-identifier">
                Sector
              </label>
              <input
                id="admin-sector-identifier"
                className="input"
                value={sectorIdentifier}
                onChange={(event) => setSectorIdentifier(event.target.value)}
                placeholder="Sector UID or name, e.g. Arkanis"
              />
            </div>

            <div className="admin-card">
              <label className="small">
                <input
                  type="checkbox"
                  checked={persist}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setPersist(checked);
                    if (!checked) {
                      setDeep(false);
                    }
                  }}
                />{" "}
                Save pulled data to DB
              </label>

              <label className="small">
                <input
                  type="checkbox"
                  checked={deep}
                  disabled={!persist}
                  onChange={(event) => setDeep(event.target.checked)}
                />{" "}
                Also pull linked systems
              </label>
            </div>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullSector} disabled={loading}>
              {loading ? "Running..." : "Pull Sector"}
            </button>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Background Pull All Info</h3>
            <p className="admin-card__desc">
              Queue a full universe sync that runs in the background. It will pull the sector index,
              hydrate each sector, deep-sync linked systems, and continue automatically after the
              sector-detail rate limit resets.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onStartBackgroundSync} disabled={backgroundSyncLoading}>
              {backgroundSyncLoading ? "Queueing..." : "Queue Background Sync"}
            </button>
            <button className="btn" type="button" onClick={() => void loadLatestBackgroundSync(backgroundSyncRun?.id)}>
              Refresh Status
            </button>
            <button
              className="btn"
              type="button"
              onClick={onCancelBackgroundSync}
              disabled={
                backgroundSyncCancelLoading ||
                !backgroundSyncRun ||
                !["queued", "running", "waiting_rate_limit", "cancel_requested"].includes(backgroundSyncRun.status)
              }
            >
              {backgroundSyncCancelLoading ? "Stopping..." : "Stop Sync"}
            </button>
          </div>

          {backgroundSyncMessage ? <p className="small">{backgroundSyncMessage}</p> : null}
          {backgroundSyncError ? <p className="small" style={{ color: "salmon" }}>{backgroundSyncError}</p> : null}

          {backgroundSyncRun ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Run ID</h3>
                <p className="small">{backgroundSyncRun.id}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Status</h3>
                <p className="small">{backgroundSyncRun.status}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Sector Progress</h3>
                <p className="small">
                  {(backgroundSyncRun.progress?.sector_cursor ?? 0)} / {(backgroundSyncRun.progress?.sector_total ?? 0)}
                </p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Sector Details</h3>
                <p className="small">{backgroundLiveStats?.sector_details_synced ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Deep Systems</h3>
                <p className="small">{backgroundLiveStats?.systems_deep_synced ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Planets Synced</h3>
                <p className="small">
                  {backgroundLiveStats?.planets_deep_synced ?? backgroundLiveStats?.planets_upserted ?? 0}
                </p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Stations Synced</h3>
                <p className="small">
                  {backgroundLiveStats?.stations_deep_synced ?? backgroundLiveStats?.stations_upserted ?? 0}
                </p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Hyperlanes</h3>
                <p className="small">{backgroundLiveStats?.hyperlanes_upserted ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Destination Systems</h3>
                <p className="small">{backgroundLiveStats?.destination_systems_synced ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Next Retry</h3>
                <p className="small">{backgroundSyncRun.next_retry_at ?? "N/A"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Updated</h3>
                <p className="small">{backgroundSyncRun.updated_at ?? "N/A"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Heartbeat</h3>
                <p className="small">
                  {heartbeatAgeSeconds === null ? "N/A" : `${heartbeatAgeSeconds}s ago`}
                </p>
              </div>
            </div>
          ) : null}

          {backgroundSyncRun?.last_message ? (
            <p className="small" style={{ marginTop: "0.75rem" }}>
              {backgroundSyncRun.last_message}
            </p>
          ) : null}

          {backgroundCurrentSector ? (
            <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
              <div className="admin-card">
                <h3 className="admin-card__title">Current Sector</h3>
                <p className="small">
                  {backgroundCurrentSector.name ?? backgroundCurrentSector.uid ?? backgroundCurrentSector.identifier ?? "Unknown"}
                </p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Current Position</h3>
                <p className="small">
                  {backgroundCurrentSector.index ?? 0} / {backgroundCurrentSector.total ?? 0}
                </p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Current Identifier</h3>
                <p className="small">{backgroundCurrentSector.identifier ?? "Unknown"}</p>
              </div>
            </div>
          ) : null}

          {backgroundLastDetail ? (
            <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
              <div className="admin-card">
                <h3 className="admin-card__title">Last Detail Event</h3>
                <p className="small">{backgroundLastDetail.event ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Last Detail Message</h3>
                <p className="small">{backgroundLastDetail.message ?? "Unknown"}</p>
              </div>
            </div>
          ) : null}

          {backgroundHeartbeat ? (
            <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
              <div className="admin-card">
                <h3 className="admin-card__title">Live Activity</h3>
                <p className="small">{backgroundHeartbeat.message ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Live Status</h3>
                <p className="small">{backgroundHeartbeat.status ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Live Update Time</h3>
                <p className="small">{backgroundHeartbeat.updated_at ?? "N/A"}</p>
              </div>
            </div>
          ) : null}

          {backgroundSyncRun?.error_message ? (
            <p className="small" style={{ color: "salmon" }}>
              {backgroundSyncRun.error_message}
            </p>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Pull All Sectors</h3>
            <p className="admin-card__desc">
              Page through the public SWC sector index and seed all sector records into
              the local database, then hydrate each sector with its detail payload.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullAllSectors} disabled={bulkLoading}>
              {bulkLoading ? "Running..." : "Pull All Sectors"}
            </button>
          </div>

          {bulkMessage ? <p className="small">{bulkMessage}</p> : null}
          {bulkError ? <p className="small" style={{ color: "salmon" }}>{bulkError}</p> : null}

          {bulkProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {bulkProgressLines.slice(-12).map((line, index) => (
                <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {bulkPersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Sector Records</h3>
                <p className="small">{bulkPersistence.sector_count ?? bulkPersistence.total ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Pages Pulled</h3>
                <p className="small">{bulkPersistence.pages ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Total Listed</h3>
                <p className="small">{bulkPersistence.total ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Details Hydrated</h3>
                <p className="small">{bulkPersistence.hydrated_sector_details ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Pull All Station Types</h3>
            <p className="admin-card__desc">
              Pull the non-rate-limited SWC station type catalog, then hydrate each station type
              with its full detail payload so we can inspect richer metadata separately from live station instances.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullAllStationTypes} disabled={stationTypeLoading}>
              {stationTypeLoading ? "Running..." : "Pull All Station Types"}
            </button>
          </div>

          {stationTypeMessage ? <p className="small">{stationTypeMessage}</p> : null}
          {stationTypeError ? <p className="small" style={{ color: "salmon" }}>{stationTypeError}</p> : null}
          {stationTypeProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {stationTypeProgressLines.slice(-8).map((line, index) => (
                <p key={`station-type-progress-${index}`} className="small">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {stationTypePersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Type Records</h3>
                <p className="small">{stationTypePersistence.station_type_count ?? stationTypePersistence.total ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Pages Pulled</h3>
                <p className="small">{stationTypePersistence.pages ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Total Listed</h3>
                <p className="small">{stationTypePersistence.total ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Details Hydrated</h3>
                <p className="small">{stationTypePersistence.hydrated_station_types ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Pull All Ship Types</h3>
            <p className="admin-card__desc">
              Pull the SWC ship type catalog and hydrate each ship type so we have stored ship references alongside other universe entity catalogs.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullAllShipTypes} disabled={shipTypeLoading}>
              {shipTypeLoading ? "Running..." : "Pull All Ship Types"}
            </button>
          </div>

          {shipTypeMessage ? <p className="small">{shipTypeMessage}</p> : null}
          {shipTypeError ? <p className="small" style={{ color: "salmon" }}>{shipTypeError}</p> : null}
          {shipTypeProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {shipTypeProgressLines.slice(-8).map((line, index) => (
                <p key={`ship-type-progress-${index}`} className="small">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {shipTypePersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Type Records</h3>
                <p className="small">{shipTypePersistence.ship_type_count ?? shipTypePersistence.total ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Pages Pulled</h3>
                <p className="small">{shipTypePersistence.pages ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Total Listed</h3>
                <p className="small">{shipTypePersistence.total ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Details Hydrated</h3>
                <p className="small">{shipTypePersistence.hydrated_ship_types ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Pull All Facility Types</h3>
            <p className="admin-card__desc">
              Pull the SWC facility type catalog and hydrate each facility type so we have stored facility references alongside the other universe entity catalogs.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullAllFacilityTypes} disabled={facilityTypeLoading}>
              {facilityTypeLoading ? "Running..." : "Pull All Facility Types"}
            </button>
          </div>

          {facilityTypeMessage ? <p className="small">{facilityTypeMessage}</p> : null}
          {facilityTypeError ? <p className="small" style={{ color: "salmon" }}>{facilityTypeError}</p> : null}
          {facilityTypeProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {facilityTypeProgressLines.slice(-8).map((line, index) => (
                <p key={`facility-type-progress-${index}`} className="small">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {facilityTypePersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Type Records</h3>
                <p className="small">{facilityTypePersistence.facility_type_count ?? facilityTypePersistence.total ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Pages Pulled</h3>
                <p className="small">{facilityTypePersistence.pages ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Total Listed</h3>
                <p className="small">{facilityTypePersistence.total ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Details Hydrated</h3>
                <p className="small">{facilityTypePersistence.hydrated_facility_types ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Pull All Item Types</h3>
            <p className="admin-card__desc">
              Pull the SWC item type catalog and hydrate each item type so we have stored item references alongside the other universe entity catalogs.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullAllItemTypes} disabled={itemTypeLoading}>
              {itemTypeLoading ? "Running..." : "Pull All Item Types"}
            </button>
          </div>

          {itemTypeMessage ? <p className="small">{itemTypeMessage}</p> : null}
          {itemTypeError ? <p className="small" style={{ color: "salmon" }}>{itemTypeError}</p> : null}
          {itemTypeProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {itemTypeProgressLines.slice(-8).map((line, index) => (
                <p key={`item-type-progress-${index}`} className="small">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {itemTypePersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Type Records</h3>
                <p className="small">{itemTypePersistence.item_type_count ?? itemTypePersistence.total ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Pages Pulled</h3>
                <p className="small">{itemTypePersistence.pages ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Total Listed</h3>
                <p className="small">{itemTypePersistence.total ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Details Hydrated</h3>
                <p className="small">{itemTypePersistence.hydrated_item_types ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Pull All Terrain Types</h3>
            <p className="admin-card__desc">
              Pull the SWC terrain type catalog and hydrate each terrain type so the planet terrain data
              has a real reference layer instead of only raw grid points and terrain map strings.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullAllTerrainTypes} disabled={terrainTypeLoading}>
              {terrainTypeLoading ? "Running..." : "Pull All Terrain Types"}
            </button>
          </div>

          {terrainTypeMessage ? <p className="small">{terrainTypeMessage}</p> : null}
          {terrainTypeError ? <p className="small" style={{ color: "salmon" }}>{terrainTypeError}</p> : null}
          {terrainTypeProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {terrainTypeProgressLines.slice(-8).map((line, index) => (
                <p key={`terrain-type-progress-${index}`} className="small">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {terrainTypePersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Type Records</h3>
                <p className="small">{terrainTypePersistence.terrain_type_count ?? terrainTypePersistence.total ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Pages Pulled</h3>
                <p className="small">{terrainTypePersistence.pages ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Total Listed</h3>
                <p className="small">{terrainTypePersistence.total ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Details Hydrated</h3>
                <p className="small">{terrainTypePersistence.hydrated_terrain_types ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Pull All Material Types</h3>
            <p className="admin-card__desc">
              Pull the SWC material catalog and hydrate each material type so terrain references can
              resolve into stored material metadata instead of only raw names and UIDs.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullAllMaterialTypes} disabled={materialTypeLoading}>
              {materialTypeLoading ? "Running..." : "Pull All Material Types"}
            </button>
          </div>

          {materialTypeMessage ? <p className="small">{materialTypeMessage}</p> : null}
          {materialTypeError ? <p className="small" style={{ color: "salmon" }}>{materialTypeError}</p> : null}
          {materialTypeProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {materialTypeProgressLines.slice(-8).map((line, index) => (
                <p key={`material-type-progress-${index}`} className="small">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {materialTypePersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Type Records</h3>
                <p className="small">{materialTypePersistence.material_type_count ?? materialTypePersistence.total ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Pages Pulled</h3>
                <p className="small">{materialTypePersistence.pages ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Total Listed</h3>
                <p className="small">{materialTypePersistence.total ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Details Hydrated</h3>
                <p className="small">{materialTypePersistence.hydrated_material_types ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Refresh Stored Planets</h3>
            <p className="admin-card__desc">
              Re-pull planet detail only for planets already stored in the database. Use this to backfill
              new planet fields like population without running a full sector or universe sync.
            </p>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onRefreshStoredPlanets} disabled={planetRefreshLoading}>
              {planetRefreshLoading ? "Running..." : "Refresh Stored Planets"}
            </button>
          </div>

          {planetRefreshMessage ? <p className="small">{planetRefreshMessage}</p> : null}
          {planetRefreshError ? <p className="small" style={{ color: "salmon" }}>{planetRefreshError}</p> : null}

          {planetRefreshProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {planetRefreshProgressLines.slice(-16).map((line, index) => (
                <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {planetRefreshPersistence ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Planet Records</h3>
                <p className="small">{planetRefreshPersistence.planet_count ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Refreshed</h3>
                <p className="small">{planetRefreshPersistence.refreshed_planets ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Missing Identifier</h3>
                <p className="small">{planetRefreshPersistence.skipped_missing_identifier ?? 0}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Skipped 404</h3>
                <p className="small">{planetRefreshPersistence.skipped_not_found ?? 0}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">System Pull</h3>
            <p className="admin-card__desc">
              Pull a single system from SWC and persist the stored system layer. Current local system data includes
              identity, sector link, galaxy/system coordinates, planets, stations, and hyperlanes.
            </p>
          </div>

          <div className="admin-grid">
            <div className="admin-card">
              <label className="small" htmlFor="admin-system-identifier">
                System
              </label>
              <input
                id="admin-system-identifier"
                className="input"
                value={systemIdentifier}
                onChange={(event) => setSystemIdentifier(event.target.value)}
                placeholder="System UID, identifier, or name, e.g. geonosis"
              />
            </div>

            <div className="admin-card">
              <label className="small">
                <input
                  type="checkbox"
                  checked={systemPersist}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSystemPersist(checked);
                    if (!checked) {
                      setSystemDeep(false);
                    }
                  }}
                />{" "}
                Save pulled data to DB
              </label>

              <label className="small">
                <input
                  type="checkbox"
                  checked={systemDeep}
                  disabled={!systemPersist}
                  onChange={(event) => setSystemDeep(event.target.checked)}
                />{" "}
                Also pull linked planet, station, and destination system details
              </label>
            </div>
          </div>

          <div className="admin-card__actions">
            <button className="btn" type="button" onClick={onPullSystem} disabled={systemLoading}>
              {systemLoading ? "Running..." : "Pull System"}
            </button>
            <button className="btn" type="button" onClick={() => void onLoadStoredSystem()} disabled={storedSystemLoading}>
              {storedSystemLoading ? "Loading..." : "Load Stored System"}
            </button>
          </div>

          {systemMessage ? <p className="small">{systemMessage}</p> : null}
          {systemError ? <p className="small" style={{ color: "salmon" }}>{systemError}</p> : null}
          {storedSystemError ? <p className="small" style={{ color: "salmon" }}>{storedSystemError}</p> : null}

          {systemProgressLines.length > 0 ? (
            <div className="sysuniverse-stack">
              {systemProgressLines.slice(-16).map((line, index) => (
                <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {systemResult?.system ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">System</h3>
                <p className="small">{systemName}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Planets Found</h3>
                <p className="small">{planetsPulled}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Stations Found</h3>
                <p className="small">{stationsPulled}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Hyperlanes Found</h3>
                <p className="small">{hyperlanesPulled}</p>
              </div>
              {systemPersist ? (
                <div className="admin-card">
                  <h3 className="admin-card__title">Records Synced</h3>
                  <p className="small">
                    {(systemPersistence?.planets_upserted ?? 0) +
                      (systemPersistence?.stations_upserted ?? 0) +
                      (systemPersistence?.hyperlanes_upserted ?? 0)}
                  </p>
                </div>
              ) : null}
              {systemPersist && systemDeep ? (
                <div className="admin-card">
                  <h3 className="admin-card__title">Deep Synced</h3>
                  <p className="small">
                    {(systemPersistence?.planets_deep_synced ?? 0) +
                      (systemPersistence?.stations_deep_synced ?? 0) +
                      (systemPersistence?.destination_systems_synced ?? 0)}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {storedSystemDetail ? (
            <div className="admin-grid">
              <div className="admin-card">
                <h3 className="admin-card__title">Stored UID</h3>
                <p className="small">{storedSystemDetail.system.uid ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Sector</h3>
                <p className="small">{storedSystemDetail.system.sector_name ?? storedSystemDetail.system.sector_uid ?? "Unknown"}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Stored Planets</h3>
                <p className="small">{storedSystemDetail.planets.length}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Stored Stations</h3>
                <p className="small">{storedSystemDetail.stations.length}</p>
              </div>
              <div className="admin-card">
                <h3 className="admin-card__title">Stored Hyperlanes</h3>
                <p className="small">{storedSystemDetail.hyperlanes.length}</p>
              </div>
            </div>
          ) : null}
        </section>

        {message ? (
          <section className="admin-card">
            <h3 className="admin-card__title">Status</h3>
            <p className="small">{message}</p>
          </section>
        ) : null}

        {error ? (
          <section className="admin-card">
            <h3 className="admin-card__title">Error</h3>
            <p className="small" style={{ color: "salmon" }}>{error}</p>
          </section>
        ) : null}

        {progressLines.length > 0 ? (
          <section className="admin-card">
            <h3 className="admin-card__title">Live Progress</h3>
            <div className="sysuniverse-stack">
              {progressLines.slice(-12).map((line, index) => (
                <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                  {line}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {result?.sector ? (
          <section className="admin-grid">
            <div className="admin-card">
              <h3 className="admin-card__title">Sector</h3>
              <p className="small">{sectorName}</p>
            </div>

            <div className="admin-card">
              <h3 className="admin-card__title">Systems Found</h3>
              <p className="small">{systemsPulled}</p>
            </div>

            <div className="admin-card">
              <h3 className="admin-card__title">Coordinates Found</h3>
              <p className="small">{coordinatesPulled}</p>
            </div>

            {persist ? (
              <div className="admin-card">
                <h3 className="admin-card__title">Records Synced</h3>
                <p className="small">{systemsSynced}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
};

export default AdminSystemPanel;
