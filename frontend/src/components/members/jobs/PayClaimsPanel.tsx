import React, { useEffect, useState } from "react";
import {
  getJobPayRates,
  getJobPayClaims,
  submitJobPayClaim,
  approveJobPayClaim,
  rejectJobPayClaim,
  type JobPayRate,
  type JobPayClaim,
} from "../../../api/jobs/jobPayRates";
import { getCgtTime, formatTimestampAsCgt, type CgtResponse } from "../../../api/core/time";
import { fmtCreditsFull as fmt } from "../../../utils/credits";
import type { PaymentsActionState } from "../../payments/types";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM, INPUT} from "../../../utils/ui";

type Props = {
  isAdmin: boolean;
};

const statusLabel: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

const claimCardBorder: Record<string, string> = {
  pending:  "border-[rgba(245,213,70,0.2)]",
  approved: "border-[rgba(46,204,113,0.2)]",
  rejected: "border-[rgba(255,80,80,0.15)]",
};

const claimStatusBadge: Record<string, string> = {
  pending:  "bg-[rgba(245,213,70,0.12)] text-[#f5d546]",
  approved: "bg-[rgba(46,204,113,0.12)] text-[#8fe1a8]",
  rejected: "bg-[rgba(255,80,80,0.12)] text-[#ff8080]",
};

const claimCardBase = "flex flex-col gap-[0.4rem] p-[0.9rem] rounded-[10px] border bg-[rgba(255,255,255,0.03)] mb-[0.65rem] font-tektur";
const statusBadgeBase = "text-[0.72rem] uppercase tracking-[0.06em] px-[0.55rem] py-[0.15rem] rounded-full";

