import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminWorkerHealth, type AdminWorkerHealthState } from "../../api/adminWorkerHealth";

const toneForStatus = (status: string): string => {
  switch (status) {
    case "ok":
      return "#7CFFB2";
    case "warn":
      return "#FFD166";
    case "error":
      return "#FF8A8A";
    default:
      return "#D7E0EA";
  }
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  overflowX: "auto",
  alignItems: "stretch",
  paddingBottom: 4,
};

const cardStyle: React.CSSProperties = {
  minWidth: 300,
  flex: "0 0 300px",
};

const formatSeconds = (value: number | null | undefined): string => {
  if (value == null || value < 0) return "Unknown";
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m ${value % 60}s`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const AdminWorkerHealthPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<AdminWorkerHealthState | null>(null);

  const load = useCallback(async (withRefreshIndicator = false) => {
    try {
      if (withRefreshIndicator) {
        setRefreshing(true);
      }

      const response = await getAdminWorkerHealth();
      setHealth(response.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load worker health.");
    } finally {
      if (withRefreshIndicator) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await getAdminWorkerHealth();
        if (cancelled) return;
        setHealth(response.data);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load worker health.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    const intervalId = window.setInterval(() => {
      if (!cancelled) {
        load();
      }
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [load]);

  const droidbrainCounts = useMemo(() => {
    if (!health) {
      return [];
    }

    return Object.entries(health.droidbrain_upload_queue.counts).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [health]);

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Worker Health</h2>
      <p className="small">
        Sysadmin live view for queue backlogs and failed jobs. Use this first when someone reports an issue.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: "0.75rem" }}>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => load(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh Now"}
        </button>
        {health?.generated_at ? (
          <p className="small" style={{ margin: 0 }}>
            Last snapshot: {new Date(health.generated_at).toLocaleString()}
          </p>
        ) : null}
      </div>

      {loading ? <p className="small">Loading worker health…</p> : null}
      {error ? <p className="small" style={{ color: "salmon" }}>{error}</p> : null}

      {!loading && !error && health ? (
        <>
          <div style={{ ...rowStyle, marginBottom: "1rem" }}>
            <section className="panel admin-card" style={cardStyle}>
              <div className="admin-card__header">
                <h3 className="admin-card__title">Overall</h3>
                <p className="small">
                  <strong>Status:</strong>{" "}
                  <span style={{ color: toneForStatus(health.status) }}>
                    {health.status.toUpperCase()}
                  </span>
                </p>
                <p className="small"><strong>Queue Status:</strong> {health.queue.status.toUpperCase()}</p>
                <p className="small"><strong>Failed Jobs Status:</strong> {health.failed_jobs.status.toUpperCase()}</p>
                <p className="small"><strong>DroidBrain Queue Status:</strong> {health.droidbrain_upload_queue.status.toUpperCase()}</p>
              </div>
            </section>

            <section className="panel admin-card" style={cardStyle}>
              <div className="admin-card__header">
                <h3 className="admin-card__title">Queue Backlog</h3>
                <p className="small"><strong>Connection:</strong> {health.queue.default_connection ?? "Unknown"}</p>
                <p className="small"><strong>Driver:</strong> {health.queue.driver ?? "Unknown"}</p>
                <p className="small"><strong>Pending Total:</strong> {health.queue.pending_total ?? "Unknown"}</p>
                <p className="small"><strong>Reserved Total:</strong> {health.queue.reserved_total ?? "Unknown"}</p>
                <p className="small">
                  <strong>Oldest Pending:</strong> {formatSeconds(health.queue.oldest_pending_seconds)}
                </p>
                {health.queue.error ? (
                  <p className="small" style={{ color: "salmon" }}>{health.queue.error}</p>
                ) : null}
              </div>
            </section>

            <section className="panel admin-card" style={cardStyle}>
              <div className="admin-card__header">
                <h3 className="admin-card__title">Failed Queue Jobs</h3>
                <p className="small"><strong>Recent Failed:</strong> {health.failed_jobs.recent ?? "Unknown"}{health.failed_jobs.recent_window_hours ? ` (last ${health.failed_jobs.recent_window_hours}h)` : ""}</p>
                <p className="small"><strong>All-Time Failed:</strong> {health.failed_jobs.total ?? "Unknown"}</p>
                <p className="small">
                  <strong>Last Failure:</strong>{" "}
                  {health.failed_jobs.last_failed_at ? new Date(health.failed_jobs.last_failed_at).toLocaleString() : "None"}
                </p>
                {health.failed_jobs.error ? (
                  <p className="small" style={{ color: "salmon" }}>{health.failed_jobs.error}</p>
                ) : null}
              </div>
            </section>

            <section className="panel admin-card" style={cardStyle}>
              <div className="admin-card__header">
                <h3 className="admin-card__title">DroidBrain Upload Queue</h3>
                {droidbrainCounts.length > 0 ? (
                  droidbrainCounts.map(([status, total]) => (
                    <p key={status} className="small">
                      <strong>{status}:</strong> {total}
                    </p>
                  ))
                ) : (
                  <p className="small">No queue data found.</p>
                )}
                {health.droidbrain_upload_queue.error ? (
                  <p className="small" style={{ color: "salmon" }}>{health.droidbrain_upload_queue.error}</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="panel" style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Queue Backlog by Queue Name</h3>
            {health.queue.by_queue.length === 0 ? (
              <p className="small">No pending jobs detected.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Queue</th>
                      <th style={{ textAlign: "right" }}>Pending</th>
                      <th style={{ textAlign: "right" }}>Reserved</th>
                      <th style={{ textAlign: "right" }}>Oldest Waiting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.queue.by_queue.map((entry) => (
                      <tr key={entry.queue}>
                        <td>{entry.queue}</td>
                        <td style={{ textAlign: "right" }}>{entry.pending}</td>
                        <td style={{ textAlign: "right" }}>{entry.reserved}</td>
                        <td style={{ textAlign: "right" }}>{formatSeconds(entry.oldest_waiting_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel" style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Latest Failed Queue Jobs</h3>
            {health.failed_jobs.latest.length === 0 ? (
              <p className="small">No failed jobs recorded.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "right" }}>ID</th>
                      <th style={{ textAlign: "left" }}>Queue</th>
                      <th style={{ textAlign: "left" }}>Job</th>
                      <th style={{ textAlign: "left" }}>Failed At</th>
                      <th style={{ textAlign: "left" }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.failed_jobs.latest.map((job) => (
                      <tr key={job.id}>
                        <td style={{ textAlign: "right" }}>{job.id}</td>
                        <td>{job.queue}</td>
                        <td>{job.job_name}</td>
                        <td>{job.failed_at ? new Date(job.failed_at).toLocaleString() : "Unknown"}</td>
                        <td>{job.error_summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <h3 style={{ marginTop: 0 }}>Recent Failed DroidBrain Imports</h3>
            {health.droidbrain_upload_queue.recent_failed.length === 0 ? (
              <p className="small">No failed DroidBrain queue items.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "right" }}>ID</th>
                      <th style={{ textAlign: "left" }}>File Name</th>
                      <th style={{ textAlign: "left" }}>Processed At</th>
                      <th style={{ textAlign: "left" }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.droidbrain_upload_queue.recent_failed.map((item) => (
                      <tr key={item.id}>
                        <td style={{ textAlign: "right" }}>{item.id}</td>
                        <td>{item.file_name}</td>
                        <td>{item.processed_at ? new Date(item.processed_at).toLocaleString() : "Unknown"}</td>
                        <td>{item.error_message ?? "Unknown error"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default AdminWorkerHealthPanel;
