import React, { useEffect, useState } from "react";
import {
  getJobPayClaims,
  approveJobPayClaim,
  rejectJobPayClaim,
  type JobPayClaim,
} from "../../api/jobs/jobPayRates";
import { BTN_SM, BTN_GHOST_SM, INPUT} from "../../utils/ui";

const statusLabel: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const statusColor: Record<string, string> = {
  pending: "inherit",
  approved: "lightgreen",
  rejected: "salmon",
};

const AdminJobPayClaimsPanel: React.FC = () => {
  const [claims, setClaims] = useState<JobPayClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  async function load(status?: string) {
    const res = await getJobPayClaims(status && status !== "all" ? { status } : undefined);
    setClaims(res.data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getJobPayClaims(filter !== "all" ? { status: filter } : undefined);
        if (!cancelled) {
          setClaims(res.data);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load claims.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [filter]);

  async function handleApprove(claim: JobPayClaim) {
    setActionId(claim.id);
    setError(null);
    try {
      await approveJobPayClaim(claim.id, reviewNotes[claim.id] ?? undefined);
      setNotice(`Claim #${claim.id} approved — payment item queued.`);
      await load(filter !== "all" ? filter : undefined);
    } catch (e: any) {
      setError(e?.message ?? "Failed to approve.");
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(claim: JobPayClaim) {
    setActionId(claim.id);
    setError(null);
    try {
      await rejectJobPayClaim(claim.id, reviewNotes[claim.id] ?? undefined);
      setNotice(`Claim #${claim.id} rejected.`);
      await load(filter !== "all" ? filter : undefined);
    } catch (e: any) {
      setError(e?.message ?? "Failed to reject.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="panel">
      <h2 className="h2">Pay Claim Review</h2>
      <p className="small">Review member-submitted pay claims. Approving a claim creates a pending payment item.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={filter === s ? BTN_SM : BTN_GHOST_SM}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {notice && <p className="small" style={{ color: "lightgreen" }}>{notice}</p>}
      {error && <p className="small" style={{ color: "salmon" }}>{error}</p>}

      {loading ? (
        <p className="small">Loading…</p>
      ) : claims.length === 0 ? (
        <p className="small">No claims found.</p>
      ) : (
        claims.map((claim) => (
          <div key={claim.id} className="flex flex-col gap-4" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
              <div>
                <strong>{claim.pay_rate?.name ?? `Pay Rate #${claim.job_pay_rate_id}`}</strong>
                <span className="small" style={{ marginLeft: 8, opacity: 0.6 }}>
                  by {claim.claimant_handle ?? `User #${claim.claimant_user_id}`}
                </span>
              </div>
              <span className="small" style={{ color: statusColor[claim.status] ?? "inherit" }}>
                {statusLabel[claim.status] ?? claim.status}
              </span>
            </div>
            <p className="small" style={{ margin: "4px 0 0" }}>
              {claim.quantity} × {claim.pay_rate?.unit_label ?? "unit"} ·{" "}
              <strong>{(claim.total_amount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 })}m credits</strong>
              {claim.include_bonus && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>(includes bonus)</span>
              )}
            </p>
            {claim.notes && (
              <p className="small" style={{ margin: "4px 0 0", opacity: 0.75 }}>
                Notes: {claim.notes}
              </p>
            )}
            <p className="small" style={{ margin: "4px 0 0", opacity: 0.5 }}>
              Submitted {claim.created_at ? new Date(claim.created_at).toLocaleDateString() : "—"}
            </p>

            {claim.status === "pending" && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  className={INPUT}
                  type="text"
                  placeholder="Reviewer note (optional)"
                  value={reviewNotes[claim.id] ?? ""}
                  onChange={(e) => setReviewNotes((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                  style={{ maxWidth: 400 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={BTN_SM + " all"}
                    disabled={actionId === claim.id}
                    onClick={() => handleApprove(claim)}
                  >
                    {actionId === claim.id ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={BTN_SM}
                    disabled={actionId === claim.id}
                    onClick={() => handleReject(claim)}
                    style={{ color: "salmon" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {claim.status !== "pending" && claim.review_note && (
              <p className="small" style={{ margin: "4px 0 0", opacity: 0.6 }}>
                Reviewer note: {claim.review_note}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default AdminJobPayClaimsPanel;
