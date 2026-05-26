import React, { useCallback, useEffect, useState } from "react";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/core/auth";
import {
  getStoreCatalog,
  getSubscribeQuote,
  sendSubscription,
  type StorePlan,
  type StorePlanSeatTier,
  type PublicTool,
  type StoreSubscription,
} from "../api/market/toolStore";
import { getMyFactions, type PayableFaction } from "../api/factions/factions";
import { BTN, BTN_SM, INPUT} from "../utils/ui";

function formatCredits(n: number): string {
  return n.toLocaleString() + " Cr";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Subscribe modal
// ---------------------------------------------------------------------------

type ModalState =
  | { stage: "confirm"; plan: StorePlan; price: number; seatCount: number | null; perSeat: boolean; perSeatPrice: number | null; payeeConfigured: boolean }
  | { stage: "sending" }
  | { stage: "success"; periodEnd: string | null }
  | { stage: "error"; message: string };

type SubscribeModalProps = {
  plan: StorePlan;
  user: SwcUser | null;
  factions: PayableFaction[];
  onClose: () => void;
  onSuccess: () => void;
};

const SubscribeModal: React.FC<SubscribeModalProps> = ({ plan, user, factions, onClose, onSuccess }) => {
  const isFactionPlan = plan.key === "faction";
  const [subscriberType] = useState<"user" | "faction">(isFactionPlan ? "faction" : "user");
  const [factionId, setFactionId] = useState<number | null>(null);
  const [seatCount, setSeatCount] = useState<number>(1);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [quoting, setQuoting] = useState(false);

  async function handleQuote() {
    if (!user) return;
    setQuoting(true);
    try {
      const res = await getSubscribeQuote({
        plan_key: plan.key,
        subscriber_type: subscriberType,
        faction_id: subscriberType === "faction" ? factionId : null,
        seat_count: subscriberType === "faction" ? seatCount : undefined,
      });
      setModal({
        stage: "confirm",
        plan,
        price: res.data.price_credits,
        seatCount: res.data.seat_count,
        perSeat: res.data.per_seat,
        perSeatPrice: res.data.per_seat_price,
        payeeConfigured: res.data.payee_configured,
      });
    } catch (err: unknown) {
      setModal({ stage: "error", message: err instanceof Error ? err.message : "Failed to get quote." });
    } finally {
      setQuoting(false);
    }
  }

  async function handleConfirm() {
    setModal({ stage: "sending" });
    try {
      const res = await sendSubscription({
        plan_key: plan.key,
        subscriber_type: subscriberType,
        faction_id: subscriberType === "faction" ? factionId : null,
        seat_count: subscriberType === "faction" ? seatCount : undefined,
      });
      setModal({ stage: "success", periodEnd: res.data.subscription.current_period_end });
      onSuccess();
    } catch (err: unknown) {
      setModal({ stage: "error", message: err instanceof Error ? err.message : "Payment failed." });
    }
  }

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.7)] flex items-center justify-center z-[999] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1a1d22] border border-white/[0.12] rounded-[14px] p-8 max-w-[420px] w-full flex flex-col gap-5">
        <h3 className="text-[1.1rem] font-semibold m-0">Subscribe — {plan.label}</h3>

        {!modal && (
          <>
            {isFactionPlan && (
              <>
                <div className="field">
                  <label className="field__label">Faction</label>
                  <select
                    className={INPUT}
                    value={factionId ?? ""}
                    onChange={(e) => setFactionId(Number(e.target.value) || null)}
                    required
                  >
                    <option value="">— select faction —</option>
                    {factions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">Seats</label>
                  <input
                    className={INPUT}
                    type="number"
                    min={1}
                    value={seatCount}
                    onChange={(e) => setSeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </>
            )}

            <p className="text-[0.82rem] opacity-60 leading-[1.5]">
              Payment is made directly in Star Wars Combine Credits via the SWC API.
              Your Chain Code Verification must be active for payments.
            </p>

            <div className="flex gap-3 justify-end">
              <button className={BTN_SM + " all"} type="button" onClick={onClose}>Cancel</button>
              <button
                className={BTN}
                type="button"
                onClick={handleQuote}
                disabled={quoting || (subscriberType === "faction" && (!factionId || seatCount < 1))}
              >
                {quoting ? "Loading…" : "Get quote"}
              </button>
            </div>
          </>
        )}

        {modal?.stage === "confirm" && (
          <>
            <div className="flex justify-between items-center text-[0.9rem]">
              <span className="opacity-60">Plan</span>
              <span className="font-semibold">{modal.plan.label}</span>
            </div>
            {isFactionPlan && factionId && (
              <div className="flex justify-between items-center text-[0.9rem]">
                <span className="opacity-60">Faction</span>
                <span className="font-semibold">{factions.find((f) => f.id === factionId)?.name ?? `#${factionId}`}</span>
              </div>
            )}
            {modal.seatCount !== null && (
              <div className="flex justify-between items-center text-[0.9rem]">
                <span className="opacity-60">Seats</span>
                <span className="font-semibold">{modal.seatCount}</span>
              </div>
            )}
            {modal.perSeat && modal.perSeatPrice !== null && modal.seatCount !== null && (
              <div className="flex justify-between items-center text-[0.9rem]">
                <span className="opacity-60">Rate</span>
                <span className="font-semibold">{formatCredits(modal.perSeatPrice)} × {modal.seatCount} seats</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[0.9rem]">
              <span className="opacity-60">Total / month</span>
              <span className="font-semibold">{formatCredits(modal.price)}</span>
            </div>
            {!modal.payeeConfigured && (
              <p className="text-[0.85rem] text-[salmon] m-0">
                Subscriptions are not yet configured by the administrators. Please check back soon.
              </p>
            )}
            <p className="text-[0.82rem] opacity-60 leading-[1.5]">
              Clicking confirm will immediately send {formatCredits(modal.price)} from your SWC account.
              Your subscription will activate instantly and run for 30 days.
            </p>
            <div className="flex gap-3 justify-end">
              <button className={BTN_SM + " all"} type="button" onClick={() => setModal(null)}>Back</button>
              <button
                className={BTN}
                type="button"
                onClick={handleConfirm}
                disabled={!modal.payeeConfigured}
              >
                Confirm &amp; pay {formatCredits(modal.price)}
              </button>
            </div>
          </>
        )}

        {modal?.stage === "sending" && (
          <p className="text-[0.82rem] opacity-60 leading-[1.5] text-center">
            Sending payment via SWC…
          </p>
        )}

        {modal?.stage === "success" && (
          <>
            <p className="text-[0.9rem] text-[#8ef0a0] text-center m-0">
              Subscription activated! Access is live now.
              {modal.periodEnd && <><br />Renews on {formatDate(modal.periodEnd)}.</>}
            </p>
            <div className="flex gap-3 justify-end">
              <button className={BTN} type="button" onClick={onClose}>Done</button>
            </div>
          </>
        )}

        {modal?.stage === "error" && (
          <>
            <p className="text-[0.85rem] text-[salmon] m-0">{modal.message}</p>
            <div className="flex gap-3 justify-end">
              <button className={BTN_SM + " all"} type="button" onClick={() => setModal(null)}>Back</button>
              <button className={BTN_SM + " all"} type="button" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

type PlanCardProps = {
  plan: StorePlan;
  publicTools: PublicTool[];
  seatTiers: StorePlanSeatTier[];
  currentSubscription: StoreSubscription | null;
  tier: "full" | "public" | "none";
  user: SwcUser | null;
  hasPaymentsAccess: boolean;
  onSubscribe: (plan: StorePlan) => void;
};

const PlanCard: React.FC<PlanCardProps> = ({ plan, publicTools, seatTiers, currentSubscription, tier, user, hasPaymentsAccess, onSubscribe }) => {
  const isCurrentPlan = currentSubscription?.plan_key === plan.key && currentSubscription?.status === "active";
  const isFullMember = tier === "full";

  return (
    <div className={`border rounded-xl p-7 flex flex-col gap-4 ${isCurrentPlan ? "border-[rgba(100,200,120,0.4)] bg-[rgba(100,200,120,0.05)]" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-[1rem] font-semibold uppercase tracking-[0.08em] opacity-60 m-0">{plan.label}</p>

      <div className="flex items-baseline gap-[0.4rem]">
        <span className="text-[2rem] font-bold leading-none">{formatCredits(plan.monthly_price_credits)}</span>
        <span className="text-[0.8rem] opacity-50">{plan.key === "faction" ? "/ seat / month" : "/ month"}</span>
      </div>

      {plan.has_faction_deal && (
        <span className="text-[0.7rem] bg-[rgba(255,200,60,0.15)] border border-[rgba(255,200,60,0.3)] text-[#ffd060] rounded px-[6px] py-[2px] self-start">Faction pricing applied</span>
      )}

      {plan.description && <p className="text-[0.88rem] opacity-70 leading-[1.55] m-0">{plan.description}</p>}

      {seatTiers.length > 0 && (
        <div>
          <p className="text-[0.82rem] opacity-60 m-0 mb-1">Volume pricing</p>
          <table className="text-[0.8rem] w-full">
            <tbody>
              <tr>
                <td className="opacity-60">1+ seats</td>
                <td>{formatCredits(plan.monthly_price_credits)} / seat</td>
              </tr>
              {seatTiers.map((t) => (
                <tr key={t.min_seats}>
                  <td className="opacity-60">{t.min_seats}+ seats</td>
                  <td>{formatCredits(t.price_per_seat_credits)} / seat</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="list-none p-0 m-0 flex flex-col gap-[0.3rem]">
        {publicTools.map((t) => (
          <li key={t.key} className="text-[0.82rem] opacity-65 flex items-center gap-[0.4rem] before:content-['✓'] before:text-[#8ef0a0] before:font-bold before:text-[0.75rem]">{t.label}</li>
        ))}
      </ul>

      <div className="mt-auto">
        {isFullMember ? (
          <p className="text-[0.85rem] text-[#8ef0a0] py-[0.6rem] text-center">Included with JOE membership</p>
        ) : isCurrentPlan ? (
          <p className="text-[0.85rem] text-[#8ef0a0] py-[0.6rem] text-center">
            Active — renews {formatDate(currentSubscription?.current_period_end ?? null)}
          </p>
        ) : !user ? (
          <p className="text-[0.85rem] text-white/40 py-[0.6rem] text-center">
            Log in to subscribe
          </p>
        ) : !hasPaymentsAccess ? (
          <div className="text-center">
            <p className="text-[0.85rem] text-white/50 py-[0.6rem] text-center mb-2">
              Chain Code Verification required
            </p>
            <a className={BTN + " w-full"} href="/aboutme">
              Connect payments on About Me
            </a>
          </div>
        ) : (
          <button className={BTN + " w-full"} onClick={() => onSubscribe(plan)}>
            Subscribe
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const ToolStorePage: React.FC = () => {
  const [user, setUser] = useState<SwcUser | null | undefined>(undefined);
  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [publicTools, setPublicTools] = useState<PublicTool[]>([]);
  const [seatTiersByPlan, setSeatTiersByPlan] = useState<Record<string, StorePlanSeatTier[]>>({});
  const [tier, setTier] = useState<"full" | "public" | "none">("none");
  const [subscription, setSubscription] = useState<StoreSubscription | null>(null);
  const [factions, setFactions] = useState<PayableFaction[]>([]);
  const [hasPaymentsAccess, setHasPaymentsAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribingTo, setSubscribingTo] = useState<StorePlan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, catalogRes] = await Promise.all([
        fetchAuthMe().catch(() => ({ user: null })),
        getStoreCatalog(),
      ]);
      const me = meRes.user;
      setUser(me);
      setPlans(catalogRes.data.plans);
      setPublicTools(catalogRes.data.public_tools);
      setSeatTiersByPlan(catalogRes.data.seat_tiers ?? {});
      setTier(catalogRes.data.tier);
      setSubscription(catalogRes.data.subscription);
      setHasPaymentsAccess(catalogRes.data.has_payments_access);

      if (me) {
        const factionsRes = await getMyFactions().catch(() => ({ data: [] }));
        setFactions(factionsRes.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load store.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return subscribeToAuthStateChange(load);
  }, [load]);

  function handleSubscribeSuccess() {
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 px-4 pb-16">
        <div className="max-w-[1100px] mx-auto">
          <p className="small text-center opacity-50">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen py-8 px-4 pb-16">
        <div className="max-w-[1100px] mx-auto">
          <p className="small text-[salmon] text-center">{error}</p>
          <div className="text-center mt-3">
            <button className={BTN} onClick={load}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 pb-16">
      <div className="max-w-[1100px] mx-auto">
        <header className="text-center mb-12">
          <p className="text-[0.75rem] tracking-[0.12em] uppercase opacity-50 mb-2">Anarchy Industries</p>
          <h1 className="text-[2.2rem] font-bold m-0 mb-3">Tools Platform</h1>
          <p className="opacity-70 max-w-[560px] mx-auto mb-6 leading-[1.6]">
            Access the full suite of Anarchy Industries galactic tools — astrogation, intel,
            hyper planning, entity stats, and more.
          </p>
          {subscription && (
            <div className="inline-block bg-[rgba(100,200,120,0.12)] border border-[rgba(100,200,120,0.3)] rounded-lg px-5 py-2 text-[0.85rem] text-[#8ef0a0]">
              Active subscription — {subscription.plan_key} — renews {formatDate(subscription.current_period_end)}
            </div>
          )}
        </header>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6 mb-12">
          {plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              publicTools={publicTools}
              seatTiers={seatTiersByPlan[plan.key] ?? []}
              currentSubscription={subscription}
              tier={tier}
              user={user ?? null}
              hasPaymentsAccess={hasPaymentsAccess}
              onSubscribe={setSubscribingTo}
            />
          ))}
        </div>

        <section className="mb-12">
          <h2 className="text-[1.1rem] font-semibold m-0 mb-4 opacity-80">What's included</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {publicTools.map((tool) => (
              <div key={tool.key} className="border border-white/[0.08] rounded-lg px-5 py-4 bg-white/[0.02]">
                <p className="text-[0.9rem] font-semibold m-0 mb-[0.3rem]">{tool.label}</p>
                <p className="text-[0.8rem] opacity-55 m-0 leading-[1.5]">{tool.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {subscribingTo && (
        <SubscribeModal
          plan={subscribingTo}
          user={user ?? null}
          factions={factions}
          onClose={() => setSubscribingTo(null)}
          onSuccess={handleSubscribeSuccess}
        />
      )}
    </div>
  );
};

export default ToolStorePage;
