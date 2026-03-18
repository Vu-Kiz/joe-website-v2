import React from "react";
import type { PaymentTransfer } from "../../api/payments";

type Props = {
  transfers: PaymentTransfer[];
  onVerifyTransfer: (id: number) => Promise<void>;
};

const PaymentHistoryPanel: React.FC<Props> = ({
  transfers,
  onVerifyTransfer,
}) => {
  return (
    <div className="panel">
      <h2>History</h2>

      {transfers.length === 0 && (
        <p className="small">No transfer history yet.</p>
      )}

      {transfers.map((transfer) => (
        <div
          key={transfer.id}
          className="admin-card"
          style={{ marginBottom: 12 }}
        >
          <strong>{transfer.payee_handle ?? transfer.payee_label ?? "Unknown"}</strong>

          <p className="small">
            Ref: {transfer.reference} · Total:{" "}
            {transfer.total_amount.toLocaleString()}
          </p>

          <p className="small">
            Method: {transfer.payment_method} · Status: {transfer.status}
          </p>

          {transfer.communication && (
            <p className="small">Communication: {transfer.communication}</p>
          )}

          {transfer.verified_transaction_id && (
            <p className="small">
              Verified SWC transaction: {transfer.verified_transaction_id}
            </p>
          )}

          {transfer.status !== "verified" && transfer.status !== "paid" && (
            <button
              className="btn"
              type="button"
              onClick={() => onVerifyTransfer(transfer.id)}
            >
              Verify in Credit Log
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default PaymentHistoryPanel;