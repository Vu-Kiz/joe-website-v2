import React, { useEffect, useMemo, useState } from "react";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import { BTN_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import {
  getStoredShipTypes,
  getStoredVehicleTypes,
  getStoredFacilityTypes,
  getStoredStationTypes,
  type StoredShipTypeSummary,
  type StoredVehicleTypeSummary,
  type StoredFacilityTypeSummary,
  type StoredStationTypeSummary,
} from "../../api/universe/universe";
import ReportBugButton from "../support/ReportBugButton";
import { getMySkills } from "../../api/universe/fleetCommander";
import { BTN_GHOST_SM } from "../../utils/ui";

type RecyclerType = "station_facility" | "ship" | "vehicle";
type EntityCondition = "intact" | "wreck";

const RECYCLER_LABELS: Record<RecyclerType, string> = {
  station_facility: "Station / Facility",
  ship: "Ship",
  vehicle: "Vehicle",
};

type MaterialEntry = { name: string; quantity: number };

type EntityOption = {
  uid: string;
  name: string;
  class_name: string | null;
  totalMaterials: number;
  materials: MaterialEntry[];
  rmp: number | null;
};

type EntityCategory = "ship" | "vehicle" | "facility" | "station";

const CATEGORY_LABELS: Record<EntityCategory, string> = {
  ship: "Ship",
  vehicle: "Vehicle",
  facility: "Facility",
  station: "Station",
};

function parseMaterials(raw: unknown): MaterialEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).flatMap((m) => {
    const name = typeof m.name === "string" ? m.name : null;
    const qty = typeof m.quantity === "number" ? m.quantity : parseFloat(String(m.quantity ?? 0));
    if (!name || isNaN(qty) || qty <= 0) return [];
    return [{ name, quantity: qty }];
  });
}

function formatTime(hours: number): string {
  if (hours <= 0) return "0s";
  const totalSeconds = Math.round(hours * 3600);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ") || "0s";
}

