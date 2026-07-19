import React, { useEffect, useMemo, useState } from "react";
import {
  listAdminActionLogs,
  type AdminActionLogItem,
} from "../../api/admin/adminActionLogs";
import Pagination from "../common/Pagination";
import { INPUT } from '../../utils/ui';

const AREA_LABELS: Record<string, string> = {
  droidbrain: "DroidBrain",
  site_lock: "Site Lock",
  universe_entity_stats: "Entity Stats Admin",
  website_health: "Website Health",
  discord_bot: "Discord Bot",
};

const uiButtonSmallBaseClass =
  "inline-flex min-h-[34px] items-center justify-center rounded-[10px] border px-[0.8rem] py-2 text-[0.88rem] font-bold leading-none no-underline transition-[border-color,background,transform,box-shadow] duration-150 ease-out hover:enabled:-translate-y-px hover:enabled:border-[#f5d546]/[0.28] hover:enabled:bg-[#f5d546]/[0.07] disabled:cursor-not-allowed disabled:opacity-[0.55] font-tektur";
const uiButtonSoftClass = "border-white/10 bg-white/[0.025] text-white/90";
const uiButtonPrimaryClass =
  "border-[#f5d546]/35 bg-[#f5d546]/10 text-[#f2c46f] shadow-[inset_0_0_0_1px_rgba(245,213,70,0.08)] hover:enabled:border-[#f5d546]/45 hover:enabled:bg-[#f5d546]/15";

function formatLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "Unknown";
  }

  if (AREA_LABELS[raw]) {
    return AREA_LABELS[raw];
  }

  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const FETCH_LIMIT_OPTIONS = [100, 250, 500];

