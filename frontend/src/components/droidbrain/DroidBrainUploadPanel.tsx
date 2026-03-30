import React, { useMemo, useState } from "react";
import type { DroidBrainUploadDebug, DroidBrainUploadResult } from "../../api/droidbrain";

function cleanUid(uid: string | null | undefined): string | null {
  if (!uid) {
    return null;
  }

  const trimmed = uid.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(":");
  return parts.length === 2 && parts[1] ? parts[1] : trimmed;
}

type Props = {
  onUpload: (files: File[]) => Promise<void>;
  uploadResults: DroidBrainUploadResult[];
  uploadDebug: DroidBrainUploadDebug | null;
  onLoadDebug: (fileId: number) => Promise<void>;
  onCreateRewardPayment: (fileId: number, payerFactionId: number) => Promise<void>;
  uploading: boolean;
  loadingDebug: boolean;
  creatingRewardPayment: boolean;
  isSysadmin: boolean;
};

const DroidBrainUploadPanel: React.FC<Props> = ({
  onUpload,
  uploadResults,
  uploadDebug,
  onLoadDebug,
  onCreateRewardPayment,
  uploading,
  loadingDebug,
  creatingRewardPayment,
  isSysadmin,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPayerId, setSelectedPayerId] = useState<number | null>(null);

  const uploadSummary = useMemo(() => {
    return uploadResults.map((result) => ({
      ...result,
      counts: Object.entries(result.counts),
    }));
  }, [uploadResults]);

  return (
    <div className="panel" style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Upload XML / RSS</h2>
        <p className="small" style={{ margin: 0 }}>
          Upload DroidBrain inventory XML or phone `.rss` exports. The importer resolves ship, station, vehicle, planet, and race references against the stored SWC catalogs so snapshots use normalized IDs instead of relying only on long type strings.
        </p>
        <p className="small" style={{ margin: "6px 0 0" }}>
          You can upload up to 10 files at once.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          type="file"
          multiple
          accept=".xml,.rss,text/xml,application/xml,application/rss+xml"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []).slice(0, 10);
            setFiles(selected);
          }}
        />
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          disabled={files.length === 0 || uploading}
          onClick={async () => {
            if (files.length === 0) {
              return;
            }

            await onUpload(files);
            setFiles([]);
          }}
        >
          {uploading ? "Uploading…" : `Import ${files.length || ""} File${files.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {files.length > 0 && (
        <p className="small" style={{ margin: 0 }}>
          Selected: {files.length} file{files.length === 1 ? "" : "s"}
        </p>
      )}

      {uploadSummary.length > 0 && (
        <div className="admin-card" style={{ display: "grid", gap: 10 }}>
          <p className="small" style={{ marginTop: 0, marginBottom: 0 }}>
            <strong>Upload Results</strong>
          </p>
          {uploadSummary.map((result) => (
            <div key={result.file_id} className="panel">
              <p className="small" style={{ marginTop: 0 }}>
                <strong>{result.message}</strong>
              </p>
              <p className="small">
                File ID: {result.file_id} · Payload: {result.payload_type}
                {result.duplicate ? " · Duplicate file" : ""}
              </p>
              {result.duplicate && (
                <p className="small" style={{ marginTop: 0 }}>
                  This re-upload made no changes. Effective result: New:{" "}
                  {result.duplicate_attempt_new_entities_count ?? 0} · Modified:{" "}
                  {result.duplicate_attempt_modified_entities_count ?? 0} · Unchanged:{" "}
                  {result.duplicate_attempt_unchanged_entities_count ?? 0}
                </p>
              )}
              {result.counts.length > 0 && (
                <p className="small" style={{ marginBottom: 0 }}>
                  {result.duplicate ? "Existing import: " : ""}
                  {result.counts.map(([key, value]) => `${key}: ${value}`).join(" · ")}
                </p>
              )}
              {result.duplicate &&
                (result.existing_change_status ||
                  result.existing_new_entities_count != null ||
                  result.existing_modified_entities_count != null ||
                  result.existing_unchanged_entities_count != null) && (
                  <p className="small" style={{ marginBottom: 0 }}>
                    Original import status: {result.existing_change_status ?? "unknown"} · New:{" "}
                    {result.existing_new_entities_count ?? 0} · Modified:{" "}
                    {result.existing_modified_entities_count ?? 0} · Unchanged:{" "}
                    {result.existing_unchanged_entities_count ?? 0}
                  </p>
                )}
              {isSysadmin && result.reward_summary && (
                <div style={{ marginTop: 10 }}>
                  <p className="small" style={{ margin: 0 }}>
                    Payment item: {result.reward_summary.payment_item_id ?? "not created"} · Total reward:{" "}
                    {result.reward_summary.total_amount.toLocaleString()} · Payee:{" "}
                    {result.reward_summary.payee_handle ?? `No SWC handle (${result.reward_summary.payee_label})`}
                  </p>
                  <p className="small" style={{ margin: "6px 0 0" }}>
                    {result.reward_summary.systems
                      .map((system) => {
                        const label = `${system.system_name ?? "Unknown"} (${system.galx}, ${system.galy})`;
                        if (system.status === "rewarded" && system.is_new_system) {
                          return `${label}: new system = ${system.total_amount.toLocaleString()}`;
                        }

                        if (system.status === "rewarded") {
                          return `${label}: ${system.new_entities_count} new, ${system.modified_entities_count} updated = ${system.total_amount.toLocaleString()}`;
                        }

                        return `${label}: ${system.status}`;
                      })
                      .join(" · ")}
                  </p>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="ui-btn ui-btn--small"
                  disabled={loadingDebug}
                  onClick={() => onLoadDebug(result.file_id)}
                >
                  {loadingDebug
                    ? "Loading Debug…"
                    : result.duplicate
                      ? "Load Original Import Debug"
                      : "Load Debug"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadDebug && (
        <div className="admin-card" style={{ display: "grid", gap: 10 }}>
          <p className="small" style={{ margin: 0 }}>
            <strong>Debug</strong>
          </p>
          <p className="small" style={{ margin: 0 }}>
            File: {uploadDebug.file.file_name} · Status: {uploadDebug.file.change_status ?? "unknown"} ·
            New: {uploadDebug.file.new_entities_count} · Modified: {uploadDebug.file.modified_entities_count} ·
            Unchanged: {uploadDebug.file.unchanged_entities_count}
          </p>
          <p className="small" style={{ margin: 0 }}>
            {Object.entries(uploadDebug.entity_counts)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" · ")}
          </p>
          {uploadDebug.scan_objects_preview.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {uploadDebug.scan_objects_preview.map((row) => (
                <div key={row.id} className="panel">
                  <p className="small" style={{ margin: 0 }}>
                    <strong>{row.object_name ?? "Unknown object"}</strong>
                  </p>
                  <p className="small" style={{ margin: 0 }}>
                    Type: {row.object_type ?? "unknown"} · ID: {cleanUid(row.object_uid) ?? "unknown"}
                    {row.system_name ? ` · System: ${row.system_name}` : ""}
                    {row.galx != null && row.galy != null ? ` · Galaxy: ${row.galx}, ${row.galy}` : ""}
                    {row.sysx != null && row.sysy != null ? ` · Local: ${row.sysx}, ${row.sysy}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          {isSysadmin && uploadDebug.reward_logs.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {uploadDebug.reward_logs.map((row) => (
                <div key={row.id} className="panel">
                  <p className="small" style={{ margin: 0 }}>
                    <strong>{row.system_name ?? "Unknown system"}</strong> ({row.galx}, {row.galy})
                  </p>
                  <p className="small" style={{ margin: 0 }}>
                    Status: {row.reward_status} · New system: {row.is_new_system ? "yes" : "no"} · New entities:{" "}
                    {row.new_entities_count} · Updated entities: {row.modified_entities_count} · Reward:{" "}
                    {row.total_amount.toLocaleString()}
                    {row.cooldown_until ? ` · Cooldown until: ${row.cooldown_until}` : ""}
                    {row.payment_item_id ? ` · Payment item: ${row.payment_item_id}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          {isSysadmin && uploadDebug.reward_payment && (
            <div className="panel">
              <p className="small" style={{ margin: 0 }}>
                <strong>Current payment item</strong>
              </p>
              <p className="small" style={{ margin: "6px 0 0" }}>
                Payment item: {uploadDebug.reward_payment.payment_item_id ?? "not created"} · Total:{" "}
                {uploadDebug.reward_payment.total_amount.toLocaleString()} · Payer:{" "}
                {uploadDebug.reward_payment.payer_label ?? "not set"}
              </p>
            </div>
          )}
          {isSysadmin && uploadDebug.payer_options.length > 0 && (
            <div className="panel" style={{ display: "grid", gap: 8 }}>
              <p className="small" style={{ margin: 0 }}>
                <strong>Sysadmin payment controls</strong>
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  className="input"
                  value={selectedPayerId ?? ""}
                  onChange={(event) => setSelectedPayerId(event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">Choose faction payer</option>
                  {uploadDebug.payer_options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {option.abbreviation ? ` (${option.abbreviation})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ui-btn ui-btn--primary ui-btn--small"
                  disabled={!selectedPayerId || creatingRewardPayment}
                  onClick={() => {
                    if (!selectedPayerId || !uploadDebug) {
                      return;
                    }

                    void onCreateRewardPayment(uploadDebug.file.id, selectedPayerId);
                  }}
                >
                  {creatingRewardPayment ? "Creating Payment…" : "Create / Update Payment Item"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DroidBrainUploadPanel;
