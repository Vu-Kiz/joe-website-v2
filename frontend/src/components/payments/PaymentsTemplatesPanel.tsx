import type { ManualPaymentTemplate } from "../../api/manualPayments";

type Props = {
  templates?: ManualPaymentTemplate[];
};

const PaymentsTemplatesPanel = ({ templates = [] }: Props) => {
  return (
    <div className="panel">
      <h2>Manual Templates</h2>
      <p className="small">
        This area is still being migrated. The tab now routes correctly, but
        full template management is not wired up yet.
      </p>

      {templates.length === 0 ? (
        <p className="small">No manual templates are being displayed yet.</p>
      ) : (
        templates.map((template) => (
          <div
            key={template.id}
            className="admin-card"
            style={{ marginBottom: 12 }}
          >
            <strong>{template.name}</strong>
            <p className="small">
              Payer: {template.payer_label ?? "Unknown"} · Payee:{" "}
              {template.payee_handle ?? template.payee_label ?? "Unknown"}
            </p>
            <p className="small">
              Total: {template.total_amount.toLocaleString()} · Status:{" "}
              {template.status}
            </p>
          </div>
        ))
      )}
    </div>
  );
};

export default PaymentsTemplatesPanel;