const PayClaimsPanel: React.FC<Props> = ({ isAdmin }) => {
  const [rates, setRates] = useState<JobPayRate[]>([]);
  const [claims, setClaims] = useState<JobPayClaim[]>([]);
  const [cgtState, setCgtState] = useState<CgtResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<PaymentsActionState>({ working: false, message: null, error: null });

  const [selectedRateId, setSelectedRateId] = useState<number | "">("");
  const [quantity, setQuantity] = useState("");
  const [includeBonus, setIncludeBonus] = useState(false);
  const [notes, setNotes] = useState("");

  const [adminFilter, setAdminFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [actionId, setActionId] = useState<number | null>(null);

  function clearActionState() {
    setActionState({ working: false, message: null, error: null });
  }

  async function load() {
    const [ratesRes, claimsRes] = await Promise.all([getJobPayRates(), getJobPayClaims()]);
    setRates(ratesRes.data);
    setClaims(claimsRes.data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [ratesRes, claimsRes, cgt] = await Promise.all([getJobPayRates(), getJobPayClaims(), getCgtTime()]);
        if (!cancelled) {
          setRates(ratesRes.data);
          setClaims(claimsRes.data);
          setCgtState(cgt);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setActionState({ working: false, message: null, error: e?.message ?? "Failed to load." });
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedRate = rates.find((r) => r.id === selectedRateId) ?? null;
  const qty = parseInt(quantity, 10);
  const baseTotal = selectedRate && qty > 0 ? qty * selectedRate.base_rate : null;
  const bonusTotal = selectedRate?.bonus_rate && includeBonus && qty > 0 ? qty * selectedRate.bonus_rate : 0;
  const totalAmount = baseTotal !== null ? baseTotal + bonusTotal : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRate || !qty || qty < 1) return;
    setActionState({ working: true, message: null, error: null });
    try {
      await submitJobPayClaim({
        job_pay_rate_id: selectedRate.id,
        quantity: qty,
        include_bonus: includeBonus,
        notes: notes.trim() || undefined,
      });
      setActionState({ working: false, message: "Claim submitted! An admin will review it shortly.", error: null });
      setSelectedRateId("");
      setQuantity("");
      setIncludeBonus(false);
      setNotes("");
      await load();
    } catch (e: any) {
      setActionState({ working: false, message: null, error: e?.message ?? "Failed to submit claim." });
    }
  }

  async function handleApprove(claim: JobPayClaim) {
    setActionId(claim.id);
    setActionState({ working: true, message: null, error: null });
    try {
      await approveJobPayClaim(claim.id, reviewNotes[claim.id] ?? undefined);
      setActionState({ working: false, message: `Claim #${claim.id} approved — payment item queued.`, error: null });
      await load();
    } catch (e: any) {
      setActionState({ working: false, message: null, error: e?.message ?? "Failed to approve." });
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(claim: JobPayClaim) {
    setActionId(claim.id);
    setActionState({ working: true, message: null, error: null });
    try {
      await rejectJobPayClaim(claim.id, reviewNotes[claim.id] ?? undefined);
      setActionState({ working: false, message: `Claim #${claim.id} rejected.`, error: null });
      await load();
    } catch (e: any) {
      setActionState({ working: false, message: null, error: e?.message ?? "Failed to reject." });
    } finally {
      setActionId(null);
    }
  }

  const adminClaims = adminFilter === "all" ? claims : claims.filter((c) => c.status === adminFilter);

  if (loading) {
    return <div className="panel"><p className="small">Loading…</p></div>;
  }

  return (
    <>
      {(actionState.message || actionState.error) && (
        <div className="panel">
          {actionState.message && <p className="small">{actionState.message}</p>}
          {actionState.error && <p className="small" style={{ color: "salmon" }}>{actionState.error}</p>}
          <button className={BTN} type="button" onClick={clearActionState}>Clear</button>
        </div>
      )}

      {/* Submit form */}
      <div className="panel">
        <h2 className="h2">Submit Pay Claim</h2>
        <p className="small">Select a job type, enter how many units you completed, and submit for admin review.</p>

        {rates.length === 0 ? (
          <p className="small" style={{ opacity: 0.6 }}>
            No pay rates have been set up yet. An admin needs to populate the pay rate catalog before claims can be submitted.
          </p>
        ) : (
          <form className="flex flex-col gap-[0.85rem] max-w-[500px] font-tektur" onSubmit={handleSubmit}>
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
                    {r.name} — {fmt(r.base_rate)} / {r.unit_label}
                  </option>
                ))}
              </select>
            </label>

            {selectedRate && (
              <div className="p-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] flex flex-col gap-[0.3rem]">
                <p className="text-[0.82rem] m-0"><strong className="text-[#f5d546]">Rate:</strong> {fmt(selectedRate.base_rate)} / {selectedRate.unit_label}</p>
                {selectedRate.description && <p className="text-[0.82rem] m-0" style={{ opacity: 0.7 }}>{selectedRate.description}</p>}
                {selectedRate.bonus_rate && (
                  <p className="text-[0.82rem] m-0">
                    <strong className="text-[#f5d546]">Bonus available:</strong> {fmt(selectedRate.bonus_rate)} / {selectedRate.unit_label}
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
                <input type="checkbox" checked={includeBonus} onChange={(e) => setIncludeBonus(e.target.checked)} />
                Include bonus ({fmt(selectedRate.bonus_rate)} / {selectedRate.unit_label}
                {selectedRate.bonus_description ? ` — ${selectedRate.bonus_description}` : ""})
              </label>
            )}

            {totalAmount !== null && (
              <div className="px-[0.85rem] py-[0.65rem] rounded-lg bg-[rgba(245,213,70,0.07)] border border-[rgba(245,213,70,0.15)] text-[0.85rem]">
                <strong className="text-[#f5d546]">{fmt(totalAmount)} credits</strong>
                {bonusTotal > 0 && (
                  <span className="ml-2 opacity-55 text-[0.78rem]">
                    base {fmt(baseTotal!)} + bonus {fmt(bonusTotal)}
                  </span>
                )}
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

            <button type="submit" className={BTN} disabled={actionState.working || !selectedRate || !qty || qty < 1}>
              {actionState.working ? "Submitting…" : "Submit Claim"}
            </button>
          </form>
        )}
      </div>

      {/* My claims history */}
      <div className="panel">
        <h2 className="h2">My Pay Claims</h2>
        {claims.length === 0 ? (
          <p className="small">You have not submitted any pay claims yet.</p>
        ) : (
          claims.map((claim) => (
            <div key={claim.id} className={`${claimCardBase} ${claimCardBorder[claim.status] ?? "border-[rgba(255,255,255,0.07)]"}`}>
              <div className="flex justify-between items-start flex-wrap gap-[0.4rem]">
                <p className="font-bold text-[0.9rem] m-0">{claim.pay_rate?.name ?? `Pay Rate #${claim.job_pay_rate_id}`}</p>
                <span className={`${statusBadgeBase} ${claimStatusBadge[claim.status] ?? ""}`}>
                  {statusLabel[claim.status] ?? claim.status}
                </span>
              </div>
              <p className="text-[0.88rem] m-0">
                {claim.quantity} × {claim.pay_rate?.unit_label ?? "unit"} · <strong className="text-[#f5d546]">{fmt(claim.total_amount)}</strong>
                {claim.include_bonus && <span className="text-[0.75rem] opacity-55 ml-[0.4rem]">(includes bonus)</span>}
              </p>
              {claim.notes && <p className="text-[0.78rem] opacity-65 m-0">Notes: {claim.notes}</p>}
              {claim.review_note && <p className="text-[0.78rem] opacity-50 m-0">Reviewer note: {claim.review_note}</p>}
              <p className="text-[0.75rem] opacity-40 m-0">Submitted {formatTimestampAsCgt(claim.created_at, cgtState)}</p>
            </div>
          ))
        )}
      </div>

      {/* Admin review queue */}
      {isAdmin && (
        <div className="panel">
          <h2 className="h2">Review Claims</h2>
          <div className="flex gap-2 flex-wrap mb-4">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={adminFilter === s ? BTN_SM : BTN_GHOST_SM}
                onClick={() => setAdminFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {adminClaims.length === 0 ? (
            <p className="small">No claims found.</p>
          ) : (
            adminClaims.map((claim) => (
              <div key={claim.id} className={`${claimCardBase} ${claimCardBorder[claim.status] ?? "border-[rgba(255,255,255,0.07)]"}`}>
                <div className="flex justify-between items-start flex-wrap gap-[0.4rem]">
                  <p className="font-bold text-[0.9rem] m-0">
                    {claim.pay_rate?.name ?? `Pay Rate #${claim.job_pay_rate_id}`}
                    <span className="text-[0.78rem] opacity-55 ml-[0.4rem] font-normal">by {claim.claimant_handle ?? `User #${claim.claimant_user_id}`}</span>
                  </p>
                  <span className={`${statusBadgeBase} ${claimStatusBadge[claim.status] ?? ""}`}>
                    {statusLabel[claim.status] ?? claim.status}
                  </span>
                </div>
                <p className="text-[0.88rem] m-0">
                  {claim.quantity} × {claim.pay_rate?.unit_label ?? "unit"} · <strong className="text-[#f5d546]">{fmt(claim.total_amount)}</strong>
                  {claim.include_bonus && <span className="text-[0.75rem] opacity-55 ml-[0.4rem]">(includes bonus)</span>}
                </p>
                {claim.notes && <p className="text-[0.78rem] opacity-65 m-0">Notes: {claim.notes}</p>}
                <p className="text-[0.75rem] opacity-40 m-0">Submitted {formatTimestampAsCgt(claim.created_at, cgtState)}</p>

                {claim.status === "pending" && (
                  <div className="flex flex-col gap-2 mt-[0.4rem] pt-[0.6rem] border-t border-[rgba(255,255,255,0.06)]">
                    <input
                      className={INPUT}
                      type="text"
                      placeholder="Reviewer note (optional)"
                      value={reviewNotes[claim.id] ?? ""}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                      style={{ maxWidth: 400 }}
                    />
                    <div className="flex gap-2 items-center flex-wrap">
                      <button
                        type="button"
                        className={BTN_SM}
                        disabled={actionId === claim.id || actionState.working}
                        onClick={() => handleApprove(claim)}
                      >
                        {actionId === claim.id ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className={BTN_GHOST_SM}
                        disabled={actionId === claim.id || actionState.working}
                        onClick={() => handleReject(claim)}
                        style={{ color: "salmon" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {claim.status !== "pending" && claim.review_note && (
                  <p className="text-[0.78rem] opacity-50 m-0">Reviewer note: {claim.review_note}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
};

export default PayClaimsPanel;
