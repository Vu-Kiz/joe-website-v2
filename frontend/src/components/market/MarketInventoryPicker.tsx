import React, { useEffect, useState } from "react";
import { ENTITY_TYPES, getFactionInventory, getPersonalInventory } from "../../api/market";
import type { EntityTypeKey } from "../../api/market";
import EntityDetailPopup from "./EntityDetailPopup";

type InventoryItem = {
  uid: string;
  name: string;
  quantity?: number | null;
};

type Props = {
  mode: "personal" | "faction";
  factionId?: number;
  entityType: EntityTypeKey;
  onEntityTypeChange: (type: EntityTypeKey) => void;
  selectedUid: string | null;
  onSelect: (item: InventoryItem) => void;
  allowedEntityTypes?: EntityTypeKey[];
  // Multi-select mode
  multiSelect?: boolean;
  selectedUids?: Set<string>;
  onToggle?: (item: InventoryItem) => void;
};

function getTags(val: any): string[] {
  const rawTag = val?.tags?.tag ?? [];
  const tags = Array.isArray(rawTag) ? rawTag : [rawTag];
  return tags.map((t: any) => (typeof t === "string" ? t : (t?.value ?? t?.name ?? "")).trim().toLowerCase());
}

function hasForSaleTag(val: any): boolean {
  return getTags(val).some((t) => t === "for sale");
}

function hasJoeMarketTag(val: any): boolean {
  return getTags(val).some((t) => t === "joe-market" || t === "joe-listing");
}

function normalizeDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function extractQuantity(val: any): number | null {
  const candidates = [
    val?.quantity?.value,
    val?.quantity,
    val?.attributes?.quantity,
    val?.amount?.value,
    val?.amount,
  ];

  for (const candidate of candidates) {
    const raw = typeof candidate === "object" && candidate !== null ? candidate.value : candidate;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function parseInventoryItems(json: any): { items: InventoryItem[]; protectedCount: number; untaggedCount: number } {
  if (!json) return { items: [], protectedCount: 0, untaggedCount: 0 };
  const rawEntities = json?.swcapi?.entities?.entity ?? [];
  const arr = Array.isArray(rawEntities) ? rawEntities : [rawEntities].filter(Boolean);

  let protectedCount = 0;
  let untaggedCount = 0;

  const items = arr
    .filter((item: any) => {
      const val = item?.value ?? item;
      if (val?.protected === "yes") { protectedCount++; return false; }
      if (!hasForSaleTag(val)) { untaggedCount++; return false; }
      if (hasJoeMarketTag(val)) return false;
      return true;
    })
    .map((item: any) => ({
      uid: item?.value?.uid ?? "",
      name: normalizeDisplayName(item?.value?.name ?? "Unknown"),
      quantity: extractQuantity(item?.value ?? item),
    }))
    .filter((i: InventoryItem) => i.uid !== "");

  return { items, protectedCount, untaggedCount };
}

const MarketInventoryPicker: React.FC<Props> = ({
  mode,
  factionId,
  entityType,
  onEntityTypeChange,
  selectedUid,
  onSelect,
  allowedEntityTypes,
  multiSelect = false,
  selectedUids,
  onToggle,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [protectedCount, setProtectedCount] = useState(0);
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setSearch("");

    const fetch = mode === "personal"
      ? getPersonalInventory(entityType)
      : factionId
        ? getFactionInventory(factionId, entityType)
        : Promise.reject(new Error("No faction selected"));

    fetch
      .then((res) => {
        if (!cancelled) {
          const { items: parsed, protectedCount: pc, untaggedCount: uc } = parseInventoryItems(res.data);
          setItems(parsed);
          setProtectedCount(pc);
          setUntaggedCount(uc);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          if ((e as any)?.status === 401) {
            setError("Your session has expired. Please refresh the page and log in again.");
          } else {
            setError(e?.message ?? "Failed to load inventory.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mode, factionId, entityType]);

  const visibleTypes = allowedEntityTypes
    ? ENTITY_TYPES.filter((et) => allowedEntityTypes.includes(et.key))
    : ENTITY_TYPES;

  const filteredItems = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div className="market-filter-bar">
        {visibleTypes.map((et) => (
          <button
            key={et.key}
            className={`market-filter-chip${entityType === et.key ? " is-active" : ""}`}
            type="button"
            onClick={() => onEntityTypeChange(et.key)}
          >
            {et.label}
          </button>
        ))}
      </div>

      {loading && <p className="market-empty">Loading inventory…</p>}
      {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}

      {!loading && !error && items.length > 0 && (
        <input
          className="input"
          type="search"
          placeholder={`Search ${items.length.toLocaleString()} items…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <p className="market-empty">
          No {entityType}s tagged "For Sale" in inventory.
          {(protectedCount > 0 || untaggedCount > 0) && (
            <> {[
              untaggedCount > 0 && `${untaggedCount} without "For Sale" tag`,
              protectedCount > 0 && `${protectedCount} protected`,
            ].filter(Boolean).join(", ")} excluded.</>
          )}
        </p>
      )}

      {!loading && !error && items.length > 0 && (protectedCount > 0 || untaggedCount > 0) && (
        <p className="small muted">
          {[
            untaggedCount > 0 && `${untaggedCount} without "For Sale" tag`,
            protectedCount > 0 && `${protectedCount} protected`,
          ].filter(Boolean).join(", ")} excluded.
        </p>
      )}

      {!loading && !error && items.length > 0 && filteredItems.length === 0 && (
        <p className="market-empty">No items match "{search}".</p>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="market-inventory-picker">
          {filteredItems.map((item) => {
            const isSelected = multiSelect ? (selectedUids?.has(item.uid) ?? false) : selectedUid === item.uid;
            return (
              <div
                key={item.uid}
                className={`market-inventory-item${isSelected ? " is-selected" : ""}`}
                onClick={() => multiSelect ? onToggle?.(item) : setPopup(item)}
              >
                {multiSelect && (
                  <input type="checkbox" checked={isSelected} onChange={() => onToggle?.(item)} onClick={(e) => e.stopPropagation()} />
                )}
                <span className="market-inventory-item__name">
                  {item.name}
                  {entityType === "material" && item.quantity != null ? ` (${item.quantity.toLocaleString()})` : ""}
                </span>
                <span className="market-inventory-item__uid">{item.uid}</span>
              </div>
            );
          })}
        </div>
      )}

      {!multiSelect && popup && (
        <EntityDetailPopup
          entityType={entityType}
          entityUid={popup.uid}
          entityName={popup.name}
          onClose={() => setPopup(null)}
          onSelect={() => onSelect(popup)}
          selectLabel={selectedUid === popup.uid ? "Selected ✓" : "Select This"}
        />
      )}
    </div>
  );
};

export default MarketInventoryPicker;
