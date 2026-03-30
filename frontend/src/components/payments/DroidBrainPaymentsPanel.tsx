import React, { useEffect, useState } from "react";

type Props = {
  defaultPayerFactionId: number | null;
  payerOptions: Array<{
    id: number;
    name: string;
    swc_uid: string | null;
    abbreviation: string | null;
  }>;
  working: boolean;
  onSave: (defaultPayerFactionId: number | null) => Promise<void>;
};

const DroidBrainPaymentsPanel: React.FC<Props> = ({
  defaultPayerFactionId,
  payerOptions,
  working,
  onSave,
}) => {
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    setSelectedId(defaultPayerFactionId ? String(defaultPayerFactionId) : "");
  }, [defaultPayerFactionId]);

  return (
    <section className="panel">
      <h2 style={{ marginTop: 0 }}>DroidBrain</h2>
      <p className="small">
        Set the default faction payer used when sysadmins create DroidBrain reward payment items.
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
        <label className="small" style={{ display: "grid", gap: 6 }}>
          <span>Default payer faction</span>
          <select
            className="input"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={working}
          >
            <option value="">No default selected</option>
            {payerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.abbreviation ? ` (${option.abbreviation})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div>
          <button
            type="button"
            className="btn"
            disabled={working}
            onClick={() => onSave(selectedId ? Number(selectedId) : null)}
          >
            {working ? "Saving…" : "Save DroidBrain Defaults"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default DroidBrainPaymentsPanel;
