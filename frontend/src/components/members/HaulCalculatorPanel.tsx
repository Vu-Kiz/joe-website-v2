import React, { useEffect, useMemo, useState } from "react";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import { BTN, BTN_GHOST, BTN_GHOST_SM, BTN_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import {
  getStoredCreatureTypes,
  getStoredDroidTypes,
  getStoredItemTypes,
  getStoredMaterialTypes,
  getStoredShipTypes,
  getStoredVehicleTypes,
  type StoredCreatureTypeSummary,
  type StoredDroidTypeSummary,
  type StoredItemTypeSummary,
  type StoredMaterialTypeSummary,
  type StoredShipTypeSummary,
  type StoredVehicleTypeSummary,
} from "../../api/universe/universe";
import ReportBugButton from "../support/ReportBugButton";

type CargoCategory = "material" | "item" | "droid" | "creature" | "ship" | "vehicle";

const CATEGORY_LABELS: Record<CargoCategory, string> = {
  material: "Material",
  item: "Item",
  droid: "Droid",
  creature: "Creature",
  ship: "Ship (cargo)",
  vehicle: "Vehicle (cargo)",
};

type EntityOption = {
  uid: string;
  name: string;
  weight_tonnes: number | null;
  volume_m3: number | null;
};

type CargoRow = {
  id: string;
  category: CargoCategory;
  entityUid: string;
  quantity: string;
};

type HaulEntry = {
  uid: string;
  name: string;
  class_name: string | null;
  entity_type: "ship" | "vehicle";
  weight_capacity_tonnes: number | null;
  volume_capacity_m3: number | null;
  trips: number;
  limiting_factor: "weight" | "volume" | "equal" | "none";
};

type SortKey = "trips" | "name" | "weight_cap" | "vol_cap";
type SortDir = "asc" | "desc";

let _rowCounter = 0;
function newRowId() {
  return `row-${++_rowCounter}`;
}

function calcTrips(
  totalWeight: number,
  totalVolume: number,
  wCap: number | null,
  vCap: number | null
): { trips: number; limiting_factor: HaulEntry["limiting_factor"] } {
  const tripsByWeight = wCap && wCap > 0 && totalWeight > 0 ? Math.ceil(totalWeight / wCap) : 0;
  const tripsByVolume = vCap && vCap > 0 && totalVolume > 0 ? Math.ceil(totalVolume / vCap) : 0;
  const trips = Math.max(tripsByWeight, tripsByVolume, 1);
  const limiting_factor: HaulEntry["limiting_factor"] =
    tripsByWeight === 0 && tripsByVolume === 0
      ? "none"
      : tripsByWeight > tripsByVolume
        ? "weight"
        : tripsByVolume > tripsByWeight
          ? "volume"
          : "equal";
  return { trips, limiting_factor };
}

type SavedManifest = {
  id: string;
  name: string;
  rows: CargoRow[];
};

const STORAGE_KEY = "joe_haul_manifests";

function loadSavedManifests(): SavedManifest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedManifest[]) : [];
  } catch {
    return [];
  }
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="opacity-25 ml-1">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

