import React, { useState } from "react";
import type { JobPayRate } from "../../../api/jobs/jobPayRates";
import { submitJobPayClaim } from "../../../api/jobs/jobPayRates";
import { BTN, INPUT} from "../../../utils/ui";

type Props = {
  rates: JobPayRate[];
  onSubmitted: () => void;
};

const PayClaimSubmitPanel: React.FC<Props> = ({ rates, onSubmitted }) => {
  const [selectedRateId, setSelectedRateId] = useState<number | "">("");
  const [quantity, setQuantity] = useState<string>("");
  const [includeBonus, setIncludeBonus] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedRate = rates.find((r) => r.id === selectedRateId) ?? null;

  const qty = parseInt(quantity, 10);
  const baseTotal = selectedRate && qty > 0 ? qty * selectedRate.base_rate : null;
  const bonusTotal =
    selectedRate?.bonus_rate && includeBonus && qty > 0 ? qty * selectedRate.bonus_rate : 0;
  const totalAmount = baseTotal !== null ? baseTotal + bonusTotal : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRate || !qty || qty < 1) return;

    setSubmitting(true);
    setError(null);
    try {
      await submitJobPayClaim({
        job_pay_rate_id: selectedRate.id,
        quantity: qty,
        include_bonus: includeBonus,
        notes: notes.trim() || undefined,
      });
      setSuccess(true);
      setSelectedRateId("");
      setQuantity("");
      setIncludeBonus(false);
      setNotes("");
      onSubmitted();
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="h2">Submit Pay Claim</h2>
      <p className="small">Select a job type, enter how many units you completed, and submit for admin review.</p>

      {rates.length === 0 && (
        <p className="small" style={{ opacity: 0.6 }}>
          No pay rates have been set up yet. An admin needs to populate the pay rate catalog before claims can be submitted.
        </p>
      )}

      {success && (
        <p className="small" style={{ color: "lightgreen" }}>
          Claim submitted! An admin will review it shortly.
        </p>
      )}

      {rates.length > 0 && <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
        <label className="small">
          Job Type
          <select
            className={INPUT}
            value={selectedRateId}
            onChange={(e) => {
              setSelectedRateId(e.target.value ? parseInt(e.target.value, 10) : "");
              setIncludeBonus(false);
            }}
            style={{ display: "block", marginTop: 4, width: "100%" }}
          >
            <option value="">— Select a job type —</option>
            {rates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {(r.base_rate / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}m /{" "}
                {r.unit_label}
              </option>
            ))}
          </select>
        </label>

        {selectedRate && (
          <div className="flex flex-col gap-4" style={{ marginBottom: 0 }}>
            <p className="small" style={{ margin: 0 }}>
              <strong>Rate:</strong>{" "}
              {(selectedRate.base_rate / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 })}m /{" "}
              {selectedRate.unit_label}
            </p>
            {selectedRate.description && (
              <p className="small" style={{ margin: "4px 0 0" }}>
                {selectedRate.description}
              </p>
            )}
            {selectedRate.bonus_rate && (
              <p className="small" style={{ margin: "4px 0 0" }}>
                <strong>Bonus:</strong>{" "}
                {(selectedRate.bonus_rate / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 })}m /{" "}
                {selectedRate.unit_label}
                {selectedRate.bonus_description ? ` — ${selectedRate.bonus_description}` : ""}
              </p>
            )}
          </div>
        )}

        <label className="small">
          Quantity ({selectedRate?.unit_label ?? "units"})
          <input
            type="number"
            className={INPUT}
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ display: "block", marginTop: 4, width: "100%" }}
            placeholder="e.g. 3"
          />
        </label>

        {selectedRate?.bonus_rate && (
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={includeBonus}
              onChange={(e) => setIncludeBonus(e.target.checked)}
            />
            Include bonus ({(selectedRate.bonus_rate / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 })}m /{" "}
            {selectedRate.unit_label}
            {selectedRate.bonus_description ? ` — ${selectedRate.bonus_description}` : ""})
          </label>
        )}

        {totalAmount !== null && (
          <div className="flex flex-col gap-4" style={{ marginBottom: 0 }}>
            <p className="small" style={{ margin: 0 }}>
              <strong>Total:</strong>{" "}
              {(totalAmount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 })}m credits
              {bonusTotal > 0 && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>
                  (base {(baseTotal! / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 })}m + bonus{" "}
                  {(bonusTotal / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 })}m)
                </span>
              )}
            </p>
          </div>
        )}

        <label className="small">
          Notes (optional)
          <textarea
            className={INPUT}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ display: "block", marginTop: 4, width: "100%", resize: "vertical" }}
            placeholder="Any details for the reviewer…"
          />
        </label>

        {error && (
          <p className="small" style={{ color: "salmon", margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className={BTN}
          disabled={submitting || !selectedRate || !qty || qty < 1}
        >
          {submitting ? "Submitting…" : "Submit Claim"}
        </button>
      </form>}
    </div>
  );
};

export default PayClaimSubmitPanel;
