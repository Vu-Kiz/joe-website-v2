import { useEffect, useMemo, useState } from "react";
import { BTN, BTN_GHOST_SM, BTN_SM, INPUT } from "../../utils/ui";
import { getMaterialPrices, upsertMaterialPrice, deleteMaterialPrice, type MaterialPrice } from "../../api/member/materialPrices";
import { getStoredMaterialTypes, type StoredMaterialTypeSummary } from "../../api/universe/universe";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";



function fmtC(n: number) { return n.toLocaleString() + " cr"; }

export default function AdminMaterialPricesPanel() {
  const [prices, setPrices] = useState<MaterialPrice[]>([]);
  const [materials, setMaterials] = useState<StoredMaterialTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMaterial, setSelectedMaterial] = useState<StoredMaterialTypeSummary | null>(null);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getMaterialPrices(), getStoredMaterialTypes()])
      .then(([p, m]) => {
        setPrices(p.data ?? []);
        setMaterials(m.data ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials.slice(0, 40);
    return materials.filter((m) => (m.name ?? "").toLowerCase().includes(q));
  }, [materials, query]);

  function handleSelect(m: StoredMaterialTypeSummary) {
    setSelectedMaterial(m);
    setQuery(m.name ?? "");
    const existing = prices.find((p) => p.material_uid === m.uid);
    setPriceInput(existing ? String(existing.price_per_unit) : "");
    setSaveError(null);
  }

  function handleSave() {
    if (!selectedMaterial) return;
    const price = parseInt(priceInput.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(price) || price < 0) { setSaveError("Enter a valid price."); return; }
    setSaving(true);
    setSaveError(null);
    upsertMaterialPrice(selectedMaterial.uid, price)
      .then((res) => {
        setPrices((prev) => {
          const next = prev.filter((p) => p.material_uid !== selectedMaterial.uid);
          return [...next, res.data].sort((a, b) => a.material_name.localeCompare(b.material_name));
        });
        setSelectedMaterial(null);
        setQuery("");
        setPriceInput("");
      })
      .catch((e: unknown) => setSaveError(e instanceof Error ? e.message : "Save failed."))
      .finally(() => setSaving(false));
  }

  function handleDelete(uid: string) {
    deleteMaterialPrice(uid)
      .then(() => setPrices((prev) => prev.filter((p) => p.material_uid !== uid)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Delete failed."));
  }

  return (
    <div className="space-y-4">
      <div className="panel">
        <h2 className="text-sm font-semibold opacity-80 m-0 mb-1">Material Prices</h2>
        <p className="text-xs opacity-50 m-0">Set internal JOE mining prices shown to members in the Production Calculator.</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Add / edit form */}
      <div className="panel space-y-3">
        <h3 className="text-xs font-semibold opacity-60 uppercase tracking-wide m-0">Set Price</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-60">Material</label>
            <SearchSuggestionPicker<StoredMaterialTypeSummary>
              value={query}
              onChange={(v) => { setQuery(v); setShowSuggestions(true); if (!v) setSelectedMaterial(null); }}
              placeholder="Search materials…"
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              onShowSuggestions={setShowSuggestions}
              getKey={(m) => m.uid}
              isActive={(m) => m.uid === selectedMaterial?.uid}
              onSelect={handleSelect}
              renderSuggestion={(m) => <span>{m.name ?? m.uid}</span>}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-60">Price per unit (cr)</label>
            <input
              className={INPUT}
              type="number"
              min={0}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="e.g. 120000"
              disabled={!selectedMaterial}
            />
          </div>
        </div>
        {saveError && <p className="text-red-400 text-xs m-0">{saveError}</p>}
        <button className={BTN} type="button" onClick={handleSave} disabled={!selectedMaterial || saving}>
          {saving ? "Saving…" : "Save Price"}
        </button>
      </div>

      {/* Price list */}
      <div className="panel">
        <h3 className="text-xs font-semibold opacity-60 uppercase tracking-wide m-0 mb-3">
          Current Prices ({prices.length})
        </h3>
        {loading && <p className="text-xs opacity-50">Loading…</p>}
        {!loading && prices.length === 0 && <p className="text-xs opacity-50">No prices set yet.</p>}
        {prices.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-2 pr-3 font-semibold opacity-70">Material</th>
                <th className="py-2 pr-3 font-semibold opacity-70 text-right">Price/unit</th>
                <th className="py-2 pr-3 font-semibold opacity-70 hidden sm:table-cell">Set by</th>
                <th className="py-2 font-semibold opacity-70 hidden sm:table-cell">Updated</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.material_uid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2 pr-3">{p.material_name}</td>
                  <td className="py-2 pr-3 tabular-nums text-right text-amber-300 font-semibold">{fmtC(p.price_per_unit)}</td>
                  <td className="py-2 pr-3 opacity-50 text-xs hidden sm:table-cell">{p.set_by?.swc_handle ?? "—"}</td>
                  <td className="py-2 pr-3 opacity-50 text-xs hidden sm:table-cell">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className={BTN_SM} type="button" onClick={() => {
                        const m = materials.find((mat) => mat.uid === p.material_uid);
                        if (m) handleSelect(m);
                      }}>Edit</button>
                      <button className={BTN_GHOST_SM} type="button" onClick={() => handleDelete(p.material_uid)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
