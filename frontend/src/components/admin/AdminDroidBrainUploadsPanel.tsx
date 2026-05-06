import React, { useEffect, useMemo, useState } from "react";
import {
  listAdminDroidBrainUploads,
  type AdminDroidBrainUploadItem,
} from "../../api/adminDroidBrainUploads";
import Pagination from "../common/Pagination";

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatUploader(row: AdminDroidBrainUploadItem): string {
  const candidates = [
    row.uploader_handle,
    row.uploader_record_handle,
    row.uploader_user_swc_handle,
    row.uploader_user_discord_global_name,
    row.uploader_user_discord_username,
    row.uploader_swc_uid,
    row.uploader_record_swc_uid,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value !== "") {
      return value;
    }
  }

  return "Unknown";
}

const AdminDroidBrainUploadsPanel: React.FC = () => {
  const [rows, setRows] = useState<AdminDroidBrainUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);

  const [userFilter, setUserFilter] = useState("");
  const [queryFilter, setQueryFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [uploaderOptions, setUploaderOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await listAdminDroidBrainUploads({
          page,
          per_page: pageSize,
          user: userFilter,
          q: queryFilter,
          date_from: dateFromFilter,
          date_to: dateToFilter,
        });

        if (cancelled) {
          return;
        }

        setRows(response.data.uploads);
        setTotalItems(response.data.pagination.total);
        setUploaderOptions(response.data.uploader_options ?? []);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setTotalItems(0);
          setError(e?.message ?? "Failed to load DroidBrain uploads.");
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
  }, [page, pageSize, userFilter, queryFilter, dateFromFilter, dateToFilter]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, userFilter, queryFilter, dateFromFilter, dateToFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalItems / pageSize)), [pageSize, totalItems]);
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  function clearFilters() {
    setUserFilter("");
    setQueryFilter("");
    setDateFromFilter("");
    setDateToFilter("");
  }

  function toggleExpanded(id: number) {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <h2>DroidBrain Upload Audit</h2>
        <p className="small">
          Sysadmin-only upload history for DroidBrain files with summary import results.
        </p>
      </header>

      <div className="admin-panel__body">
        <div className="admin-users-toolbar admin-action-log__toolbar">
          <div className="admin-action-log__filters">
            <div className="admin-action-log__filter">
              <label className="small" htmlFor="droidbrain-audit-user-filter">
                User
              </label>
              <input
                id="droidbrain-audit-user-filter"
                className="input"
                list="droidbrain-audit-user-options"
                placeholder="Handle / SWC / Discord"
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
              />
              <datalist id="droidbrain-audit-user-options">
                {uploaderOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="admin-action-log__filter">
              <label className="small" htmlFor="droidbrain-audit-query-filter">
                Search
              </label>
              <input
                id="droidbrain-audit-query-filter"
                className="input"
                placeholder="Filename / payload / status"
                value={queryFilter}
                onChange={(event) => setQueryFilter(event.target.value)}
              />
            </div>

            <div className="admin-action-log__filter">
              <label className="small" htmlFor="droidbrain-audit-date-from">
                Date From
              </label>
              <input
                id="droidbrain-audit-date-from"
                type="date"
                className="input"
                value={dateFromFilter}
                onChange={(event) => setDateFromFilter(event.target.value)}
              />
            </div>

            <div className="admin-action-log__filter">
              <label className="small" htmlFor="droidbrain-audit-date-to">
                Date To
              </label>
              <input
                id="droidbrain-audit-date-to"
                type="date"
                className="input"
                value={dateToFilter}
                onChange={(event) => setDateToFilter(event.target.value)}
              />
            </div>
          </div>

          <div className="admin-action-log__meta">
            <p className="small">Showing {totalItems} matching uploads</p>
            <button
              type="button"
              className="ui-btn ui-btn--soft ui-btn--small"
              onClick={clearFilters}
              disabled={!userFilter && !queryFilter && !dateFromFilter && !dateToFilter}
            >
              Clear filters
            </button>
          </div>
        </div>

        {loading ? (
          <p className="small">Loading DroidBrain upload audit...</p>
        ) : error ? (
          <p className="small" style={{ color: "salmon" }}>
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="small">No uploads found for those filters.</p>
        ) : (
          <div className="admin-action-log-table">
            <div className="admin-action-log-table__head admin-droidbrain-audit-table__head">
              <div>Uploaded</div>
              <div>User</div>
              <div>Payload</div>
              <div>Status</div>
              <div>Summary</div>
              <div>Queue</div>
              <div>Actions</div>
            </div>

            <div className="admin-action-log-table__body admin-droidbrain-audit-table__body">
              {rows.map((row) => {
                const expanded = expandedIds.includes(row.id);

                return (
                  <div key={row.id} className="admin-action-log-table__group">
                    <div className="admin-action-log-table__row admin-droidbrain-audit-table__row">
                      <div className="admin-action-log-table__cell admin-action-log-table__when">
                        {formatDateTime(row.created_at)}
                      </div>
                      <div className="admin-action-log-table__cell">
                        <strong>{formatUploader(row)}</strong>
                      </div>
                      <div className="admin-action-log-table__cell">
                        {row.payload_type ?? "unknown"}
                      </div>
                      <div className="admin-action-log-table__cell">
                        <strong>{row.change_status}</strong>
                      </div>
                      <div className="admin-action-log-table__cell admin-action-log-table__summary">
                        New {row.new_entities_count} · Updated {row.modified_entities_count} · Unchanged {row.unchanged_entities_count} · Total {row.total_entities_count}
                      </div>
                      <div className="admin-action-log-table__cell">
                        {row.queue_status ?? "n/a"}
                      </div>
                      <div className="admin-action-log-table__cell admin-action-log-table__actions">
                        <button
                          type="button"
                          className="ui-btn ui-btn--soft ui-btn--small"
                          onClick={() => toggleExpanded(row.id)}
                        >
                          {expanded ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="admin-action-log-table__details">
                        <p className="small">
                          <strong>File:</strong> #{row.id} · {row.file_name}
                        </p>
                        <p className="small">
                          <strong>Queue:</strong> {row.queue_item_id ? `#${row.queue_item_id}` : "None"} · {row.queue_status ?? "n/a"}
                          {row.queue_processed_at ? ` · Processed ${formatDateTime(row.queue_processed_at)}` : ""}
                        </p>
                        {row.queue_error_message ? (
                          <p className="small" style={{ color: "salmon" }}>
                            <strong>Queue error:</strong> {row.queue_error_message}
                          </p>
                        ) : null}
                        <p className="small">
                          <strong>Snapshot:</strong> {row.snapshot_unix ?? "n/a"}
                        </p>
                        <p className="small">
                          <strong>User detail:</strong> User ID {row.uploader_user_id ?? "n/a"} · SWC UID {row.uploader_swc_uid ?? row.uploader_record_swc_uid ?? "n/a"}
                        </p>
                        <p className="small">
                          <strong>Updated:</strong> {formatDateTime(row.updated_at)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error ? (
          <Pagination
            page={safePage}
            pageSize={pageSize}
            totalItems={totalItems}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>
    </section>
  );
};

export default AdminDroidBrainUploadsPanel;

