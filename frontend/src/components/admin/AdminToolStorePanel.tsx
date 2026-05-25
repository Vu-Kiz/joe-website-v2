import React, { useCallback, useEffect, useState } from "react";
import {
  createSeatTier,
  createToolStoreDeal,
  deleteToolStoreDeal,
  deleteSeatTier,
  getToolStoreDeals,
  getToolStorePlans,
  getToolStoreSettings,
  grantToolSubscription,
  grantFactionToolSubscription,
  searchToolStoreUsers,
  updateSeatTier,
  updateToolStoreDeal,
  updateToolStorePlan,
  updateToolStoreSettings,
  type Faction,
  type GrantedSubscription,
  type GrantedFactionSubscription,
  type PlanSeatTier,
  type PublicTool,
  type ToolStoreSettings,
  type ToolSubscriptionFactionDeal,
  type ToolSubscriptionPlan,
  type UserSearchResult,
} from "../../api/admin/adminToolStore";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import { BTN, BTN_SM, INPUT} from "../../utils/ui";
import CreditInput, { parseCreditInput } from "../common/CreditInput";

// ---------------------------------------------------------------------------
// Plans section
// ---------------------------------------------------------------------------

type PlanEditorState = {
  label: string;
  description: string;
  monthly_price_credits: string;
  is_active: boolean;
};

function planToEditor(p: ToolSubscriptionPlan): PlanEditorState {
  return {
    label: p.label,
    description: p.description ?? "",
    monthly_price_credits: String(p.monthly_price_credits),
    is_active: p.is_active,
  };
}

function formatCredits(n: number): string {
  return n.toLocaleString() + " Cr";
}

type PlanCardProps = {
  plan: ToolSubscriptionPlan;
  publicTools: PublicTool[];
  onSaved: (updated: ToolSubscriptionPlan) => void;
};

