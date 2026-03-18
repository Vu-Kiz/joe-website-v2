import React from "react";
import type { PaymentItem } from "../../api/payments";

type Props = {
  items: PaymentItem[];
};

const OwedPaymentsPanel: React.FC<Props> = ({ items }) => {
  return (
    <div className="panel">
      <h2>Owed To Me</h2>

      {items.length === 0 && (
        <p className="small">Nothing is currently owed to you.</p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className="admin-card"
          style={{ marginBottom: 12 }}
        >
          <strong>{item.tool_key}</strong>
          <p className="small">
            Source: {item.source_type} #{item.source_id}
          </p>
          <p className="small">
            Payer: {item.payer_label ?? "-"} · Total:{" "}
            {item.total_amount.toLocaleString()} · Status: {item.status}
          </p>
        </div>
      ))}
    </div>
  );
};

export default OwedPaymentsPanel;