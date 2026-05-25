import React from "react";
import type { StoredSystemDetail } from "../../../api/universe/universe";
import { BTN, INPUT} from "../../../utils/ui";

type Props = {
  planetRefreshLoading: boolean;
  planetRefreshMessage: string | null;
  planetRefreshError: string | null;
  planetRefreshPersistence: any;
  planetRefreshProgressLines: string[];
  onRefreshStoredPlanets: () => void;
  systemRefreshMessage: string | null;
  systemRefreshError: string | null;
  systemRefreshPersistence: any;
  onRefreshStoredSystems: () => void;
  onLoadLatestSystemRefreshRun: () => void;
  onCancelSystemRefresh: () => void;
  systemRefreshRunLoading: boolean;
  systemRefreshRunCancelLoading: boolean;
  systemRefreshRun: any;
  systemRefreshLiveStats: Record<string, any>;
  systemRefreshHeartbeatAgeSeconds: number | null;
  systemRefreshCurrentSystem: any;
  systemRefreshLastDetail: any;
  systemRefreshHeartbeat: any;
  systemIdentifier: string;
  setSystemIdentifier: (value: string) => void;
  systemPersist: boolean;
  setSystemPersist: (value: boolean) => void;
  systemDeep: boolean;
  setSystemDeep: (value: boolean) => void;
  onPullSystem: () => void;
  systemLoading: boolean;
  onLoadStoredSystem: () => void;
  storedSystemLoading: boolean;
  systemMessage: string | null;
  systemError: string | null;
  storedSystemError: string | null;
  systemProgressLines: string[];
  systemResult: any;
  systemName: string;
  planetsPulled: number;
  stationsPulled: number;
  hyperlanesPulled: number;
  systemPersisted: boolean;
  systemDeepEnabled: boolean;
  systemPersistence: any;
  storedSystemDetail: StoredSystemDetail | null;
};