const RecyclingCalculatorPanel: React.FC = () => {
  const [shipTypes, setShipTypes] = useState<StoredShipTypeSummary[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<StoredVehicleTypeSummary[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<StoredFacilityTypeSummary[]>([]);
  const [stationTypes, setStationTypes] = useState<StoredStationTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entityCategory, setEntityCategory] = useState<EntityCategory>("ship");
  const [selectedEntityUid, setSelectedEntityUid] = useState<string>("");
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialEntry[]>([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualMatReq, setManualMatReq] = useState("");
  const [repairSkill, setRepairSkill] = useState("0");
  const [skillsPulling, setSkillsPulling] = useState(false);
  const [skillsPulled, setSkillsPulled] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [condition, setCondition] = useState<EntityCondition>("intact");
  const [recyclerType, setRecyclerType] = useState<RecyclerType>("vehicle");
  const [rmpCredits, setRmpCredits] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      getStoredShipTypes(),
      getStoredVehicleTypes(),
      getStoredFacilityTypes(),
      getStoredStationTypes(),
    ])
      .then(([s, v, f, st]) => {
        if (cancelled) return;
        setShipTypes(s.data ?? []);
        setVehicleTypes(v.data ?? []);
        setFacilityTypes(f.data ?? []);
        setStationTypes(st.data ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load entity data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const categoryOptions = useMemo<Record<EntityCategory, EntityOption[]>>(() => {
    function toOpts<T extends { uid: string; name?: string | null; class_name?: string | null; materials?: unknown; price_credits?: number | null }>(
      items: T[]
    ): EntityOption[] {
      return items
        .map((i) => {
          const mats = parseMaterials(i.materials);
          const total = mats.reduce((s, m) => s + m.quantity, 0);
          return {
            uid: i.uid,
            name: i.name ?? i.uid,
            class_name: i.class_name ?? null,
            totalMaterials: total,
            materials: mats,
            rmp: i.price_credits ?? null,
          };
        })
        .filter((o) => o.totalMaterials > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return {
      ship: toOpts(shipTypes),
      vehicle: toOpts(vehicleTypes),
      facility: toOpts(facilityTypes),
      station: toOpts(stationTypes),
    };
  }, [shipTypes, vehicleTypes, facilityTypes, stationTypes]);

  const options = categoryOptions[entityCategory];
  const selectedEntity = options.find((o) => o.uid === selectedEntityUid) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options.slice(0, 40);
  }, [options, query]);

  function categoryToRecyclerType(cat: EntityCategory): RecyclerType {
    if (cat === "ship") return "ship";
    if (cat === "facility" || cat === "station") return "station_facility";
    return "vehicle";
  }

  function handleCategoryChange(cat: EntityCategory) {
    setEntityCategory(cat);
    setRecyclerType(categoryToRecyclerType(cat));
    setSelectedEntityUid("");
    setSelectedMaterials([]);
    setQuery("");
    setManualMatReq("");
    setRmpCredits("");
  }

  function handleSelectEntity(entity: EntityOption) {
    setSelectedEntityUid(entity.uid);
    setSelectedMaterials(entity.materials);
    setQuery(entity.name);
    setManualMatReq(String(Math.round(entity.totalMaterials)));
    if (entity.rmp != null) setRmpCredits(String(entity.rmp));
  }

  function handleClearEntity() {
    setSelectedEntityUid("");
    setSelectedMaterials([]);
    setQuery("");
    setManualMatReq("");
    setRmpCredits("");
  }

  async function handlePullSkills() {
    setSkillsPulling(true);
    setSkillsError(null);
    try {
      const res = await getMySkills();
      const repair = res.data?.repair;
      if (repair != null) {
        setRepairSkill(String(Math.round(repair)));
        setSkillsPulled(true);
      } else {
        setSkillsError("Repair skill not found in your SWC profile.");
      }
    } catch {
      setSkillsError("Couldn't pull skills — check your Chain Code connection.");
    } finally {
      setSkillsPulling(false);
    }
  }

  const skill = Math.min(5, Math.max(0, parseInt(repairSkill, 10) || 0));
  const matReq = parseFloat(manualMatReq) || 0;
  const rmp = parseFloat(rmpCredits) || 0;

  const base = condition === "wreck" ? 20 : 50;
  const returnModifier = base + skill;
  const timeModifier = base - skill;

  const timeMultiplier =
    recyclerType === "station_facility" ? 0.40
    : recyclerType === "ship" ? 0.60
    : 1.0;

  const timeHours = matReq > 0 ? (matReq * 20 * (timeModifier / 60) * timeMultiplier) / 60 : 0;
  const materialsReturned = matReq > 0 ? matReq * (returnModifier / 100) : 0;
  const recycleCost = rmp > 0 ? rmp * 0.5 : null;

  const materialBreakdown = useMemo<Array<{ name: string; required: number; returned: number }>>(() => {
    if (selectedMaterials.length === 0) return [];
    return selectedMaterials
      .map((m) => ({
        name: m.name,
        required: m.quantity,
        returned: m.quantity * (returnModifier / 100),
      }))
      .sort((a, b) => b.required - a.required);
  }, [selectedMaterials, returnModifier]);

  const hasResult = matReq > 0;

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtC = (n: number) => n.toLocaleString() + " cr";

  return (
    <div className="max-w-275 mx-auto p-4 max-[767px]:px-2 max-[767px]:py-3">
      <div className="mb-5">
        <h1 className="text-[1.4rem] font-semibold m-0">Recycling Calculator</h1>
        <p className="small opacity-70 m-0">
          Estimate recycling time, materials returned, and cost.
        </p>
        <div className="mt-2">
          <ReportBugButton toolKey="recycling_calculator" toolLabel="Recycling Calculator" />
        </div>
      </div>

      {error && <p className="small mb-4" style={{ color: "salmon" }}>{error}</p>}

      {loading ? (
        <p className="small opacity-60">Loading entity data…</p>
      ) : (
        <>
          <div className="panel mb-4 space-y-4">
            <h2 className="text-sm font-semibold opacity-80 m-0">Entity Being Recycled</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Category</label>
                <select
                  className={SELECT_INPUT}
                  value={entityCategory}
                  onChange={(e) => handleCategoryChange(e.target.value as EntityCategory)}
                >
                  {(Object.keys(CATEGORY_LABELS) as EntityCategory[]).map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Condition</label>
                <select
                  className={SELECT_INPUT}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as EntityCondition)}
                >
                  <option value="intact">Non-Wreck</option>
                  <option value="wreck">Wreck</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">
                {CATEGORY_LABELS[entityCategory]} (optional — auto-fills materials)
              </label>
              <div className="relative flex items-center *:first:flex-1">
                <SearchSuggestionPicker
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    if (!v) { setSelectedEntityUid(""); setSelectedMaterials([]); setManualMatReq(""); setRmpCredits(""); }
                  }}
                  placeholder={`Search ${CATEGORY_LABELS[entityCategory].toLowerCase()}…`}
                  suggestions={filtered}
                  showSuggestions={showSuggestions}
                  onShowSuggestions={setShowSuggestions}
                  getKey={(o) => o.uid}
                  isActive={(o) => o.uid === selectedEntityUid}
                  onSelect={handleSelectEntity}
                  renderSuggestion={(o) => (
                    <>
                      <strong>{o.name}</strong>
                      {o.class_name && <span className="small opacity-60">{o.class_name}</span>}
                    </>
                  )}
                />
                {selectedEntityUid && (
                  <button
                    type="button"
                    className={BTN_SM + " absolute right-1.5 top-1/2 -translate-y-1/2"}
                    onClick={handleClearEntity}
                  >
                    ×
                  </button>
                )}
              </div>
              {selectedEntity && (
                <p className="text-[0.72rem] opacity-50 m-0 pl-1">
                  {fmt(selectedEntity.totalMaterials)} total material units · {selectedEntity.materials.length} material type{selectedEntity.materials.length !== 1 ? "s" : ""}
                  {selectedEntity.rmp != null ? ` · RMP: ${fmtC(selectedEntity.rmp)}` : ""}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">
                  Total Material Requirement
                </label>
                <input
                  type="number"
                  className={INPUT}
                  min={1}
                  step={1}
                  placeholder="e.g. 5000"
                  value={manualMatReq}
                  onChange={(e) => { setManualMatReq(e.target.value); setSelectedEntityUid(""); setSelectedMaterials([]); setQuery(""); }}
                />
                <p className="text-[0.72rem] opacity-40 m-0">Sum of all materials needed to build this entity</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">
                  Production Cost / RMP (cr)
                </label>
                <input
                  type="number"
                  className={INPUT}
                  min={0}
                  step={1}
                  placeholder="optional"
                  value={rmpCredits}
                  onChange={(e) => setRmpCredits(e.target.value)}
                />
                <p className="text-[0.72rem] opacity-40 m-0">Used to estimate the 50% recycling cost</p>
              </div>
            </div>
          </div>

          <div className="panel mb-4 space-y-4">
            <h2 className="text-sm font-semibold opacity-80 m-0">Recycler Settings</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Recycler Type</label>
                <select
                  className={SELECT_INPUT}
                  value={recyclerType}
                  onChange={(e) => setRecyclerType(e.target.value as RecyclerType)}
                >
                  {(Object.keys(RECYCLER_LABELS) as RecyclerType[]).map((t) => (
                    <option key={t} value={t}>{RECYCLER_LABELS[t]}</option>
                  ))}
                </select>
                <p className="text-[0.72rem] opacity-40 m-0">
                  Station/Facility is 60% faster than vehicle; Ship is 40% faster
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Repair Skill (0–5)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    className={INPUT}
                    min={0}
                    max={5}
                    step={1}
                    value={repairSkill}
                    onChange={(e) => setRepairSkill(e.target.value)}
                  />
                  <button
                    type="button"
                    className={BTN_GHOST_SM + " shrink-0"}
                    onClick={() => { void handlePullSkills(); }}
                    disabled={skillsPulling}
                  >
                    {skillsPulling ? "Pulling…" : skillsPulled ? "Pulled ✓" : "Pull from SWC"}
                  </button>
                </div>
                {skillsError && <p className="text-[0.72rem] m-0" style={{ color: "salmon" }}>{skillsError}</p>}
              </div>
            </div>
          </div>

          {hasResult ? (
            <>
              <div className="panel mb-4">
                <h2 className="text-sm font-semibold opacity-80 m-0 mb-4">Results</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Recycling Time</p>
                    <p className="text-lg font-semibold text-amber-300 m-0">{formatTime(timeHours)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">
                      Time mod: {base} − {skill} = {timeModifier}
                      {" · "}
                      {recyclerType === "station_facility" ? "×0.40" : recyclerType === "ship" ? "×0.60" : "×1.00"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Materials Returned</p>
                    <p className="text-lg font-semibold text-green-400 m-0">{fmt(materialsReturned)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">
                      {returnModifier}% of {fmt(matReq)} units
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Materials Lost</p>
                    <p className="text-lg font-semibold opacity-70 m-0">{fmt(matReq - materialsReturned)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">{100 - returnModifier}% not recovered</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Recycling Cost</p>
                    {recycleCost != null ? (
                      <>
                        <p className="text-lg font-semibold text-red-400 m-0">{fmtC(recycleCost)}</p>
                        <p className="text-[0.72rem] opacity-50 m-0">50% of {fmtC(rmp)} RMP</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold opacity-40 m-0">—</p>
                        <p className="text-[0.72rem] opacity-40 m-0">Enter RMP above to calculate</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {materialBreakdown.length > 0 && (
                <div className="panel mb-4">
                  <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Material Breakdown</h2>
                  <p className="text-[0.72rem] opacity-50 m-0 mb-3">
                    Per-material return at {returnModifier}% modifier.
                  </p>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="py-2 pr-3 font-semibold opacity-70">Material</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 text-right">Required</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 text-right">Returned</th>
                        <th className="py-2 font-semibold opacity-70 text-right">Lost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialBreakdown.map((m) => (
                        <tr key={m.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 pr-3">{m.name}</td>
                          <td className="py-2 pr-3 tabular-nums text-right opacity-60">{fmt(m.required)}</td>
                          <td className="py-2 pr-3 tabular-nums text-right font-semibold text-green-400">{fmt(m.returned)}</td>
                          <td className="py-2 tabular-nums text-right opacity-50">{fmt(m.required - m.returned)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20">
                        <td className="py-2 pr-3 font-semibold opacity-70">Total</td>
                        <td className="py-2 pr-3 tabular-nums text-right opacity-60 font-semibold">{fmt(matReq)}</td>
                        <td className="py-2 pr-3 tabular-nums text-right font-semibold text-green-400">{fmt(materialsReturned)}</td>
                        <td className="py-2 tabular-nums text-right opacity-50 font-semibold">{fmt(matReq - materialsReturned)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="small opacity-40 text-center py-8">
              Select an entity or enter a material requirement above to see recycling estimates.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default RecyclingCalculatorPanel;
