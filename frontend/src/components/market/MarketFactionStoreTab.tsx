import React, { useEffect, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factionPrivileges";
import { ENTITY_TYPES, getFactionStoreListings, postFactionStoreListing } from "../../api/market";
import type { EntityTypeKey, MarketListing } from "../../api/market";
import MarketInventoryPicker from "./MarketInventoryPicker";
import MarketListingCard from "./MarketListingCard";

type Props = {
  manageableFactions: FactionPrivilegeCheckResult[];
  privsByEntityType: Record<string, FactionPrivilegeCheckResult[]>;
  hasFactionInventoryAccess: boolean;
  loadingPrivs: boolean;
};

const MarketFactionStoreTab: React.FC<Props> = ({
  manageableFactions,
  privsByEntityType,
  hasFactionInventoryAccess,
  loadingPrivs,
}) => {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<EntityTypeKey | "all">("all");
  const [showListForm, setShowListForm] = useState(false);

  // List form state
  const [formFactionId, setFormFactionId] = useState<number | null>(null);
  const [formEntityType, setFormEntityType] = useState<EntityTypeKey>("ship");
  const [formSelectedUid, setFormSelectedUid] = useState<string | null>(null);
  const [formSelectedName, setFormSelectedName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function loadListings() {
    setLoading(true);
    getFactionStoreListings({
      entity_type: entityFilter !== "all" ? entityFilter : undefined,
    })
      .then((res) => setListings(res.data ?? []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadListings(); }, [entityFilter]);

  // Entity types this user can manage for the selected faction.
  // Types without a SWC makeover privilege (material, city) are allowed whenever the user
  // has faction inventory access — they use manual transfer rather than SWC assign.
  // Materials have no SWC assign API — manual transfer only — so no makeover privilege exists for them.
  const NO_PRIVILEGE_TYPES: EntityTypeKey[] = ["material"];
  const allowedEntityTypes: EntityTypeKey[] = formFactionId
    ? (ENTITY_TYPES
        .filter(({ key }) => {
          if (NO_PRIVILEGE_TYPES.includes(key)) return hasFactionInventoryAccess;
          const privs = privsByEntityType[key] ?? [];
          return privs.some((p) => p.id === formFactionId && p.check.allowed);
        })
        .map(({ key }) => key) as EntityTypeKey[])
    : [];

  async function handleList(e: React.FormEvent) {
    e.preventDefault();
    if (!formFactionId || !formSelectedUid) {
      setFormError("Select a faction and an item.");
      return;
    }
    const priceNum = parseInt(formPrice, 10);
    if (!priceNum || priceNum < 1) {
      setFormError("Enter a valid price.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await postFactionStoreListing({
        faction_id: formFactionId,
        entity_type: formEntityType,
        entity_uid: formSelectedUid,
        entity_name: formSelectedName,
        price_credits: priceNum,
        quantity_total: parseInt(formQuantity, 10) || 1,
        notes: formNotes.trim() || null,
      });
      setShowListForm(false);
      setFormSelectedUid(null);
      setFormSelectedName("");
      setFormPrice("");
      setFormQuantity("1");
      setFormNotes("");
      loadListings();
    } catch (e: any) {
      setFormError(e?.message ?? "Failed to post listing.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div className="market-filter-bar">
          <button
            className={`market-filter-chip${entityFilter === "all" ? " is-active" : ""}`}
            type="button"
            onClick={() => setEntityFilter("all")}
          >
            All Types
          </button>
          {ENTITY_TYPES.map((et) => (
            <button
              key={et.key}
              className={`market-filter-chip${entityFilter === et.key ? " is-active" : ""}`}
              type="button"
              onClick={() => setEntityFilter(et.key)}
            >
              {et.label}
            </button>
          ))}
        </div>

        {!loadingPrivs && manageableFactions.length > 0 && hasFactionInventoryAccess && (
          <button
            className="btn"
            type="button"
            onClick={() => setShowListForm((v) => !v)}
            style={{ marginLeft: "auto" }}
          >
            {showListForm ? "Cancel" : "List Item"}
          </button>
        )}
      </div>

      {showListForm && (
        <form className="market-form" onSubmit={handleList}>
          <h3 className="h3" style={{ margin: 0 }}>List Faction Item</h3>

          <div className="market-form__row">
            <label className="market-form__label">Faction</label>
            <select
              className="input"
              value={formFactionId ?? ""}
              onChange={(e) => {
                setFormFactionId(Number(e.target.value) || null);
                setFormSelectedUid(null);
                setFormSelectedName("");
              }}
              required
            >
              <option value="">Select faction…</option>
              {manageableFactions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {formFactionId && (
            <div className="market-form__row">
              <label className="market-form__label">Select from faction inventory</label>
              <MarketInventoryPicker
                mode="faction"
                factionId={formFactionId}
                entityType={formEntityType}
                onEntityTypeChange={(t) => { setFormEntityType(t); setFormSelectedUid(null); setFormSelectedName(""); }}
                selectedUid={formSelectedUid}
                onSelect={(item) => { setFormSelectedUid(item.uid); setFormSelectedName(item.name); }}
                allowedEntityTypes={allowedEntityTypes.length > 0 ? allowedEntityTypes : undefined}
              />
            </div>
          )}

          {formSelectedUid && (
            <p className="small muted">Selected: <strong>{formSelectedName}</strong> ({formSelectedUid})</p>
          )}

          <div className="market-form__row">
            <label className="market-form__label" htmlFor="fstore-price">
              Price (Credits){formEntityType === "material" ? " per unit" : ""}
            </label>
            <input
              id="fstore-price"
              className="input"
              type="number"
              min={1}
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              placeholder="e.g. 250000"
              required
            />
          </div>

          {formEntityType === "material" && (
            <div className="market-form__row">
              <label className="market-form__label" htmlFor="fstore-quantity">Quantity</label>
              <input
                id="fstore-quantity"
                className="input"
                type="number"
                min={1}
                value={formQuantity}
                onChange={(e) => setFormQuantity(e.target.value)}
                required
              />
            </div>
          )}

          <div className="market-form__row">
            <label className="market-form__label" htmlFor="fstore-notes">Notes (optional)</label>
            <textarea
              id="fstore-notes"
              className="input"
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          {formError && <p className="small" style={{ color: "#f87171" }}>{formError}</p>}

          <button className="btn" type="submit" disabled={submitting || !formSelectedUid}>
            {submitting ? "Listing…" : "List Item"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="market-empty">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="market-empty">No faction store listings right now.</p>
      ) : (
        <div className="market-grid">
          {listings.map((listing) => (
            <MarketListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketFactionStoreTab;
