import React, { useEffect, useState } from "react";
import { createOrder, payOrder } from "../../api/market";
import { useCart } from "./CartContext";
import { formatMarketName } from "./marketDisplay";

type PaymentResult = {
  orderId: number;
  listingName: string;
  reference: string;
  payeeHandle: string;
  amount: number;
  quantity: number;
  isMaterial: boolean;
};

type Props = {
  onClose: () => void;
  hasPaymentsAccess: boolean;
};

function formatCredits(n: number): string {
  return n.toLocaleString() + " Credits";
}

const CartSidebar: React.FC<Props> = ({ onClose, hasPaymentsAccess }) => {
  const { items, remove, updateQty, clear } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [results, setResults] = useState<PaymentResult[]>([]);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [payStates, setPayStates] = useState<Record<number, { ok: boolean; message: string }>>({});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const grandTotal = items.reduce((sum, item) => {
    const qty = item.listing.entity_type === "material" ? item.quantity : 1;
    return sum + item.listing.price_credits * qty;
  }, 0);

  async function handleCheckout() {
    setCheckingOut(true);
    setResults([]);
    setErrors([]);
    setPayStates({});

    const successes: PaymentResult[] = [];
    const failures: { name: string; message: string }[] = [];

    for (const item of items) {
      const isMat = item.listing.entity_type === "material";
      const qty = isMat ? item.quantity : 1;
      try {
        const res = await createOrder(item.listing.id, qty);
        successes.push({
          orderId: res.data.id,
          listingName: formatMarketName(item.listing.entity_name),
          reference: res.payment.reference,
          payeeHandle: res.payment.payee_handle,
          amount: res.payment.amount,
          quantity: qty,
          isMaterial: isMat,
        });
      } catch (e: any) {
        failures.push({ name: formatMarketName(item.listing.entity_name), message: e?.message ?? "Failed to place order." });
      }
    }

    setResults(successes);
    setErrors(failures);
    if (successes.length > 0) clear();
    setCheckingOut(false);
  }

  async function handlePay(orderId: number) {
    setPayingOrderId(orderId);
    try {
      const res = await payOrder(orderId);
      if (res.ok) {
        setPayStates((prev) => ({
          ...prev,
          [orderId]: { ok: true, message: res.message },
        }));
      } else {
        setPayStates((prev) => ({
          ...prev,
          [orderId]: { ok: false, message: res.message },
        }));
      }
    } catch (e: any) {
      setPayStates((prev) => ({
        ...prev,
        [orderId]: { ok: false, message: e?.message ?? "Payment failed." },
      }));
    } finally {
      setPayingOrderId(null);
    }
  }

  async function handlePayAll() {
    for (const result of results) {
      if (!payStates[result.orderId]?.ok) {
        // eslint-disable-next-line no-await-in-loop
        await handlePay(result.orderId);
      }
    }
  }

  const pendingResultCount = results.filter((result) => !payStates[result.orderId]?.ok).length;

  return (
    <div className="cart-sidebar">
      <div className="cart-sidebar__header">
        <h2 className="cart-sidebar__title">Cart</h2>
        <button className="btn btn--ghost" type="button" onClick={onClose}>Close</button>
      </div>

      {results.length > 0 && (
        <div className="cart-sidebar__results">
          <p className="small muted" style={{ marginBottom: "0.75rem" }}>
            Orders placed. You can pay for them here now, or close this and pay later from My Orders.
          </p>
          {hasPaymentsAccess ? (
            <button
              className="btn"
              type="button"
              onClick={handlePayAll}
              disabled={payingOrderId !== null || pendingResultCount === 0}
            >
              {payingOrderId !== null ? "Processing Payment…" : pendingResultCount > 0 ? `Pay Remaining (${pendingResultCount})` : "All Paid"}
            </button>
          ) : (
            <div className="cart-result-item__access-note">
              <p className="small muted" style={{ margin: 0 }}>
                Link Chain Code Verification (Payments) on your About Me page to pay from the cart.
              </p>
              <a className="btn btn--ghost" href="/aboutme">Open About Me</a>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className="cart-result-item">
              <p className="small" style={{ margin: "0 0 0.25rem" }}>
                <strong>{r.listingName}</strong>{r.isMaterial && ` · ${r.quantity.toLocaleString()} units`}
              </p>
              <p className="small" style={{ margin: "0 0 0.25rem" }}>
                Send <strong>{formatCredits(r.amount)}</strong> to <strong>{r.payeeHandle}</strong>
              </p>
              <div className="market-order-box__ref">{r.reference}</div>
              {r.isMaterial && <p className="small muted" style={{ marginTop: "0.25rem" }}>⚠ Material transfer must be completed manually in SWC by the seller.</p>}
              <div className="cart-result-item__actions">
                {hasPaymentsAccess ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => handlePay(r.orderId)}
                    disabled={payingOrderId === r.orderId || Boolean(payStates[r.orderId]?.ok)}
                  >
                    {payStates[r.orderId]?.ok
                      ? "Paid"
                      : payingOrderId === r.orderId
                      ? "Paying…"
                      : `Pay ${formatCredits(r.amount)}`}
                  </button>
                ) : (
                  <a className="btn btn--ghost" href="/aboutme">Enable Payments</a>
                )}
              </div>
              {payStates[r.orderId] && (
                <p
                  className="small"
                  style={{
                    margin: "0.5rem 0 0",
                    color: payStates[r.orderId]?.ok ? "#4ade80" : "#f87171",
                  }}
                >
                  {payStates[r.orderId]?.ok ? `✓ ${payStates[r.orderId]?.message}` : payStates[r.orderId]?.message}
                </p>
              )}
            </div>
          ))}
          {errors.map((e, i) => (
            <p key={i} className="small" style={{ color: "#f87171" }}>Failed: {e.name} — {e.message}</p>
          ))}
        </div>
      )}

      {results.length === 0 && items.length === 0 && (
        <p className="cart-sidebar__empty">Your cart is empty.</p>
      )}

      {results.length === 0 && items.length > 0 && (
        <>
          <div className="cart-sidebar__items">
            {items.map((item) => {
              const isMat = item.listing.entity_type === "material";
              const qty = isMat ? item.quantity : 1;
              const lineTotal = item.listing.price_credits * qty;
              return (
                <div key={item.listing.id} className="cart-item">
                  {item.listing.entity_image_url && (
                    <img className="cart-item__image" src={item.listing.entity_image_url} alt={formatMarketName(item.listing.entity_name)} />
                  )}
                  <div className="cart-item__info">
                    <p className="cart-item__name">{formatMarketName(item.listing.entity_name)}</p>
                    <p className="small muted" style={{ margin: 0 }}>{formatCredits(lineTotal)}</p>
                    {isMat && (
                      <div className="market-card__qty-controls" style={{ marginTop: "0.25rem" }}>
                        <button className="market-card__qty-btn" type="button" onClick={() => updateQty(item.listing.id, item.quantity - 1)} disabled={item.quantity <= 1}>−</button>
                        <input
                          className="market-card__qty-input"
                          type="number"
                          min={1}
                          max={item.listing.quantity_available}
                          value={item.quantity}
                          onChange={(e) => updateQty(item.listing.id, parseInt(e.target.value) || 1)}
                        />
                        <button className="market-card__qty-btn" type="button" onClick={() => updateQty(item.listing.id, item.quantity + 1)} disabled={item.quantity >= item.listing.quantity_available}>+</button>
                      </div>
                    )}
                  </div>
                  <button className="cart-item__remove" type="button" onClick={() => remove(item.listing.id)}>✕</button>
                </div>
              );
            })}
          </div>

          <div className="cart-sidebar__footer">
            <p className="cart-sidebar__total">Total: <strong>{formatCredits(grandTotal)}</strong></p>
            <button className="btn" style={{ width: "100%" }} type="button" onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? "Placing Orders…" : `Checkout (${items.length} item${items.length !== 1 ? "s" : ""})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CartSidebar;
