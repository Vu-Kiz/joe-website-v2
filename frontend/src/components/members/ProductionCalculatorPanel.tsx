import React, { useEffect, useMemo, useState } from "react";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import { BTN, BTN_GHOST, BTN_GHOST_SM, BTN_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import {
  getStoredDroidTypes,
  getStoredFacilityTypes,
  getStoredItemTypes,
  getStoredMaterialTypes,
  getStoredShipTypes,
  getStoredStationTypes,
  getStoredVehicleTypes,
  type StoredDroidTypeSummary,
  type StoredFacilityTypeSummary,
  type StoredItemTypeSummary,
  type StoredMaterialTypeSummary,
  type StoredShipTypeSummary,
  type StoredStationTypeSummary,
  type StoredVehicleTypeSummary,
} from "../../api/universe/universe";
import { getMySkills } from "../../api/universe/fleetCommander";
import { getMaterialPrices, type MaterialPrice } from "../../api/member/materialPrices";
import ReportBugButton from "../support/ReportBugButton";
import SlideTabNav from "../common/SlideTabNav";

type ProdCategory = "ship" | "vehicle" | "droid" | "item" | "weapon";

const CATEGORY_LABELS: Record<ProdCategory, string> = {
  ship: "Ship",
  vehicle: "Vehicle",
  droid: "Droid",
  item: "Item",
  weapon: "Weapon",
};

const ITEM_LIKE: Set<ProdCategory> = new Set(["item", "weapon"]);

type MaterialEntry = { name: string; quantity: number };

type ProdEntityOption = {
  uid: string;
  name: string;
  class_name: string | null;
  length: number | null;
  production_modifier: number | null;
  recommended_workers: number | null;
  weight_tonnes: number | null;
  batch_quantity: number | null;
  materials: MaterialEntry[];
  price_credits: number | null;
};

type ProdRow = {
  id: string;
  category: ProdCategory;
  entityUid: string;
  quantity: string;
};

type FacilityRow = {
  id: string;
  facilityUid: string;
  quantity: string;
};

type FacilityEntityOption = {
  uid: string;
  name: string;
  size: string | null;
  materials: MaterialEntry[];
  price_credits: number | null;
};

type SavedPlan = { id: string; name: string; rows: ProdRow[]; settings: Partial<ProdSettings> };

type ProdSettings = {
  managementSkill: string;
  workerCount: string;
  locationMod: "1" | "0.9";
  civLevel: string;
  buildCivLevel: string;
  crimeLevel: string;
  moraleLevel: string;
  taxLevel: string;
};

const DEFAULT_SETTINGS: ProdSettings = {
  managementSkill: "0",
  workerCount: "",
  locationMod: "1",
  civLevel: "0",
  buildCivLevel: "0",
  crimeLevel: "50",
  moraleLevel: "50",
  taxLevel: "0",
};

const STORAGE_KEY = "joe_production_plans";

let _rowCounter = 0;
function newRowId() { return `prow-${++_rowCounter}`; }

function loadSavedPlans(): SavedPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedPlan[]) : [];
  } catch { return []; }
}

function parseMaterials(raw: Array<Record<string, unknown>> | Record<string, unknown> | null): MaterialEntry[] {
  if (!raw) return [];

  // Item/weapon format: {material: ["quantum", "meleenium", ...], @attributes: {count: "4"}}
  if (!Array.isArray(raw) && typeof raw === "object") {
    const matField = (raw as Record<string, unknown>).material;
    const names = Array.isArray(matField) ? matField : (typeof matField === "string" ? [matField] : []);
    return (names as unknown[]).flatMap((n) => {
      if (typeof n !== "string" || !n.trim()) return [];
      return [{ name: n.trim(), quantity: 1 }];
    });
  }

  // Ship/vehicle/droid format: [{name, quantity}, ...]
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      const name = typeof item.name === "string" ? item.name : null;
      const qty = typeof item.quantity === "number" ? item.quantity
        : typeof item.quantity === "string" ? parseFloat(item.quantity) : null;
      if (!name) return [];
      const resolvedQty = (qty == null || isNaN(qty as number)) ? 1 : qty;
      if (resolvedQty <= 0) return [];
      return [{ name, quantity: resolvedQty }];
    });
  }

  return [];
}


function getDelayMultiplier(category: ProdCategory, className: string | null, length: number | null): number {
  const cls = (className ?? "").toLowerCase();
  const isCapital = cls.includes("capital");
  if (isCapital) {
    const len = length ?? 0;
    if (len >= 3000) return 1.5;
    if (len >= 200) return 2;
    return 3.5;
  }
  if (category === "ship") return 2; // fighters, freighters, etc.
  if (category === "vehicle") return 2;
  if (category === "droid") return 2;
  if (category === "item" || category === "weapon") return 2;
  return 1;
}


function calcProductionXp(category: ProdCategory, rmp: number, qty: number, batchQuantity: number | null): number {
  const XP_MULTIPLIER = 2.2;
  let base: number;
  if (category === "item" || category === "weapon") {
    const totalOutput = batchQuantity != null ? qty * batchQuantity : qty;
    base = Math.ceil(totalOutput * 0.17);
  } else if (category === "ship") {
    base = 2 + Math.floor((rmp / 85000) * qty);
  } else if (category === "vehicle") {
    base = 2 + Math.floor((rmp / 50000) * qty);
  } else {
    // droid
    base = 1 + Math.floor((rmp / 60000) * qty);
  }
  return Math.round(base * XP_MULTIPLIER);
}

function calcDays(
  totalMaterials: number,
  prodMod: number,
  management: number,
  civLevel: number,
  locationMod: number,
  quantity: number,
  random: number,
  delayMult: number
): number {
  if (prodMod <= 0 || quantity <= 0) return 0;
  const mpf = Math.pow(Math.min(Math.max(quantity, 1), 52), -0.04);
  const civFactor = Math.max(0.05, 1 - civLevel / 800);
  const managementFactor = Math.max(0, 1.2 - management / 25);
  return (totalMaterials / prodMod) * managementFactor * civFactor * locationMod * quantity * mpf * delayMult * random;
}

function calcFacilityDays(materialSum: number, management: number, workers: number, civLevel: number, random: number): number {
  if (workers <= 0 || materialSum <= 0) return 0;
  const civMod = Math.max(1.1 - civLevel, 0.5);
  return (materialSum / 48) * (1 - management / 50) / workers * civMod * random;
}

function calcFacilityCost(rmp: number, crime: number, morale: number, tax: number, random: number, qty: number): number {
  return Math.round(rmp * (1 + crime) * (2 - morale) * random * qty + rmp * tax * qty);
}

