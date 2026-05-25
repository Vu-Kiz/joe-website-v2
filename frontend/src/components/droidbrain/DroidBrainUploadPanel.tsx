import React, { useEffect, useMemo, useState } from "react";
import { getDroidBrainUploadQueueStatus, type DroidBrainUploadResult } from "../../api/universe/droidbrain";
import { BTN_SM, INPUT } from "../../utils/ui";

type Props = {
  onUpload: (files: File[]) => Promise<void>;
  uploadResults: DroidBrainUploadResult[];
  uploading: boolean;
  uploadStatus: string | null;
  isSysadmin: boolean;
  compact?: boolean;
};

const DroidBrainUploadPanel: React.FC<Props> = ({
  onUpload,
  uploadResults,
  uploading,
  uploadStatus,
  isSysadmin,
  compact = false,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const compactInputId = "members-universe-droidbrain-upload-input";
  const [queueUpdatesById, setQueueUpdatesById] = useState<Record<number, DroidBrainUploadResult>>({});

  const mergedUploadResults = useMemo(() => {
    return uploadResults.map((result) => {
      const queueId = typeof result.queue_id === "number" ? result.queue_id : null;
      if (!queueId) {
        return result;
      }

      return queueUpdatesById[queueId] ?? result;
    });
  }, [queueUpdatesById, uploadResults]);

  const pendingQueueIds = useMemo(() => {
    const ids = new Set<number>();
    mergedUploadResults.forEach((result) => {
      const queueId = typeof result.queue_id === "number" ? result.queue_id : null;
      if (!queueId) {
        return;
      }

      const status = String(result.queue_status ?? "").toLowerCase();
      const isPending = Boolean(result.queued) || status === "queued" || status === "processing";
      if (isPending) {
        ids.add(queueId);
      }
    });

    return Array.from(ids).sort((a, b) => a - b);
  }, [mergedUploadResults]);

  useEffect(() => {
    setQueueUpdatesById((previous) => {
      const activeQueueIds = new Set(
        uploadResults
          .map((result) => (typeof result.queue_id === "number" ? result.queue_id : null))
          .filter((id): id is number => id !== null)
      );

      const next: Record<number, DroidBrainUploadResult> = {};
      Object.entries(previous).forEach(([key, value]) => {
        const queueId = Number(key);
        if (activeQueueIds.has(queueId)) {
          next[queueId] = value;
        }
      });

      return next;
    });
  }, [uploadResults]);

  useEffect(() => {
    if (pendingQueueIds.length === 0) {
      return;
    }

    let cancelled = false;

    const refreshStatuses = async () => {
      const responses = await Promise.all(
        pendingQueueIds.map(async (queueId) => {
          try {
            const response = await getDroidBrainUploadQueueStatus(queueId);
            return { queueId, response };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const updates: Record<number, DroidBrainUploadResult> = {};
      responses.forEach((entry) => {
        if (!entry) {
          return;
        }

        const queueId = entry.queueId;
        const status = String(entry.response.data.status ?? "queued");
        const uploadResult = entry.response.data.upload_result;

        if (uploadResult) {
          updates[queueId] = uploadResult;
          return;
        }

        updates[queueId] = {
          queue_id: queueId,
          queued: status === "queued" || status === "processing",
          queue_status: status,
          duplicate: false,
          payload_type: "unknown",
          counts: {},
          message:
            status === "failed"
              ? `Upload failed: ${entry.response.data.error_message ?? "Unknown error."}`
              : status === "completed"
                ? "Upload imported successfully."
                : `Queue status: ${status}`,
        };
      });

      if (Object.keys(updates).length > 0) {
        setQueueUpdatesById((previous) => ({ ...previous, ...updates }));
      }
    };

    void refreshStatuses();
    const intervalId = window.setInterval(() => {
      void refreshStatuses();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pendingQueueIds]);

  const uploadSummary = useMemo(() => {
    return mergedUploadResults.map((result) => ({
      ...result,
      counts: Object.entries(result.counts ?? {}),
    }));
  }, [mergedUploadResults]);

  const IMPORT_LOG_CLS = "grid gap-[0.3rem]";
  const IMPORT_LOG_ENTRY_CLS = "grid gap-[0.2rem]";

  if (compact) {
    return (
      <div className="grid gap-2">
        <div className="grid gap-[0.2rem]">
          <h4 className="m-0">Upload RSS/XML</h4>
        </div>

        <div className="flex justify-start items-center gap-[0.65rem] flex-wrap">
          <input
            id={compactInputId}
            className="sr-only"
            type="file"
            multiple
            accept=".xml,.rss,text/xml,application/xml,application/rss+xml"
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []).slice(0, 10);
              setFiles(selected);
            }}
          />
          <label htmlFor={compactInputId} className={BTN_SM}>
            {files.length > 0 ? "Change Files" : "Choose Files"}
          </label>
          <button
            type="button"
            className={BTN_SM}
            disabled={files.length === 0 || uploading}
            onClick={async () => {
              if (files.length === 0) {
                return;
              }

              await onUpload(files);
              setFiles([]);
            }}
          >
            {uploading ? "Uploading..." : "Import Files"}
          </button>
          <span className="small">
            {files.length > 0 ? `${files.length} selected` : "No files selected"}
          </span>
        </div>

        {uploadStatus ? (
          <p className="small" style={{ margin: 0 }}>
            <strong>{uploadStatus}</strong>
          </p>
        ) : null}

        {uploadSummary.length > 0 ? (
          <details>
            <summary className="small" style={{ cursor: "pointer" }}>
              Upload Results ({uploadSummary.length})
            </summary>
            <div className={IMPORT_LOG_CLS} style={{ marginTop: 8 }}>
              {uploadSummary.map((result, index) => (
                <div key={`${result.file_id ?? "queue"}-${result.queue_id ?? index}`} className={IMPORT_LOG_ENTRY_CLS}>
                  <p className="small" style={{ marginTop: 0 }}>
                    <strong>{result.message}</strong>
                  </p>
                  <p className="small">
                    {result.queue_id != null
                      ? `Queue ID: ${result.queue_id} · Status: ${result.queue_status ?? (result.queued ? "queued" : "completed")}`
                      : `File ID: ${result.file_id ?? "pending"}`}
                    {result.queue_id != null && result.file_id != null ? ` · File ID: ${result.file_id}` : ""}
                    {result.payload_type ? ` · Payload: ${result.payload_type}` : ""}
                    {result.duplicate ? " · Duplicate file" : ""}
                  </p>
                  {result.counts.length > 0 ? (
                    <p className="small" style={{ marginBottom: 0 }}>
                      {result.duplicate ? "Existing import: " : ""}
                      {result.counts.map(([key, value]) => `${key}: ${value}`).join(" · ")}
                    </p>
                  ) : null}
                  {isSysadmin && result.reward_summary ? (
                    <p className="small" style={{ marginBottom: 0 }}>
                      Reward: {result.reward_summary.total_amount.toLocaleString()} · Item:{" "}
                      {result.reward_summary.payment_item_id ?? "not created"}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 className="h2" style={{ marginTop: 0, marginBottom: 6 }}>Upload XML / RSS</h2>
        <p className="small" style={{ margin: 0 }}>
          Upload DroidBrain XML or phone RSS exports.
        </p>
        <p className="small" style={{ margin: "6px 0 0" }}>
          You can upload up to 10 files at once. Files are queued and processed in the background.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className={INPUT}
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
          className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[#f5d546]/35 bg-[#f5d546]/10 px-[0.95rem] py-[0.65rem] font-bold leading-none text-[#f2c46f] no-underline shadow-[inset_0_0_0_1px_rgba(245,213,70,0.08)] transition-[border-color,background,transform,box-shadow] duration-150 ease-out hover:enabled:-translate-y-px hover:enabled:border-[#f5d546]/45 hover:enabled:bg-[#f5d546]/15 disabled:cursor-not-allowed disabled:opacity-[0.55]"
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
        <div className="grid gap-[10px]">
          <p className="small" style={{ marginTop: 0, marginBottom: 0 }}>
            <strong>Upload Results</strong>
          </p>
          {uploadSummary.map((result, index) => (
            <div key={`${result.file_id ?? "queue"}-${result.queue_id ?? index}`} className="panel">
              <p className="small" style={{ marginTop: 0 }}>
                <strong>{result.message}</strong>
              </p>
              <p className="small">
                {result.queue_id != null
                  ? `Queue ID: ${result.queue_id} · Status: ${result.queue_status ?? (result.queued ? "queued" : "completed")}`
                  : `File ID: ${result.file_id ?? "pending"}`}
                {result.queue_id != null && result.file_id != null ? ` · File ID: ${result.file_id}` : ""}
                {result.payload_type ? ` · Payload: ${result.payload_type}` : ""}
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
