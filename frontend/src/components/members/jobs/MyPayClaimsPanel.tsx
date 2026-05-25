import React from "react";
import type { JobPayClaim } from "../../../api/jobs/jobPayRates";

type Props = {
  claims: JobPayClaim[];
};

const statusLabel: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

const statusColor: Record<string, string> = {
  pending: "inherit",
  approved: "lightgreen",
  rejected: "salmon",
};

const MyPayClaimsPanel: React.FC<Props> = ({ claims }) => {
  return (
    <div className="panel">
      <h2 className="h2">My Pay Claims</h2>
      {claims.length === 0 && <p className="small">You have not submitted any pay claims yet.</p>}
      {claims.map((claim) => (
        <div key={claim.id} className="flex flex-col gap-4" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <strong>{claim.pay_rate?.name ?? `Pay Rate #${claim.job_pay_rate_id}`}</strong>
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
          {claim.review_note && (
            <p className="small" style={{ margin: "4px 0 0", opacity: 0.75 }}>
              Reviewer note: {claim.review_note}
            </p>
          )}
          <p className="small" style={{ margin: "4px 0 0", opacity: 0.5 }}>
            Submitted {claim.created_at ? new Date(claim.created_at).toLocaleDateString() : "—"}
          </p>
        </div>
      ))}
    </div>
  );
};

export default MyPayClaimsPanel;