function calcFacilityXp(rmp: number): number {
  return Math.round((2 + Math.floor(rmp / 10000)) * 1.3);
}

function calcStationDays(materialSum: number, management: number, npcs: number, civLevel: number, random: number): number {
  if (materialSum <= 0 || npcs <= 0) return 0;
  const npcFactor = Math.pow(Math.max(0, 1 - npcs / 250), management);
  const civFactor = Math.max(0, 1 - civLevel / 5);
  return (materialSum / 250) * npcFactor * civFactor * random;
}

function calcStationXp(rmp: number): number {
  return Math.round((50 + rmp / 100000) * 1.5);
}

function formatDays(days: number): string {
  if (days <= 0) return "0 hours";
  const d = Math.floor(days);
  const h = Math.floor((days - d) * 24);
  const m = Math.floor(((days - d) * 24 - h) * 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 && d === 0) parts.push(`${m}m`);
  return parts.join(" ") || "<1m";
}


const ProdRowInput: React.FC<{
  row: ProdRow;
  categoryOptions: Record<ProdCategory, ProdEntityOption[]>;
  onRecommendedWorkers: (n: number) => void;
  onChange: (row: ProdRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}> = ({ row, categoryOptions, onRecommendedWorkers, onChange, onRemove, canRemove }) => {
  const options = categoryOptions[row.category];
  const selectedEntity = options.find((o) => o.uid === row.entityUid) ?? null;
  const [query, setQuery] = useState(selectedEntity?.name ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options.slice(0, 40);
  }, [options, query]);

  function handleCategoryChange(cat: ProdCategory) {
    setQuery("");
    onChange({ ...row, category: cat, entityUid: "" });
  }

  function handleSelect(entity: ProdEntityOption) {
    setQuery(entity.name);
    onChange({ ...row, entityUid: entity.uid });
    if (entity.recommended_workers) onRecommendedWorkers(entity.recommended_workers);
  }

  function handleClear() {
    setQuery("");
    onChange({ ...row, entityUid: "" });
  }

  return (
    <div className="flex gap-2 flex-wrap items-end p-3 rounded-lg border border-white/10 bg-white/3">
      <div className="flex flex-col gap-1 min-w-30">
        <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Category</label>
        <select className={SELECT_INPUT} value={row.category} onChange={(e) => handleCategoryChange(e.target.value as ProdCategory)}>
          {(Object.keys(CATEGORY_LABELS) as ProdCategory[]).map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-50">
        <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">{CATEGORY_LABELS[row.category]}</label>
        <div className="relative flex items-center *:first:flex-1">
          <SearchSuggestionPicker
            value={query}
            onChange={(v) => { setQuery(v); if (!v) onChange({ ...row, entityUid: "" }); }}
            placeholder={`Search ${CATEGORY_LABELS[row.category].toLowerCase()}…`}
            suggestions={filtered}
            showSuggestions={showSuggestions}
            onShowSuggestions={setShowSuggestions}
            getKey={(o) => o.uid}
            isActive={(o) => o.uid === row.entityUid}
            onSelect={handleSelect}
            renderSuggestion={(o) => (
              <>
                <strong>{o.name}</strong>
                {o.class_name && <span className="small opacity-60">{o.class_name}{o.length ? ` · ${o.length}m` : ""}</span>}
              </>
            )}
          />
          {row.entityUid && (
            <button type="button" className={BTN_SM + " absolute right-1.5 top-1/2 -translate-y-1/2"} onClick={handleClear} title="Clear">×</button>
          )}
        </div>
        {selectedEntity && (
          <p className="text-[0.72rem] opacity-50 m-0 pl-1">
            Recommended workers: {selectedEntity.recommended_workers ?? "—"}
            {(() => {
              const bq = selectedEntity.batch_quantity
                ?? (selectedEntity.weight_tonnes && selectedEntity.weight_tonnes > 0
                  ? Math.round(0.5 / Math.sqrt(selectedEntity.weight_tonnes))
                  : null);
              return bq != null ? ` · Batch qty: ${bq}` : "";
            })()}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 w-25">
        <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">
          {row.category === "droid" ? "Batches" : "Qty"}
        </label>
        <input type="number" className={INPUT} min={1} max={48} step={1} value={row.quantity}
          onChange={(e) => onChange({ ...row, quantity: e.target.value })} />
      </div>

      <button type="button" className={BTN_SM + " self-end"} onClick={onRemove} disabled={!canRemove} title="Remove">✕</button>
    </div>
  );
};

const FacilityRowInput: React.FC<{
  row: FacilityRow;
  options: FacilityEntityOption[];
  label?: string;
  onChange: (row: FacilityRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}> = ({ row, options, label = "Facility", onChange, onRemove, canRemove }) => {
  const selected = options.find((o) => o.uid === row.facilityUid) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options.slice(0, 40);
  }, [options, query]);

  return (
    <div className="flex gap-2 flex-wrap items-end p-3 rounded-lg border border-white/10 bg-white/3">
      <div className="flex flex-col gap-1 flex-1 min-w-50">
        <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">{label}</label>
        <div className="relative flex items-center *:first:flex-1">
          <SearchSuggestionPicker
            value={query}
            onChange={(v) => { setQuery(v); if (!v) onChange({ ...row, facilityUid: "" }); }}
            placeholder={`Search ${label.toLowerCase()}…`}
            suggestions={filtered}
            showSuggestions={showSuggestions}
            onShowSuggestions={setShowSuggestions}
            getKey={(o) => o.uid}
            isActive={(o) => o.uid === row.facilityUid}
            onSelect={(o) => { setQuery(o.name); onChange({ ...row, facilityUid: o.uid }); }}
            renderSuggestion={(o) => (
              <>
                <strong>{o.name}</strong>
                {o.size && <span className="small opacity-60">{o.size}</span>}
              </>
            )}
          />
          {row.facilityUid && (
            <button type="button" className={BTN_SM + " absolute right-1.5 top-1/2 -translate-y-1/2"}
              onClick={() => { setQuery(""); onChange({ ...row, facilityUid: "" }); }}>×</button>
          )}
        </div>
        {selected && (
          <p className="text-[0.72rem] opacity-50 m-0 pl-1">
            {selected.materials.length > 0
              ? `${selected.materials.reduce((s, m) => s + m.quantity, 0).toLocaleString()} total material units`
              : "No material data"}
            {selected.price_credits ? ` · RMP: ${selected.price_credits.toLocaleString()} cr` : ""}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 w-25">
        <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Qty</label>
        <input type="number" className={INPUT} min={1} step={1} value={row.quantity}
          onChange={(e) => onChange({ ...row, quantity: e.target.value })} />
      </div>

      <button type="button" className={BTN_SM + " self-end"} onClick={onRemove} disabled={!canRemove} title="Remove">✕</button>
    </div>
  );
};

const SavePlanModal: React.FC<{ onSave: (name: string) => void; onClose: () => void }> = ({ onSave, onClose }) => {
  const [name, setName] = useState("");
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-1200 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div className="flex flex-col gap-4 w-full max-w-105 p-4 rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,28,34,0.98),rgba(19,20,25,0.98))] shadow-[0_20px_44px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 mb-1 text-white/50 text-[0.72rem] font-bold tracking-[0.08em] uppercase">Production Plan</p>
            <h3 className="m-0 text-[1.1rem]">Save Plan</h3>
          </div>
          <button className={BTN_GHOST + " shrink-0"} type="button" onClick={onClose}>Close</button>
        </div>
        <input type="text" className={INPUT} placeholder="Plan name…" value={name} autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }} />
        <div className="flex gap-2 justify-end">
          <button className={BTN_GHOST} type="button" onClick={onClose}>Cancel</button>
          <button className={BTN} type="button" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
        </div>
      </div>
    </div>
  );
};

const ProductionCalculatorPanel: React.FC<{
  onPushToHaul?: (materials: Array<{ name: string; quantity: number }>) => void;
}> = ({ onPushToHaul }) => {
  const [mode, setMode] = useState<"batch" | "facility" | "station">("batch");
  const [rows, setRows] = useState<ProdRow[]>([{ id: newRowId(), category: "ship", entityUid: "", quantity: "1" }]);
  const [facilityRows, setFacilityRows] = useState<FacilityRow[]>([{ id: newRowId(), facilityUid: "", quantity: "1" }]);
  const [stationRows, setStationRows] = useState<FacilityRow[]>([{ id: newRowId(), facilityUid: "", quantity: "1" }]);
  const [settings, setSettings] = useState<ProdSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(loadSavedPlans);
  const [skillsPulling, setSkillsPulling] = useState(false);
  const [skillsPulled, setSkillsPulled] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const [shipTypes, setShipTypes] = useState<StoredShipTypeSummary[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<StoredVehicleTypeSummary[]>([]);
  const [droidTypes, setDroidTypes] = useState<StoredDroidTypeSummary[]>([]);
  const [itemTypes, setItemTypes] = useState<StoredItemTypeSummary[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<StoredFacilityTypeSummary[]>([]);
  const [stationTypes, setStationTypes] = useState<StoredStationTypeSummary[]>([]);
  const [materialTypes, setMaterialTypes] = useState<StoredMaterialTypeSummary[]>([]);
  const [internalPrices, setInternalPrices] = useState<MaterialPrice[]>([]);
  const [matPriceTab, setMatPriceTab] = useState<"rmp" | "internal">("rmp");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      getStoredShipTypes(), getStoredVehicleTypes(), getStoredDroidTypes(),
      getStoredItemTypes(), getStoredFacilityTypes(),
      getStoredStationTypes(), getStoredMaterialTypes(),
      getMaterialPrices(),
    ])
      .then(([s, v, d, i, f, st, m, mp]) => {
        if (cancelled) return;
        setShipTypes(s.data ?? []);
        setVehicleTypes(v.data ?? []);
        setDroidTypes(d.data ?? []);
        setItemTypes(i.data ?? []);
        setFacilityTypes(f.data ?? []);
        setStationTypes(st.data ?? []);
        setMaterialTypes(m.data ?? []);
        setInternalPrices(mp.data ?? []);
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

const matPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    materialTypes.forEach((m) => { if (m.name) map.set(m.name.toLowerCase(), m.price_credits ?? 0); });
    return map;
  }, [materialTypes]);

  const internalPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    internalPrices.forEach((p) => { map.set(p.material_name.toLowerCase(), p.price_per_unit); });
    return map;
  }, [internalPrices]);

  const categoryOptions = useMemo<Record<ProdCategory, ProdEntityOption[]>>(() => {
    function toOption(
      items: Array<StoredShipTypeSummary | StoredVehicleTypeSummary | StoredDroidTypeSummary | StoredItemTypeSummary>,
      allowPriceAsFallback = false
    ): ProdEntityOption[] {
      return items
        .map((i) => ({
          uid: i.uid,
          name: i.name ?? i.uid,
          class_name: (i as StoredShipTypeSummary).class_name ?? null,
          length: (i as StoredShipTypeSummary).length ?? null,
          production_modifier: (i as StoredShipTypeSummary).production_modifier ?? null,
          recommended_workers: (i as StoredShipTypeSummary).recommended_workers ?? null,
          weight_tonnes: (i as StoredShipTypeSummary).weight_tonnes ?? null,
          batch_quantity: (i as StoredDroidTypeSummary | StoredItemTypeSummary).batch_quantity ?? null,
          materials: parseMaterials((i as StoredShipTypeSummary).materials ?? null),
          price_credits: i.price_credits ?? null,
        }))
        .filter((o) => {
          if (!o.production_modifier || o.production_modifier <= 0) return false;
          if (allowPriceAsFallback) return o.price_credits != null && o.price_credits > 0;
          return o.materials.length > 0;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const EXCLUDED_CLASSES = new Set(["trophy", "items"]);
    const isExcluded = (i: StoredItemTypeSummary) => EXCLUDED_CLASSES.has((i.class_name ?? "").toLowerCase());
    const isWeaponItem = (i: StoredItemTypeSummary) => {
      const cls = ((i.class_name ?? "") + " " + (i.class_uid ?? "")).toLowerCase();
      return cls.includes("weapon") || cls.includes("explosiv") || cls.includes("melee") || cls.includes("projectile");
    };
    return {
      ship: toOption(shipTypes),
      vehicle: toOption(vehicleTypes),
      droid: toOption(droidTypes),
      item: toOption(itemTypes.filter((i) => !isWeaponItem(i) && !isExcluded(i)), true),
      weapon: toOption(itemTypes.filter((i) => isWeaponItem(i) && !isExcluded(i)), true),
    };
  }, [shipTypes, vehicleTypes, droidTypes, itemTypes]);

  const entityLookup = useMemo(() => {
    const map = new Map<string, ProdEntityOption>();
    Object.values(categoryOptions).forEach((opts) => opts.forEach((o) => map.set(o.uid, o)));
    return map;
  }, [categoryOptions]);

  const parsedSettings = useMemo(() => ({
    management: Math.min(5, Math.max(0, parseFloat(settings.managementSkill) || 0)),
    workers: parseInt(settings.workerCount, 10) || 0,
    locationMod: parseFloat(settings.locationMod) as 1 | 0.9,
    civLevel: Math.min(100, Math.max(0, parseFloat(settings.civLevel) || 0)),
    crime: Math.min(1, Math.max(0, (parseFloat(settings.crimeLevel) || 0) / 100)),
    morale: Math.min(1, Math.max(0, (parseFloat(settings.moraleLevel) || 0) / 100)),
    tax: Math.min(1, Math.max(0, (parseFloat(settings.taxLevel) || 0) / 100)),
    buildCivLevel: Math.min(1, Math.max(0, (parseFloat(settings.buildCivLevel) || 0) / 100)),
  }), [settings]);

  type RowResult = {
    row: ProdRow;
    entity: ProdEntityOption;
    qty: number;
    batchOutput: number;
    xp: number;
    totalMaterials: number;
    rmp: number;
    daysMin: number;
    daysMax: number;
    costMin: number;
    costMax: number;
    delayMult: number;
  };

  const rowResults = useMemo<RowResult[]>(() => {
    return rows.flatMap((row) => {
      const entity = entityLookup.get(row.entityUid);
      const qty = parseInt(row.quantity, 10);
      if (!entity || !Number.isFinite(qty) || qty <= 0) return [];
      const prodMod = entity.production_modifier;
      if (!prodMod || prodMod <= 0) return [];

      const isItemLike = ITEM_LIKE.has(row.category);
      const rmpPerEntity = entity.materials.length > 0
        ? entity.materials.reduce((s, m) => s + m.quantity * (matPriceMap.get(m.name.toLowerCase()) ?? 0), 0)
        : (entity.price_credits ?? 0);
      const totalMaterialsPerEntity = isItemLike
        ? 2.5 * Math.pow(rmpPerEntity, 0.4)
        : entity.materials.reduce((s, m) => s + m.quantity, 0);
      const delayMult = getDelayMultiplier(row.category, entity.class_name, entity.length);
      const daysMin = calcDays(totalMaterialsPerEntity, prodMod, parsedSettings.management, parsedSettings.civLevel, parsedSettings.locationMod, qty, 0.95, delayMult);
      const daysMax = calcDays(totalMaterialsPerEntity, prodMod, parsedSettings.management, parsedSettings.civLevel, parsedSettings.locationMod, qty, 1.05, delayMult);

      const massProd = Math.pow(qty, -0.04);
      const prodCostFactor = 1.5 - 0.5 * (parsedSettings.morale - parsedSettings.crime);
      const costMin = Math.round((rmpPerEntity * prodCostFactor * 1.2) * qty * massProd + rmpPerEntity * parsedSettings.tax * qty);
      const costMax = Math.round((rmpPerEntity * prodCostFactor * 1.3) * qty * massProd + rmpPerEntity * parsedSettings.tax * qty);

      const batchOutput = (entity.batch_quantity ?? 1) * qty;
      const xp = calcProductionXp(row.category, rmpPerEntity, qty, entity.batch_quantity ?? null);
      return [{ row, entity, qty, batchOutput, xp, totalMaterials: totalMaterialsPerEntity, rmp: rmpPerEntity, daysMin, daysMax, costMin, costMax, delayMult }];
    });
  }, [rows, entityLookup, parsedSettings, matPriceMap]);

  const aggregatedMaterials = useMemo(() => {
    const map = new Map<string, number>();
    for (const result of rowResults) {
      for (const mat of result.entity.materials) {
        map.set(mat.name, (map.get(mat.name) ?? 0) + mat.quantity * result.qty);
      }
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty, priceEach: matPriceMap.get(name.toLowerCase()) ?? 0 }))
      .sort((a, b) => b.qty - a.qty);
  }, [rowResults, matPriceMap]);

  const totals = useMemo(() => ({
    daysMin: rowResults.reduce((s, r) => s + r.daysMin, 0),
    daysMax: rowResults.reduce((s, r) => s + r.daysMax, 0),
    costMin: rowResults.reduce((s, r) => s + r.costMin, 0),
    costMax: rowResults.reduce((s, r) => s + r.costMax, 0),
    xp: rowResults.reduce((s, r) => s + r.xp, 0),
  }), [rowResults]);

  const facilityOptions = useMemo<FacilityEntityOption[]>(() =>
    facilityTypes
      .map((f) => ({
        uid: f.uid,
        name: f.name ?? f.uid,
        size: f.size ?? null,
        materials: parseMaterials(f.materials ?? null),
        price_credits: f.price_credits ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [facilityTypes]
  );

  const facilityLookup = useMemo(() => {
    const map = new Map<string, FacilityEntityOption>();
    facilityOptions.forEach((f) => map.set(f.uid, f));
    return map;
  }, [facilityOptions]);

  type FacilityResult = {
    row: FacilityRow;
    facility: FacilityEntityOption;
    qty: number;
    materialSum: number;
    rmp: number;
    daysMin: number;
    daysMax: number;
    costMin: number;
    costMax: number;
    xp: number;
  };

  const facilityResults = useMemo<FacilityResult[]>(() => {
    const management = parsedSettings.management;
    const workers = Math.min(10, Math.max(1, parsedSettings.workers > 0 ? parsedSettings.workers : 1));
    return facilityRows.flatMap((row) => {
      const facility = facilityLookup.get(row.facilityUid);
      const qty = parseInt(row.quantity, 10);
      if (!facility || !Number.isFinite(qty) || qty <= 0) return [];
      if (facility.materials.length === 0) return [];
      const materialSum = facility.materials.reduce((s, m) => s + m.quantity, 0);
      const rmp = facility.materials.length > 0
        ? facility.materials.reduce((s, m) => s + m.quantity * (matPriceMap.get(m.name.toLowerCase()) ?? 0), 0)
        : (facility.price_credits ?? 0);
      const daysMin = calcFacilityDays(materialSum, management, workers, parsedSettings.buildCivLevel, 0.9) * qty;
      const daysMax = calcFacilityDays(materialSum, management, workers, parsedSettings.buildCivLevel, 1.1) * qty;
      const costMin = calcFacilityCost(rmp, parsedSettings.crime, parsedSettings.morale, parsedSettings.tax, 1.0, qty);
      const costMax = calcFacilityCost(rmp, parsedSettings.crime, parsedSettings.morale, parsedSettings.tax, 1.05, qty);
      const xp = calcFacilityXp(rmp) * qty;
      return [{ row, facility, qty, materialSum, rmp, daysMin, daysMax, costMin, costMax, xp }];
    });
  }, [facilityRows, facilityLookup, parsedSettings, matPriceMap]);

  const facilityMaterials = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of facilityResults) {
      for (const mat of r.facility.materials) {
        map.set(mat.name, (map.get(mat.name) ?? 0) + mat.quantity * r.qty);
      }
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty, priceEach: matPriceMap.get(name.toLowerCase()) ?? 0 }))
      .sort((a, b) => b.qty - a.qty);
  }, [facilityResults, matPriceMap]);

  const facilityTotals = useMemo(() => ({
    daysMin: facilityResults.reduce((s, r) => s + r.daysMin, 0),
    daysMax: facilityResults.reduce((s, r) => s + r.daysMax, 0),
    costMin: facilityResults.reduce((s, r) => s + r.costMin, 0),
    costMax: facilityResults.reduce((s, r) => s + r.costMax, 0),
    xp: facilityResults.reduce((s, r) => s + r.xp, 0),
  }), [facilityResults]);

  function addRow() {
    setRows((r) => [...r, { id: newRowId(), category: "ship", entityUid: "", quantity: "1" }]);
  }

  function addFacilityRow() {
    setFacilityRows((r) => [...r, { id: newRowId(), facilityUid: "", quantity: "1" }]);
  }

  function updateFacilityRow(id: string, updated: FacilityRow) {
    setFacilityRows((r) => r.map((row) => row.id === id ? updated : row));
  }

  function removeFacilityRow(id: string) {
    setFacilityRows((r) => r.filter((row) => row.id !== id));
  }

  const stationOptions = useMemo<FacilityEntityOption[]>(() =>
    stationTypes
      .map((s) => ({
        uid: s.uid,
        name: s.name ?? s.uid,
        size: s.length != null ? `${s.length}m` : null,
        materials: parseMaterials(s.materials ?? null),
        price_credits: s.price_credits ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [stationTypes]
  );

  const stationLookup = useMemo(() => {
    const map = new Map<string, FacilityEntityOption>();
    stationOptions.forEach((s) => map.set(s.uid, s));
    return map;
  }, [stationOptions]);

  const stationResults = useMemo(() => {
    const management = parsedSettings.management;
    const workers = Math.min(25, Math.max(1, parsedSettings.workers > 0 ? parsedSettings.workers : 1));
    return stationRows.flatMap((row) => {
      const station = stationLookup.get(row.facilityUid);
      const qty = parseInt(row.quantity, 10);
      if (!station || !Number.isFinite(qty) || qty <= 0) return [];
      if (station.materials.length === 0) return [];
      const materialSum = station.materials.reduce((s, m) => s + m.quantity, 0);
      const rmp = station.materials.length > 0
        ? station.materials.reduce((s, m) => s + m.quantity * (matPriceMap.get(m.name.toLowerCase()) ?? 0), 0)
        : (station.price_credits ?? 0);
      const daysMin = calcStationDays(materialSum, management, workers, parsedSettings.buildCivLevel, 0.9) * qty;
      const daysMax = calcStationDays(materialSum, management, workers, parsedSettings.buildCivLevel, 1.1) * qty;
      const costMin = calcFacilityCost(rmp, parsedSettings.crime, parsedSettings.morale, parsedSettings.tax, 1.0, qty);
      const costMax = calcFacilityCost(rmp, parsedSettings.crime, parsedSettings.morale, parsedSettings.tax, 1.05, qty);
      const xp = calcStationXp(rmp) * qty;
      return [{ row, station, qty, materialSum, rmp, daysMin, daysMax, costMin, costMax, xp }];
    });
  }, [stationRows, stationLookup, parsedSettings, matPriceMap]);

  const stationMaterials = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of stationResults) {
      for (const mat of r.station.materials) {
        map.set(mat.name, (map.get(mat.name) ?? 0) + mat.quantity * r.qty);
      }
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty, priceEach: matPriceMap.get(name.toLowerCase()) ?? 0 }))
      .sort((a, b) => b.qty - a.qty);
  }, [stationResults, matPriceMap]);

  const stationTotals = useMemo(() => ({
    daysMin: stationResults.reduce((s, r) => s + r.daysMin, 0),
    daysMax: stationResults.reduce((s, r) => s + r.daysMax, 0),
    costMin: stationResults.reduce((s, r) => s + r.costMin, 0),
    costMax: stationResults.reduce((s, r) => s + r.costMax, 0),
    xp: stationResults.reduce((s, r) => s + r.xp, 0),
  }), [stationResults]);

  function addStationRow() {
    setStationRows((r) => [...r, { id: newRowId(), facilityUid: "", quantity: "1" }]);
  }

  function updateStationRow(id: string, updated: FacilityRow) {
    setStationRows((r) => r.map((row) => row.id === id ? updated : row));
  }

  function removeStationRow(id: string) {
    setStationRows((r) => r.filter((row) => row.id !== id));
  }

  function updateRow(id: string, updated: ProdRow) {
    setRows((r) => r.map((row) => row.id === id ? updated : row));
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function handleSave(name: string) {
    const plan: SavedPlan = { id: String(Date.now()), name, rows, settings };
    const next = [...savedPlans, plan];
    setSavedPlans(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setShowSaveModal(false);
  }

  function handleLoad(id: string) {
    const plan = savedPlans.find((p) => p.id === id);
    if (!plan) return;
    setRows(plan.rows.map((r) => ({ ...r, id: newRowId() })));
    if (plan.settings) setSettings((s) => ({ ...s, ...plan.settings }));
  }

  function handleDeletePlan(id: string) {
    const next = savedPlans.filter((p) => p.id !== id);
    setSavedPlans(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function handlePullSkills() {
    setSkillsPulling(true);
    setSkillsError(null);
    try {
      const res = await getMySkills();
      const mgmt = res.data?.management;
      if (mgmt != null) {
        setSettings((s) => ({ ...s, managementSkill: String(Math.round(mgmt)) }));
        setSkillsPulled(true);
      } else {
        setSkillsError("Management skill not found in your SWC profile.");
      }
    } catch {
      setSkillsError("Couldn't pull skills — check your Chain Code connection.");
    } finally {
      setSkillsPulling(false);
    }
  }

  const fmt = (n: number) => n.toLocaleString();
  const fmtC = (n: number) => n.toLocaleString() + " cr";

  const isFacilityMode = mode === "facility";
  const isStationMode = mode === "station";
  const isConstructionMode = isFacilityMode || isStationMode;

  return (
    <div className="max-w-275 mx-auto p-4 max-[767px]:px-2 max-[767px]:py-3">
      <div className="mb-5">
        <h1 className="text-[1.4rem] font-semibold m-0">Production Calculator</h1>
        <p className="small opacity-70 m-0">
          Estimate materials, time, and cost for production runs.
        </p>
        <div className="mt-2">
          <ReportBugButton toolKey="production_calculator" toolLabel="Production Calculator" />
        </div>
      </div>

      {error && <p className="small mb-4" style={{ color: "salmon" }}>{error}</p>}

      {loading ? <p className="small opacity-60">Loading entity data…</p> : (
        <>
          {/* Mode + save/load */}
          <div className="panel mb-4 space-y-3">
            <SlideTabNav
              items={[
                { key: "batch", label: "Production" },
                { key: "facility", label: "Facility Construction" },
                { key: "station", label: "Station Construction" },
              ]}
              activeKey={mode}
              onChange={setMode}
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div />
              <div className="flex items-center gap-2 flex-wrap">
                {savedPlans.length > 0 && (
                  <div className="flex items-center gap-1">
                    <select className={SELECT_INPUT + " text-sm"} defaultValue=""
                      onChange={(e) => { if (e.target.value) { handleLoad(e.target.value); e.target.value = ""; } }}>
                      <option value="">Load saved…</option>
                      {savedPlans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select className={SELECT_INPUT + " text-sm"} defaultValue=""
                      onChange={(e) => { if (e.target.value) { handleDeletePlan(e.target.value); e.target.value = ""; } }}>
                      <option value="">Delete…</option>
                      {savedPlans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="button" className={BTN_GHOST_SM} onClick={() => setShowSaveModal(true)}>Save Plan</button>
              </div>
            </div>

            {/* Production rows */}
            {mode === "batch" && (
              <>
                <div className="space-y-2">
                  {rows.map((row) => (
                    <ProdRowInput
                      key={row.id}
                      row={row}
                      categoryOptions={categoryOptions}
                      onRecommendedWorkers={(n) => setSettings((s) => ({ ...s, workerCount: String(n) }))}
                      onChange={(updated) => updateRow(row.id, updated)}
                      onRemove={() => removeRow(row.id)}
                      canRemove={rows.length > 1}
                    />
                  ))}
                </div>
                <button type="button" className={BTN_GHOST_SM} onClick={addRow}>+ Add Run</button>
              </>
            )}

            {/* Facility rows */}
            {isFacilityMode && (
              <>
                <div className="space-y-2">
                  {facilityRows.map((row) => (
                    <FacilityRowInput
                      key={row.id}
                      row={row}
                      options={facilityOptions}
                      onChange={(updated) => updateFacilityRow(row.id, updated)}
                      onRemove={() => removeFacilityRow(row.id)}
                      canRemove={facilityRows.length > 1}
                    />
                  ))}
                </div>
                <button type="button" className={BTN_GHOST_SM} onClick={addFacilityRow}>+ Add Facility</button>
              </>
            )}

            {/* Station rows */}
            {isStationMode && (
              <>
                <div className="space-y-2">
                  {stationRows.map((row) => (
                    <FacilityRowInput
                      key={row.id}
                      row={row}
                      options={stationOptions}
                      label="Station"
                      onChange={(updated) => updateStationRow(row.id, updated)}
                      onRemove={() => removeStationRow(row.id)}
                      canRemove={stationRows.length > 1}
                    />
                  ))}
                </div>
                <button type="button" className={BTN_GHOST_SM} onClick={addStationRow}>+ Add Station</button>
              </>
            )}
          </div>

          {/* Settings */}
          <div className="panel mb-4">
            <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Settings</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Management Skill (0–5)</label>
                <div className="flex gap-2 items-center">
                  <input type="number" className={INPUT} min={0} max={5} step={1} value={settings.managementSkill}
                    onChange={(e) => setSettings((s) => ({ ...s, managementSkill: String(Math.round(parseInt(e.target.value, 10) || 0)) }))} />
                  <button type="button" className={BTN_GHOST_SM + " shrink-0"} onClick={() => { void handlePullSkills(); }} disabled={skillsPulling}>
                    {skillsPulling ? "Pulling…" : skillsPulled ? "Pulled ✓" : "Pull from SWC"}
                  </button>
                </div>
                {skillsError && <p className="text-[0.72rem] m-0" style={{ color: "salmon" }}>{skillsError}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">
                  {isFacilityMode ? "Workers (max 10)" : isStationMode ? "Workers (max 25)" : "Workers"}
                </label>
                <input type="number" className={INPUT} min={1}
                  max={isFacilityMode ? 10 : isStationMode ? 25 : undefined} step={1}
                  value={settings.workerCount}
                  placeholder={isConstructionMode ? `1–${isFacilityMode ? "10" : "25"}` : "Auto from entity"}
                  onChange={(e) => setSettings((s) => ({ ...s, workerCount: e.target.value }))} />
              </div>
              {!isConstructionMode && (
                <div className="flex flex-col gap-1">
                  <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Location</label>
                  <select className={SELECT_INPUT} value={settings.locationMod}
                    onChange={(e) => setSettings((s) => ({ ...s, locationMod: e.target.value as "1" | "0.9" }))}>
                    <option value="1">Facility (×1.0)</option>
                    <option value="0.9">Space Station (×0.9)</option>
                  </select>
                </div>
              )}
              {!isConstructionMode && (
                <div className="flex flex-col gap-1">
                  <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">CL %</label>
                  <input type="number" className={INPUT} min={0} max={100} step={1} placeholder="0" value={settings.civLevel}
                    onChange={(e) => setSettings((s) => ({ ...s, civLevel: e.target.value }))} />
                </div>
              )}
              {isConstructionMode && (
                <div className="flex flex-col gap-1">
                  <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">CL %</label>
                  <input type="number" className={INPUT} min={0} max={100} step={1} placeholder="0" value={settings.buildCivLevel}
                    onChange={(e) => setSettings((s) => ({ ...s, buildCivLevel: e.target.value }))} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Crime %</label>
                <input type="number" className={INPUT} min={0} max={100} step={1} placeholder="50" value={settings.crimeLevel}
                  onChange={(e) => setSettings((s) => ({ ...s, crimeLevel: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Morale %</label>
                <input type="number" className={INPUT} min={0} max={100} step={1} placeholder="50" value={settings.moraleLevel}
                  onChange={(e) => setSettings((s) => ({ ...s, moraleLevel: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Tax %</label>
                <input type="number" className={INPUT} min={0} max={100} step={1} placeholder="0" value={settings.taxLevel}
                  onChange={(e) => setSettings((s) => ({ ...s, taxLevel: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Results */}
          {mode === "batch" && rowResults.length > 0 && (
            <>
              {/* Per-run table for batch */}
              {mode === "batch" && rowResults.length > 1 && (
                <div className="panel mb-4 overflow-x-auto">
                  <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Run Breakdown</h2>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="py-2 pr-3 font-semibold opacity-70">Entity</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Runs</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Output</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Time (min–max)</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Cost (min–max)</th>
                        <th className="py-2 font-semibold opacity-70 hidden sm:table-cell">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowResults.map((r, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-2 pr-3">{r.entity.name}</td>
                          <td className="py-2 pr-3 tabular-nums">{r.qty}</td>
                          <td className="py-2 pr-3 tabular-nums">{r.batchOutput.toLocaleString()}</td>
                          <td className="py-2 pr-3 tabular-nums text-amber-300">{formatDays(r.daysMin)} – {formatDays(r.daysMax)}</td>
                          <td className="py-2 pr-3 tabular-nums opacity-80">{fmtC(r.costMin)} – {fmtC(r.costMax)}</td>
                          <td className="py-2 tabular-nums text-blue-300 hidden sm:table-cell">{r.xp.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary */}
              <div className="panel mb-4">
                <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">
                  {mode === "batch" && rowResults.length > 1 ? "Totals (Sequential)" : "Result"}
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Production Time</p>
                    <p className="text-lg font-semibold text-amber-300 m-0">
                      {formatDays(totals.daysMin)} – {formatDays(totals.daysMax)}
                    </p>
                    <p className="text-[0.72rem] opacity-50 m-0">Based on random factor 0.95–1.05</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Estimated Cost</p>
                    <p className="text-lg font-semibold text-green-400 m-0">{fmtC(totals.costMin)} – {fmtC(totals.costMax)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">Random factor 1.2–1.3 · Uses planet settings above</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">XP Gained</p>
                    <p className="text-lg font-semibold text-blue-300 m-0">{totals.xp.toLocaleString()}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">At 220% · Ships/Vehicles/Droids based on RMP · Items/Weapons based on output qty</p>
                  </div>
                </div>

              </div>

              {/* Materials list */}
              {aggregatedMaterials.length > 0 && (
                <div className="panel mb-4">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold opacity-80 m-0">Materials Required</h2>
                      <SlideTabNav
                        items={[
                          { key: "rmp", label: "SWC RMP" },
                          { key: "internal", label: "JOE Price" },
                        ]}
                        activeKey={matPriceTab}
                        onChange={setMatPriceTab}
                      />
                    </div>
                    {onPushToHaul && (
                      <button className={BTN_SM} type="button"
                        onClick={() => onPushToHaul(aggregatedMaterials.map((m) => ({ name: m.name, quantity: m.qty })))}>
                        Send to RM Hauler
                      </button>
                    )}
                  </div>
                  {matPriceTab === "internal" && internalPrices.length === 0 && (
                    <p className="text-xs opacity-50 mb-3 m-0">No internal prices set yet. An admin can add them.</p>
                  )}
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="py-2 pr-3 font-semibold opacity-70">Material</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 tabular-nums text-right">Units</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 tabular-nums text-right hidden sm:table-cell">Price/unit</th>
                        <th className="py-2 font-semibold opacity-70 tabular-nums text-right hidden sm:table-cell">
                          {matPriceTab === "rmp" ? "Total RMP" : "Total Cost"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregatedMaterials.map((m) => {
                        const unitPrice = matPriceTab === "rmp"
                          ? m.priceEach
                          : (internalPriceMap.get(m.name.toLowerCase()) ?? null);
                        return (
                          <tr key={m.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-2 pr-3">{m.name}</td>
                            <td className="py-2 pr-3 tabular-nums text-right text-amber-300 font-semibold">{fmt(m.qty)}</td>
                            <td className="py-2 pr-3 tabular-nums text-right opacity-60 hidden sm:table-cell">
                              {unitPrice != null && unitPrice > 0 ? fmtC(unitPrice) : "—"}
                            </td>
                            <td className="py-2 tabular-nums text-right opacity-80 hidden sm:table-cell">
                              {unitPrice != null && unitPrice > 0 ? fmtC(m.qty * unitPrice) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20">
                        <td className="py-2 pr-3 font-semibold" colSpan={2}>
                          {fmt(aggregatedMaterials.reduce((s, m) => s + m.qty, 0))} total units
                        </td>
                        <td className="py-2 pr-3 hidden sm:table-cell" />
                        <td className="py-2 font-semibold text-right hidden sm:table-cell">
                          {(() => {
                            const total = aggregatedMaterials.reduce((s, m) => {
                              const p = matPriceTab === "rmp" ? m.priceEach : (internalPriceMap.get(m.name.toLowerCase()) ?? 0);
                              return s + m.qty * p;
                            }, 0);
                            return total > 0 ? fmtC(total) + (matPriceTab === "rmp" ? " total RMP" : " total") : "—";
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}

          {mode === "batch" && rowResults.length === 0 && rows.some((r) => r.entityUid) && (
            <p className="small opacity-50 text-center py-8">
              Selected entity is missing production data — try a different entity.
            </p>
          )}

          {mode === "batch" && !rows.some((r) => r.entityUid) && (
            <p className="small opacity-40 text-center py-8">
              Select an entity above to see production estimates.
            </p>
          )}

          {/* Facility results */}
          {isFacilityMode && facilityResults.length > 0 && (
            <>
              {facilityResults.length > 1 && (
                <div className="panel mb-4 overflow-x-auto">
                  <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Facility Breakdown</h2>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="py-2 pr-3 font-semibold opacity-70">Facility</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Qty</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Time (min–max)</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 hidden sm:table-cell">Cost (min–max)</th>
                        <th className="py-2 font-semibold opacity-70 hidden sm:table-cell">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facilityResults.map((r, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-2 pr-3">{r.facility.name}</td>
                          <td className="py-2 pr-3 tabular-nums">{r.qty}</td>
                          <td className="py-2 pr-3 tabular-nums text-amber-300">{formatDays(r.daysMin)} – {formatDays(r.daysMax)}</td>
                          <td className="py-2 pr-3 tabular-nums opacity-80 hidden sm:table-cell">{fmtC(r.costMin)} – {fmtC(r.costMax)}</td>
                          <td className="py-2 tabular-nums opacity-70 hidden sm:table-cell">{fmt(r.xp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="panel mb-4">
                <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">
                  {facilityResults.length > 1 ? "Totals (Sequential)" : "Result"}
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Construction Time</p>
                    <p className="text-lg font-semibold text-amber-300 m-0">{formatDays(facilityTotals.daysMin)} – {formatDays(facilityTotals.daysMax)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">Random 0.9–1.1 · Management ÷50 · Workers capped at 10</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Estimated Cost</p>
                    <p className="text-lg font-semibold text-green-400 m-0">{fmtC(facilityTotals.costMin)} – {fmtC(facilityTotals.costMax)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">Random 1.0–1.05 · Uses planet settings above</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">XP Gained</p>
                    <p className="text-lg font-semibold text-blue-300 m-0">{fmt(facilityTotals.xp)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">At 130% (current SWC bonus)</p>
                  </div>
                </div>
              </div>

              {facilityMaterials.length > 0 && (
                <div className="panel mb-4">
                  <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Materials Required</h2>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="py-2 pr-3 font-semibold opacity-70">Material</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 text-right">Units</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 text-right hidden sm:table-cell">Price/unit</th>
                        <th className="py-2 font-semibold opacity-70 text-right hidden sm:table-cell">Total RMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facilityMaterials.map((m) => (
                        <tr key={m.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 pr-3">{m.name}</td>
                          <td className="py-2 pr-3 tabular-nums text-right text-amber-300 font-semibold">{fmt(m.qty)}</td>
                          <td className="py-2 pr-3 tabular-nums text-right opacity-60 hidden sm:table-cell">{m.priceEach > 0 ? fmtC(m.priceEach) : "—"}</td>
                          <td className="py-2 tabular-nums text-right opacity-80 hidden sm:table-cell">{m.priceEach > 0 ? fmtC(m.qty * m.priceEach) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20">
                        <td className="py-2 pr-3 font-semibold" colSpan={2}>{fmt(facilityMaterials.reduce((s, m) => s + m.qty, 0))} total units</td>
                        <td className="py-2 pr-3 hidden sm:table-cell" />
                        <td className="py-2 font-semibold text-right hidden sm:table-cell">{fmtC(facilityMaterials.reduce((s, m) => s + m.qty * m.priceEach, 0))} total RMP</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}

          {isFacilityMode && facilityRows.some((r) => r.facilityUid) && facilityResults.length === 0 && (
            <p className="small opacity-60 text-center py-8">
              Material data not available for selected facilities — an admin needs to run the facility type catalog pull from the Admin System Panel.
            </p>
          )}

          {isFacilityMode && !facilityRows.some((r) => r.facilityUid) && (
            <p className="small opacity-40 text-center py-8">Select a facility above to see construction estimates.</p>
          )}

          {/* Station results */}
          {isStationMode && stationResults.length > 0 && (
            <>
              {stationResults.length > 1 && (
                <div className="panel mb-4 overflow-x-auto">
                  <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Station Breakdown</h2>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="py-2 pr-3 font-semibold opacity-70">Station</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Qty</th>
                        <th className="py-2 pr-3 font-semibold opacity-70">Time (min–max)</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 hidden sm:table-cell">Cost (min–max)</th>
                        <th className="py-2 font-semibold opacity-70 hidden sm:table-cell">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationResults.map((r, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-2 pr-3">{r.station.name}</td>
                          <td className="py-2 pr-3 tabular-nums">{r.qty}</td>
                          <td className="py-2 pr-3 tabular-nums text-amber-300">{formatDays(r.daysMin)} – {formatDays(r.daysMax)}</td>
                          <td className="py-2 pr-3 tabular-nums opacity-80 hidden sm:table-cell">{fmtC(r.costMin)} – {fmtC(r.costMax)}</td>
                          <td className="py-2 tabular-nums opacity-70 hidden sm:table-cell">{fmt(r.xp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="panel mb-4">
                <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">
                  {stationResults.length > 1 ? "Totals (Sequential)" : "Result"}
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Construction Time</p>
                    <p className="text-lg font-semibold text-amber-300 m-0">{formatDays(stationTotals.daysMin)} – {formatDays(stationTotals.daysMax)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">Random 0.9–1.1 · NPCs affect time via management exponent · Max 25 workers</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">Estimated Cost</p>
                    <p className="text-lg font-semibold text-green-400 m-0">{fmtC(stationTotals.costMin)} – {fmtC(stationTotals.costMax)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">Random 1.0–1.05 · Uses planet settings above</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide m-0">XP Gained</p>
                    <p className="text-lg font-semibold text-blue-300 m-0">{fmt(stationTotals.xp)}</p>
                    <p className="text-[0.72rem] opacity-50 m-0">At 150% (current SWC bonus)</p>
                  </div>
                </div>
              </div>

              {stationMaterials.length > 0 && (
                <div className="panel mb-4">
                  <h2 className="text-sm font-semibold opacity-80 m-0 mb-3">Materials Required</h2>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="py-2 pr-3 font-semibold opacity-70">Material</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 text-right">Units</th>
                        <th className="py-2 pr-3 font-semibold opacity-70 text-right hidden sm:table-cell">Price/unit</th>
                        <th className="py-2 font-semibold opacity-70 text-right hidden sm:table-cell">Total RMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationMaterials.map((m) => (
                        <tr key={m.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 pr-3">{m.name}</td>
                          <td className="py-2 pr-3 tabular-nums text-right text-amber-300 font-semibold">{fmt(m.qty)}</td>
                          <td className="py-2 pr-3 tabular-nums text-right opacity-60 hidden sm:table-cell">{m.priceEach > 0 ? fmtC(m.priceEach) : "—"}</td>
                          <td className="py-2 tabular-nums text-right opacity-80 hidden sm:table-cell">{m.priceEach > 0 ? fmtC(m.qty * m.priceEach) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20">
                        <td className="py-2 pr-3 font-semibold" colSpan={2}>{fmt(stationMaterials.reduce((s, m) => s + m.qty, 0))} total units</td>
                        <td className="py-2 pr-3 hidden sm:table-cell" />
                        <td className="py-2 font-semibold text-right hidden sm:table-cell">{fmtC(stationMaterials.reduce((s, m) => s + m.qty * m.priceEach, 0))} total RMP</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}

          {isStationMode && stationRows.some((r) => r.facilityUid) && stationResults.length === 0 && (
            <p className="small opacity-60 text-center py-8">No material data for selected stations — station types may need to be individually pulled by an admin.</p>
          )}

          {isStationMode && !stationRows.some((r) => r.facilityUid) && (
            <p className="small opacity-40 text-center py-8">Select a station above to see construction estimates.</p>
          )}
        </>
      )}

      {showSaveModal && (
        <SavePlanModal onSave={handleSave} onClose={() => setShowSaveModal(false)} />
      )}
    </div>
  );
};

export default ProductionCalculatorPanel;
