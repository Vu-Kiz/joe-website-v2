import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearFailedJobs,
  getAdminWorkerHealth,
  recoverStuckImports,
  retryFailedPayments,
  runPaymentsNow,
  type AdminWorkerHealthState,
} from "../../api/adminWorkerHealth";

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

type ActionKey = "recoverImports" | "runPayments" | "retryPayments" | "clearFailed" | `retryImport:${number}`;

const AdminWorkerHealthPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<AdminWorkerHealthState | null>(null);
  const [acting, setActing] = useState<ActionKey | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

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
    if (!health) return [];
    return Object.entries(health.droidbrain_upload_queue.counts).sort(([a], [b]) => a.localeCompare(b));
  }, [health]);

  const paymentCounts = useMemo(() => {
    if (!health) return [];
    return Object.entries(health.droidbrain_payment_queue.counts).sort(([a], [b]) => a.localeCompare(b));
  }, [health]);

  const runAction = useCallback(async (key: ActionKey, fn: () => Promise<{ ok: boolean; message?: string; dispatched?: number; reset?: number; cleared?: number }>) => {
    setActing(key);
    setActionFeedback(null);
    try {
      const result = await fn();
      const detail = result.dispatched != null ? ` (${result.dispatched} dispatched)`
        : result.reset != null ? ` (${result.reset} reset)`
        : result.cleared != null ? ` (${result.cleared} cleared)`
        : "";
      setActionFeedback(`Done${detail}.`);
      load();
    } catch (e: any) {
      setActionFeedback(`Error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setActing(null);
    }
  }, [load]);

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Worker Health</h2>
      <p className="small">
        Sysadmin live view for queue backlogs and failed jobs. Use this first when someone reports an issue.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => load(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh Now"}
        </button>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => runAction("recoverImports", () => recoverStuckImports().then(r => r))}
          disabled={!!acting}
        >
          {acting === "recoverImports" ? "Running…" : "Recover Stuck Imports"}
        </button>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => runAction("runPayments", () => runPaymentsNow().then(r => r))}
          disabled={!!acting}
        >
          {acting === "runPayments" ? "Running…" : "Run Payments Now"}
        </button>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => runAction("retryPayments", () => retryFailedPayments().then(r => r))}
          disabled={!!acting}
        >
          {acting === "retryPayments" ? "Running…" : "Retry Failed Payments"}
        </button>
        <button
          type="button"
          className="btn btn--small btn--danger"
          onClick={() => { if (window.confirm("Clear all failed queue jobs? This cannot be undone.")) runAction("clearFailed", () => clearFailedJobs().then(r => r)); }}
          disabled={!!acting}
        >
          {acting === "clearFailed" ? "Clearing…" : "Clear Failed Jobs"}
        </button>
        {health?.generated_at ? (
          <p className="small" style={{ margin: 0 }}>
            Last snapshot: {new Date(health.generated_at).toLocaleString()}
          </p>
        ) : null}
      </div>
      {actionFeedback ? (
        <p className="small" style={{ marginBottom: "0.75rem", color: toneForStatus("ok") }}>{actionFeedback}</p>
      ) : null}

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
                <p className="small"><strong>Queue:</strong> <span style={{ color: toneForStatus(health.queue.status) }}>{health.queue.status.toUpperCase()}</span></p>
                <p className="small"><strong>Failed Jobs:</strong> <span style={{ color: toneForStatus(health.failed_jobs.status) }}>{health.failed_jobs.status.toUpperCase()}</span></p>
                <p className="small"><strong>DB Imports:</strong> <span style={{ color: toneForStatus(health.droidbrain_upload_queue.status) }}>{health.droidbrain_upload_queue.status.toUpperCase()}</span></p>
                <p className="small"><strong>Payments:</strong> <span style={{ color: toneForStatus(health.droidbrain_payment_queue.status) }}>{health.droidbrain_payment_queue.status.toUpperCase()}</span></p>
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
                  droidbrainCounts.map(([s, total]) => (
                    <p key={s} className="small"><strong>{s}:</strong> {total}</p>
                  ))
                ) : (
                  <p className="small">No queue data found.</p>
                )}
                {health.droidbrain_upload_queue.stuck_count > 0 ? (
                  <p className="small" style={{ color: toneForStatus("warn") }}>
                    <strong>Stuck (&gt;2h):</strong> {health.droidbrain_upload_queue.stuck_count}
                  </p>
                ) : null}
                {health.droidbrain_upload_queue.error ? (
                  <p className="small" style={{ color: "salmon" }}>{health.droidbrain_upload_queue.error}</p>
                ) : null}
              </div>
            </section>

            <section className="panel admin-card" style={cardStyle}>
              <div className="admin-card__header">
                <h3 className="admin-card__title">DroidBrain Payments</h3>
                {paymentCounts.length > 0 ? (
                  paymentCounts.map(([s, total]) => (
                    <p key={s} className="small"><strong>{s}:</strong> {total}</p>
                  ))
                ) : (
                  <p className="small">No payment data found.</p>
                )}
                {health.droidbrain_payment_queue.stuck_count > 0 ? (
                  <p className="small" style={{ color: toneForStatus("warn") }}>
                    <strong>Stuck (&gt;25h):</strong> {health.droidbrain_payment_queue.stuck_count}
                  </p>
                ) : null}
                {health.droidbrain_payment_queue.error ? (
                  <p className="small" style={{ color: "salmon" }}>{health.droidbrain_payment_queue.error}</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="panel" style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Workers</h3>
            {health.queue.by_queue.length === 0 ? (
              <p className="small">All queues empty — no active jobs.</p>
            ) : (
              <div style={{ ...rowStyle, flexWrap: "wrap" }}>
                {health.queue.by_queue.map((entry) => (
                  <section key={entry.queue} className="panel admin-card" style={{ ...cardStyle, minWidth: 220, flex: "0 0 220px" }}>
                    <div className="admin-card__header">
                      <h3 className="admin-card__title" style={{ color: toneForStatus(entry.status) }}>
                        {entry.queue}
                      </h3>
                      <p className="small"><strong>Status:</strong> <span style={{ color: toneForStatus(entry.status) }}>{entry.status.toUpperCase()}</span></p>
                      <p className="small"><strong>Pending:</strong> {entry.pending}</p>
                      <p className="small"><strong>Reserved:</strong> {entry.reserved}</p>
                      <p className="small"><strong>Oldest Waiting:</strong> {formatSeconds(entry.oldest_waiting_seconds)}</p>
                      <p className="small"><strong>Warn After:</strong> {formatSeconds(entry.warn_threshold_seconds)}</p>
                    </div>
                  </section>
                ))}
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

          <section className="panel" style={{ marginBottom: "1rem" }}>
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
          <section className="panel">
            <h3 style={{ marginTop: 0 }}>Recent Failed DroidBrain Payments</h3>
            {health.droidbrain_payment_queue.recent_failed.length === 0 ? (
              <p className="small">No failed payments.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "right" }}>File ID</th>
                      <th style={{ textAlign: "left" }}>File Name</th>
                      <th style={{ textAlign: "left" }}>Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.droidbrain_payment_queue.recent_failed.map((item) => (
                      <tr key={item.id}>
                        <td style={{ textAlign: "right" }}>{item.id}</td>
                        <td>{item.file_name}</td>
                        <td>{item.updated_at ? new Date(item.updated_at).toLocaleString() : "Unknown"}</td>
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
