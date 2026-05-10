import React, { useEffect, useState } from "react";
import {
  confirmMaterialOrder,
  fulfillOrder,
  getMyListings,
  getPendingFulfillment,
  markOrderComplete,
  refundOrder,
  retryTransfer,
} from "../../api/market";
import type { MarketListing, MarketOrder } from "../../api/market";
import MarketListingCard from "./MarketListingCard";
import MarketConfirmDialog from "./MarketConfirmDialog";
import { formatMarketName } from "./marketDisplay";

function formatCredits(n: number): string {
  return n.toLocaleString() + " Credits";
}

type ConfirmDialogState =
  | {
      kind: "refund";
      order: MarketOrder;
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "complete";
      order: MarketOrder;
      title: string;
      message: string;
      confirmLabel: string;
    }
  | null;

const MarketMyListingsTab: React.FC = () => {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [pendingOrders, setPendingOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<Record<number, "fulfilling" | "confirming" | "retrying" | "completing" | "refunding" | null>>({});
  const [actionMessages, setActionMessages] = useState<Record<number, { ok: boolean; text: string }>>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  function load() {
    setLoading(true);
    Promise.all([
      getMyListings().then((r) => setListings(r.data ?? [])).catch(() => setListings([])),
      getPendingFulfillment().then((r) => setPendingOrders(r.data ?? [])).catch(() => setPendingOrders([])),
    ]).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleFulfill(order: MarketOrder) {
    setActionStates((s) => ({ ...s, [order.id]: "fulfilling" }));
    setActionMessages((m) => { const next = { ...m }; delete next[order.id]; return next; });
    try {
      const res = await fulfillOrder(order.id);
      setActionMessages((m) => ({ ...m, [order.id]: { ok: res.ok, text: res.message } }));
      if (res.ok) load();
    } catch (e: any) {
      setActionMessages((m) => ({ ...m, [order.id]: { ok: false, text: e?.message ?? "Failed." } }));
    } finally {
      setActionStates((s) => ({ ...s, [order.id]: null }));
    }
  }

  async function runRefund(order: MarketOrder) {
    setActionStates((s) => ({ ...s, [order.id]: "refunding" }));
    setActionMessages((m) => { const next = { ...m }; delete next[order.id]; return next; });
    try {
      const res = await refundOrder(order.id);
      setActionMessages((m) => ({ ...m, [order.id]: { ok: res.ok, text: res.message } }));
      if (res.ok) load();
    } catch (e: any) {
      setActionMessages((m) => ({ ...m, [order.id]: { ok: false, text: e?.message ?? "Refund failed." } }));
    } finally {
      setActionStates((s) => ({ ...s, [order.id]: null }));
    }
  }

  function handleRefund(order: MarketOrder) {
    setConfirmDialog({
      kind: "refund",
      order,
      title: "Refund Order",
      message: `Refund ${formatCredits(order.total_credits)} to ${order.buyer?.handle ?? "buyer"}? This will send the credits back via SWC and cancel the order.`,
      confirmLabel: "Refund Credits",
    });
  }

  async function handleRetry(order: MarketOrder) {
    setActionStates((s) => ({ ...s, [order.id]: "retrying" }));
    setActionMessages((m) => { const next = { ...m }; delete next[order.id]; return next; });
    try {
      const res = await retryTransfer(order.id);
      setActionMessages((m) => ({ ...m, [order.id]: { ok: res.ok, text: res.message } }));
      if (res.ok) load();
    } catch (e: any) {
      setActionMessages((m) => ({ ...m, [order.id]: { ok: false, text: e?.message ?? "Failed." } }));
    } finally {
      setActionStates((s) => ({ ...s, [order.id]: null }));
    }
  }

  async function runMarkComplete(order: MarketOrder) {
    setActionStates((s) => ({ ...s, [order.id]: "completing" }));
    setActionMessages((m) => { const next = { ...m }; delete next[order.id]; return next; });
    try {
      const res = await markOrderComplete(order.id);
      setActionMessages((m) => ({ ...m, [order.id]: { ok: res.ok, text: res.message } }));
      if (res.ok) load();
    } catch (e: any) {
      setActionMessages((m) => ({ ...m, [order.id]: { ok: false, text: e?.message ?? "Failed." } }));
    } finally {
      setActionStates((s) => ({ ...s, [order.id]: null }));
    }
  }

  function handleMarkComplete(order: MarketOrder) {
    setConfirmDialog({
      kind: "complete",
      order,
      title: "Mark Order Complete",
      message: "Only confirm this if the transfer has already been resolved outside the system.",
      confirmLabel: "Mark Complete",
    });
  }

  async function handleConfirmDialog() {
    if (!confirmDialog) return;
    const current = confirmDialog;
    setConfirmDialog(null);

    if (current.kind === "refund") {
      await runRefund(current.order);
      return;
    }

    await runMarkComplete(current.order);
  }

  async function handleConfirmMaterial(order: MarketOrder) {
    setActionStates((s) => ({ ...s, [order.id]: "confirming" }));
    setActionMessages((m) => { const next = { ...m }; delete next[order.id]; return next; });
    try {
      const res = await confirmMaterialOrder(order.id);
      setActionMessages((m) => ({ ...m, [order.id]: { ok: res.ok, text: res.message } }));
      if (res.ok) load();
    } catch (e: any) {
      setActionMessages((m) => ({ ...m, [order.id]: { ok: false, text: e?.message ?? "Failed." } }));
    } finally {
      setActionStates((s) => ({ ...s, [order.id]: null }));
    }
  }

  if (loading) return <p className="market-empty">Loading…</p>;

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {pendingOrders.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 className="h3" style={{ margin: 0 }}>Awaiting Fulfillment</h3>
          {pendingOrders.map((order) => {
            const isMaterial = order.listing?.entity_type === "material";
            const isCustom = order.listing?.sale_type === "custom";
            const isDisputed = order.status === "disputed";
            const isTransferPending = order.status === "transfer_pending";
            const action = actionStates[order.id];
            const msg = actionMessages[order.id];

            const statusColor = isDisputed ? "#f87171" : isTransferPending ? "#a78bfa" : "#60a5fa";
            const statusLabel = isDisputed ? "Disputed" : isTransferPending ? "Transfer Pending" : "Paid — Awaiting Transfer";

            return (
              <div key={order.id} className="market-card" style={{ maxWidth: 520 }}>
                <div className="market-card__eyebrow">
                  <span className="market-badge market-badge--entity">{order.listing?.entity_type ?? "—"}</span>
                  <span className="small" style={{ marginLeft: "auto", color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>

                <p className="market-card__name">{formatMarketName(order.listing?.entity_name)}</p>

                <p className="market-card__meta">
                  {order.quantity > 1 && `Qty: ${order.quantity.toLocaleString()} · `}
                  {formatCredits(order.total_credits)}
                  {order.buyer?.handle && ` · Buyer: ${order.buyer.handle}`}
                </p>

                <p className="small muted">Ref: {order.order_reference}</p>

                {isDisputed && order.dispute_note && !msg && (
                  <p className="small" style={{ color: "#f87171" }}>{order.dispute_note}</p>
                )}

                {msg && (
                  <p className="small" style={{ color: msg.ok ? "#4ade80" : "#f87171" }}>{msg.text}</p>
                )}

                <div className="market-card__actions">
                  {isCustom ? (
                    <>
                      <button className="btn" type="button" onClick={() => handleMarkComplete(order)} disabled={!!action}>
                        {action === "completing" ? "Completing…" : "Mark Complete"}
                      </button>
                      <button className="btn btn--ghost" type="button" onClick={() => handleRefund(order)} disabled={!!action}>
                        {action === "refunding" ? "Refunding…" : "Refund"}
                      </button>
                    </>
                  ) : (
                    <>
                      {isDisputed && (
                        <>
                          {!isMaterial && (
                            <button className="btn" type="button" onClick={() => handleRetry(order)} disabled={!!action}>
                              {action === "retrying" ? "Retrying…" : "Retry Transfer"}
                            </button>
                          )}
                          <button className="btn btn--ghost" type="button" onClick={() => handleMarkComplete(order)} disabled={!!action}>
                            {action === "completing" ? "Completing…" : "Mark Complete"}
                          </button>
                          <button className="btn btn--ghost" type="button" onClick={() => handleRefund(order)} disabled={!!action}>
                            {action === "refunding" ? "Refunding…" : "Refund"}
                          </button>
                        </>
                      )}
                      {!isDisputed && (
                        <button className="btn btn--ghost" type="button" onClick={() => handleRefund(order)} disabled={!!action}>
                          {action === "refunding" ? "Refunding…" : "Refund"}
                        </button>
                      )}
                      {!isDisputed && !isTransferPending && !isMaterial && (
                        <button className="btn" type="button" onClick={() => handleFulfill(order)} disabled={!!action}>
                          {action === "fulfilling" ? "Transferring…" : "Transfer via SWC"}
                        </button>
                      )}
                      {!isDisputed && !isTransferPending && isMaterial && (
                        <button className="btn" type="button" onClick={() => handleFulfill(order)} disabled={!!action}>
                          {action === "fulfilling" ? "Processing…" : "Mark as Sending"}
                        </button>
                      )}
                      {!isDisputed && isTransferPending && isMaterial && (
                        <button className="btn" type="button" onClick={() => handleConfirmMaterial(order)} disabled={!!action}>
                          {action === "confirming" ? "Confirming…" : "Confirm Sent"}
                        </button>
                      )}
                      {!isDisputed && isTransferPending && !isMaterial && (
                        <button className="btn btn--ghost" type="button" onClick={() => handleMarkComplete(order)} disabled={!!action}>
                          {action === "completing" ? "Completing…" : "Mark Complete"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {listings.length === 0 && pendingOrders.length === 0 && (
        <p className="market-empty">You have no active listings.</p>
      )}

      {listings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {pendingOrders.length > 0 && <h3 className="h3" style={{ margin: 0 }}>Active Listings</h3>}
          <div className="market-grid">
            {listings.map((listing) => (
              <MarketListingCard
                key={listing.id}
                listing={listing}
                isMine
                onCancelled={load}
              />
            ))}
          </div>
        </div>
      )}
    </div>

    {confirmDialog && (
      <MarketConfirmDialog
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={handleConfirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    )}
    </>
  );
};

export default MarketMyListingsTab;
