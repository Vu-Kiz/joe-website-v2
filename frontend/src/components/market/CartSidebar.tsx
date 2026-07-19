import React, { useEffect, useState } from "react";
import { createOrder, payOrder } from "../../api/market/market";
import { useCart } from "./CartContext";
import { formatMarketName } from "./marketDisplay";
import { BTN, BTN_GHOST } from "../../utils/ui";

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

const QTY_BTN = "bg-white/[0.06] border border-white/[0.12] rounded-[6px] text-white/70 cursor-pointer text-[0.9rem] leading-none px-[0.6rem] py-[0.3rem] transition-[background] duration-150 hover:not-disabled:bg-white/[0.12] hover:not-disabled:text-white disabled:opacity-35 disabled:cursor-default font-tektur";
const QTY_INPUT = "bg-white/[0.06] border border-white/[0.12] rounded-[6px] text-white text-[0.9rem] px-2 py-[0.3rem] text-center w-[70px] font-tektur";

const CartSidebar: React.FC<Props> = ({ onClose, hasPaymentsAccess }) => {
  const { items, remove, updateQty, clear } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [results, setResults] = useState<PaymentResult[]>([]);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [payStates, setPayStates] = useState<Record<number, { ok: boolean; message: string }>>({});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
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
      setPayStates((prev) => ({ ...prev, [orderId]: { ok: res.ok, message: res.message } }));
    } catch (e: any) {
      setPayStates((prev) => ({ ...prev, [orderId]: { ok: false, message: e?.message ?? "Payment failed." } }));
    } finally {
      setPayingOrderId(null);
    }
  }

  async function handlePayAll() {
    for (const result of results) {
      if (!payStates[result.orderId]?.ok) await handlePay(result.orderId);
    }
  }

  const pendingResultCount = results.filter((result) => !payStates[result.orderId]?.ok).length;

  return (
    <div
      className="relative flex flex-col gap-3 w-full max-h-[min(86vh,920px)] overflow-hidden rounded-[16px] border border-white/10 p-4"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015)), var(--bg-panel, #1a1c22)", boxShadow: "0 20px 44px rgba(0,0,0,0.5)" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-[1.1rem] font-semibold">Cart</h2>
        <button className={BTN_GHOST} type="button" onClick={onClose}>Close</button>
      </div>

      {results.length > 0 && (
        <div className="flex flex-col flex-1 gap-3 min-h-0 overflow-y-auto pr-[0.15rem]">
          <p className="small muted" style={{ marginBottom: "0.75rem" }}>
            Orders placed. You can pay for them here now, or close this and pay later from My Orders.
          </p>
          {hasPaymentsAccess ? (
            <button className={BTN} type="button" onClick={handlePayAll} disabled={payingOrderId !== null || pendingResultCount === 0}>
              {payingOrderId !== null ? "Processing Payment…" : pendingResultCount > 0 ? `Pay Remaining (${pendingResultCount})` : "All Paid"}
            </button>
          ) : (
            <div className="flex flex-col gap-[0.6rem] p-[0.8rem] border border-white/[0.08] rounded-[10px] bg-white/[0.025]">
              <p className="small muted" style={{ margin: 0 }}>Link Chain Code Verification (Payments) on your About Me page to pay from the cart.</p>
              <a className={BTN_GHOST} href="/aboutme">Open About Me</a>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className="bg-white/[0.03] rounded-[8px] p-3">
              <p className="small" style={{ margin: "0 0 0.25rem" }}>
                <strong>{r.listingName}</strong>{r.isMaterial && ` · ${r.quantity.toLocaleString()} units`}
              </p>
              <p className="small" style={{ margin: "0 0 0.25rem" }}>
                Send <strong>{formatCredits(r.amount)}</strong> to <strong>{r.payeeHandle}</strong>
              </p>
              <div className="font-mono text-[1rem] font-bold text-[#ffd875]">{r.reference}</div>
              {r.isMaterial && <p className="small muted" style={{ marginTop: "0.25rem" }}>⚠ Material transfer must be completed manually in SWC by the seller.</p>}
              <div className="flex gap-2 mt-[0.65rem]">
                {hasPaymentsAccess ? (
                  <button className={BTN + " w-full"} type="button" onClick={() => handlePay(r.orderId)} disabled={payingOrderId === r.orderId || Boolean(payStates[r.orderId]?.ok)}>
                    {payStates[r.orderId]?.ok ? "Paid" : payingOrderId === r.orderId ? "Paying…" : `Pay ${formatCredits(r.amount)}`}
                  </button>
                ) : (
                  <a className={BTN_GHOST + " w-full"} href="/aboutme">Enable Payments</a>
                )}
              </div>
              {payStates[r.orderId] && (
                <p className="small" style={{ margin: "0.5rem 0 0", color: payStates[r.orderId]?.ok ? "#4ade80" : "#f87171" }}>
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
        <p className="text-white/[var(--text-muted,0.55)] text-[0.9rem] text-center">Your cart is empty.</p>
      )}

      {results.length === 0 && items.length > 0 && (
        <>
          <div className="flex flex-col flex-1 gap-3 min-h-0 overflow-y-auto pr-[0.15rem]">
            {items.map((item) => {
              const isMat = item.listing.entity_type === "material";
              const qty = isMat ? item.quantity : 1;
              const lineTotal = item.listing.price_credits * qty;
              return (
                <div key={item.listing.id} className="flex items-start gap-3 bg-white/[0.03] rounded-[8px] p-3">
                  {item.listing.entity_image_url && (
                    <img className="shrink-0 w-12 h-12 rounded-[4px] object-contain" src={item.listing.entity_image_url} alt={formatMarketName(item.listing.entity_name)} />
                  )}
                  <div className="flex flex-1 flex-col gap-[0.15rem] min-w-0">
                    <p className="m-0 text-[0.9rem] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{formatMarketName(item.listing.entity_name)}</p>
                    <p className="small muted" style={{ margin: 0 }}>{formatCredits(lineTotal)}</p>
                    {isMat && (
                      <div className="flex items-center gap-[0.35rem] mt-1">
                        <button className={QTY_BTN} type="button" onClick={() => updateQty(item.listing.id, item.quantity - 1)} disabled={item.quantity <= 1}>−</button>
                        <input
                          className={QTY_INPUT}
                          type="number"
                          min={1}
                          max={item.listing.quantity_available}
                          value={item.quantity}
                          onChange={(e) => updateQty(item.listing.id, parseInt(e.target.value) || 1)}
                        />
                        <button className={QTY_BTN} type="button" onClick={() => updateQty(item.listing.id, item.quantity + 1)} disabled={item.quantity >= item.listing.quantity_available}>+</button>
                      </div>
                    )}
                  </div>
                  <button className="shrink-0 bg-transparent border-0 text-white/[var(--text-muted,0.55)] cursor-pointer text-[0.8rem] px-[0.25rem] py-[0.1rem] hover:text-[#f87171] font-tektur" type="button" onClick={() => remove(item.listing.id)}>✕</button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-3">
            <p className="m-0 text-[1rem]">Total: <strong>{formatCredits(grandTotal)}</strong></p>
            <button className={BTN + " w-full"} type="button" onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? "Placing Orders…" : `Checkout (${items.length} item${items.length !== 1 ? "s" : ""})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CartSidebar;
