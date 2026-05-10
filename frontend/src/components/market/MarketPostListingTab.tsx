import React, { useState } from "react";
import { postMemberListing } from "../../api/market";
import type { EntityTypeKey } from "../../api/market";
import MarketInventoryPicker from "./MarketInventoryPicker";

type Props = {
  hasPersonalInventoryAccess: boolean;
  onPosted: () => void;
};

const MarketPostListingTab: React.FC<Props> = ({ hasPersonalInventoryAccess, onPosted }) => {
  const [entityType, setEntityType] = useState<EntityTypeKey>("ship");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasPersonalInventoryAccess) {
    return (
      <div>
        <p className="muted">
          You need Market (Personal Inventory) access synced on your About Me page before you can post listings.
        </p>
        <a className="btn btn--ghost" href="/aboutme">Open About Me</a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUid) {
      setError("Select an item from your inventory.");
      return;
    }

    const priceNum = parseInt(price, 10);
    if (!priceNum || priceNum < 1) {
      setError("Enter a valid price.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await postMemberListing({
        entity_type: entityType,
        entity_uid: selectedUid,
        entity_name: selectedName,
        price_credits: priceNum,
        quantity_total: parseInt(quantity, 10) || 1,
        notes: notes.trim() || null,
      });
      onPosted();
    } catch (e: any) {
      setError(e?.message ?? "Failed to post listing.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="market-form" onSubmit={handleSubmit}>
      <h3 className="h3" style={{ margin: 0 }}>Post a Listing</h3>

      <div className="market-form__row">
        <label className="market-form__label">Select from your inventory</label>
        <MarketInventoryPicker
          mode="personal"
          entityType={entityType}
          onEntityTypeChange={(t) => { setEntityType(t); setSelectedUid(null); setSelectedName(""); }}
          selectedUid={selectedUid}
          onSelect={(item) => { setSelectedUid(item.uid); setSelectedName(item.name); }}
        />
      </div>

      {selectedUid && (
        <p className="small muted">Selected: <strong>{selectedName}</strong> ({selectedUid})</p>
      )}

      <div className="market-form__row">
        <label className="market-form__label" htmlFor="market-price">
          Price (Credits){entityType === "material" ? " per unit" : ""}
        </label>
        <input
          id="market-price"
          className="input"
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 50000"
          required
        />
      </div>

      {entityType === "material" && (
        <div className="market-form__row">
          <label className="market-form__label" htmlFor="market-quantity">Quantity</label>
          <input
            id="market-quantity"
            className="input"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <p className="small muted">Pre-split the stack in SWC before listing.</p>
        </div>
      )}

      <div className="market-form__row">
        <label className="market-form__label" htmlFor="market-notes">Notes (optional)</label>
        <textarea
          id="market-notes"
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Condition, restrictions, etc."
        />
      </div>

      {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}

      <button className="btn" type="submit" disabled={submitting || !selectedUid}>
        {submitting ? "Posting…" : "Post Listing"}
      </button>
    </form>
  );
};

export default MarketPostListingTab;
