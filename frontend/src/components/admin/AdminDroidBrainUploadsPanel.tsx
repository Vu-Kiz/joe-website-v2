import React, { useEffect, useMemo, useState } from "react";
import {
  listAdminDroidBrainUploads,
  type AdminDroidBrainUploadItem,
} from "../../api/admin/adminDroidBrainUploads";
import Pagination from "../common/Pagination";
import { INPUT } from '../../utils/ui';

const uiButtonSmallBaseClass =
  "inline-flex min-h-[34px] items-center justify-center rounded-[10px] border px-[0.8rem] py-2 text-[0.88rem] font-bold leading-none no-underline transition-[border-color,background,transform,box-shadow] duration-150 ease-out hover:enabled:-translate-y-px hover:enabled:border-[#f5d546]/[0.28] hover:enabled:bg-[#f5d546]/[0.07] disabled:cursor-not-allowed disabled:opacity-[0.55]";
const uiButtonSoftClass = "border-white/10 bg-white/[0.025] text-white/90";

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
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <h2 className="h2">DroidBrain Upload Audit</h2>
        <p className="small">
          Sysadmin-only upload history for DroidBrain files with summary import results.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 flex flex-col items-stretch gap-2.5">
          <div className="grid w-full gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="droidbrain-audit-user-filter">
                User
              </label>
              <input
                id="droidbrain-audit-user-filter"
                className={INPUT}
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

            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="droidbrain-audit-query-filter">
                Search
              </label>
              <input
                id="droidbrain-audit-query-filter"
                className={INPUT}
                placeholder="Filename / payload / status"
                value={queryFilter}
                onChange={(event) => setQueryFilter(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="droidbrain-audit-date-from">
                Date From
              </label>
              <input
                id="droidbrain-audit-date-from"
                type="date"
                className={INPUT}
                value={dateFromFilter}
                onChange={(event) => setDateFromFilter(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="small" htmlFor="droidbrain-audit-date-to">
                Date To
              </label>
              <input
                id="droidbrain-audit-date-to"
                type="date"
                className={INPUT}
                value={dateToFilter}
                onChange={(event) => setDateToFilter(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="small">Showing {totalItems} matching uploads</p>
            <button
              type="button"
              className={`${uiButtonSmallBaseClass} ${uiButtonSoftClass}`}
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
          <div className="flex flex-col overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.02] max-[1180px]:overflow-x-auto">
            <div className="grid border-b border-white/10 bg-white/[0.04] [grid-template-columns:190px_170px_120px_110px_minmax(320px,1fr)_130px_96px]">
              <div>Uploaded</div>
              <div>User</div>
              <div>Payload</div>
              <div>Status</div>
              <div>Summary</div>
              <div>Queue</div>
              <div>Actions</div>
            </div>

            <div className="flex min-w-[980px] flex-col">
              {rows.map((row) => {
                const expanded = expandedIds.includes(row.id);

                return (
                  <div key={row.id} className="flex flex-col border-t border-white/5 first:border-t-0">
                    <div className="grid min-h-14 items-start [grid-template-columns:190px_170px_120px_110px_minmax(320px,1fr)_130px_96px] hover:bg-white/[0.025]">
                      <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.82rem] leading-[1.3] text-white/70">
                        {formatDateTime(row.created_at)}
                      </div>
                      <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                        <strong>{formatUploader(row)}</strong>
                      </div>
                      <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                        {row.payload_type ?? "unknown"}
                      </div>
                      <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                        <strong>{row.change_status}</strong>
                      </div>
                      <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3] whitespace-normal break-words font-semibold">
                        New {row.new_entities_count} · Updated {row.modified_entities_count} · Unchanged {row.unchanged_entities_count} · Total {row.total_entities_count}
                      </div>
                      <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3]">
                        {row.queue_status ?? "n/a"}
                      </div>
                      <div className="min-w-0 overflow-wrap-anywhere px-3.5 py-2.5 text-[0.92rem] leading-[1.3] flex items-start justify-end">
                        <button
                          type="button"
                          className={`${uiButtonSmallBaseClass} ${uiButtonSoftClass}`}
                          onClick={() => toggleExpanded(row.id)}
                        >
                          {expanded ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="flex flex-col gap-2.5 border-t border-white/5 bg-black/15 px-4 pb-4 pt-3">
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
