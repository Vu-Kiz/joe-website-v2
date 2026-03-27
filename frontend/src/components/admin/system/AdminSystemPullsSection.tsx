import React from "react";
import { Link } from "react-router-dom";

type Props = {
  sectorIdentifier: string;
  setSectorIdentifier: (value: string) => void;
  persist: boolean;
  setPersist: (value: boolean) => void;
  deep: boolean;
  setDeep: (value: boolean) => void;
  loading: boolean;
  onPullSector: () => void;
  onStartBackgroundSync: () => void;
  onCancelBackgroundSync: () => void;
  onLoadLatestBackgroundSync: () => void;
  backgroundSyncLoading: boolean;
  backgroundSyncCancelLoading: boolean;
  backgroundSyncError: string | null;
  backgroundSyncMessage: string | null;
  backgroundSyncRun: any;
  backgroundLiveStats: Record<string, any>;
  heartbeatAgeSeconds: number | null;
  backgroundCurrentSector: any;
  backgroundLastDetail: any;
  backgroundHeartbeat: any;
  bulkLoading: boolean;
  bulkMessage: string | null;
  bulkError: string | null;
  bulkPersistence: any;
  bulkProgressLines: string[];
  onPullAllSectors: () => void;
  message: string | null;
  error: string | null;
  progressLines: string[];
  result: any;
  sectorName: string;
  systemsPulled: number;
  coordinatesPulled: number;
  systemsSynced: number;
};

const AdminSystemPullsSection: React.FC<Props> = ({
  sectorIdentifier,
  setSectorIdentifier,
  persist,
  setPersist,
  deep,
  setDeep,
  loading,
  onPullSector,
  onStartBackgroundSync,
  onCancelBackgroundSync,
  onLoadLatestBackgroundSync,
  backgroundSyncLoading,
  backgroundSyncCancelLoading,
  backgroundSyncError,
  backgroundSyncMessage,
  backgroundSyncRun,
  backgroundLiveStats,
  heartbeatAgeSeconds,
  backgroundCurrentSector,
  backgroundLastDetail,
  backgroundHeartbeat,
  bulkLoading,
  bulkMessage,
  bulkError,
  bulkPersistence,
  bulkProgressLines,
  onPullAllSectors,
  message,
  error,
  progressLines,
  result,
  sectorName,
  systemsPulled,
  coordinatesPulled,
  systemsSynced,
}) => {
  return (
    <>
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
            Open Galaxy Explorer
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
            Queue a full galaxy sync that runs in the background. It will pull the sector index,
            hydrate each sector, deep-sync linked systems, and continue automatically after the
            sector-detail rate limit resets.
          </p>
        </div>

        <div className="admin-card__actions">
          <button className="btn" type="button" onClick={onStartBackgroundSync} disabled={backgroundSyncLoading}>
            {backgroundSyncLoading ? "Queueing..." : "Queue Background Sync"}
          </button>
          <button className="btn" type="button" onClick={onLoadLatestBackgroundSync}>
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
            <div className="admin-card"><h3 className="admin-card__title">Run ID</h3><p className="small">{backgroundSyncRun.id}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Status</h3><p className="small">{backgroundSyncRun.status}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Sector Progress</h3><p className="small">{(backgroundSyncRun.progress?.sector_cursor ?? 0)} / {(backgroundSyncRun.progress?.sector_total ?? 0)}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Sector Details</h3><p className="small">{backgroundLiveStats?.sector_details_synced ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Deep Systems</h3><p className="small">{backgroundLiveStats?.systems_deep_synced ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Planets Synced</h3><p className="small">{backgroundLiveStats?.planets_deep_synced ?? backgroundLiveStats?.planets_upserted ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Stations Synced</h3><p className="small">{backgroundLiveStats?.stations_deep_synced ?? backgroundLiveStats?.stations_upserted ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Hyperlanes</h3><p className="small">{backgroundLiveStats?.hyperlanes_upserted ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Destination Systems</h3><p className="small">{backgroundLiveStats?.destination_systems_synced ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Next Retry</h3><p className="small">{backgroundSyncRun.next_retry_at ?? "N/A"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Updated</h3><p className="small">{backgroundSyncRun.updated_at ?? "N/A"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Heartbeat</h3><p className="small">{heartbeatAgeSeconds === null ? "N/A" : `${heartbeatAgeSeconds}s ago`}</p></div>
          </div>
        ) : null}

        {backgroundSyncRun?.last_message ? <p className="small" style={{ marginTop: "0.75rem" }}>{backgroundSyncRun.last_message}</p> : null}

        {backgroundCurrentSector ? (
          <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
            <div className="admin-card"><h3 className="admin-card__title">Current Sector</h3><p className="small">{backgroundCurrentSector.name ?? backgroundCurrentSector.uid ?? backgroundCurrentSector.identifier ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Current Position</h3><p className="small">{backgroundCurrentSector.index ?? 0} / {backgroundCurrentSector.total ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Current Identifier</h3><p className="small">{backgroundCurrentSector.identifier ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {backgroundLastDetail ? (
          <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
            <div className="admin-card"><h3 className="admin-card__title">Last Detail Event</h3><p className="small">{backgroundLastDetail.event ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Last Detail Message</h3><p className="small">{backgroundLastDetail.message ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {backgroundHeartbeat ? (
          <div className="admin-grid" style={{ marginTop: "0.75rem" }}>
            <div className="admin-card"><h3 className="admin-card__title">Live Activity</h3><p className="small">{backgroundHeartbeat.message ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Live Status</h3><p className="small">{backgroundHeartbeat.status ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Live Update Time</h3><p className="small">{backgroundHeartbeat.updated_at ?? "N/A"}</p></div>
          </div>
        ) : null}

        {backgroundSyncRun?.error_message ? <p className="small" style={{ color: "salmon" }}>{backgroundSyncRun.error_message}</p> : null}
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
            <div className="admin-card"><h3 className="admin-card__title">Sector Records</h3><p className="small">{bulkPersistence.sector_count ?? bulkPersistence.total ?? 0}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Pages Pulled</h3><p className="small">{bulkPersistence.pages ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Total Listed</h3><p className="small">{bulkPersistence.total ?? "Unknown"}</p></div>
            <div className="admin-card"><h3 className="admin-card__title">Details Hydrated</h3><p className="small">{bulkPersistence.hydrated_sector_details ?? 0}</p></div>
          </div>
        ) : null}
      </section>

      {message ? <section className="admin-card"><h3 className="admin-card__title">Status</h3><p className="small">{message}</p></section> : null}
      {error ? <section className="admin-card"><h3 className="admin-card__title">Error</h3><p className="small" style={{ color: "salmon" }}>{error}</p></section> : null}
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
          <div className="admin-card"><h3 className="admin-card__title">Sector</h3><p className="small">{sectorName}</p></div>
          <div className="admin-card"><h3 className="admin-card__title">Systems Found</h3><p className="small">{systemsPulled}</p></div>
          <div className="admin-card"><h3 className="admin-card__title">Coordinates Found</h3><p className="small">{coordinatesPulled}</p></div>
          {persist ? <div className="admin-card"><h3 className="admin-card__title">Records Synced</h3><p className="small">{systemsSynced}</p></div> : null}
        </section>
      ) : null}
    </>
  );
};

export default AdminSystemPullsSection;