const AdminActionLogPanel: React.FC = () => {
  const [logs, setLogs] = useState<AdminActionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fetchLimit, setFetchLimit] = useState(100);

  const [actorHandleFilter, setActorHandleFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await listAdminActionLogs({ limit: fetchLimit });

        if (cancelled) return;

        setLogs(response.logs);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setLogs([]);
          setError(e?.message ?? "Failed to load action logs");
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
  }, [refreshKey, fetchLimit]);

  function toggleExpanded(id: number) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  const actorOptions = useMemo(() => {
    return Array.from(
      new Set(
        logs
          .map((log) => log.actor_handle)
          .filter((value): value is string => Boolean(value && value.trim()))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const areaOptions = useMemo(() => {
    return Array.from(
      new Set(
        logs
          .map((log) => log.area)
          .filter((value): value is string => Boolean(value && value.trim()))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const actionOptions = useMemo(() => {
    return Array.from(
      new Set(
        logs
          .map((log) => log.action)
          .filter((value): value is string => Boolean(value && value.trim()))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const targetTypeOptions = useMemo(() => {
    return Array.from(
      new Set(
        logs
          .map((log) => log.target_type)
          .filter((value): value is string => Boolean(value && value.trim()))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actorHandleFilter && (log.actor_handle ?? "") !== actorHandleFilter) {
        return false;
      }

      if (areaFilter && log.area !== areaFilter) {
        return false;
      }

      if (actionFilter && log.action !== actionFilter) {
        return false;
      }

      if (targetTypeFilter && (log.target_type ?? "") !== targetTypeFilter) {
        return false;
      }

      return true;
    });
  }, [logs, actorHandleFilter, areaFilter, actionFilter, targetTypeFilter]);

  useEffect(() => {
    setPage(1);
  }, [actorHandleFilter, areaFilter, actionFilter, targetTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, safePage, pageSize]);

  function clearFilters() {
    setActorHandleFilter("");
    setAreaFilter("");
    setActionFilter("");
    setTargetTypeFilter("");
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <h2 className="h2">Action Log</h2>
        <p className="small">Audit trail of admin changes across the website.</p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 flex flex-col items-stretch gap-2.5">
          <div className="grid w-full gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="action-log-actor">
                Actor
              </label>
              <select
                id="action-log-actor"
                className={INPUT}
                value={actorHandleFilter}
                onChange={(e) => setActorHandleFilter(e.target.value)}
              >
                <option value="">All actors</option>
                {actorOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="action-log-area">
                Area
              </label>
              <select
                id="action-log-area"
                className={INPUT}
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
              >
                <option value="">All areas</option>
                {areaOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="action-log-action">
                Action
              </label>
              <select
                id="action-log-action"
                className={INPUT}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="">All actions</option>
                {actionOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="action-log-target-type">
                Target type
              </label>
              <select
                id="action-log-target-type"
                className={INPUT}
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value)}
              >
                <option value="">All target types</option>
                {targetTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="small">
              Showing {filteredLogs.length} of {logs.length} loaded entries
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="small shrink-0" htmlFor="action-log-fetch-limit">Load</label>
                <select
                  id="action-log-fetch-limit"
                  className={INPUT}
                  value={fetchLimit}
                  onChange={(e) => { setFetchLimit(Number(e.target.value)); setPage(1); }}
                >
                  {FETCH_LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={`${uiButtonSmallBaseClass} ${uiButtonSoftClass}`}
                onClick={clearFilters}
                disabled={
                  !actorHandleFilter &&
                  !areaFilter &&
                  !actionFilter &&
                  !targetTypeFilter
                }
              >
                Clear filters
              </button>
              <button
                type="button"
                className={`${uiButtonSmallBaseClass} ${uiButtonPrimaryClass}`}
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="small">Loading action log…</p>
        ) : error ? (
          <p className="small" style={{ color: "salmon" }}>
            {error}
          </p>
        ) : filteredLogs.length === 0 ? (
          <p className="small">No action log entries found.</p>
        ) : (
          <>
            <div className="flex flex-col overflow-x-auto rounded-[14px] border border-white/10 bg-white/[0.02]">
              <div className="grid min-w-[980px] border-b border-white/10 bg-white/[0.04] [grid-template-columns:170px_130px_110px_130px_minmax(320px,1fr)_150px_96px]">
                <div>When</div>
                <div>Actor</div>
                <div>Area</div>
                <div>Action</div>
                <div>Summary</div>
                <div>Target</div>
                <div></div>
              </div>

              <div className="flex min-w-[980px] flex-col">
                {paginatedLogs.map((log) => {
                  const expanded = expandedIds.includes(log.id);

                  return (
                    <div key={log.id} className="flex flex-col border-t border-white/5 first:border-t-0">
                      <div className="grid min-h-14 items-start [grid-template-columns:170px_130px_110px_130px_minmax(320px,1fr)_150px_96px] hover:bg-white/[0.025]">
                        <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.82rem] leading-[1.3] text-white/70">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString()
                            : "Unknown time"}
                        </div>

                        <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                          {log.actor_handle ??
                            (log.actor_user_id
                              ? `User #${log.actor_user_id}`
                              : "System")}
                        </div>

                        <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                          {formatLabel(log.area)}
                        </div>

                        <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                          {formatLabel(log.action)}
                        </div>

                        <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3] whitespace-normal break-words font-semibold">
                          {log.summary}
                        </div>

                        <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                          {log.target_type
                            ? `${formatLabel(log.target_type)}${
                                log.target_id !== null ? ` #${log.target_id}` : ""
                              }`
                            : "—"}
                        </div>

                        <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3] flex items-start justify-end">
                          <button
                            type="button"
                            className={`${uiButtonSmallBaseClass} ${uiButtonPrimaryClass}`}
                            onClick={() => toggleExpanded(log.id)}
                          >
                            {expanded ? "Hide" : "View"}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="flex flex-col gap-2.5 border-t border-white/5 bg-black/15 px-4 pb-4 pt-3">
                          {log.ip_address && (
                            <p className="small">
                              <strong>IP:</strong> {log.ip_address}
                            </p>
                          )}

                          {log.user_agent && (
                            <p className="small">
                              <strong>User Agent:</strong> {log.user_agent}
                            </p>
                          )}

                          {log.before && (
                            <div className="flex flex-col gap-1">
                              <p className="small">
                                <strong>Before</strong>
                              </p>
                              <pre>{JSON.stringify(log.before, null, 2)}</pre>
                            </div>
                          )}

                          {log.after && (
                            <div className="flex flex-col gap-1">
                              <p className="small">
                                <strong>After</strong>
                              </p>
                              <pre>{JSON.stringify(log.after, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={filteredLogs.length}
              pageSizeOptions={[5, 10, 25, 50, 100]}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
    </section>
  );
};

export default AdminActionLogPanel;
