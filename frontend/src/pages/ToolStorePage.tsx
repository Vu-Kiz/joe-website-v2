import React, { useCallback, useEffect, useState } from "react";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/auth";
import {
  getStoreCatalog,
  getSubscribeQuote,
  sendSubscription,
  type StorePlan,
  type StorePlanSeatTier,
  type PublicTool,
  type StoreSubscription,
} from "../api/toolStore";
import { getMyPayableFactions, type PayableFaction } from "../api/factions";
import "../styles/main.sass";
import "../styles/_toolstore.sass";

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
    <div className="store-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="store-modal">
        <h3 className="store-modal__title">Subscribe — {plan.label}</h3>

        {!modal && (
          <>
            {isFactionPlan && (
              <>
                <div className="field">
                  <label className="field__label">Faction</label>
                  <select
                    className="input"
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
                    className="input"
                    type="number"
                    min={1}
                    value={seatCount}
                    onChange={(e) => setSeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </>
            )}

            <p className="store-modal__warning">
              Payment is made directly in Star Wars Combine Credits via the SWC API.
              Your Chain Code Verification must be active for payments.
            </p>

            <div className="store-modal__actions">
              <button className="btn btn--small" type="button" onClick={onClose}>Cancel</button>
              <button
                className="btn"
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
            <div className="store-modal__row">
              <span className="store-modal__label">Plan</span>
              <span className="store-modal__value">{modal.plan.label}</span>
            </div>
            {isFactionPlan && factionId && (
              <div className="store-modal__row">
                <span className="store-modal__label">Faction</span>
                <span className="store-modal__value">{factions.find((f) => f.id === factionId)?.name ?? `#${factionId}`}</span>
              </div>
            )}
            {modal.seatCount !== null && (
              <div className="store-modal__row">
                <span className="store-modal__label">Seats</span>
                <span className="store-modal__value">{modal.seatCount}</span>
              </div>
            )}
            {modal.perSeat && modal.perSeatPrice !== null && modal.seatCount !== null && (
              <div className="store-modal__row">
                <span className="store-modal__label">Rate</span>
                <span className="store-modal__value">{formatCredits(modal.perSeatPrice)} × {modal.seatCount} seats</span>
              </div>
            )}
            <div className="store-modal__row">
              <span className="store-modal__label">Total / month</span>
              <span className="store-modal__value">{formatCredits(modal.price)}</span>
            </div>
            {!modal.payeeConfigured && (
              <p className="store-modal__error">
                Subscriptions are not yet configured by the administrators. Please check back soon.
              </p>
            )}
            <p className="store-modal__warning">
              Clicking confirm will immediately send {formatCredits(modal.price)} from your SWC account.
              Your subscription will activate instantly and run for 30 days.
            </p>
            <div className="store-modal__actions">
              <button className="btn btn--small" type="button" onClick={() => setModal(null)}>Back</button>
              <button
                className="btn"
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
          <p className="store-modal__warning" style={{ textAlign: "center" }}>
            Sending payment via SWC…
          </p>
        )}

        {modal?.stage === "success" && (
          <>
            <p className="store-modal__success">
              Subscription activated! Access is live now.
              {modal.periodEnd && <><br />Renews on {formatDate(modal.periodEnd)}.</>}
            </p>
            <div className="store-modal__actions">
              <button className="btn" type="button" onClick={onClose}>Done</button>
            </div>
          </>
        )}

        {modal?.stage === "error" && (
          <>
            <p className="store-modal__error">{modal.message}</p>
            <div className="store-modal__actions">
              <button className="btn btn--small" type="button" onClick={() => setModal(null)}>Back</button>
              <button className="btn btn--small" type="button" onClick={onClose}>Cancel</button>
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
    <div className={`store-plan${isCurrentPlan ? " store-plan--active" : ""}`}>
      <p className="store-plan__name">{plan.label}</p>

      <div className="store-plan__price">
        <span className="store-plan__price-amount">{formatCredits(plan.monthly_price_credits)}</span>
        <span className="store-plan__price-unit">{plan.key === "faction" ? "/ seat / month" : "/ month"}</span>
      </div>

      {plan.has_faction_deal && (
        <span className="store-plan__deal-badge">Faction pricing applied</span>
      )}

      {plan.description && <p className="store-plan__desc">{plan.description}</p>}

      {seatTiers.length > 0 && (
        <div className="store-plan__tiers">
          <p className="store-plan__tiers-label">Volume pricing</p>
          <table className="store-plan__tiers-table">
            <tbody>
              <tr>
                <td>1+ seats</td>
                <td>{formatCredits(plan.monthly_price_credits)} / seat</td>
              </tr>
              {seatTiers.map((t) => (
                <tr key={t.min_seats}>
                  <td>{t.min_seats}+ seats</td>
                  <td>{formatCredits(t.price_per_seat_credits)} / seat</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="store-plan__tools">
        {publicTools.map((t) => (
          <li key={t.key} className="store-plan__tool">{t.label}</li>
        ))}
      </ul>

      <div className="store-plan__cta">
        {isFullMember ? (
          <p className="store-plan__subscribed">Included with JOE membership</p>
        ) : isCurrentPlan ? (
          <p className="store-plan__subscribed">
            Active — renews {formatDate(currentSubscription?.current_period_end ?? null)}
          </p>
        ) : !user ? (
          <p className="store-plan__subscribed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Log in to subscribe
          </p>
        ) : !hasPaymentsAccess ? (
          <div style={{ textAlign: "center" }}>
            <p className="store-plan__subscribed" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
              Chain Code Verification required
            </p>
            <a className="btn" style={{ width: "100%", display: "block" }} href="/aboutme">
              Connect payments on About Me
            </a>
          </div>
        ) : (
          <button className="btn" style={{ width: "100%" }} onClick={() => onSubscribe(plan)}>
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
        const factionsRes = await getMyPayableFactions().catch(() => ({ data: [] }));
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
      <div className="store-page">
        <div className="store-page__inner">
          <p className="small" style={{ textAlign: "center", opacity: 0.5 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="store-page">
        <div className="store-page__inner">
          <p className="small" style={{ color: "salmon", textAlign: "center" }}>{error}</p>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button className="btn" onClick={load}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="store-page">
      <div className="store-page__inner">
        <header className="store-page__header">
          <p className="store-page__brand">Anarchy Industries</p>
          <h1 className="store-page__title">Tools Platform</h1>
          <p className="store-page__subtitle">
            Access the full suite of Anarchy Industries galactic tools — astrogation, intel,
            hyper planning, entity stats, and more.
          </p>
          {subscription && (
            <div className="store-page__active-sub">
              Active subscription — {subscription.plan_key} — renews {formatDate(subscription.current_period_end)}
            </div>
          )}
        </header>

        <div className="store-plans">
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

        <section className="store-tools">
          <h2 className="store-tools__title">What's included</h2>
          <div className="store-tools__grid">
            {publicTools.map((tool) => (
              <div key={tool.key} className="store-tool-card">
                <p className="store-tool-card__name">{tool.label}</p>
                <p className="store-tool-card__desc">{tool.description}</p>
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
