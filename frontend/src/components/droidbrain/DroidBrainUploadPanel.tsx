import React, { useMemo, useState } from "react";
import type { DroidBrainUploadResult } from "../../api/droidbrain";

type Props = {
  onUpload: (files: File[]) => Promise<void>;
  uploadResults: DroidBrainUploadResult[];
  uploading: boolean;
  uploadStatus: string | null;
  isSysadmin: boolean;
};

const DroidBrainUploadPanel: React.FC<Props> = ({
  onUpload,
  uploadResults,
  uploading,
  uploadStatus,
  isSysadmin,
}) => {
  const [files, setFiles] = useState<File[]>([]);

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
          Upload DroidBrain XML or phone RSS exports.
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

      {files.length > 0 ? (
        <p className="small" style={{ margin: 0 }}>
          Selected: {files.length} file{files.length === 1 ? "" : "s"}
        </p>
      ) : null}

      {uploading && uploadStatus ? (
        <div className="panel">
          <p className="small" style={{ margin: 0 }}>
            <strong>{uploadStatus}</strong>
          </p>
        </div>
      ) : null}

      {uploadSummary.length > 0 ? (
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
              {result.duplicate ? (
                <p className="small" style={{ marginTop: 0 }}>
                  This re-upload made no changes. Effective result: New:{" "}
                  {result.duplicate_attempt_new_entities_count ?? 0} · Modified:{" "}
                  {result.duplicate_attempt_modified_entities_count ?? 0} · Unchanged:{" "}
                  {result.duplicate_attempt_unchanged_entities_count ?? 0}
                </p>
              ) : null}
              {result.counts.length > 0 ? (
                <p className="small" style={{ marginBottom: 0 }}>
                  {result.duplicate ? "Existing import: " : ""}
                  {result.counts.map(([key, value]) => `${key}: ${value}`).join(" · ")}
                </p>
              ) : null}
              {result.duplicate &&
              (result.existing_change_status ||
                result.existing_new_entities_count != null ||
                result.existing_modified_entities_count != null ||
                result.existing_unchanged_entities_count != null) ? (
                <p className="small" style={{ marginBottom: 0 }}>
                  Original import status: {result.existing_change_status ?? "unknown"} · New:{" "}
                  {result.existing_new_entities_count ?? 0} · Modified:{" "}
                  {result.existing_modified_entities_count ?? 0} · Unchanged:{" "}
                  {result.existing_unchanged_entities_count ?? 0}
                </p>
              ) : null}
              {isSysadmin && result.reward_summary ? (
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
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default DroidBrainUploadPanel;
