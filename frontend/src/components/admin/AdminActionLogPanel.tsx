import React, { useEffect, useMemo, useState } from "react";
import {
  listAdminActionLogs,
  type AdminActionLogItem,
} from "../../api/adminActionLogs";
import Pagination from "../common/Pagination";

const AdminActionLogPanel: React.FC = () => {
  const [logs, setLogs] = useState<AdminActionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

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
        const response = await listAdminActionLogs();

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
  }, []);

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
    <section className="admin-panel">
      <header className="admin-panel__header">
        <h2>Action Log</h2>
        <p className="small">Audit trail of admin changes across the website.</p>
      </header>

      <div className="admin-panel__body">
        <div className="admin-users-toolbar admin-action-log__toolbar">
          <div className="admin-action-log__filters">
            <div className="admin-action-log__filter">
              <label className="small" htmlFor="action-log-actor">
                Actor
              </label>
              <select
                id="action-log-actor"
                className="input"
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

            <div className="admin-action-log__filter">
              <label className="small" htmlFor="action-log-area">
                Area
              </label>
              <select
                id="action-log-area"
                className="input"
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
              >
                <option value="">All areas</option>
                {areaOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-action-log__filter">
              <label className="small" htmlFor="action-log-action">
                Action
              </label>
              <select
                id="action-log-action"
                className="input"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="">All actions</option>
                {actionOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-action-log__filter">
              <label className="small" htmlFor="action-log-target-type">
                Target type
              </label>
              <select
                id="action-log-target-type"
                className="input"
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value)}
              >
                <option value="">All target types</option>
                {targetTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-action-log__meta">
            <p className="small">
              Showing {filteredLogs.length} filtered entries
            </p>

            <button
              type="button"
              className="ui-btn ui-btn--soft ui-btn--small"
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
            <div className="admin-action-log-table">
              <div className="admin-action-log-table__head">
                <div>When</div>
                <div>Actor</div>
                <div>Area</div>
                <div>Action</div>
                <div>Summary</div>
                <div>Target</div>
                <div></div>
              </div>

              <div className="admin-action-log-table__body">
                {paginatedLogs.map((log) => {
                  const expanded = expandedIds.includes(log.id);

                  return (
                    <div
                      key={log.id}
                      className={`admin-action-log-table__group${
                        expanded ? " is-expanded" : ""
                      }`}
                    >
                      <div className="admin-action-log-table__row">
                        <div className="admin-action-log-table__cell admin-action-log-table__when">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString()
                            : "Unknown time"}
                        </div>

                        <div className="admin-action-log-table__cell">
                          {log.actor_handle ??
                            (log.actor_user_id
                              ? `User #${log.actor_user_id}`
                              : "System")}
                        </div>

                        <div className="admin-action-log-table__cell">
                          {log.area}
                        </div>

                        <div className="admin-action-log-table__cell">
                          {log.action}
                        </div>

                        <div className="admin-action-log-table__cell admin-action-log-table__summary">
                          {log.summary}
                        </div>

                        <div className="admin-action-log-table__cell">
                          {log.target_type
                            ? `${log.target_type}${
                                log.target_id !== null ? ` #${log.target_id}` : ""
                              }`
                            : "—"}
                        </div>

                        <div className="admin-action-log-table__cell admin-action-log-table__actions">
                          <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--small"
                            onClick={() => toggleExpanded(log.id)}
                          >
                            {expanded ? "Hide" : "View"}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="admin-action-log-table__details">
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
                            <div className="admin-action-log__json-block">
                              <p className="small">
                                <strong>Before</strong>
                              </p>
                              <pre>{JSON.stringify(log.before, null, 2)}</pre>
                            </div>
                          )}

                          {log.after && (
                            <div className="admin-action-log__json-block">
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