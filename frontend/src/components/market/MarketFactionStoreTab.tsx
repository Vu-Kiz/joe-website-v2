import React, { useEffect, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factions/factionPrivileges";
import { ENTITY_TYPES, getFactionStoreListings, postFactionStoreListing } from "../../api/market/market";
import type { EntityTypeKey, MarketListing } from "../../api/market/market";
import MarketInventoryPicker from "./MarketInventoryPicker";
import MarketListingCard from "./MarketListingCard";
import { EMPTY_CLS, FILTER_CHIP_CLS, FORM_ROW_CLS, FORM_LABEL_CLS } from "./marketDisplay";
import { BTN, INPUT} from "../../utils/ui";
import CreditInput, { parseCreditInput } from "../common/CreditInput";

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
    getFactionStoreListings({ entity_type: entityFilter !== "all" ? entityFilter : undefined })
      .then((res) => setListings(res.data ?? []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadListings(); }, [entityFilter]);

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
    if (!formFactionId || !formSelectedUid) { setFormError("Select a faction and an item."); return; }
    const priceNum = parseCreditInput(formPrice);
    if (!priceNum || priceNum < 1) { setFormError("Enter a valid price."); return; }
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
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex gap-[0.4rem] flex-wrap items-center">
          <button className={FILTER_CHIP_CLS(entityFilter === "all")} type="button" onClick={() => setEntityFilter("all")}>All Types</button>
          {ENTITY_TYPES.map((et) => (
            <button key={et.key} className={FILTER_CHIP_CLS(entityFilter === et.key)} type="button" onClick={() => setEntityFilter(et.key)}>{et.label}</button>
          ))}
        </div>
        {!loadingPrivs && manageableFactions.length > 0 && hasFactionInventoryAccess && (
          <button className={BTN + " ml-auto"} type="button" onClick={() => setShowListForm((v) => !v)}>
            {showListForm ? "Cancel" : "List Item"}
          </button>
        )}
      </div>

      {showListForm && (
        <form className="flex flex-col gap-4 p-5 rounded-[12px] border border-white/[0.08] bg-white/[0.02]" onSubmit={handleList}>
          <h3 className="h3" style={{ margin: 0 }}>List Faction Item</h3>

          <div className={FORM_ROW_CLS}>
            <label className={FORM_LABEL_CLS}>Faction</label>
            <select
              className={INPUT}
              value={formFactionId ?? ""}
              onChange={(e) => { setFormFactionId(Number(e.target.value) || null); setFormSelectedUid(null); setFormSelectedName(""); }}
              required
            >
              <option value="">Select faction…</option>
              {manageableFactions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {formFactionId && (
            <div className={FORM_ROW_CLS}>
              <label className={FORM_LABEL_CLS}>Select from faction inventory</label>
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

          {formSelectedUid && <p className="small muted">Selected: <strong>{formSelectedName}</strong> ({formSelectedUid})</p>}

          <div className={FORM_ROW_CLS}>
            <label className={FORM_LABEL_CLS} htmlFor="fstore-price">
              Price (Credits){formEntityType === "material" ? " per unit" : ""}
            </label>
            <CreditInput id="fstore-price" className={INPUT} value={formPrice} onChange={setFormPrice} placeholder="e.g. 250,000" required />
          </div>

          {formEntityType === "material" && (
            <div className={FORM_ROW_CLS}>
              <label className={FORM_LABEL_CLS} htmlFor="fstore-quantity">Quantity</label>
              <input id="fstore-quantity" className={INPUT} type="number" min={1} value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} required />
            </div>
          )}

          <div className={FORM_ROW_CLS}>
            <label className={FORM_LABEL_CLS} htmlFor="fstore-notes">Notes (optional)</label>
            <textarea id="fstore-notes" className={INPUT} rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
          </div>

          {formError && <p className="small" style={{ color: "#f87171" }}>{formError}</p>}

          <button className={BTN} type="submit" disabled={submitting || !formSelectedUid}>
            {submitting ? "Listing…" : "List Item"}
          </button>
        </form>
      )}

      {loading ? (
        <p className={EMPTY_CLS}>Loading…</p>
      ) : listings.length === 0 ? (
        <p className={EMPTY_CLS}>No faction store listings right now.</p>
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] max-[480px]:grid-cols-1">
          {listings.map((listing) => <MarketListingCard key={listing.id} listing={listing} />)}
        </div>
      )}
    </div>
  );
};

export default MarketFactionStoreTab;
