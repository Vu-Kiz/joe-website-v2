import React, { useState } from "react";
import { getDroidBrainHistory, type DroidBrainContext, type DroidBrainResultRow } from "../../api/droidbrain";
import Pagination from "../common/Pagination";

const resultLabel = (row: DroidBrainResultRow) =>
  row.name ?? row.identifier ?? row.entity_uid ?? "Unknown";

const formatSwcDisplayId = (value: string | null | undefined): string => {
  if (!value) {
    return "Unknown";
  }

  const [prefix, rawId] = String(value).split(":", 2);
  if (rawId && /^\d+$/.test(prefix)) {
    return rawId;
  }

  return String(value);
};

const formatSnapshot = (value: number | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

const detailPairs = (row: DroidBrainResultRow): Array<[string, string]> =>
  [
    row.type_name ? ["Type", String(row.type_name)] : null,
    row.race_name ? ["Race", String(row.race_name)] : null,
    row.class_name ? ["Class", String(row.class_name)] : null,
    row.owner_name ? ["Owner", String(row.owner_name)] : null,
    row.government ? ["Government", String(row.government)] : null,
    row.uploader_handle ? ["Uploader", String(row.uploader_handle)] : null,
  ].filter(Boolean) as Array<[string, string]>;

const locationPairs = (row: DroidBrainResultRow): Array<[string, string]> =>
  [
    row.sector_name ? ["Sector", String(row.sector_name)] : null,
    row.system_name ? ["System", String(row.system_name)] : null,
    row.planet_name ? ["Planet", String(row.planet_name)] : null,
    row.galx != null && row.galy != null ? ["Galaxy", `${row.galx}, ${row.galy}`] : null,
    row.sysx != null && row.sysy != null ? ["Local", `${row.sysx}, ${row.sysy}`] : null,
  ].filter(Boolean) as Array<[string, string]>;

type Props = {
  context: DroidBrainContext;
  isRestrictedView: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const DroidBrainResultsPanel: React.FC<Props> = ({
  context,
  isRestrictedView,
  onPageChange,
  onPageSizeChange,
}) => {
  const [historyUid, setHistoryUid] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<DroidBrainResultRow[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyPageSize = 5;

  const openHistory = async (row: DroidBrainResultRow) => {
    const uid = row.entity_uid ?? null;
    if (!uid) {
      return;
    }

    if (historyUid === uid) {
      setHistoryUid(null);
      setHistoryRows([]);
      setHistoryPage(1);
      setHistoryError(null);
      return;
    }

    try {
      setLoadingHistory(true);
      setHistoryUid(uid);
      setHistoryPage(1);
      setHistoryError(null);
      const response = await getDroidBrainHistory(context.tab, uid, 10);
      setHistoryRows(response.data);
    } catch (error: any) {
      setHistoryRows([]);
      setHistoryError(error?.message ?? "Failed to load entity history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel">
        <p className="small">
          {context.did_search
            ? `${context.total_rows} result(s) found.`
            : isRestrictedView
              ? "Search by Exact ID to view imported DroidBrain records in the member view."
              : "Add a filter to start searching DroidBrain."}
        </p>
      </div>

      {context.results.map((row, index) => {
        const uid = row.entity_uid ?? null;
      const details = detailPairs(row);
      const locations = locationPairs(row);
      const isHistoryOpen = historyUid === uid && uid !== null;
      const historyTotalPages = Math.max(1, Math.ceil(historyRows.length / historyPageSize));
      const pagedHistoryRows = historyRows.slice(
        (historyPage - 1) * historyPageSize,
        historyPage * historyPageSize
      );

        return (
          <div
            key={`${row.entity_uid ?? row.identifier ?? index}`}
            className="panel"
            style={{ display: "grid", gap: 12 }}
          >
            <div className="admin-card">
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <strong style={{ fontSize: "1.1rem" }}>{String(resultLabel(row))}</strong>
                  <p className="small" style={{ margin: 0 }}>
                    ID: {formatSwcDisplayId(row.entity_uid)}
                    {row.identifier ? ` · Identifier: ${String(row.identifier)}` : ""}
                  </p>
                </div>

                {uid && !isRestrictedView ? (
                  <button
                    type="button"
                    className="ui-btn ui-btn--small"
                    onClick={() => void openHistory(row)}
                    disabled={loadingHistory && isHistoryOpen}
                  >
                    {isHistoryOpen ? "Hide History" : "View History"}
                  </button>
                ) : null}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  marginTop: 12,
                }}
              >
                <div className="panel">
                  <p className="small" style={{ marginTop: 0, marginBottom: 8 }}>
                    <strong>Details</strong>
                  </p>
                  {details.length > 0 ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      {details.map(([label, value]) => (
                        <p key={label} className="small" style={{ margin: 0 }}>
                          <strong>{label}:</strong> {value}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="small" style={{ margin: 0 }}>No detail fields recorded.</p>
                  )}
                </div>

                <div className="panel">
                  <p className="small" style={{ marginTop: 0, marginBottom: 8 }}>
                    <strong>Location</strong>
                  </p>
                  {locations.length > 0 ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      {locations.map(([label, value]) => (
                        <p key={label} className="small" style={{ margin: 0 }}>
                          <strong>{label}:</strong> {value}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="small" style={{ margin: 0 }}>No location recorded.</p>
                  )}
                </div>
              </div>
            </div>

            {isHistoryOpen && !isRestrictedView ? (
              <div className="panel" style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <p className="small" style={{ margin: 0 }}>
                  <strong>History</strong>
                </p>
                {loadingHistory ? (
                  <p className="small" style={{ margin: 0 }}>Loading entity history…</p>
                ) : historyError ? (
                  <p className="small" style={{ margin: 0, color: "salmon" }}>{historyError}</p>
                ) : historyRows.length === 0 ? (
                  <p className="small" style={{ margin: 0 }}>No history entries were found for this entity.</p>
                ) : (
                  <>
                    {pagedHistoryRows.map((historyRow) => (
                    <div key={`${historyRow.id ?? historyRow.file_id ?? historyRow.snapshot_unixtime}`} className="panel">
                      <p className="small" style={{ marginTop: 0, marginBottom: 6 }}>
                        <strong>{historyRow.file_name ?? "Snapshot"}</strong>
                      </p>
                      <p className="small" style={{ margin: 0 }}>
                        {historyRow.file_change_status ? `Status: ${historyRow.file_change_status}` : "Snapshot"}
                        {historyRow.snapshot_unixtime
                          ? ` · Captured: ${formatSnapshot(historyRow.snapshot_unixtime) ?? "Unknown"}`
                          : ""}
                      </p>
                      <p className="small" style={{ margin: "6px 0 0" }}>
                        {detailPairs(historyRow)
                          .map(([label, value]) => `${label}: ${value}`)
                          .join(" · ") || "No detail fields recorded"}
                      </p>
                      <p className="small" style={{ margin: "6px 0 0" }}>
                        {locationPairs(historyRow)
                          .map(([label, value]) => `${label}: ${value}`)
                          .join(" · ") || "No location recorded"}
                      </p>
                    </div>
                  ))}
                    {historyTotalPages > 1 ? (
                      <div className="panel">
                        <Pagination
                          page={historyPage}
                          pageSize={historyPageSize}
                          totalItems={historyRows.length}
                          pageSizeOptions={[historyPageSize]}
                          onPageChange={setHistoryPage}
                          onPageSizeChange={() => undefined}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {context.results.length === 0 && context.did_search && (
        <div className="panel">
          <p className="small">No matches found for the current filters.</p>
        </div>
      )}

      {context.total_pages > 1 && (
        <div className="panel">
          <Pagination
            page={context.page}
            pageSize={context.per_page}
            totalItems={context.total_rows}
            pageSizeOptions={[25, 50, 100]}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
};

export default DroidBrainResultsPanel;
