import React from "react";
import type { DroidBrainResultRow, DroidBrainTab } from "../../api/droidbrain";

type Props = {
  summary: Record<string, DroidBrainResultRow[]>;
  tabLabels: Record<DroidBrainTab, string>;
};

const DroidBrainSummaryPanel: React.FC<Props> = ({ summary, tabLabels }) => {
  const summaryEntries = Object.entries(summary);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {summaryEntries.length === 0 && (
        <div className="panel">
          <p className="small">No summary data yet.</p>
        </div>
      )}

      {summaryEntries.map(([key, rows]) => (
        <div key={key} className="panel">
          <h2 style={{ marginTop: 0 }}>{tabLabels[key as DroidBrainTab] ?? key}</h2>
          {rows.length === 0 ? (
            <p className="small">No assets recorded for this tab yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map((row, index) => (
                <div key={`${key}-${index}`} className="admin-card">
                  <p className="small">
                    <strong>Owner:</strong> {String(row.owner_name ?? "Unknown")}
                  </p>
                  <p className="small">
                    <strong>Type:</strong> {String(row.type_name ?? "Unknown")}
                    {row.class_name ? " · " : ""}
                    {row.class_name ? (
                      <>
                        <strong>Class:</strong> {String(row.class_name)}
                      </>
                    ) : null}
                  </p>
                  <p className="small">
                    <strong>Total:</strong> {Number(row.total ?? 0).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DroidBrainSummaryPanel;
