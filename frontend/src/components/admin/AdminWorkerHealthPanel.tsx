import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearFailedJobs,
  getAdminWorkerHealth,
  recoverStuckImports,
  reindexSearchTab,
  retryFailedPayments,
  runPaymentsNow,
  type AdminWorkerHealthState,
} from "../../api/admin/adminWorkerHealth";
import { BTN_SM } from "../../utils/ui";

const toneClassForStatus = (status: string): string => {
  switch (status) {
    case "ok":
      return "text-[#7CFFB2]";
    case "warn":
      return "text-[#FFD166]";
    case "error":
      return "text-[#FF8A8A]";
    default:
      return "text-[#D7E0EA]";
  }
};

const formatSeconds = (value: number | null | undefined): string => {
  if (value == null || value < 0) return "Unknown";
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m ${value % 60}s`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

type ActionKey = "recoverImports" | "runPayments" | "retryPayments" | "clearFailed" | "reindexAll" | "reindexUniverse" | `retryImport:${number}`;

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
      <h2 className="h2 m-0">Worker Health</h2>
      <p className="small">
        Sysadmin live view for queue backlogs and failed jobs. Use this first when someone reports an issue.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className={BTN_SM + " all"}
          onClick={() => load(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh Now"}
        </button>
        <button
          type="button"
          className={BTN_SM + " all"}
          onClick={() => runAction("recoverImports", () => recoverStuckImports().then(r => r))}
          disabled={!!acting}
        >
          {acting === "recoverImports" ? "Running…" : "Recover Stuck Imports"}
        </button>
        <button
          type="button"
          className={BTN_SM + " all"}
          onClick={() => runAction("runPayments", () => runPaymentsNow().then(r => r))}
          disabled={!!acting}
        >
          {acting === "runPayments" ? "Running…" : "Run Payments Now"}
        </button>
        <button
          type="button"
          className={BTN_SM + " all"}
          onClick={() => runAction("retryPayments", () => retryFailedPayments().then(r => r))}
          disabled={!!acting}
        >
          {acting === "retryPayments" ? "Running…" : "Retry Failed Payments"}
        </button>
        <button
          type="button"
          className={BTN_SM + " all"}
          onClick={() => runAction("reindexAll", () => reindexSearchTab("all").then(r => ({ ...r, dispatched: r.dispatched?.length })))}
          disabled={!!acting}
        >
          {acting === "reindexAll" ? "Dispatching…" : "Reindex DroidBrain Search"}
        </button>
        <button
          type="button"
          className={BTN_SM + " all"}
          onClick={() => runAction("reindexUniverse", () => reindexSearchTab("universe:all").then(r => ({ ...r, dispatched: r.dispatched?.length })))}
          disabled={!!acting}
        >
          {acting === "reindexUniverse" ? "Dispatching…" : "Reindex Universe Search"}
        </button>
        <button
          type="button"
          className={BTN_SM}
          onClick={() => { if (window.confirm("Clear all failed queue jobs? This cannot be undone.")) runAction("clearFailed", () => clearFailedJobs().then(r => r)); }}
          disabled={!!acting}
        >
          {acting === "clearFailed" ? "Clearing…" : "Clear Failed Jobs"}
        </button>
        {health?.generated_at ? (
          <p className="small m-0">
            Last snapshot: {new Date(health.generated_at).toLocaleString()}
          </p>
        ) : null}
      </div>
      {actionFeedback ? (
        <p className="small mb-3 text-[#7CFFB2]">{actionFeedback}</p>
      ) : null}

      {loading ? <p className="small">Loading worker health…</p> : null}
      {error ? <p className="small text-[#FF8A8A]">{error}</p> : null}

      {!loading && !error && health ? (
        <>
          <div className="mb-4 flex items-stretch gap-3 overflow-x-auto pb-1">
            <section className="panel flex min-w-[300px] flex-[0_0_300px] flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Overall</h3>
                <p className="small">
                  <strong>Status:</strong>{" "}
                  <span className={toneClassForStatus(health.status)}>
                    {health.status.toUpperCase()}
                  </span>
                </p>
                <p className="small"><strong>Queue:</strong> <span className={toneClassForStatus(health.queue.status)}>{health.queue.status.toUpperCase()}</span></p>
                <p className="small"><strong>Failed Jobs:</strong> <span className={toneClassForStatus(health.failed_jobs.status)}>{health.failed_jobs.status.toUpperCase()}</span></p>
                <p className="small"><strong>DB Imports:</strong> <span className={toneClassForStatus(health.droidbrain_upload_queue.status)}>{health.droidbrain_upload_queue.status.toUpperCase()}</span></p>
                <p className="small"><strong>Payments:</strong> <span className={toneClassForStatus(health.droidbrain_payment_queue.status)}>{health.droidbrain_payment_queue.status.toUpperCase()}</span></p>
              </div>
            </section>

            <section className="panel flex min-w-[300px] flex-[0_0_300px] flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Queue Backlog</h3>
                <p className="small"><strong>Connection:</strong> {health.queue.default_connection ?? "Unknown"}</p>
                <p className="small"><strong>Driver:</strong> {health.queue.driver ?? "Unknown"}</p>
                <p className="small"><strong>Pending Total:</strong> {health.queue.pending_total ?? "Unknown"}</p>
                <p className="small"><strong>Reserved Total:</strong> {health.queue.reserved_total ?? "Unknown"}</p>
                <p className="small">
                  <strong>Oldest Pending:</strong> {formatSeconds(health.queue.oldest_pending_seconds)}
                </p>
                {health.queue.error ? (
                  <p className="small text-[#FF8A8A]">{health.queue.error}</p>
                ) : null}
              </div>
            </section>

            <section className="panel flex min-w-[300px] flex-[0_0_300px] flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Failed Queue Jobs</h3>
                <p className="small"><strong>Recent Failed:</strong> {health.failed_jobs.recent ?? "Unknown"}{health.failed_jobs.recent_window_hours ? ` (last ${health.failed_jobs.recent_window_hours}h)` : ""}</p>
                <p className="small"><strong>All-Time Failed:</strong> {health.failed_jobs.total ?? "Unknown"}</p>
                <p className="small">
                  <strong>Last Failure:</strong>{" "}
                  {health.failed_jobs.last_failed_at ? new Date(health.failed_jobs.last_failed_at).toLocaleString() : "None"}
                </p>
                {health.failed_jobs.error ? (
                  <p className="small text-[#FF8A8A]">{health.failed_jobs.error}</p>
                ) : null}
              </div>
            </section>

            <section className="panel flex min-w-[300px] flex-[0_0_300px] flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">DroidBrain Upload Queue</h3>
                {droidbrainCounts.length > 0 ? (
                  droidbrainCounts.map(([s, total]) => (
                    <p key={s} className="small"><strong>{s}:</strong> {total}</p>
                  ))
                ) : (
                  <p className="small">No queue data found.</p>
                )}
                {health.droidbrain_upload_queue.stuck_count > 0 ? (
                  <p className="small text-[#FFD166]">
                    <strong>Stuck (&gt;2h):</strong> {health.droidbrain_upload_queue.stuck_count}
                  </p>
                ) : null}
                {health.droidbrain_upload_queue.error ? (
                  <p className="small text-[#FF8A8A]">{health.droidbrain_upload_queue.error}</p>
                ) : null}
              </div>
            </section>

            <section className="panel flex min-w-[300px] flex-[0_0_300px] flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">DroidBrain Payments</h3>
                {paymentCounts.length > 0 ? (
                  paymentCounts.map(([s, total]) => (
                    <p key={s} className="small"><strong>{s}:</strong> {total}</p>
                  ))
                ) : (
                  <p className="small">No payment data found.</p>
                )}
                {health.droidbrain_payment_queue.stuck_count > 0 ? (
                  <p className="small text-[#FFD166]">
                    <strong>Stuck (&gt;25h):</strong> {health.droidbrain_payment_queue.stuck_count}
                  </p>
                ) : null}
                {health.droidbrain_payment_queue.error ? (
                  <p className="small text-[#FF8A8A]">{health.droidbrain_payment_queue.error}</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="panel mb-4">
            <h3 className="h3 m-0">Workers</h3>
            {health.queue.by_queue.length === 0 ? (
              <p className="small">All queues empty — no active jobs.</p>
            ) : (
              <div className="flex flex-wrap items-stretch gap-3 overflow-x-auto pb-1">
                {health.queue.by_queue.map((entry) => (
                  <section key={entry.queue} className="panel flex min-w-[220px] flex-[0_0_220px] flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <h3 className={`m-0 ${toneClassForStatus(entry.status)}`}>
                        {entry.queue}
                      </h3>
                      <p className="small"><strong>Status:</strong> <span className={toneClassForStatus(entry.status)}>{entry.status.toUpperCase()}</span></p>
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

          <section className="panel mb-4">
            <h3 className="h3 m-0">Latest Failed Queue Jobs</h3>
            {health.failed_jobs.latest.length === 0 ? (
              <p className="small">No failed jobs recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="text-right">ID</th>
                      <th className="text-left">Queue</th>
                      <th className="text-left">Job</th>
                      <th className="text-left">Failed At</th>
                      <th className="text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.failed_jobs.latest.map((job) => (
                      <tr key={job.id}>
                        <td className="text-right">{job.id}</td>
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

          <section className="panel mb-4">
            <h3 className="h3 m-0">Recent Failed DroidBrain Imports</h3>
            {health.droidbrain_upload_queue.recent_failed.length === 0 ? (
              <p className="small">No failed DroidBrain queue items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="text-right">ID</th>
                      <th className="text-left">File Name</th>
                      <th className="text-left">Processed At</th>
                      <th className="text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.droidbrain_upload_queue.recent_failed.map((item) => (
                      <tr key={item.id}>
                        <td className="text-right">{item.id}</td>
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
            <h3 className="h3 m-0">Recent Failed DroidBrain Payments</h3>
            {health.droidbrain_payment_queue.recent_failed.length === 0 ? (
              <p className="small">No failed payments.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="text-right">File ID</th>
                      <th className="text-left">File Name</th>
                      <th className="text-left">Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.droidbrain_payment_queue.recent_failed.map((item) => (
                      <tr key={item.id}>
                        <td className="text-right">{item.id}</td>
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