const PlanCard: React.FC<PlanCardProps> = ({ plan, publicTools, onSaved }) => {
  const [editor, setEditor] = useState<PlanEditorState>(() => planToEditor(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = parseCreditInput(editor.monthly_price_credits) || 0;
  const perTool = publicTools.length > 0 ? Math.round(priceNum / publicTools.length) : 0;

  const isDirty =
    editor.label !== plan.label ||
    editor.description !== (plan.description ?? "") ||
    parseCreditInput(editor.monthly_price_credits) !== plan.monthly_price_credits ||
    editor.is_active !== plan.is_active;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await updateToolStorePlan(plan.key, {
        label: editor.label,
        description: editor.description || null,
        monthly_price_credits: parseCreditInput(editor.monthly_price_credits) || 0,
        is_active: editor.is_active,
      });
      onSaved(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setEditor(planToEditor(plan));
    setError(null);
  }

  return (
    <form className="panel flex flex-col gap-4" onSubmit={handleSave}>
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">{plan.key}</h3>
        <label className="flex items-center gap-2" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={editor.is_active}
            onChange={(e) => setEditor((s) => ({ ...s, is_active: e.target.checked }))}
          />
          <span>Active</span>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="field">
          <label className="field__label">Plan label</label>
          <input
            className={INPUT}
            value={editor.label}
            onChange={(e) => setEditor((s) => ({ ...s, label: e.target.value }))}
            required
          />
        </div>

        <div className="field">
          <label className="field__label">Description</label>
          <textarea
            className={INPUT}
            rows={2}
            value={editor.description}
            onChange={(e) => setEditor((s) => ({ ...s, description: e.target.value }))}
          />
        </div>

        <div className="field">
          <label className="field__label">Monthly price (Credits)</label>
          <CreditInput
            className={INPUT}
            value={editor.monthly_price_credits}
            onChange={(v) => setEditor((s) => ({ ...s, monthly_price_credits: v }))}
            required
          />
          {priceNum > 0 && publicTools.length > 0 && (
            <p className="small" style={{ marginTop: 4, opacity: 0.7 }}>
              ≈ {formatCredits(perTool)} / tool ({publicTools.length} tools included)
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label">Included public tools</label>
          <ul className="small" style={{ margin: "4px 0 0 16px", opacity: 0.8 }}>
            {publicTools.map((t) => (
              <li key={t.key}>{t.label}</li>
            ))}
          </ul>
        </div>

        {error && <p className="small" style={{ color: "salmon" }}>{error}</p>}
        {plan.updated_by && (
          <p className="small" style={{ opacity: 0.5 }}>
            Last updated by {plan.updated_by.swc_handle} on{" "}
            {plan.updated_at ? new Date(plan.updated_at).toLocaleDateString() : "—"}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {isDirty && (
            <button type="button" className={BTN_SM + " all"} onClick={handleReset} disabled={saving}>
              Reset
            </button>
          )}
          <button type="submit" className={BTN} disabled={saving || !isDirty}>
            {saving ? "Saving…" : "Save plan"}
          </button>
        </div>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Seat tiers section
// ---------------------------------------------------------------------------

type SeatTiersProps = {
  tiers: PlanSeatTier[];
  planKeys: Record<string, string>;
  onTiersChanged: (tiers: PlanSeatTier[]) => void;
};

const SeatTiersSection: React.FC<SeatTiersProps> = ({ tiers, planKeys, onTiersChanged }) => {
  const [form, setForm] = useState({ plan_key: "", min_seats: "", price_per_seat_credits: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await createSeatTier({
        plan_key: form.plan_key,
        min_seats: parseInt(form.min_seats),
        price_per_seat_credits: parseCreditInput(form.price_per_seat_credits),
      });
      onTiersChanged([...tiers, res.data].sort((a, b) => a.plan_key.localeCompare(b.plan_key) || a.min_seats - b.min_seats));
      setForm({ plan_key: "", min_seats: "", price_per_seat_credits: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create tier.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await updateSeatTier(id, { price_per_seat_credits: parseCreditInput(editPrice) });
      onTiersChanged(tiers.map((t) => (t.id === id ? res.data : t)));
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update tier.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this tier?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSeatTier(id);
      onTiersChanged(tiers.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete tier.");
    } finally {
      setSaving(false);
    }
  }

  // Group by plan for display
  const grouped = Object.entries(planKeys).map(([key, label]) => ({
    key,
    label,
    tiers: tiers.filter((t) => t.plan_key === key).sort((a, b) => a.min_seats - b.min_seats),
  })).filter((g) => g.tiers.length > 0 || true);

  return (
    <div className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">Volume Seat Tiers</h3>
        <p className="small" style={{ margin: 0, opacity: 0.7 }}>
          Automatic per-seat discounts based on seat count — no manual deal needed
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {error && <p className="small" style={{ color: "salmon", marginBottom: 8 }}>{error}</p>}

        {/* Add tier form */}
        <form onSubmit={handleCreate} className="flex flex-col gap-3" style={{ marginBottom: 24 }}>
          <p className="small" style={{ marginBottom: 8, fontWeight: 600 }}>Add tier</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div className="field">
              <label className="field__label">Plan</label>
              <select
                className={INPUT}
                value={form.plan_key}
                onChange={(e) => setForm((s) => ({ ...s, plan_key: e.target.value }))}
                required
              >
                <option value="">— select plan —</option>
                {Object.entries(planKeys).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Min seats (from)</label>
              <input
                className={INPUT}
                type="number"
                min={1}
                step={1}
                value={form.min_seats}
                onChange={(e) => setForm((s) => ({ ...s, min_seats: e.target.value }))}
                placeholder="e.g. 10"
                required
              />
            </div>
            <div className="field">
              <label className="field__label">Price per seat (Cr / mo)</label>
              <CreditInput
                className={INPUT}
                value={form.price_per_seat_credits}
                onChange={(v) => setForm((s) => ({ ...s, price_per_seat_credits: v }))}
                placeholder="e.g. 60,000"
                required
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={BTN} disabled={saving}>
              {saving ? "Adding…" : "Add tier"}
            </button>
          </div>
        </form>

        {/* Tier tables per plan */}
        {grouped.map(({ key, label, tiers: planTiers }) => (
          <div key={key} style={{ marginBottom: 20 }}>
            <p className="small" style={{ fontWeight: 600, marginBottom: 6, opacity: 0.8 }}>{label}</p>
            {planTiers.length === 0 ? (
              <p className="small" style={{ opacity: 0.5 }}>No tiers — standard price applies</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.6 }}>
                    <th style={{ padding: "4px 8px" }}>Min seats</th>
                    <th style={{ padding: "4px 8px" }}>Price / seat / mo</th>
                    <th style={{ padding: "4px 8px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {planTiers.map((tier) => (
                    <tr key={tier.id} style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <td style={{ padding: "6px 8px" }}>{tier.min_seats}+</td>
                      <td style={{ padding: "6px 8px" }}>
                        {editingId === tier.id ? (
                          <CreditInput
                            className={INPUT}
                            style={{ width: 130 }}
                            value={editPrice}
                            onChange={setEditPrice}
                          />
                        ) : (
                          formatCredits(tier.price_per_seat_credits)
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        {editingId === tier.id ? (
                          <>
                            <button className={BTN_SM + " all"} type="button" onClick={() => handleUpdate(tier.id)} disabled={saving} style={{ marginRight: 4 }}>Save</button>
                            <button className={BTN_SM + " all"} type="button" onClick={() => setEditingId(null)} disabled={saving}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button
                              className={BTN_SM + " all"}
                              type="button"
                              onClick={() => { setEditingId(tier.id); setEditPrice(String(tier.price_per_seat_credits)); }}
                              disabled={saving}
                              style={{ marginRight: 4 }}
                            >Edit</button>
                            <button className={BTN_SM + " all"} type="button" onClick={() => handleDelete(tier.id)} disabled={saving} style={{ color: "salmon" }}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Faction deals section
// ---------------------------------------------------------------------------

type DealFormState = {
  faction_id: string;
  plan_key: string;
  pricing_type: "per_seat" | "flat";
  per_seat_price_credits: string;
  max_seats: string;
  override_price_credits: string;
  notes: string;
};

const EMPTY_DEAL_FORM: DealFormState = {
  faction_id: "",
  plan_key: "",
  pricing_type: "per_seat",
  per_seat_price_credits: "",
  max_seats: "",
  override_price_credits: "",
  notes: "",
};

type EditDealFormState = {
  pricing_type: "per_seat" | "flat";
  per_seat_price_credits: string;
  max_seats: string;
  override_price_credits: string;
  notes: string;
};

type DealsProps = {
  deals: ToolSubscriptionFactionDeal[];
  factions: Faction[];
  planKeys: Record<string, string>;
  onDealsChanged: (deals: ToolSubscriptionFactionDeal[]) => void;
};

const FactionDealsSection: React.FC<DealsProps> = ({ deals, factions, planKeys, onDealsChanged }) => {
  const [form, setForm] = useState<DealFormState>(EMPTY_DEAL_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditDealFormState>({
    pricing_type: "per_seat",
    per_seat_price_credits: "",
    max_seats: "",
    override_price_credits: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload =
        form.pricing_type === "per_seat"
          ? {
              faction_id: parseInt(form.faction_id),
              plan_key: form.plan_key,
              per_seat_price_credits: parseCreditInput(form.per_seat_price_credits) || 0,
              max_seats: form.max_seats ? parseInt(form.max_seats) : null,
              notes: form.notes || null,
            }
          : {
              faction_id: parseInt(form.faction_id),
              plan_key: form.plan_key,
              override_price_credits: parseCreditInput(form.override_price_credits) || 0,
              notes: form.notes || null,
            };
      const res = await createToolStoreDeal(payload);
      onDealsChanged([res.data, ...deals]);
      setForm(EMPTY_DEAL_FORM);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create deal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number) {
    setSaving(true);
    setError(null);
    try {
      const payload =
        editForm.pricing_type === "per_seat"
          ? {
              per_seat_price_credits: parseCreditInput(editForm.per_seat_price_credits) || 0,
              override_price_credits: null,
              max_seats: editForm.max_seats ? parseInt(editForm.max_seats) : null,
              notes: editForm.notes || null,
            }
          : {
              override_price_credits: parseCreditInput(editForm.override_price_credits) || 0,
              per_seat_price_credits: null,
              max_seats: null,
              notes: editForm.notes || null,
            };
      const res = await updateToolStoreDeal(id, payload);
      onDealsChanged(deals.map((d) => (d.id === id ? res.data : d)));
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update deal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Revoke this faction deal?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteToolStoreDeal(id);
      onDealsChanged(deals.filter((d) => d.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete deal.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(deal: ToolSubscriptionFactionDeal) {
    setEditingId(deal.id);
    const isPerSeat = deal.per_seat_price_credits !== null;
    setEditForm({
      pricing_type: isPerSeat ? "per_seat" : "flat",
      per_seat_price_credits: isPerSeat ? String(deal.per_seat_price_credits) : "",
      max_seats: deal.max_seats !== null ? String(deal.max_seats) : "",
      override_price_credits: !isPerSeat && deal.override_price_credits !== null ? String(deal.override_price_credits) : "",
      notes: deal.notes ?? "",
    });
  }

  function dealPriceSummary(deal: ToolSubscriptionFactionDeal): string {
    if (deal.per_seat_price_credits !== null) {
      const maxStr = deal.max_seats ? `, max ${deal.max_seats}` : "";
      return `${formatCredits(deal.per_seat_price_credits)} / seat / mo${maxStr}`;
    }
    if (deal.override_price_credits !== null) {
      return `${formatCredits(deal.override_price_credits)} flat / mo`;
    }
    return "—";
  }

  return (
    <div className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">Faction Deals</h3>
        <p className="small" style={{ margin: 0, opacity: 0.7 }}>Negotiated pricing overrides for specific factions</p>
      </div>

      <div className="flex flex-col gap-3">
        {error && <p className="small" style={{ color: "salmon", marginBottom: 8 }}>{error}</p>}

        {/* New deal form */}
        <form onSubmit={handleCreate} className="flex flex-col gap-3" style={{ marginBottom: 24 }}>
          <p className="small" style={{ marginBottom: 8, fontWeight: 600 }}>New deal</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="field">
              <label className="field__label">Faction</label>
              <select
                className={INPUT}
                value={form.faction_id}
                onChange={(e) => setForm((s) => ({ ...s, faction_id: e.target.value }))}
                required
              >
                <option value="">— select faction —</option>
                {factions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} [{f.abbreviation}]
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Plan</label>
              <select
                className={INPUT}
                value={form.plan_key}
                onChange={(e) => setForm((s) => ({ ...s, plan_key: e.target.value }))}
                required
              >
                <option value="">— select plan —</option>
                {Object.entries(planKeys).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="field__label">Pricing type</label>
              <select
                className={INPUT}
                value={form.pricing_type}
                onChange={(e) => setForm((s) => ({ ...s, pricing_type: e.target.value as "per_seat" | "flat" }))}
              >
                <option value="per_seat">Per seat / month (bulk discount)</option>
                <option value="flat">Flat price / month (any seat count)</option>
              </select>
            </div>
            {form.pricing_type === "per_seat" ? (
              <>
                <div className="field">
                  <label className="field__label">Price per seat (Cr / mo)</label>
                  <CreditInput
                    className={INPUT}
                    value={form.per_seat_price_credits}
                    onChange={(v) => setForm((s) => ({ ...s, per_seat_price_credits: v }))}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label">Max seats (optional)</label>
                  <input
                    className={INPUT}
                    type="number"
                    min={1}
                    step={1}
                    value={form.max_seats}
                    onChange={(e) => setForm((s) => ({ ...s, max_seats: e.target.value }))}
                    placeholder="No limit"
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <label className="field__label">Flat monthly price (Cr)</label>
                <CreditInput
                  className={INPUT}
                  value={form.override_price_credits}
                  onChange={(v) => setForm((s) => ({ ...s, override_price_credits: v }))}
                  required
                />
              </div>
            )}
            <div className="field" style={form.pricing_type === "flat" ? {} : undefined}>
              <label className="field__label">Notes (optional)</label>
              <input
                className={INPUT}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                placeholder="e.g. 6-month locked deal"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={BTN} disabled={saving}>
              {saving ? "Creating…" : "Create deal"}
            </button>
          </div>
        </form>

        {/* Existing deals */}
        {deals.length === 0 ? (
          <p className="small" style={{ opacity: 0.6 }}>No faction deals yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.6 }}>
                <th style={{ padding: "4px 8px" }}>Faction</th>
                <th style={{ padding: "4px 8px" }}>Plan</th>
                <th style={{ padding: "4px 8px" }}>Pricing</th>
                <th style={{ padding: "4px 8px" }}>Notes</th>
                <th style={{ padding: "4px 8px" }}>Set by</th>
                <th style={{ padding: "4px 8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  {editingId === deal.id ? (
                    <>
                      <td style={{ padding: "6px 8px" }}>{deal.faction?.name}</td>
                      <td style={{ padding: "6px 8px" }}>{planKeys[deal.plan_key] ?? deal.plan_key}</td>
                      <td style={{ padding: "6px 8px" }} colSpan={2}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <select
                            className={INPUT}
                            style={{ width: 160 }}
                            value={editForm.pricing_type}
                            onChange={(e) => setEditForm((s) => ({ ...s, pricing_type: e.target.value as "per_seat" | "flat" }))}
                          >
                            <option value="per_seat">Per seat / mo</option>
                            <option value="flat">Flat / mo</option>
                          </select>
                          {editForm.pricing_type === "per_seat" ? (
                            <>
                              <CreditInput
                                className={INPUT}
                                style={{ width: 110 }}
                                placeholder="Cr / seat"
                                value={editForm.per_seat_price_credits}
                                onChange={(v) => setEditForm((s) => ({ ...s, per_seat_price_credits: v }))}
                              />
                              <input
                                className={INPUT}
                                type="number"
                                min={1}
                                style={{ width: 90 }}
                                placeholder="Max seats"
                                value={editForm.max_seats}
                                onChange={(e) => setEditForm((s) => ({ ...s, max_seats: e.target.value }))}
                              />
                            </>
                          ) : (
                            <CreditInput
                              className={INPUT}
                              style={{ width: 120 }}
                              placeholder="Flat Cr"
                              value={editForm.override_price_credits}
                              onChange={(v) => setEditForm((s) => ({ ...s, override_price_credits: v }))}
                            />
                          )}
                          <input
                            className={INPUT}
                            placeholder="Notes"
                            value={editForm.notes}
                            onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))}
                            style={{ flex: 1, minWidth: 120 }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: "6px 8px", opacity: 0.5 }}>{deal.set_by?.swc_handle ?? "—"}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className={BTN_SM + " all"}
                          onClick={() => handleUpdate(deal.id)}
                          disabled={saving}
                          style={{ marginRight: 4 }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={BTN_SM + " all"}
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "6px 8px" }}>{deal.faction?.name} <span style={{ opacity: 0.5 }}>[{deal.faction?.abbreviation}]</span></td>
                      <td style={{ padding: "6px 8px" }}>{planKeys[deal.plan_key] ?? deal.plan_key}</td>
                      <td style={{ padding: "6px 8px" }}>{dealPriceSummary(deal)}</td>
                      <td style={{ padding: "6px 8px", opacity: 0.7 }}>{deal.notes ?? "—"}</td>
                      <td style={{ padding: "6px 8px", opacity: 0.5 }}>{deal.set_by?.swc_handle ?? "—"}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className={BTN_SM + " all"}
                          onClick={() => startEdit(deal)}
                          disabled={saving}
                          style={{ marginRight: 4 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={BTN_SM + " all"}
                          onClick={() => handleDelete(deal.id)}
                          disabled={saving}
                          style={{ color: "salmon" }}
                        >
                          Revoke
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Manual grant section
// ---------------------------------------------------------------------------

type ManualGrantSectionProps = {
  planKeys: Record<string, string>;
};

const ManualGrantSection: React.FC<ManualGrantSectionProps> = ({ planKeys }) => {
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [planKey, setPlanKey] = useState("");
  const [months, setMonths] = useState("1");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GrantedSubscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planOptions = Object.entries(planKeys);

  async function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedUser(null);
    if (value.length >= 2) {
      try {
        const res = await searchToolStoreUsers(value);
        setSuggestions(res.data);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  }

  function handleSelect(user: UserSearchResult) {
    setSelectedUser(user);
    setQuery(user.swc_handle);
    setShowSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setResult(null);
    setError(null);
    try {
      const res = await grantToolSubscription({
        user_id: selectedUser.id,
        plan_key: planKey,
        months: parseInt(months) || 1,
      });
      setResult(res.data);
      setQuery("");
      setSelectedUser(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to grant subscription.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">Manual Grant</h3>
        <p className="small" style={{ margin: 0, opacity: 0.7 }}>Grant access without payment — for testing or comped accounts</p>
      </div>
      <div className="flex flex-col gap-3">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 8 }}>
          <div className="field">
            <label className="field__label">User (SWC handle)</label>
            <SearchSuggestionPicker
              value={query}
              onChange={handleQueryChange}
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              onShowSuggestions={setShowSuggestions}
              placeholder="search by SWC handle…"
              getKey={(u) => String(u.id)}
              isActive={(u) => u.id === selectedUser?.id}
              onSelect={handleSelect}
              renderSuggestion={(u) => u.swc_handle}
            />
          </div>
          <div className="field">
            <label className="field__label">Plan</label>
            <select
              className={INPUT}
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
              required
            >
              <option value="">— select —</option>
              {planOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Months</label>
            <input
              className={INPUT}
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              required
            />
          </div>
        </div>

        {error && <p className="small" style={{ color: "salmon", marginTop: 8 }}>{error}</p>}
        {result && (
          <p className="small" style={{ color: "#7fba7f", marginTop: 8 }}>
            ✓ Granted <strong>{result.plan_key}</strong> to <strong>{result.user.swc_handle}</strong>
            {result.current_period_end
              ? ` until ${new Date(result.current_period_end).toLocaleDateString()}`
              : ""}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BTN} disabled={saving || !selectedUser || !planKey}>
            {saving ? "Granting…" : "Grant access"}
          </button>
        </div>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Payee settings section
// ---------------------------------------------------------------------------

type PayeeSettingsSectionProps = {
  settings: ToolStoreSettings;
  onSaved: (updated: { payee_faction_id: number | null }) => void;
};

const PayeeSettingsSection: React.FC<PayeeSettingsSectionProps> = ({ settings, onSaved }) => {
  const [factionId, setFactionId] = useState<string>(settings.payee_faction_id ? String(settings.payee_faction_id) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = (parseInt(factionId) || null) !== settings.payee_faction_id;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await updateToolStoreSettings({
        payee_faction_id: parseInt(factionId) || null,
      });
      onSaved(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const configured = settings.payee_faction_id;

  return (
    <form className="panel flex flex-col gap-4" onSubmit={handleSave}>
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">Payment Recipient</h3>
        <span className="small" style={{ opacity: 0.6 }}>
          {configured ? "✓ Configured" : "⚠ Not configured — subscriptions will not work"}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <div className="field">
          <label className="field__label">Payee faction</label>
          <select
            className={INPUT}
            value={factionId}
            onChange={(e) => setFactionId(e.target.value)}
          >
            <option value="">— select faction —</option>
            {settings.factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} [{f.abbreviation}]
              </option>
            ))}
          </select>
          <p className="small" style={{ marginTop: 4, opacity: 0.5 }}>
            Credits from subscriptions are sent to this faction's SWC account using their faction name.
          </p>
        </div>
        {error && <p className="small" style={{ color: "salmon" }}>{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BTN} disabled={saving || !isDirty}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Faction manual grant section
// ---------------------------------------------------------------------------

type FactionGrantSectionProps = {
  planKeys: Record<string, string>;
  factions: Faction[];
};

const FactionGrantSection: React.FC<FactionGrantSectionProps> = ({ planKeys, factions }) => {
  const [factionId, setFactionId] = useState("");
  const [planKey, setPlanKey] = useState("");
  const [months, setMonths] = useState("1");
  const [seatCount, setSeatCount] = useState("10");
  const [managerQuery, setManagerQuery] = useState("");
  const [managerUser, setManagerUser] = useState<UserSearchResult | null>(null);
  const [managerSuggestions, setManagerSuggestions] = useState<UserSearchResult[]>([]);
  const [showManagerSuggestions, setShowManagerSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GrantedFactionSubscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planOptions = Object.entries(planKeys);

  async function handleManagerQueryChange(value: string) {
    setManagerQuery(value);
    setManagerUser(null);
    if (value.length >= 2) {
      try {
        const res = await searchToolStoreUsers(value);
        setManagerSuggestions(res.data);
      } catch {
        setManagerSuggestions([]);
      }
    } else {
      setManagerSuggestions([]);
    }
  }

  function handleManagerSelect(user: UserSearchResult) {
    setManagerUser(user);
    setManagerQuery(user.swc_handle);
    setShowManagerSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factionId || !managerUser) return;
    setSaving(true);
    setResult(null);
    setError(null);
    try {
      const res = await grantFactionToolSubscription({
        faction_id: parseInt(factionId),
        plan_key: planKey,
        months: parseInt(months) || 1,
        seat_count: parseInt(seatCount) || 1,
        manager_user_id: managerUser.id,
      });
      setResult(res.data);
      setFactionId("");
      setPlanKey("");
      setMonths("1");
      setSeatCount("10");
      setManagerQuery("");
      setManagerUser(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to grant faction subscription.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">Faction Manual Grant</h3>
        <p className="small" style={{ margin: 0, opacity: 0.7 }}>Grant a faction subscription with seat allocation — for comped or deal-based access</p>
      </div>
      <div className="flex flex-col gap-3">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div className="field">
            <label className="field__label">Faction</label>
            <select
              className={INPUT}
              value={factionId}
              onChange={(e) => setFactionId(e.target.value)}
              required
            >
              <option value="">— select faction —</option>
              {factions.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.name} [{f.abbreviation}]</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Manager (SWC handle)</label>
            <SearchSuggestionPicker
              value={managerQuery}
              onChange={handleManagerQueryChange}
              suggestions={managerSuggestions}
              showSuggestions={showManagerSuggestions}
              onShowSuggestions={setShowManagerSuggestions}
              placeholder="search by SWC handle…"
              getKey={(u) => String(u.id)}
              isActive={(u) => u.id === managerUser?.id}
              onSelect={handleManagerSelect}
              renderSuggestion={(u) => u.swc_handle}
            />
          </div>
          <div className="field">
            <label className="field__label">Plan</label>
            <select
              className={INPUT}
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
              required
            >
              <option value="">— select —</option>
              {planOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Seats</label>
            <input
              className={INPUT}
              type="number"
              min={1}
              max={500}
              value={seatCount}
              onChange={(e) => setSeatCount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field__label">Months</label>
            <input
              className={INPUT}
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              required
            />
          </div>
        </div>

        {error && <p className="small" style={{ color: "salmon", marginTop: 8 }}>{error}</p>}
        {result && (
          <p className="small" style={{ color: "#7fba7f", marginTop: 8 }}>
            ✓ Granted <strong>{result.plan_key}</strong> to <strong>{result.faction.name}</strong>{" "}
            ({result.seat_count} seats, managed by {result.manager.swc_handle})
            {result.current_period_end
              ? ` until ${new Date(result.current_period_end).toLocaleDateString()}`
              : ""}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BTN} disabled={saving || !factionId || !planKey || !managerUser}>
            {saving ? "Granting…" : "Grant faction access"}
          </button>
        </div>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Root panel
// ---------------------------------------------------------------------------

const AdminToolStorePanel: React.FC = () => {
  const [plans, setPlans] = useState<ToolSubscriptionPlan[]>([]);
  const [publicTools, setPublicTools] = useState<PublicTool[]>([]);
  const [seatTiers, setSeatTiers] = useState<PlanSeatTier[]>([]);
  const [deals, setDeals] = useState<ToolSubscriptionFactionDeal[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [planKeys, setPlanKeys] = useState<Record<string, string>>({});
  const [storeSettings, setStoreSettings] = useState<ToolStoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, dealsRes, settingsRes] = await Promise.all([getToolStorePlans(), getToolStoreDeals(), getToolStoreSettings()]);
      setPlans(plansRes.data.plans);
      setPublicTools(plansRes.data.public_tools);
      setSeatTiers(plansRes.data.seat_tiers);
      setDeals(dealsRes.data.deals);
      setFactions(dealsRes.data.factions);
      setPlanKeys(dealsRes.data.plan_keys);
      setStoreSettings(settingsRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tool store data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handlePlanSaved(updated: ToolSubscriptionPlan) {
    setPlans((prev) => prev.map((p) => (p.key === updated.key ? updated : p)));
  }

  if (loading) {
    return (
      <section className="panel flex flex-col gap-4">
        <p className="small">Loading tool store settings…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel flex flex-col gap-4">
        <p className="small" style={{ color: "salmon" }}>{error}</p>
        <button className={BTN} onClick={load}>Retry</button>
      </section>
    );
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="h2">Tools Store</h2>
        <p className="small" style={{ margin: 0, opacity: 0.7 }}>
          Manage Anarchy Industries public tool subscription plans and pricing.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        {storeSettings && (
          <PayeeSettingsSection
            settings={storeSettings}
            onSaved={(updated) => setStoreSettings((s) => s ? { ...s, payee_faction_id: updated.payee_faction_id } : s)}
          />
        )}

        <ManualGrantSection planKeys={planKeys} />

        <FactionGrantSection planKeys={planKeys} factions={factions} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              publicTools={publicTools}
              onSaved={handlePlanSaved}
            />
          ))}
        </div>

        <SeatTiersSection
          tiers={seatTiers}
          planKeys={planKeys}
          onTiersChanged={setSeatTiers}
        />

        <FactionDealsSection
          deals={deals}
          factions={factions}
          planKeys={planKeys}
          onDealsChanged={setDeals}
        />
      </div>
    </section>
  );
};

export default AdminToolStorePanel;
