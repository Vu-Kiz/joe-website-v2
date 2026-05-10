import React, { useRef, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factionPrivileges";
import {
  ENTITY_TYPES,
  postMemberListing,
  postFactionStoreListing,
  postCustomListing,
  postBundleListing,
  uploadCustomImage,
} from "../../api/market";
import type { EntityTypeKey, EntityTypeResult } from "../../api/market";
import MarketInventoryPicker from "./MarketInventoryPicker";
import EntityTypePicker from "./EntityTypePicker";

type Source = "personal" | "faction";
type PostType = "entity" | "custom";
type ListingAudience = "public" | "joe_members";

type SelectedItem = {
  uid: string;
  name: string;
  entityType: EntityTypeKey;
  availableQuantity?: number | null;
  price: string;
  quantity: string;
  notes: string;
  imageWatermarked: boolean;
};

type PostResult = { name: string; ok: boolean; message?: string };

type InventoryItem = { uid: string; name: string; quantity?: number | null };

type Props = {
  hasPersonalInventoryAccess: boolean;
  hasFactionInventoryAccess: boolean;
  manageableFactions: FactionPrivilegeCheckResult[];
  privsByEntityType: Record<string, FactionPrivilegeCheckResult[]>;
  loadingPrivs: boolean;
  onPosted: () => void;
};

const NO_PRIVILEGE_TYPES: EntityTypeKey[] = ["material"];

const MarketPostTab: React.FC<Props> = ({
  hasPersonalInventoryAccess,
  hasFactionInventoryAccess,
  manageableFactions,
  privsByEntityType,
  loadingPrivs,
  onPosted,
}) => {
  const canPersonal = hasPersonalInventoryAccess;
  const canFaction = hasFactionInventoryAccess && manageableFactions.length > 0;

  const [postType, setPostType] = useState<PostType>("entity");
  const [source, setSource] = useState<Source>(canPersonal ? "personal" : "faction");
  const [audience, setAudience] = useState<ListingAudience>("public");
  const [factionId, setFactionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PostResult[]>([]);

  // Multi-select
  const [entityType, setEntityType] = useState<EntityTypeKey>("ship");
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [globalPrice, setGlobalPrice] = useState("");
  const [bundleName, setBundleName] = useState("");

  // Custom art state
  const [customEntityType, setCustomEntityType] = useState<EntityTypeResult | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [customUnlimited, setCustomUnlimited] = useState(true);
  const [customUses, setCustomUses] = useState("1");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [watermarkedUrl, setWatermarkedUrl] = useState<string | null>(null);
  const [uploadedPaths, setUploadedPaths] = useState<{ original: string; watermarked: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleItem(item: InventoryItem) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.uid === item.uid);
      if (exists) return prev.filter((s) => s.uid !== item.uid);
      return [...prev, {
        uid: item.uid,
        name: item.name,
        entityType,
        availableQuantity: item.quantity ?? null,
        price: globalPrice,
        quantity: "1",
        notes: "",
        imageWatermarked: false,
      }];
    });
  }

  function updateSelected(uid: string, patch: Partial<SelectedItem>) {
    setSelected((prev) => prev.map((s) => s.uid === uid ? { ...s, ...patch } : s));
  }

  function applyGlobalPrice() {
    if (!globalPrice) return;
    setSelected((prev) => prev.map((s) => ({ ...s, price: globalPrice })));
  }

  function splitTotal() {
    if (!globalPrice || selected.length === 0) return;
    const perItem = Math.floor(parseInt(globalPrice, 10) / selected.length);
    if (perItem < 1) return;
    setSelected((prev) => prev.map((s) => ({ ...s, price: String(perItem) })));
  }

  function handleSourceChange(s: Source) {
    setSource(s);
    setAudience("public");
    setFactionId(null);
    setSelected([]);
  }

  function handleEntityTypeChange(t: EntityTypeKey) {
    setEntityType(t);
  }

  const allowedEntityTypes = (id: number | null): EntityTypeKey[] | undefined => {
    if (!id) return undefined;
    const types = ENTITY_TYPES
      .filter(({ key }) => {
        if (NO_PRIVILEGE_TYPES.includes(key)) return hasFactionInventoryAccess;
        const privs = privsByEntityType[key] ?? [];
        return privs.some((p) => p.id === id && p.check.allowed);
      })
      .map(({ key }) => key) as EntityTypeKey[];
    return types.length > 0 ? types : undefined;
  };

  async function handleFileSelect(file: File) {
    setPreviewUrl(URL.createObjectURL(file));
    setWatermarkedUrl(null);
    setUploadedPaths(null);
    setError(null);
    setUploading(true);
    try {
      const res = await uploadCustomImage(file);
      setWatermarkedUrl(res.watermarked_url);
      setUploadedPaths({ original: res.original_path, watermarked: res.watermarked_path });
    } catch (e: any) {
      setError(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitEntity(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResults([]);

    if (source === "faction" && !factionId) { setError("Select a faction."); return; }

    const valid = selected.filter((s) => parseInt(s.price, 10) >= 0);
    if (valid.length === 0) { setError("Select at least one item and set a price."); return; }

    const invalidMaterial = valid.find((s) =>
      s.entityType === "material" &&
      s.availableQuantity != null &&
      (parseInt(s.quantity, 10) || 1) > s.availableQuantity
    );
    if (invalidMaterial) {
      setError(`${invalidMaterial.name} only has ${invalidMaterial.availableQuantity?.toLocaleString()} available in the pile.`);
      return;
    }

    const isBundle = valid.length > 1;

    if (isBundle && !bundleName.trim()) { setError("Enter a bundle name."); return; }

    setSubmitting(true);

    try {
      if (isBundle) {
        await postBundleListing({
          bundle_name: bundleName.trim(),
          faction_id: source === "faction" ? factionId ?? undefined : undefined,
          audience,
          image_watermarked: valid.some((s) => s.imageWatermarked),
          items: valid.map((s) => ({
            entity_type: s.entityType,
            entity_uid: s.uid,
            entity_name: s.name,
            price_credits: parseInt(s.price, 10) || 0,
            quantity_total: parseInt(s.quantity, 10) || 1,
          })),
        });
        setResults([{ name: bundleName.trim(), ok: true }]);
      } else {
        const s = valid[0];
        const payload = {
          entity_type: s.entityType,
          entity_uid: s.uid,
          entity_name: s.name,
          price_credits: parseInt(s.price, 10),
          quantity_total: parseInt(s.quantity, 10) || 1,
          audience,
          notes: s.notes.trim() || null,
          image_watermarked: s.imageWatermarked,
        };
        if (source === "personal") {
          await postMemberListing(payload);
        } else {
          await postFactionStoreListing({ ...payload, faction_id: factionId! });
        }
        setResults([{ name: s.name, ok: true }]);
      }
      setSelected([]);
      setBundleName("");
      setTimeout(onPosted, 1200);
    } catch (e: any) {
      setError(e?.message ?? "Failed to post listing.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitCustom(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!customEntityType) { setError("Select an entity type."); return; }
    if (!uploadedPaths) { setError("Upload an image first."); return; }
    const priceNum = parseInt(customPrice, 10);
    if (!priceNum || priceNum < 1) { setError("Enter a valid price."); return; }
    if (source === "faction" && !factionId) { setError("Select a faction."); return; }

    setSubmitting(true);
    try {
      await postCustomListing({
        price_credits: priceNum,
        audience,
        notes: customNotes.trim() || null,
        custom_image_path: uploadedPaths.original,
        custom_image_watermarked_path: uploadedPaths.watermarked,
        custom_entity_category: customEntityType.category,
        custom_entity_uid: customEntityType.uid,
        custom_entity_name: customEntityType.name,
        custom_entity_image_url: customEntityType.image_url ?? null,
        faction_id: source === "faction" ? factionId ?? undefined : undefined,
        is_unlimited: customUnlimited,
        quantity_total: customUnlimited ? null : (parseInt(customUses, 10) || 1),
      });
      onPosted();
    } catch (e: any) {
      setError(e?.message ?? "Failed to post listing.");
    } finally {
      setSubmitting(false);
    }
  }

  const sharedControls = (
    <div className="market-form__grid">
      <div className="market-form__row">
        <label className="market-form__label">Type</label>
        <div className="market-filter-bar">
          <button className={`market-filter-chip${postType === "entity" ? " is-active" : ""}`} type="button" onClick={() => { setPostType("entity"); setError(null); setResults([]); }}>Entity Sale</button>
          <button className={`market-filter-chip${postType === "custom" ? " is-active" : ""}`} type="button" onClick={() => { setPostType("custom"); setError(null); setResults([]); }}>Custom Art</button>
        </div>
      </div>

      {canPersonal && canFaction && (
        <div className="market-form__row">
          <label className="market-form__label">Source</label>
          <div className="market-filter-bar">
            <button className={`market-filter-chip${source === "personal" ? " is-active" : ""}`} type="button" onClick={() => handleSourceChange("personal")}>My Inventory</button>
            <button className={`market-filter-chip${source === "faction" ? " is-active" : ""}`} type="button" onClick={() => handleSourceChange("faction")}>Faction Store</button>
          </div>
        </div>
      )}

      {source === "faction" && (
        <div className="market-form__row">
          <label className="market-form__label">Faction</label>
          <select className="input" value={factionId ?? ""} onChange={(e) => { setFactionId(Number(e.target.value) || null); setSelected([]); }} required>
            <option value="">Select faction…</option>
            {manageableFactions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {(source === "personal" || source === "faction") && (
        <div className="market-form__row">
          <label className="market-form__label">Who can see this listing</label>
          <div className="market-filter-bar">
            <button
              className={`market-filter-chip${audience === "public" ? " is-active" : ""}`}
              type="button"
              onClick={() => setAudience("public")}
            >
              Public
            </button>
            <button
              className={`market-filter-chip${audience === "joe_members" ? " is-active" : ""}`}
              type="button"
              onClick={() => setAudience("joe_members")}
            >
              JOE Members
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {audience === "joe_members"
              ? "Only JOE members will see this listing."
              : source === "faction"
              ? "Any logged-in user can see this faction listing."
              : "Any logged-in user can see this listing."}
          </p>
        </div>
      )}
    </div>
  );

  if (postType === "custom") {
    return (
      <form className="market-form" onSubmit={handleSubmitCustom}>
        <h3 className="h3" style={{ margin: 0 }}>Post a Listing</h3>
        {sharedControls}

        <div className="market-form__grid">
          <div className="market-form__col">
            <div className="market-form__row">
              <label className="market-form__label">Custom Image *</label>
              <div
                className={`market-custom-form__dropzone${uploading ? " is-loading" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFileSelect(f); }}
                onClick={() => fileRef.current?.click()}
              >
                {watermarkedUrl ? (
                  <div className="market-custom-form__preview-wrap">
                    <img src={watermarkedUrl} alt="Watermarked preview" className="market-custom-form__preview" />
                    <span className="muted small">Watermarked preview — buyers see this</span>
                  </div>
                ) : previewUrl ? (
                  <div className="market-custom-form__preview-wrap">
                    <img src={previewUrl} alt="Preview" className="market-custom-form__preview" />
                    <span className="muted small">{uploading ? "Uploading and watermarking…" : "Processing…"}</span>
                  </div>
                ) : (
                  <div className="market-custom-form__dropzone-placeholder">
                    <span>Drop image here or click to upload</span>
                    <span className="muted small">JPEG, PNG, or WebP · max 8MB</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              {watermarkedUrl && (
                <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: "0.5rem" }} onClick={() => fileRef.current?.click()}>Replace image</button>
              )}
            </div>
          </div>
          <div className="market-form__col">
            <div className="market-form__row">
              <label className="market-form__label">Entity Type *</label>
              <EntityTypePicker value={customEntityType} onChange={setCustomEntityType} placeholder="Search ships, vehicles, droids…" />
            </div>
            <div className="market-form__row">
              <label className="market-form__label" htmlFor="custom-price">Price per use (Credits)</label>
              <input id="custom-price" className="input" type="number" min={1} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="e.g. 500000" required />
            </div>
            <div className="market-form__row">
              <label className="market-form__label">Uses</label>
              <div className="market-filter-bar">
                <button className={`market-filter-chip${customUnlimited ? " is-active" : ""}`} type="button" onClick={() => setCustomUnlimited(true)}>Unlimited</button>
                <button className={`market-filter-chip${!customUnlimited ? " is-active" : ""}`} type="button" onClick={() => setCustomUnlimited(false)}>Limited</button>
              </div>
              {!customUnlimited && (
                <input className="input" type="number" min={1} value={customUses} onChange={(e) => setCustomUses(e.target.value)} style={{ marginTop: "0.5rem" }} />
              )}
            </div>
            <div className="market-form__row">
              <label className="market-form__label" htmlFor="custom-notes">Notes (optional)</label>
              <textarea id="custom-notes" className="input" rows={3} maxLength={2000} value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} placeholder="Describe the custom, delivery method, etc." />
            </div>
          </div>
        </div>

        {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}
        <button className="btn" type="submit" disabled={submitting || uploading || !customEntityType || !uploadedPaths || (source === "faction" && !factionId)}>
          {submitting ? "Posting…" : "Post Custom Listing"}
        </button>
      </form>
    );
  }

  // Entity sale — multi-select mode
  const selectedUids = new Set(selected.map((s) => s.uid));
  const readyCount = selected.filter((s) => parseInt(s.price, 10) > 0).length;

  return (
    <form className="market-form" onSubmit={handleSubmitEntity}>
      <h3 className="h3" style={{ margin: 0 }}>Post Listings</h3>
      {sharedControls}

      {(source === "personal" || (source === "faction" && factionId)) && (
        <>
          <MarketInventoryPicker
            mode={source}
            factionId={source === "faction" ? factionId ?? undefined : undefined}
            entityType={entityType}
            onEntityTypeChange={handleEntityTypeChange}
            selectedUid={null}
            onSelect={() => {}}
            allowedEntityTypes={source === "faction" ? allowedEntityTypes(factionId) : undefined}
            multiSelect
            selectedUids={selectedUids}
            onToggle={toggleItem}
          />

          {selected.length > 1 && (
            <div className="market-form__row">
              <label className="market-form__label">Bundle Name *</label>
              <input className="input" type="text" value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="e.g. JOE Fleet Package" />
            </div>
          )}

          {selected.length > 0 && (
            <>
              <div className="market-post-queue__global-price">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={globalPrice}
                  onChange={(e) => setGlobalPrice(e.target.value)}
                  placeholder="Price or total amount…"
                  style={{ flex: 1 }}
                />
                <button className="btn btn--ghost" type="button" onClick={applyGlobalPrice} disabled={!globalPrice}>
                  Each
                </button>
                <button className="btn btn--ghost" type="button" onClick={splitTotal} disabled={!globalPrice || selected.length === 0}>
                  Split Evenly
                </button>
              </div>

              <div className="market-post-queue">
                {selected.map((s) => (
                  <div key={s.uid} className="market-post-queue__item">
                    <div className="market-post-queue__item-header">
                      <span className="small" style={{ fontWeight: 500 }}>{s.name}</span>
                      <button className="market-post-queue__remove" type="button" onClick={() => setSelected((prev) => prev.filter((x) => x.uid !== s.uid))}>✕</button>
                    </div>
                    <div className="market-post-queue__item-fields">
                      <div className="market-form__row">
                        <label className="market-form__label">Price{s.entityType === "material" ? " / unit" : ""} (Credits)</label>
                        <input className="input" type="number" min={1} value={s.price} onChange={(e) => updateSelected(s.uid, { price: e.target.value })} placeholder="e.g. 50000" />
                      </div>
                      {s.entityType === "material" && (
                        <div className="market-form__row">
                          <label className="market-form__label">Quantity</label>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={s.availableQuantity ?? undefined}
                            value={s.quantity}
                            onChange={(e) => {
                              const nextValue = parseInt(e.target.value, 10) || 1;
                              const cappedValue = s.availableQuantity != null
                                ? Math.min(Math.max(1, nextValue), s.availableQuantity)
                                : Math.max(1, nextValue);
                              updateSelected(s.uid, { quantity: String(cappedValue) });
                            }}
                          />
                          {s.availableQuantity != null && (
                            <p className="small muted" style={{ margin: 0 }}>
                              Up to {s.availableQuantity.toLocaleString()} in this pile.
                            </p>
                          )}
                        </div>
                      )}
                      <div className="market-form__row">
                        <label className="market-form__label">Notes</label>
                        <input className="input" type="text" value={s.notes} onChange={(e) => updateSelected(s.uid, { notes: e.target.value })} placeholder="Optional" />
                      </div>
                      <div className="market-form__row">
                        <label className="market-form__checkbox-row">
                          <input type="checkbox" checked={s.imageWatermarked} onChange={(e) => updateSelected(s.uid, { imageWatermarked: e.target.checked })} />
                          <span className="small">Watermark image</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {results.length > 0 && (
        <div className="market-post-queue__results">
          {results.map((r, i) => (
            <p key={i} className="small" style={{ margin: 0, color: r.ok ? "#8fe1a8" : "#f87171" }}>
              {r.ok ? "✓" : "✕"} {r.name}{!r.ok && ` — ${r.message}`}
            </p>
          ))}
        </div>
      )}

      {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}

      {selected.length > 0 && (
        <button
          className="btn"
          type="submit"
          disabled={submitting || loadingPrivs || readyCount === 0 || (source === "faction" && !factionId)}
        >
          {submitting ? "Posting…" : `Post ${readyCount} Listing${readyCount !== 1 ? "s" : ""}`}
        </button>
      )}
    </form>
  );
};

export default MarketPostTab;
