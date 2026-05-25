import React from "react";
import { Link } from "react-router-dom";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM, INPUT} from "../../../utils/ui";

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
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0">Sector Pull</h3>
          <p className="m-0 opacity-[0.85]">
            Pull sector data from SWC and optionally save it into the local database.
            This panel is for syncing data, not for displaying the map.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/sys/debug/universe" className={BTN}>
            Open Galaxy Explorer
          </Link>
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <div className="flex flex-col gap-4">
            <label className="small" htmlFor="admin-sector-identifier">
              Sector
            </label>
            <input
              id="admin-sector-identifier"
              className={INPUT}
              value={sectorIdentifier}
              onChange={(event) => setSectorIdentifier(event.target.value)}
              placeholder="Sector UID or name, e.g. Arkanis"
            />
          </div>

          <div className="flex flex-col gap-4">
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

        <div className="flex flex-wrap gap-3">
          <button className={BTN} type="button" onClick={onPullSector} disabled={loading}>
            {loading ? "Running..." : "Pull Sector"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0">Background Pull All Info</h3>
          <p className="m-0 opacity-[0.85]">
            Queue a full galaxy sync that runs in the background. It will pull the sector index,
            hydrate each sector, deep-sync linked systems, and continue automatically after the
            sector-detail rate limit resets.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={BTN} type="button" onClick={onStartBackgroundSync} disabled={backgroundSyncLoading}>
            {backgroundSyncLoading ? "Queueing..." : "Queue Background Sync"}
          </button>
          <button className={BTN} type="button" onClick={onLoadLatestBackgroundSync}>
            Refresh Status
          </button>
          <button
            className={BTN}
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
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <div className="flex flex-col gap-4"><h3 className="m-0">Run ID</h3><p className="small">{backgroundSyncRun.id}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Status</h3><p className="small">{backgroundSyncRun.status}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Sector Progress</h3><p className="small">{(backgroundSyncRun.progress?.sector_cursor ?? 0)} / {(backgroundSyncRun.progress?.sector_total ?? 0)}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Sector Details</h3><p className="small">{backgroundLiveStats?.sector_details_synced ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Deep Systems</h3><p className="small">{backgroundLiveStats?.systems_deep_synced ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Planets Synced</h3><p className="small">{backgroundLiveStats?.planets_deep_synced ?? backgroundLiveStats?.planets_upserted ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Stations Synced</h3><p className="small">{backgroundLiveStats?.stations_deep_synced ?? backgroundLiveStats?.stations_upserted ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Hyperlanes</h3><p className="small">{backgroundLiveStats?.hyperlanes_upserted ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Destination Systems</h3><p className="small">{backgroundLiveStats?.destination_systems_synced ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Next Retry</h3><p className="small">{backgroundSyncRun.next_retry_at ?? "N/A"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Updated</h3><p className="small">{backgroundSyncRun.updated_at ?? "N/A"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Heartbeat</h3><p className="small">{heartbeatAgeSeconds === null ? "N/A" : `${heartbeatAgeSeconds}s ago`}</p></div>
          </div>
        ) : null}

        {backgroundSyncRun?.last_message ? <p className="small" style={{ marginTop: "0.75rem" }}>{backgroundSyncRun.last_message}</p> : null}

        {backgroundCurrentSector ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]" style={{ marginTop: "0.75rem" }}>
            <div className="flex flex-col gap-4"><h3 className="m-0">Current Sector</h3><p className="small">{backgroundCurrentSector.name ?? backgroundCurrentSector.uid ?? backgroundCurrentSector.identifier ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Current Position</h3><p className="small">{backgroundCurrentSector.index ?? 0} / {backgroundCurrentSector.total ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Current Identifier</h3><p className="small">{backgroundCurrentSector.identifier ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {backgroundLastDetail ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]" style={{ marginTop: "0.75rem" }}>
            <div className="flex flex-col gap-4"><h3 className="m-0">Last Detail Event</h3><p className="small">{backgroundLastDetail.event ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Last Detail Message</h3><p className="small">{backgroundLastDetail.message ?? "Unknown"}</p></div>
          </div>
        ) : null}

        {backgroundHeartbeat ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]" style={{ marginTop: "0.75rem" }}>
            <div className="flex flex-col gap-4"><h3 className="m-0">Live Activity</h3><p className="small">{backgroundHeartbeat.message ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Live Status</h3><p className="small">{backgroundHeartbeat.status ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Live Update Time</h3><p className="small">{backgroundHeartbeat.updated_at ?? "N/A"}</p></div>
          </div>
        ) : null}

        {backgroundSyncRun?.error_message ? <p className="small" style={{ color: "salmon" }}>{backgroundSyncRun.error_message}</p> : null}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0">Pull All Sectors</h3>
          <p className="m-0 opacity-[0.85]">
            Page through the public SWC sector index and seed all sector records into
            the local database, then hydrate each sector with its detail payload.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={BTN} type="button" onClick={onPullAllSectors} disabled={bulkLoading}>
            {bulkLoading ? "Running..." : "Pull All Sectors"}
          </button>
        </div>

        {bulkMessage ? <p className="small">{bulkMessage}</p> : null}
        {bulkError ? <p className="small" style={{ color: "salmon" }}>{bulkError}</p> : null}
        {bulkProgressLines.length > 0 ? (
          <div className="grid gap-3.5">
            {bulkProgressLines.slice(-12).map((line, index) => (
              <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {bulkPersistence ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <div className="flex flex-col gap-4"><h3 className="m-0">Sector Records</h3><p className="small">{bulkPersistence.sector_count ?? bulkPersistence.total ?? 0}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Pages Pulled</h3><p className="small">{bulkPersistence.pages ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Total Listed</h3><p className="small">{bulkPersistence.total ?? "Unknown"}</p></div>
            <div className="flex flex-col gap-4"><h3 className="m-0">Details Hydrated</h3><p className="small">{bulkPersistence.hydrated_sector_details ?? 0}</p></div>
          </div>
        ) : null}
      </section>

      {message ? <section className="flex flex-col gap-4"><h3 className="m-0">Status</h3><p className="small">{message}</p></section> : null}
      {error ? <section className="flex flex-col gap-4"><h3 className="m-0">Error</h3><p className="small" style={{ color: "salmon" }}>{error}</p></section> : null}
      {progressLines.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h3 className="m-0">Live Progress</h3>
          <div className="grid gap-3.5">
            {progressLines.slice(-12).map((line, index) => (
              <p key={`${index}-${line}`} className="small" style={{ margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        </section>
      ) : null}
      {result?.sector ? (
        <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <div className="flex flex-col gap-4"><h3 className="m-0">Sector</h3><p className="small">{sectorName}</p></div>
          <div className="flex flex-col gap-4"><h3 className="m-0">Systems Found</h3><p className="small">{systemsPulled}</p></div>
          <div className="flex flex-col gap-4"><h3 className="m-0">Coordinates Found</h3><p className="small">{coordinatesPulled}</p></div>
          {persist ? <div className="flex flex-col gap-4"><h3 className="m-0">Records Synced</h3><p className="small">{systemsSynced}</p></div> : null}
        </section>
      ) : null}
    </>
  );
};

export default AdminSystemPullsSection;
