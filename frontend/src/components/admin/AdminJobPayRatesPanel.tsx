import React, { useEffect, useState } from "react";
import {
  getJobPayRates,
  createJobPayRate,
  updateJobPayRate,
  deleteJobPayRate,
  type JobPayRate,
} from "../../api/jobs/jobPayRates";
import { getMyPayableFactions, type PayableFaction } from "../../api/factions/factions";
import { fmtCredits } from "../../utils/credits";
import { BTN, BTN_GHOST, BTN_GHOST_SM, INPUT, SELECT_INPUT} from "../../utils/ui";
import CreditInput, { parseCreditInput } from "../common/CreditInput";

type Props = Record<string, never>;

const emptyForm = {
  name: "",
  description: "",
  unit_label: "",
  base_rate: "",
  bonus_rate: "",
  bonus_description: "",
  payer_subject_type: "faction" as "faction" | "user",
  payer_subject_id: "",
  status: "active" as "active" | "inactive",
};

const rateCardCls = "flex flex-col gap-[0.4rem] p-[0.9rem] rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] mb-[0.65rem] font-tektur";

const AdminJobPayRatesPanel: React.FC<Props> = () => {
  const [rates, setRates] = useState<JobPayRate[]>([]);
  const [factions, setFactions] = useState<PayableFaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const res = await getJobPayRates();
    setRates(res.data);
    const factionsRes = await getMyPayableFactions();
    setFactions(factionsRes.data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [ratesRes, factionsRes] = await Promise.all([getJobPayRates(), getMyPayableFactions()]);
        if (!cancelled) {
          setRates(ratesRes.data);
          setFactions(factionsRes.data);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load pay rates.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function startEdit(rate: JobPayRate) {
    setEditingId(rate.id);
    setForm({
      name: rate.name,
      description: rate.description ?? "",
      unit_label: rate.unit_label,
      base_rate: String(rate.base_rate),
      bonus_rate: rate.bonus_rate != null ? String(rate.bonus_rate) : "",
      bonus_description: rate.bonus_description ?? "",
      payer_subject_type: rate.payer_subject_type,
      payer_subject_id: rate.payer_subject_id != null ? String(rate.payer_subject_id) : "",
      status: rate.status,
    });
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        unit_label: form.unit_label,
        base_rate: parseCreditInput(form.base_rate),
        bonus_rate: form.bonus_rate ? parseCreditInput(form.bonus_rate) : null,
        bonus_description: form.bonus_description || null,
        payer_subject_type: form.payer_subject_type,
        payer_subject_id: form.payer_subject_id ? parseInt(form.payer_subject_id, 10) : null,
        status: form.status,
      };

      if (editingId) {
        await updateJobPayRate(editingId, payload);
        setNotice("Pay rate updated.");
      } else {
        await createJobPayRate(payload);
        setNotice("Pay rate created.");
      }

      await load();
      cancelEdit();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this pay rate? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteJobPayRate(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  const f = (v: string) => fmtCredits(parseInt(v || "0", 10));

  return (
    <div className="panel">
      <h2 className="h2">Pay Rate Catalog</h2>
      <p className="small">Define standard job types and their pay rates. Members will see active rates when submitting pay claims.</p>

      {notice && <p className="small" style={{ color: "lightgreen" }}>{notice}</p>}
      {error && <p className="small" style={{ color: "salmon" }}>{error}</p>}

      {loading ? (
        <p className="small">Loading…</p>
      ) : (
        <>
          {rates.map((rate) => (
            <div key={rate.id} className={rateCardCls}>
              {editingId === rate.id ? (
                <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <RateFormFields form={form} setForm={setForm} factions={factions} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className={BTN} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                    <button type="button" className={BTN_GHOST} onClick={cancelEdit}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex justify-between items-start flex-wrap gap-[0.4rem]">
                    <span className="font-bold text-[0.9rem] m-0">
                      {rate.name}
                      {rate.status === "inactive" && (
                        <span className="text-[0.72rem] opacity-45 ml-[0.4rem]">Inactive</span>
                      )}
                    </span>
                    <div className="flex gap-[0.4rem]">
                      <button className={BTN_GHOST_SM} type="button" onClick={() => startEdit(rate)}>Edit</button>
                      <button
                        className={BTN_GHOST_SM}
                        type="button"
                        disabled={deletingId === rate.id}
                        onClick={() => handleDelete(rate.id)}
                        style={{ color: "salmon" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-[0.85rem] text-[#f5d546] font-semibold m-0">
                    {f(String(rate.base_rate))} / {rate.unit_label}
                  </p>
                  {rate.bonus_rate != null && (
                    <p className="text-[0.78rem] opacity-65 m-0">
                      Bonus: {f(String(rate.bonus_rate))} / {rate.unit_label}
                      {rate.bonus_description ? ` — ${rate.bonus_description}` : ""}
                    </p>
                  )}
                  {rate.description && <p className="text-[0.8rem] opacity-70 m-0">{rate.description}</p>}
                  <p className="text-[0.75rem] opacity-45 m-0">Payer: {rate.payer_label ?? "—"}</p>
                </>
              )}
            </div>
          ))}

          {rates.length === 0 && <p className="small">No pay rates defined yet.</p>}

          {editingId === null && (
            <div className={rateCardCls} style={{ marginTop: 16 }}>
              <h3 className="h3" style={{ marginTop: 0 }}>Add New Pay Rate</h3>
              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <RateFormFields form={form} setForm={setForm} factions={factions} />
                <button type="submit" className={BTN} disabled={saving}>{saving ? "Creating…" : "Create Pay Rate"}</button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

type FormState = typeof emptyForm;

function RateFormFields({
  form,
  setForm,
  factions,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  factions: { id: number; name: string }[];
}) {
  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <>
      <label className="small">
        Name *
        <input className={INPUT} style={{ display: "block", marginTop: 4 }} value={form.name} onChange={set("name")} required maxLength={150} placeholder="e.g. City Building" />
      </label>
      <label className="small">
        Unit Label * <span style={{ opacity: 0.5 }}>(what one unit is called)</span>
        <input className={INPUT} style={{ display: "block", marginTop: 4 }} value={form.unit_label} onChange={set("unit_label")} required maxLength={100} placeholder="e.g. city, prospect, trip, coordinate" />
      </label>
      <label className="small">
        Base Rate (credits) *
        <CreditInput className={INPUT} style={{ display: "block", marginTop: 4 }} value={form.base_rate} onChange={(v) => setForm((p) => ({ ...p, base_rate: v }))} required placeholder="e.g. 5,000,000" />
      </label>
      <label className="small">
        Description <span style={{ opacity: 0.5 }}>(optional, shown to members)</span>
        <textarea className={INPUT + " min-h-[120px] resize-y leading-[1.5] py-[0.85rem]"} rows={2} style={{ display: "block", marginTop: 4 }} value={form.description} onChange={set("description")} />
      </label>
      <label className="small">
        Bonus Rate (credits) <span style={{ opacity: 0.5 }}>(optional)</span>
        <CreditInput className={INPUT} style={{ display: "block", marginTop: 4 }} value={form.bonus_rate} onChange={(v) => setForm((p) => ({ ...p, bonus_rate: v }))} placeholder="e.g. 2,000,000" />
      </label>
      {form.bonus_rate && (
        <label className="small">
          Bonus Condition Description
          <input className={INPUT} style={{ display: "block", marginTop: 4 }} value={form.bonus_description} onChange={set("bonus_description")} maxLength={255} placeholder="e.g. city plan includes many 1×1 facilities" />
        </label>
      )}
      <label className="small">
        Payer Type *
        <select className={SELECT_INPUT} style={{ display: "block", marginTop: 4 }} value={form.payer_subject_type} onChange={set("payer_subject_type")}>
          <option value="faction">Faction</option>
          <option value="user">User</option>
        </select>
      </label>
      {form.payer_subject_type === "faction" && (
        <label className="small">
          Faction *
          <select className={SELECT_INPUT} style={{ display: "block", marginTop: 4 }} value={form.payer_subject_id} onChange={set("payer_subject_id")}>
            <option value="">— Select faction —</option>
            {factions.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="small">
        Status
        <select className={SELECT_INPUT} style={{ display: "block", marginTop: 4 }} value={form.status} onChange={set("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
    </>
  );
}

export default AdminJobPayRatesPanel;