const AdminSystemRefreshSection: React.FC<Props> = ({
  planetRefreshLoading,
  planetRefreshMessage,
  planetRefreshError,
  planetRefreshPersistence,
  planetRefreshProgressLines,
  onRefreshStoredPlanets,
  systemRefreshMessage,
  systemRefreshError,
  systemRefreshPersistence,
  onRefreshStoredSystems,
  onLoadLatestSystemRefreshRun,
  onCancelSystemRefresh,
  systemRefreshRunLoading,
  systemRefreshRunCancelLoading,
  systemRefreshRun,
  systemRefreshLiveStats,
  systemRefreshHeartbeatAgeSeconds,
  systemRefreshCurrentSystem,
  systemRefreshLastDetail,
  systemRefreshHeartbeat,
  systemIdentifier,
  setSystemIdentifier,
  systemPersist,
  setSystemPersist,
  systemDeep,
  setSystemDeep,
  onPullSystem,
  systemLoading,
  onLoadStoredSystem,
  storedSystemLoading,
  systemMessage,
  systemError,
  storedSystemError,
  systemProgressLines,
  systemResult,
  systemName,
  planetsPulled,
  stationsPulled,
  hyperlanesPulled,
  systemPersisted,
  systemDeepEnabled,
  systemPersistence,
  storedSystemDetail,
}) => {
  const pulledOwnerName = systemResult?.system?.owner_name ?? null;
  const pulledOwnerUid = systemResult?.system?.owner_uid ?? null;
  const storedOwnerName = storedSystemDetail?.system.owner_name ?? null;
  const storedOwnerUid = storedSystemDetail?.system.owner_uid ?? null;
  const formatOwner = (name: string | null, uid: string | null): string => {
    if (name && uid) {
      return `${name} (${uid})`;
    }

    return name ?? uid ?? "Unowned";
  };

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0">Refresh Stored Planets</h3>
          <p className="m-0 opacity-[0.85]">
            Re-pull planet detail only for planets already stored in the database. Use this to backfill
            new planet fields like population without running a full sector or galaxy sync.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={BTN} type="button" onClick={onRefreshStoredPlanets} disabled={planetRefreshLoading}>
            {planetRefreshLoading ? "Running..." : "Refresh Stored Planets"}
          </button>
        </div>

        {planetRefreshMessage ? <p className="small">{planetRefreshMessage}</p> : null}
        {planetRefreshError ? <p className="small" style={{ color: "salmon" }}>{planetRefreshError}</p> : null}
        {planetRefreshProgressLines.length > 0 ? (
          <div className="grid gap-3.5">
            {planetRefreshProgressLines.slice(-16).map((line, index) => (
              <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {planetRefreshPersistence ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <div className="flex flex-col gap-4"><h3 className="m-0">Planet Records</h3><p className="small">{planetRefreshPersistence.planet_count ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Refreshed</h3><p className="small">{planetRefreshPersistence.refreshed_planets ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Missing Identifier</h3><p className="small">{planetRefreshPersistence.skipped_missing_identifier ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Skipped 404</h3><p className="small">{planetRefreshPersistence.skipped_not_found ?? 0}</p></div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0">Refresh Stored Systems</h3>
          <p className="m-0 opacity-[0.85]">
            Re-pull system detail for systems already stored in the database. Use this to backfill shell
            system rows that are missing names, coordinates, population, or linked records.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={BTN} type="button" onClick={onRefreshStoredSystems} disabled={systemRefreshRunLoading}>
            {systemRefreshRunLoading ? "Queueing..." : "Queue Stored Systems Refresh"}
          </button>
          <button className={BTN} type="button" onClick={onLoadLatestSystemRefreshRun}>
            Refresh Status
          </button>
          <button
            className={BTN}
            type="button"
            onClick={onCancelSystemRefresh}
            disabled={
              systemRefreshRunCancelLoading ||
              !systemRefreshRun ||
              !["queued", "running", "waiting_db_lock", "cancel_requested"].includes(systemRefreshRun.status)
            }
          >
            {systemRefreshRunCancelLoading ? "Stopping..." : "Stop Refresh"}
          </button>
        </div>

        {systemRefreshMessage ? <p className="small">{systemRefreshMessage}</p> : null}
        {systemRefreshError ? <p className="small" style={{ color: "salmon" }}>{systemRefreshError}</p> : null}

        {systemRefreshRun ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <div className="flex flex-col gap-4"><h3 className="m-0">Run ID</h3><p className="small">{systemRefreshRun.id}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Status</h3><p className="small">{systemRefreshRun.status}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Progress</h3><p className="small">{systemRefreshRun.progress?.processed ?? 0} / {systemRefreshRun.progress?.total ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">System Records</h3><p className="small">{systemRefreshLiveStats.system_count ?? systemRefreshPersistence?.system_count ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Refreshed</h3><p className="small">{systemRefreshLiveStats.refreshed_systems ?? systemRefreshPersistence?.refreshed_systems ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Missing Identifier</h3><p className="small">{systemRefreshLiveStats.skipped_missing_identifier ?? systemRefreshPersistence?.skipped_missing_identifier ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Skipped 404</h3><p className="small">{systemRefreshLiveStats.skipped_not_found ?? systemRefreshPersistence?.skipped_not_found ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Next Retry</h3><p className="small">{systemRefreshRun.next_retry_at ?? "N/A"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Updated</h3><p className="small">{systemRefreshRun.updated_at ?? "N/A"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Heartbeat</h3><p className="small">{systemRefreshHeartbeatAgeSeconds === null ? "N/A" : `${systemRefreshHeartbeatAgeSeconds}s ago`}</p></div>
          </div>
        ) : null}

        {systemRefreshRun?.last_message ? <p className="small" style={{ marginTop: "0.75rem" }}>{systemRefreshRun.last_message}</p> : null}

        {systemRefreshCurrentSystem ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]" style={{ marginTop: "0.75rem" }}>
            <div className="flex flex-col gap-4"><h3 className="m-0">Current System</h3><p className="small">{systemRefreshCurrentSystem.name ?? systemRefreshCurrentSystem.uid ?? systemRefreshCurrentSystem.identifier ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Current Position</h3><p className="small">{systemRefreshCurrentSystem.index ?? 0} / {systemRefreshCurrentSystem.total ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Current Identifier</h3><p className="small">{systemRefreshCurrentSystem.identifier ?? systemRefreshCurrentSystem.uid ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {systemRefreshLastDetail ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]" style={{ marginTop: "0.75rem" }}>
            <div className="flex flex-col gap-4"><h3 className="m-0">Last Detail Event</h3><p className="small">{systemRefreshLastDetail.event ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Last Detail Message</h3><p className="small">{systemRefreshLastDetail.message ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {systemRefreshHeartbeat ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]" style={{ marginTop: "0.75rem" }}>
            <div className="flex flex-col gap-4"><h3 className="m-0">Live Activity</h3><p className="small">{systemRefreshHeartbeat.message ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Live Status</h3><p className="small">{systemRefreshHeartbeat.status ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Live Update Time</h3><p className="small">{systemRefreshHeartbeat.updated_at ?? "N/A"}</p></div>
          </div>
        ) : null}

        {systemRefreshRun?.error_message ? <p className="small" style={{ color: "salmon" }}>{systemRefreshRun.error_message}</p> : null}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0">System Pull</h3>
          <p className="m-0 opacity-[0.85]">
            Pull a single system from SWC and persist the stored system layer. Current local system data includes
            identity, sector link, galaxy/system coordinates, planets, stations, and hyperlanes.
          </p>
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <div className="flex flex-col gap-4">
            <label className="small" htmlFor="admin-system-identifier">System</label>
            <input
              id="admin-system-identifier"
              className={INPUT}
              value={systemIdentifier}
              onChange={(event) => setSystemIdentifier(event.target.value)}
              placeholder="System UID, identifier, or name, e.g. geonosis"
            />
          </div>

          <div className="flex flex-col gap-4">
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

        <div className="flex flex-wrap gap-3">
          <button className={BTN} type="button" onClick={onPullSystem} disabled={systemLoading}>
            {systemLoading ? "Running..." : "Pull System"}
          </button>
          <button className={BTN} type="button" onClick={onLoadStoredSystem} disabled={storedSystemLoading}>
            {storedSystemLoading ? "Loading..." : "Load Stored System"}
          </button>
        </div>

        {systemMessage ? <p className="small">{systemMessage}</p> : null}
        {systemError ? <p className="small" style={{ color: "salmon" }}>{systemError}</p> : null}
        {storedSystemError ? <p className="small" style={{ color: "salmon" }}>{storedSystemError}</p> : null}

        {systemProgressLines.length > 0 ? (
          <div className="grid gap-3.5">
            {systemProgressLines.slice(-16).map((line, index) => (
              <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {systemResult?.system ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <div className="flex flex-col gap-4"><h3 className="m-0">System</h3><p className="small">{systemName}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Pulled Owner</h3><p className="small">{formatOwner(pulledOwnerName, pulledOwnerUid)}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Planets Found</h3><p className="small">{planetsPulled}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Stations Found</h3><p className="small">{stationsPulled}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Hyperlanes Found</h3><p className="small">{hyperlanesPulled}</p></div>
            {systemPersisted ? <div className="flex flex-col gap-4"><h3 className="m-0">Records Synced</h3><p className="small">{(systemPersistence?.planets_upserted ?? 0) + (systemPersistence?.stations_upserted ?? 0) + (systemPersistence?.hyperlanes_upserted ?? 0)}</p></div> : null}
            {systemPersisted && systemDeepEnabled ? <div className="flex flex-col gap-4"><h3 className="m-0">Deep Synced</h3><p className="small">{(systemPersistence?.planets_deep_synced ?? 0) + (systemPersistence?.stations_deep_synced ?? 0) + (systemPersistence?.destination_systems_synced ?? 0)}</p></div> : null}
          </div>
        ) : null}

        {storedSystemDetail ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <div className="flex flex-col gap-4"><h3 className="m-0">Stored UID</h3><p className="small">{storedSystemDetail.system.uid ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Sector</h3><p className="small">{storedSystemDetail.system.sector_name ?? storedSystemDetail.system.sector_uid ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Stored Owner</h3><p className="small">{formatOwner(storedOwnerName, storedOwnerUid)}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Stored Planets</h3><p className="small">{storedSystemDetail.planets.length}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Stored Stations</h3><p className="small">{storedSystemDetail.stations.length}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Stored Hyperlanes</h3><p className="small">{storedSystemDetail.hyperlanes.length}</p></div>
          </div>
        ) : null}
      </section>
    </>
  );
};

export default AdminSystemRefreshSection;
