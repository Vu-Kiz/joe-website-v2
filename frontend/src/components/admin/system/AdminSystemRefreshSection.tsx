import React from "react";
import type { StoredSystemDetail } from "../../../api/universe";

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
  return (
    <>
      <section className="admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">Refresh Stored Planets</h3>
          <p className="admin-card__desc">
            Re-pull planet detail only for planets already stored in the database. Use this to backfill
            new planet fields like population without running a full sector or galaxy sync.
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
            <div className="admin-card"><h3 className="admin-card__title">Planet Records</h3><p className="small">{planetRefreshPersistence.planet_count ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Refreshed</h3><p className="small">{planetRefreshPersistence.refreshed_planets ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Missing Identifier</h3><p className="small">{planetRefreshPersistence.skipped_missing_identifier ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Skipped 404</h3><p className="small">{planetRefreshPersistence.skipped_not_found ?? 0}</p></div>
          </div>
        ) : null}
      </section>

      <section className="admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">Refresh Stored Systems</h3>
          <p className="admin-card__desc">
            Re-pull system detail for systems already stored in the database. Use this to backfill shell
            system rows that are missing names, coordinates, population, or linked records.
          </p>
        </div>

        <div className="admin-card__actions">
          <button className="btn" type="button" onClick={onRefreshStoredSystems} disabled={systemRefreshRunLoading}>
            {systemRefreshRunLoading ? "Queueing..." : "Queue Stored Systems Refresh"}
          </button>
          <button className="btn" type="button" onClick={onLoadLatestSystemRefreshRun}>
            Refresh Status
          </button>
          <button
            className="btn"
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
          <div className="admin-grid">
            <div className="admin-card"><h3 className="admin-card__title">Run ID</h3><p className="small">{systemRefreshRun.id}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Status</h3><p className="small">{systemRefreshRun.status}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Progress</h3><p className="small">{systemRefreshRun.progress?.processed ?? 0} / {systemRefreshRun.progress?.total ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">System Records</h3><p className="small">{systemRefreshLiveStats.system_count ?? systemRefreshPersistence?.system_count ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Refreshed</h3><p className="small">{systemRefreshLiveStats.refreshed_systems ?? systemRefreshPersistence?.refreshed_systems ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Missing Identifier</h3><p className="small">{systemRefreshLiveStats.skipped_missing_identifier ?? systemRefreshPersistence?.skipped_missing_identifier ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Skipped 404</h3><p className="small">{systemRefreshLiveStats.skipped_not_found ?? systemRefreshPersistence?.skipped_not_found ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Next Retry</h3><p className="small">{systemRefreshRun.next_retry_at ?? "N/A"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Updated</h3><p className="small">{systemRefreshRun.updated_at ?? "N/A"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Heartbeat</h3><p className="small">{systemRefreshHeartbeatAgeSeconds === null ? "N/A" : `${systemRefreshHeartbeatAgeSeconds}s ago`}</p></div>
          </div>
        ) : null}

        {systemRefreshRun?.last_message ? <p className="small" style={{ marginTop: "0.75rem" }}>{systemRefreshRun.last_message}</p> : null}

        {systemRefreshCurrentSystem ? (
          <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
            <div className="admin-card"><h3 className="admin-card__title">Current System</h3><p className="small">{systemRefreshCurrentSystem.name ?? systemRefreshCurrentSystem.uid ?? systemRefreshCurrentSystem.identifier ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Current Position</h3><p className="small">{systemRefreshCurrentSystem.index ?? 0} / {systemRefreshCurrentSystem.total ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Current Identifier</h3><p className="small">{systemRefreshCurrentSystem.identifier ?? systemRefreshCurrentSystem.uid ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {systemRefreshLastDetail ? (
          <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
            <div className="admin-card"><h3 className="admin-card__title">Last Detail Event</h3><p className="small">{systemRefreshLastDetail.event ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Last Detail Message</h3><p className="small">{systemRefreshLastDetail.message ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {systemRefreshHeartbeat ? (
          <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
            <div className="admin-card"><h3 className="admin-card__title">Live Activity</h3><p className="small">{systemRefreshHeartbeat.message ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Live Status</h3><p className="small">{systemRefreshHeartbeat.status ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Live Update Time</h3><p className="small">{systemRefreshHeartbeat.updated_at ?? "N/A"}</p></div>
          </div>
        ) : null}

        {systemRefreshRun?.error_message ? <p className="small" style={{ color: "salmon" }}>{systemRefreshRun.error_message}</p> : null}
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
            <label className="small" htmlFor="admin-system-identifier">System</label>
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
          <button className="btn" type="button" onClick={onLoadStoredSystem} disabled={storedSystemLoading}>
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
            <div className="admin-card"><h3 className="admin-card__title">System</h3><p className="small">{systemName}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Planets Found</h3><p className="small">{planetsPulled}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Stations Found</h3><p className="small">{stationsPulled}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Hyperlanes Found</h3><p className="small">{hyperlanesPulled}</p></div>
            {systemPersisted ? <div className="admin-card"><h3 className="admin-card__title">Records Synced</h3><p className="small">{(systemPersistence?.planets_upserted ?? 0) + (systemPersistence?.stations_upserted ?? 0) + (systemPersistence?.hyperlanes_upserted ?? 0)}</p></div> : null}
            {systemPersisted && systemDeepEnabled ? <div className="admin-card"><h3 className="admin-card__title">Deep Synced</h3><p className="small">{(systemPersistence?.planets_deep_synced ?? 0) + (systemPersistence?.stations_deep_synced ?? 0) + (systemPersistence?.destination_systems_synced ?? 0)}</p></div> : null}
          </div>
        ) : null}

        {storedSystemDetail ? (
          <div className="admin-grid">
            <div className="admin-card"><h3 className="admin-card__title">Stored UID</h3><p className="small">{storedSystemDetail.system.uid ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Sector</h3><p className="small">{storedSystemDetail.system.sector_name ?? storedSystemDetail.system.sector_uid ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Stored Planets</h3><p className="small">{storedSystemDetail.planets.length}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Stored Stations</h3><p className="small">{storedSystemDetail.stations.length}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Stored Hyperlanes</h3><p className="small">{storedSystemDetail.hyperlanes.length}</p></div>
          </div>
        ) : null}
      </section>
    </>
  );
};

export default AdminSystemRefreshSection;