const HaulPlanModal: React.FC<{
  entry: HaulEntry;
  text: string;
  onClose: () => void;
}> = ({ entry, text, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div
        className="flex flex-col gap-4 w-full max-w-[560px] p-4 rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,28,34,0.98),rgba(19,20,25,0.98))] shadow-[0_20px_44px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 justify-between">
          <div>
            <p className="m-0 mb-1 text-white/50 text-[0.72rem] font-bold tracking-[0.08em] uppercase">Haul Plan</p>
            <h3 className="m-0 text-[1.1rem] leading-[1.2]">{entry.name}</h3>
          </div>
          <button className={BTN_GHOST + " shrink-0"} type="button" onClick={onClose}>Close</button>
        </div>
        <textarea
          readOnly
          className={INPUT + " text-sm font-mono resize-none"}
          rows={text.split("\n").length + 1}
          value={text}
          onFocus={(e) => e.target.select()}
        />
        <div className="flex justify-end">
          <button
            className={BTN}
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SaveManifestModal: React.FC<{
  onSave: (name: string) => void;
  onClose: () => void;
}> = ({ onSave, onClose }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div
        className="flex flex-col gap-4 w-full max-w-[420px] p-4 rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,28,34,0.98),rgba(19,20,25,0.98))] shadow-[0_20px_44px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 justify-between">
          <div>
            <p className="m-0 mb-1 text-white/50 text-[0.72rem] font-bold tracking-[0.08em] uppercase">Cargo Manifest</p>
            <h3 className="m-0 text-[1.1rem] leading-[1.2]">Save Manifest</h3>
          </div>
          <button className={BTN_GHOST + " shrink-0"} type="button" onClick={onClose}>Close</button>
        </div>
        <input
          type="text"
          className={INPUT}
          placeholder="Manifest name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button className={BTN_GHOST} type="button" onClick={onClose}>Cancel</button>
          <button className={BTN} type="button" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
        </div>
      </div>
    </div>
  );
};

const CargoRowInput: React.FC<{
  row: CargoRow;
  categoryOptions: Record<CargoCategory, EntityOption[]>;
  onChange: (row: CargoRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}> = ({ row, categoryOptions, onChange, onRemove, canRemove }) => {
  const options = categoryOptions[row.category];
  const selectedEntity = options.find((o) => o.uid === row.entityUid) ?? null;

  const [query, setQuery] = useState(selectedEntity?.name ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  function handleCategoryChange(cat: CargoCategory) {
    setQuery("");
    onChange({ ...row, category: cat, entityUid: "" });
  }

  function handleSelect(entity: EntityOption) {
    setQuery(entity.name);
    onChange({ ...row, entityUid: entity.uid });
  }

  function handleClear() {
    setQuery("");
    onChange({ ...row, entityUid: "" });
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="grid gap-2 p-3 rounded-lg border border-white/10 bg-white/3">
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Type</label>
          <select
            className={SELECT_INPUT}
            value={row.category}
            onChange={(e) => handleCategoryChange(e.target.value as CargoCategory)}
          >
            {(Object.keys(CATEGORY_LABELS) as CargoCategory[]).map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-50">
          <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">
            {CATEGORY_LABELS[row.category]}
          </label>
          <div className="relative flex items-center *:first:flex-1">
            <SearchSuggestionPicker
              value={query}
              onChange={(v) => {
                setQuery(v);
                if (!v) onChange({ ...row, entityUid: "" });
              }}
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
                  {(o.weight_tonnes != null || o.volume_m3 != null) && (
                    <span className="small opacity-60">
                      {o.weight_tonnes != null && `${fmt(o.weight_tonnes)} t`}
                      {o.weight_tonnes != null && o.volume_m3 != null && " · "}
                      {o.volume_m3 != null && `${fmt(o.volume_m3)} m³`}
                    </span>
                  )}
                </>
              )}
            />
            {row.entityUid && (
              <button
                type="button"
                className={BTN_SM + " absolute right-1.5 top-1/2 -translate-y-1/2"}
                onClick={handleClear}
                title="Clear"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 w-25">
          <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide">Quantity</label>
          <input
            type="number"
            className={INPUT}
            min={1}
            step={1}
            value={row.quantity}
            placeholder="Qty"
            onChange={(e) => onChange({ ...row, quantity: e.target.value })}
          />
        </div>

        <button
          type="button"
          className={BTN_SM + " self-end"}
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove"
        >
          ✕
        </button>
      </div>

      {selectedEntity && (
        <p className="text-[0.72rem] opacity-50 m-0 pl-1">
          {selectedEntity.weight_tonnes != null && `${fmt(selectedEntity.weight_tonnes)} t`}
          {selectedEntity.weight_tonnes != null && selectedEntity.volume_m3 != null && " · "}
          {selectedEntity.volume_m3 != null && `${fmt(selectedEntity.volume_m3)} m³`}
          {" per unit"}
        </p>
      )}
    </div>
  );
};

function toEntityOptions(
  items: Array<
    | StoredMaterialTypeSummary
    | StoredItemTypeSummary
    | StoredDroidTypeSummary
    | StoredCreatureTypeSummary
    | StoredShipTypeSummary
    | StoredVehicleTypeSummary
  >
): EntityOption[] {
  return items
    .map((i) => ({
      uid: i.uid,
      name: i.name ?? i.uid,
      weight_tonnes: i.weight_tonnes ?? null,
      volume_m3: i.volume_m3 ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const HaulCalculatorPanel: React.FC<{
  pendingMaterials?: Array<{ name: string; quantity: number }> | null;
}> = ({ pendingMaterials }) => {
  const [materialTypes, setMaterialTypes] = useState<StoredMaterialTypeSummary[]>([]);
  const [itemTypes, setItemTypes] = useState<StoredItemTypeSummary[]>([]);
  const [droidTypes, setDroidTypes] = useState<StoredDroidTypeSummary[]>([]);
  const [creatureTypes, setCreatureTypes] = useState<StoredCreatureTypeSummary[]>([]);
  const [shipTypes, setShipTypes] = useState<StoredShipTypeSummary[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<StoredVehicleTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cargoRows, setCargoRows] = useState<CargoRow[]>([
    { id: newRowId(), category: "material", entityUid: "", quantity: "1000" },
  ]);
  const [sortKey, setSortKey] = useState<SortKey>("trips");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [maxTrips, setMaxTrips] = useState<string>("2");
  const [haulerType, setHaulerType] = useState<"all" | "ship" | "vehicle">("all");
  const [exportEntry, setExportEntry] = useState<HaulEntry | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedManifests, setSavedManifests] = useState<SavedManifest[]>(loadSavedManifests);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      getStoredMaterialTypes(),
      getStoredItemTypes(),
      getStoredDroidTypes(),
      getStoredCreatureTypes(),
      getStoredShipTypes(),
      getStoredVehicleTypes(),
    ])
      .then(([matRes, itemRes, droidRes, creatureRes, shipRes, vehRes]) => {
        if (cancelled) return;
        setMaterialTypes(matRes.data ?? []);
        setItemTypes(itemRes.data ?? []);
        setDroidTypes(droidRes.data ?? []);
        setCreatureTypes(creatureRes.data ?? []);
        setShipTypes(shipRes.data ?? []);
        setVehicleTypes(vehRes.data ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingMaterials || pendingMaterials.length === 0 || materialTypes.length === 0) return;
    const nameToUid = new Map(materialTypes.map((m) => [m.name?.toLowerCase() ?? "", m.uid]));
    const resolved = pendingMaterials.flatMap((m) => {
      const uid = nameToUid.get(m.name.toLowerCase());
      if (!uid) return [];
      return [{ id: newRowId(), category: "material" as CargoCategory, entityUid: uid, quantity: String(m.quantity) }];
    });
    if (resolved.length > 0) setCargoRows(resolved);
  }, [pendingMaterials, materialTypes]);

  const categoryOptions = useMemo<Record<CargoCategory, EntityOption[]>>(
    () => ({
      material: toEntityOptions(materialTypes),
      item: toEntityOptions(itemTypes),
      droid: toEntityOptions(droidTypes),
      creature: toEntityOptions(creatureTypes),
      ship: toEntityOptions(shipTypes),
      vehicle: toEntityOptions(vehicleTypes),
    }),
    [materialTypes, itemTypes, droidTypes, creatureTypes, shipTypes, vehicleTypes]
  );

  const entityLookup = useMemo(() => {
    const map = new Map<string, EntityOption>();
    Object.values(categoryOptions).forEach((opts) => {
      opts.forEach((o) => map.set(o.uid, o));
    });
    return map;
  }, [categoryOptions]);

  const totals = useMemo(() => {
    let weight = 0;
    let volume = 0;
    for (const row of cargoRows) {
      const entity = entityLookup.get(row.entityUid);
      const qty = parseInt(row.quantity, 10);
      if (!entity || !Number.isFinite(qty) || qty <= 0) continue;
      weight += (entity.weight_tonnes ?? 0) * qty;
      volume += (entity.volume_m3 ?? 0) * qty;
    }
    return { weight, volume };
  }, [cargoRows, entityLookup]);

  const hasValidRows = cargoRows.some((r) => {
    const entity = entityLookup.get(r.entityUid);
    const qty = parseInt(r.quantity, 10);
    return entity && Number.isFinite(qty) && qty > 0;
  });

  const results = useMemo<HaulEntry[]>(() => {
    if (!hasValidRows || (totals.weight === 0 && totals.volume === 0)) return [];

    const entries: HaulEntry[] = [];

    const needsWeight = totals.weight > 0;
    const needsVolume = totals.volume > 0;

    for (const ship of shipTypes) {
      const wCap = ship.weight_capacity_tonnes;
      const vCap = ship.volume_capacity_m3;
      if (needsWeight && (!wCap || wCap <= 0)) continue;
      if (needsVolume && (!vCap || vCap <= 0)) continue;
      if ((!wCap || wCap <= 0) && (!vCap || vCap <= 0)) continue;
      const { trips, limiting_factor } = calcTrips(totals.weight, totals.volume, wCap, vCap);
      entries.push({
        uid: ship.uid,
        name: ship.name ?? ship.uid,
        class_name: ship.class_name,
        entity_type: "ship",
        weight_capacity_tonnes: wCap,
        volume_capacity_m3: vCap,
        trips,
        limiting_factor,
      });
    }

    for (const veh of vehicleTypes) {
      const wCap = veh.weight_capacity_tonnes;
      const vCap = veh.volume_capacity_m3;
      if (needsWeight && (!wCap || wCap <= 0)) continue;
      if (needsVolume && (!vCap || vCap <= 0)) continue;
      if ((!wCap || wCap <= 0) && (!vCap || vCap <= 0)) continue;
      const { trips, limiting_factor } = calcTrips(totals.weight, totals.volume, wCap, vCap);
      entries.push({
        uid: veh.uid,
        name: veh.name ?? veh.uid,
        class_name: veh.class_name,
        entity_type: "vehicle",
        weight_capacity_tonnes: wCap,
        volume_capacity_m3: vCap,
        trips,
        limiting_factor,
      });
    }

    return entries;
  }, [hasValidRows, totals, shipTypes, vehicleTypes]);

  const parsedMaxTrips = useMemo(() => {
    const n = parseInt(maxTrips, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [maxTrips]);

  const sortedResults = useMemo(() => {
    const filtered = results.filter((r) => {
      if (parsedMaxTrips && r.trips > parsedMaxTrips) return false;
      if (haulerType !== "all" && r.entity_type !== haulerType) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "trips") cmp = a.trips - b.trips;
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "weight_cap") cmp = (a.weight_capacity_tonnes ?? 0) - (b.weight_capacity_tonnes ?? 0);
      else if (sortKey === "vol_cap") cmp = (a.volume_capacity_m3 ?? 0) - (b.volume_capacity_m3 ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [results, sortKey, sortDir, parsedMaxTrips, haulerType]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "trips" ? "asc" : "desc");
    }
  }

  function updateRow(id: string, updated: CargoRow) {
    setCargoRows((rows) => rows.map((r) => (r.id === id ? updated : r)));
  }

  function removeRow(id: string) {
    setCargoRows((rows) => rows.filter((r) => r.id !== id));
  }

  function addRow() {
    setCargoRows((rows) => [
      ...rows,
      { id: newRowId(), category: "material", entityUid: "", quantity: "1" },
    ]);
  }

  function handleSaveManifest(name: string) {
    const manifest: SavedManifest = { id: String(Date.now()), name, rows: cargoRows };
    const next = [...savedManifests, manifest];
    setSavedManifests(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setShowSaveModal(false);
  }

  function handleLoadManifest(id: string) {
    const manifest = savedManifests.find((m) => m.id === id);
    if (!manifest) return;
    setCargoRows(manifest.rows.map((r) => ({ ...r, id: newRowId() })));
  }

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const exportText = useMemo(() => {
    if (!exportEntry) return "";
    const lines: string[] = [];
    lines.push(`**Haul Plan — ${exportEntry.name}**`);
    if (exportEntry.class_name) lines.push(`Class: ${exportEntry.class_name}`);
    lines.push(`Capacity: ${fmt(exportEntry.weight_capacity_tonnes ?? 0)} t / ${fmt(exportEntry.volume_capacity_m3 ?? 0)} m³`);
    lines.push("");
    lines.push("**Cargo Manifest:**");
    for (const row of cargoRows) {
      const entity = entityLookup.get(row.entityUid);
      const qty = parseInt(row.quantity, 10);
      if (!entity || !Number.isFinite(qty) || qty <= 0) continue;
      const rowWeight = (entity.weight_tonnes ?? 0) * qty;
      const rowVolume = (entity.volume_m3 ?? 0) * qty;
      const dims = [rowWeight > 0 ? `${fmt(rowWeight)} t` : null, rowVolume > 0 ? `${fmt(rowVolume)} m³` : null].filter(Boolean).join(" / ");
      lines.push(`• ${qty.toLocaleString()}× ${entity.name}${dims ? ` (${dims})` : ""}`);
    }
    lines.push("");
    const totalDims = [totals.weight > 0 ? `${fmt(totals.weight)} t` : null, totals.volume > 0 ? `${fmt(totals.volume)} m³` : null].filter(Boolean).join(" / ");
    lines.push(`**Total cargo:** ${totalDims}`);
    lines.push(`**Trips required:** ${exportEntry.trips}`);
    return lines.join("\n");
  }, [exportEntry, cargoRows, entityLookup, totals]);

  return (
    <div className="max-w-275 mx-auto p-4 max-[767px]:px-2 max-[767px]:py-3">
      <div className="mb-5">
        <h1 className="text-[1.4rem] font-semibold m-0">RM Hauler</h1>
        <p className="small opacity-70 m-0">
          Build a cargo manifest across multiple entity types to see which ships and vehicles can carry the load and how many trips each needs.
        </p>
        <div className="mt-2">
          <ReportBugButton toolKey="haul_calculator" toolLabel="RM Hauler" />
        </div>
      </div>

      {error && (
        <p className="small mb-4" style={{ color: "salmon" }}>{error}</p>
      )}

      {loading ? (
        <p className="small opacity-60">Loading entity data…</p>
      ) : (
        <>
          <div className="panel mb-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold opacity-80 m-0">Cargo Manifest</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {savedManifests.length > 0 && (
                  <select
                    className={SELECT_INPUT + " text-sm"}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleLoadManifest(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Load saved…</option>
                    {savedManifests.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
                <button type="button" className={BTN_GHOST_SM} onClick={() => setShowSaveModal(true)}>
                  Save Manifest
                </button>
              </div>
            </div>

            {cargoRows.map((row) => (
              <CargoRowInput
                key={row.id}
                row={row}
                categoryOptions={categoryOptions}
                onChange={(updated) => updateRow(row.id, updated)}
                onRemove={() => removeRow(row.id)}
                canRemove={cargoRows.length > 1}
              />
            ))}

            <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
              <button
                type="button"
                className={BTN_GHOST_SM}
                onClick={addRow}
              >
                + Add Item
              </button>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide whitespace-nowrap">Max trips</label>
                  <input
                    type="number"
                    className={INPUT + " w-20 text-sm"}
                    min={1}
                    step={1}
                    value={maxTrips}
                    onChange={(e) => setMaxTrips(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[0.7rem] font-semibold opacity-60 uppercase tracking-wide whitespace-nowrap">Type</label>
                  <select
                    className={SELECT_INPUT + " w-32 text-sm"}
                    value={haulerType}
                    onChange={(e) => setHaulerType(e.target.value as "all" | "ship" | "vehicle")}
                  >
                    <option value="all">All</option>
                    <option value="ship">Ship</option>
                    <option value="vehicle">Vehicle</option>
                  </select>
                </div>
              </div>

              {hasValidRows && (
                <div className="flex gap-4 text-sm text-right">
                  <span className="opacity-60">
                    Total weight:{" "}
                    <span className="font-semibold text-amber-300">{fmt(totals.weight)} t</span>
                  </span>
                  <span className="opacity-60">
                    Total volume:{" "}
                    <span className="font-semibold text-amber-300">{fmt(totals.volume)} m³</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {sortedResults.length > 0 && (
            <div className="overflow-x-auto">
              <p className="small opacity-50 mb-2 m-0">
                {sortedResults.length.toLocaleString()} haulers
                {parsedMaxTrips && results.length !== sortedResults.length && (
                  <> (of {results.length.toLocaleString()} total, filtered to ≤ {parsedMaxTrips} trips)</>
                )}
                {" — sorted by fewest trips. "}
                <span className="text-[0.72rem]">● marks the limiting constraint.</span>
              </p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left border-b border-white/10">
                    <th
                      className="py-2 pr-3 font-semibold opacity-70 cursor-pointer whitespace-nowrap"
                      onClick={() => handleSort("name")}
                    >
                      Name <SortArrow active={sortKey === "name"} dir={sortDir} />
                    </th>
                    <th className="py-2 pr-3 font-semibold opacity-70 whitespace-nowrap">Type</th>
                    <th className="py-2 pr-3 font-semibold opacity-70 whitespace-nowrap hidden sm:table-cell">Class</th>
                    <th
                      className="py-2 pr-3 font-semibold opacity-70 cursor-pointer whitespace-nowrap hidden md:table-cell"
                      onClick={() => handleSort("weight_cap")}
                    >
                      Weight Cap <SortArrow active={sortKey === "weight_cap"} dir={sortDir} />
                    </th>
                    <th
                      className="py-2 pr-3 font-semibold opacity-70 cursor-pointer whitespace-nowrap hidden md:table-cell"
                      onClick={() => handleSort("vol_cap")}
                    >
                      Vol Cap <SortArrow active={sortKey === "vol_cap"} dir={sortDir} />
                    </th>
                    <th
                      className="py-2 pr-3 font-semibold opacity-70 cursor-pointer whitespace-nowrap"
                      onClick={() => handleSort("trips")}
                    >
                      Trips <SortArrow active={sortKey === "trips"} dir={sortDir} />
                    </th>
                    <th className="py-2 font-semibold opacity-70 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((entry) => (
                    <tr
                      key={entry.uid}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2 pr-3">{entry.name}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            entry.entity_type === "ship"
                              ? "bg-blue-900/60 text-blue-300"
                              : "bg-amber-900/60 text-amber-300"
                          }`}
                        >
                          {entry.entity_type}
                        </span>
                      </td>
                      <td className="py-2 pr-3 opacity-70 hidden sm:table-cell">{entry.class_name ?? "—"}</td>
                      <td className="py-2 pr-3 hidden md:table-cell">
                        {entry.weight_capacity_tonnes && entry.weight_capacity_tonnes > 0 ? (
                          <>
                            {fmt(entry.weight_capacity_tonnes)} t
                            {entry.limiting_factor === "weight" && (
                              <span className="ml-1 text-xs text-red-400">●</span>
                            )}
                          </>
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 hidden md:table-cell">
                        {entry.volume_capacity_m3 && entry.volume_capacity_m3 > 0 ? (
                          <>
                            {fmt(entry.volume_capacity_m3)} m³
                            {entry.limiting_factor === "volume" && (
                              <span className="ml-1 text-xs text-red-400">●</span>
                            )}
                          </>
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">
                        {entry.trips === 1 ? (
                          <span className="text-green-400">1</span>
                        ) : entry.trips <= 5 ? (
                          <span className="text-amber-300">{entry.trips}</span>
                        ) : (
                          <span className="opacity-80">{entry.trips}</span>
                        )}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className={BTN_SM}
                          onClick={() => setExportEntry(entry)}
                        >
                          Plan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

{hasValidRows && totals.weight === 0 && totals.volume === 0 && (
            <p className="small opacity-50 text-center py-8">
              Selected items have no weight or volume data — can&apos;t calculate trips.
            </p>
          )}

          {hasValidRows && (totals.weight > 0 || totals.volume > 0) && sortedResults.length === 0 && (
            <p className="small opacity-50 text-center py-8">
              No haulers with cargo capacity found in the database.
            </p>
          )}

          {!hasValidRows && (
            <p className="small opacity-40 text-center py-8">
              Add at least one item to the manifest to see hauler results.
            </p>
          )}
        </>
      )}

      {exportEntry && (
        <HaulPlanModal
          entry={exportEntry}
          text={exportText}
          onClose={() => setExportEntry(null)}
        />
      )}

      {showSaveModal && (
        <SaveManifestModal
          onSave={handleSaveManifest}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
};

export default HaulCalculatorPanel;
