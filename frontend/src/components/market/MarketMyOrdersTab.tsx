import React, { useEffect, useState } from "react";
import { cancelOrder, getMyOrders, payOrder } from "../../api/market";
import type { MarketOrder } from "../../api/market";
import MarketConfirmDialog from "./MarketConfirmDialog";
import { formatMarketName } from "./marketDisplay";

function formatCredits(n: number): string {
  return n.toLocaleString() + " Credits";
}

function statusLabel(status: MarketOrder["status"]): string {
  switch (status) {
    case "pending_payment": return "Awaiting Payment";
    case "paid": return "Paid — Awaiting Transfer";
    case "transfer_pending": return "Transfer In Progress";
    case "completed": return "Completed";
    case "disputed": return "Disputed";
    case "cancelled": return "Cancelled";
  }
}

function statusColor(status: MarketOrder["status"]): string {
  switch (status) {
    case "pending_payment": return "#facc15";
    case "paid": return "#60a5fa";
    case "transfer_pending": return "#a78bfa";
    case "completed": return "#4ade80";
    case "disputed": return "#f87171";
    case "cancelled": return "rgba(255,255,255,0.3)";
  }
}

type PayResult = {
  ok: boolean;
  message: string;
  needs_payments_access?: boolean;
  reference?: string;
  payee_handle?: string;
  amount?: number;
};

const MarketMyOrdersTab: React.FC<{ hasPaymentsAccess: boolean }> = ({ hasPaymentsAccess }) => {
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<number | null>(null);
  const [payResults, setPayResults] = useState<Record<number, PayResult>>({});
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<MarketOrder | null>(null);

  function load() {
    setLoading(true);
    getMyOrders()
      .then((res) => setOrders(res.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handlePay(orderId: number) {
    setPaying(orderId);
    try {
      const res = await payOrder(orderId);
      if (res.ok) {
        setPayResults((prev) => ({ ...prev, [orderId]: { ok: true, message: res.message } }));
        load();
      } else {
        setPayResults((prev) => ({ ...prev, [orderId]: res as PayResult }));
      }
    } catch (e: any) {
      setPayResults((prev) => ({ ...prev, [orderId]: { ok: false, message: e?.message ?? "Payment failed." } }));
    } finally {
      setPaying(null);
    }
  }

  async function handleCancel(orderId: number) {
    setCancelling(orderId);
    try {
      await cancelOrder(orderId);
      load();
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <p className="market-empty">Loading…</p>;
  if (orders.length === 0) return <p className="market-empty">You have no active orders.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {orders.map((order) => {
        const payResult = payResults[order.id];
        return (
          <div key={order.id} className="market-card" style={{ maxWidth: 520 }}>
            <div className="market-card__eyebrow">
              <span className="market-badge market-badge--entity">{order.listing?.entity_type ?? "—"}</span>
              <span className="small" style={{ marginLeft: "auto", color: statusColor(order.status) }}>
                {statusLabel(order.status)}
              </span>
            </div>

            <p className="market-card__name">{formatMarketName(order.listing?.entity_name)}</p>

            <p className="market-card__meta">
              {order.quantity > 1 && `Qty: ${order.quantity.toLocaleString()} · `}
              Total: <strong>{formatCredits(order.total_credits)}</strong>
            </p>

            {order.status === "pending_payment" && !payResult?.ok && (
              <>
                <div className="market-order-box">
                  <p className="small muted">Reference</p>
                  <div className="market-order-box__ref">{order.order_reference}</div>
                  {payResult?.needs_payments_access ? (
                    <p className="small" style={{ color: "#facc15", marginTop: "0.5rem" }}>
                      {payResult.message}
                    </p>
                  ) : payResult && !payResult.ok ? (
                    <p className="small" style={{ color: "#f87171", marginTop: "0.5rem" }}>{payResult.message}</p>
                  ) : (
                    <p className="small muted" style={{ marginTop: "0.25rem" }}>
                      Expires {order.expires_at ? new Date(order.expires_at).toLocaleTimeString() : "soon"}.
                    </p>
                  )}
                </div>

                <div className="market-card__actions">
                  {hasPaymentsAccess ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => handlePay(order.id)}
                      disabled={paying === order.id}
                    >
                      {paying === order.id ? "Paying…" : `Pay ${formatCredits(order.total_credits)} via SWC`}
                    </button>
                  ) : (
                    <div>
                      <p className="small muted">Link Chain Code Verification (Payments) on your About Me page to pay.</p>
                      <a className="btn btn--ghost" href="/aboutme">Open About Me</a>
                    </div>
                  )}
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => setOrderToCancel(order)}
                    disabled={cancelling === order.id}
                  >
                    {cancelling === order.id ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
              </>
            )}

            {payResult?.ok && (
              <p className="small" style={{ color: "#4ade80" }}>✓ {payResult.message}</p>
            )}
          </div>
        );
      })}
      {orderToCancel && (
        <MarketConfirmDialog
          title="Cancel Order"
          message={`Cancel your order for ${formatMarketName(orderToCancel.listing?.entity_name)}? This will release the reservation and remove the payment step.`}
          confirmLabel="Cancel Order"
          onConfirm={() => {
            const current = orderToCancel;
            setOrderToCancel(null);
            void handleCancel(current.id);
          }}
          onClose={() => setOrderToCancel(null)}
        />
      )}
    </div>
  );
};

export default MarketMyOrdersTab;
