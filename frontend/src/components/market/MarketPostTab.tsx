import React, { useRef, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factions/factionPrivileges";
import {
  ENTITY_TYPES,
  postMemberListing,
  postFactionStoreListing,
  postCustomListing,
  postBundleListing,
  postStockListing,
  uploadCustomImage,
  getEntityDetail,
} from "../../api/market/market";
import type { EntityTypeKey, EntityTypeResult } from "../../api/market/market";
import MarketConfirmDialog from "./MarketConfirmDialog";
import MarketInventoryPicker from "./MarketInventoryPicker";
import EntityTypePicker from "./EntityTypePicker";
import { FILTER_CHIP_CLS, FORM_ROW_CLS, FORM_LABEL_CLS } from "./marketDisplay";
import { BTN, BTN_GHOST, BTN_GHOST_SM, INPUT, SELECT_INPUT} from "../../utils/ui";
import CreditInput, { parseCreditInput } from "../common/CreditInput";

type Source = "personal" | "faction";
type PostType = "entity" | "custom";
type MultiMode = "bundle" | "stock";
type ListingAudience = "public" | "joe_members";

type SelectedItem = {
  uid: string;
  name: string;
  entityType: EntityTypeKey;
  typeUid: string | null;
  typeName: string | null;
  availableQuantity?: number | null;
  price: string;
  quantity: string;
  notes: string;
  imageWatermarked: boolean;
};

type PostResult = { name: string; ok: boolean; message?: string };
type InventoryItem = { uid: string; name: string; quantity?: number | null; typeUid?: string | null; typeName?: string | null };

type Props = {
  hasPersonalInventoryAccess: boolean;
  hasFactionInventoryAccess: boolean;
  manageableFactions: FactionPrivilegeCheckResult[];
  privsByEntityType: Record<string, FactionPrivilegeCheckResult[]>;
  loadingPrivs: boolean;
  onPosted: () => void;
};

const NO_PRIVILEGE_TYPES: EntityTypeKey[] = ["material"];


const FORM_CLS = "flex flex-col gap-4 p-5 rounded-[12px] border border-white/[0.08] bg-white/[0.02]";
const FORM_GRID = "grid gap-4 grid-cols-2 max-[640px]:grid-cols-1";

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

  const [entityType, setEntityType] = useState<EntityTypeKey>("ship");
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [globalPrice, setGlobalPrice] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [multiMode, setMultiMode] = useState<MultiMode>("bundle");
  const [stockPrice, setStockPrice] = useState("");
  const [cargoWarnings, setCargoWarnings] = useState<string[] | null>(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);

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
      return [...prev, { uid: item.uid, name: item.name, entityType, typeUid: item.typeUid ?? null, typeName: item.typeName ?? null, availableQuantity: item.quantity ?? null, price: globalPrice, quantity: "1", notes: "", imageWatermarked: false }];
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
    const perItem = Math.floor(parseCreditInput(globalPrice) / selected.length);
    if (perItem < 1) return;
    setSelected((prev) => prev.map((s) => ({ ...s, price: String(perItem) })));
  }

  function handleSourceChange(s: Source) {
    setSource(s);
    setAudience("public");
    setFactionId(null);
    setSelected([]);
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

  async function executePost(valid: SelectedItem[], isBundle: boolean, isStock: boolean) {
    setSubmitting(true);
    try {
      if (isStock) {
        const priceNum = parseCreditInput(stockPrice);
        await postStockListing({
          entity_type: valid[0].entityType,
          entity_uids: valid.map((s) => s.uid),
          price_credits: priceNum,
          faction_id: source === "faction" ? factionId ?? undefined : undefined,
          audience,
          image_watermarked: valid.some((s) => s.imageWatermarked),
          notes: valid[0].notes.trim() || null,
        });
        setResults([{ name: `${valid.length}× ${valid[0].name}`, ok: true }]);
      } else if (isBundle) {
        await postBundleListing({
          bundle_name: bundleName.trim(),
          faction_id: source === "faction" ? factionId ?? undefined : undefined,
          audience,
          image_watermarked: valid.some((s) => s.imageWatermarked),
          items: valid.map((s) => ({
            entity_type: s.entityType,
            entity_uid: s.uid,
            entity_name: s.name,
            price_credits: parseCreditInput(s.price) || 0,
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
          price_credits: parseCreditInput(s.price),
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
      setStockPrice("");
      setTimeout(onPosted, 1200);
    } catch (e: any) {
      setError(e?.message ?? "Failed to post listing.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEntity(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResults([]);
    if (source === "faction" && !factionId) { setError("Select a faction."); return; }
    const valid = selected.filter((s) => parseCreditInput(s.price) >= 0 || multiMode === "stock");
    if (valid.length === 0) { setError("Select at least one item."); return; }
    const invalidMaterial = valid.find((s) =>
      s.entityType === "material" && s.availableQuantity != null && (parseInt(s.quantity, 10) || 1) > s.availableQuantity
    );
    if (invalidMaterial) { setError(`${invalidMaterial.name} only has ${invalidMaterial.availableQuantity?.toLocaleString()} available in the pile.`); return; }
    const isMulti = valid.length > 1;
    const isStock = isMulti && multiMode === "stock";
    const isBundle = isMulti && multiMode === "bundle";
    if (isStock) {
      const priceNum = parseCreditInput(stockPrice);
      if (!priceNum || priceNum < 1) { setError("Enter a price per unit for the stock listing."); return; }
    }
    if (isBundle && !bundleName.trim()) { setError("Enter a bundle name."); return; }

    // Check for cargo / passengers on non-material entities, and for stock: same model (type_uid)
    const toCheck = valid.filter((s) => s.entityType !== "material");
    if (toCheck.length > 0) {
      setSubmitting(true);
      const warnings: string[] = [];
      const resolvedTypeUids: (string | null)[] = [];
      try {
        await Promise.all(toCheck.map(async (s) => {
          try {
            const res = await getEntityDetail(s.entityType, s.uid);
            resolvedTypeUids.push(res.data.type_uid ?? null);
            const cargo = res.data.cargo;
            if (cargo) {
              const hasCargo = cargo.weight_total != null && cargo.weight_remaining != null && cargo.weight_remaining < cargo.weight_total;
              const hasPassengers = cargo.passengers_total != null && cargo.passengers_remaining != null && cargo.passengers_remaining < cargo.passengers_total;
              if (hasCargo || hasPassengers) {
                const what = [hasCargo && "cargo", hasPassengers && "passengers"].filter(Boolean).join(" & ");
                warnings.push(`${s.name} has ${what}`);
              }
            }
          } catch { /* don't block posting if the check fails */ }
        }));
      } finally {
        setSubmitting(false);
      }
      // Stock: all items must be the same model
      if (isStock) {
        const knownUids = resolvedTypeUids.filter(Boolean);
        const uniqueModels = new Set(knownUids);
        if (uniqueModels.size > 1) {
          setError("Stock listings must all be the same type. Remove the mixed types before posting.");
          return;
        }
      }
      if (warnings.length > 0) {
        pendingPostRef.current = () => executePost(valid, isBundle, isStock);
        setCargoWarnings(warnings);
        return;
      }
    }

    await executePost(valid, isBundle, isStock);
  }

  function handleCargoConfirm() {
    setCargoWarnings(null);
    const fn = pendingPostRef.current;
    pendingPostRef.current = null;
    if (fn) void fn();
  }

  async function handleSubmitCustom(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!customEntityType) { setError("Select an entity type."); return; }
    if (!uploadedPaths) { setError("Upload an image first."); return; }
    const priceNum = parseCreditInput(customPrice);
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
    <div className={FORM_GRID}>
      <div className={FORM_ROW_CLS}>
        <label className={FORM_LABEL_CLS}>Type</label>
        <div className="flex gap-[0.4rem] flex-wrap items-center">
          <button className={FILTER_CHIP_CLS(postType === "entity")} type="button" onClick={() => { setPostType("entity"); setError(null); setResults([]); }}>Entity Sale</button>
          <button className={FILTER_CHIP_CLS(postType === "custom")} type="button" onClick={() => { setPostType("custom"); setError(null); setResults([]); }}>Custom Art</button>
        </div>
      </div>
      {canPersonal && canFaction && (
        <div className={FORM_ROW_CLS}>
          <label className={FORM_LABEL_CLS}>Source</label>
          <div className="flex gap-[0.4rem] flex-wrap items-center">
            <button className={FILTER_CHIP_CLS(source === "personal")} type="button" onClick={() => handleSourceChange("personal")}>My Inventory</button>
            <button className={FILTER_CHIP_CLS(source === "faction")} type="button" onClick={() => handleSourceChange("faction")}>Faction Store</button>
          </div>
        </div>
      )}
      {source === "faction" && (
        <div className={FORM_ROW_CLS}>
          <label className={FORM_LABEL_CLS}>Faction</label>
          <select className={SELECT_INPUT} value={factionId ?? ""} onChange={(e) => { setFactionId(Number(e.target.value) || null); setSelected([]); }} required>
            <option value="">Select faction…</option>
            {manageableFactions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      {(source === "personal" || source === "faction") && (
        <div className={FORM_ROW_CLS}>
          <label className={FORM_LABEL_CLS}>Who can see this listing</label>
          <div className="flex gap-[0.4rem] flex-wrap items-center">
            <button className={FILTER_CHIP_CLS(audience === "public")} type="button" onClick={() => setAudience("public")}>Public</button>
            <button className={FILTER_CHIP_CLS(audience === "joe_members")} type="button" onClick={() => setAudience("joe_members")}>JOE Members</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {audience === "joe_members" ? "Only JOE members will see this listing." : source === "faction" ? "Any logged-in user can see this faction listing." : "Any logged-in user can see this listing."}
          </p>
        </div>
      )}
    </div>
  );

  if (postType === "custom") {
    return (
      <form className={FORM_CLS} onSubmit={handleSubmitCustom}>
        <h3 className="h3" style={{ margin: 0 }}>Post a Listing</h3>
        {sharedControls}

        <div className={FORM_GRID}>
          <div className="flex flex-col gap-4">
            <div className={FORM_ROW_CLS}>
              <label className={FORM_LABEL_CLS}>Custom Image *</label>
              <div
                className={`flex items-center justify-center rounded-lg border-2 border-dashed border-white/15 bg-white/3 cursor-pointer min-h-40 p-4 transition-[border-color] duration-150 hover:border-white/30 ${uploading ? "opacity-60 pointer-events-none" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFileSelect(f); }}
                onClick={() => fileRef.current?.click()}
              >
                {watermarkedUrl ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <img src={watermarkedUrl} alt="Watermarked preview" className="rounded-md max-h-80 max-w-full object-contain" />
                    <span className="muted small">Watermarked preview — buyers see this</span>
                  </div>
                ) : previewUrl ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <img src={previewUrl} alt="Preview" className="rounded-md max-h-80 max-w-full object-contain" />
                    <span className="muted small">{uploading ? "Uploading and watermarking…" : "Processing…"}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span>Drop image here or click to upload</span>
                    <span className="muted small">JPEG, PNG, or WebP · max 8MB</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              {watermarkedUrl && (
                <button type="button" className={BTN_GHOST_SM + " mt-2"} onClick={() => fileRef.current?.click()}>Replace image</button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className={FORM_ROW_CLS}>
              <label className={FORM_LABEL_CLS}>Entity Type *</label>
              <EntityTypePicker value={customEntityType} onChange={setCustomEntityType} placeholder="Search ships, vehicles, droids…" />
            </div>
            <div className={FORM_ROW_CLS}>
              <label className={FORM_LABEL_CLS} htmlFor="custom-price">Price per use (Credits)</label>
              <CreditInput id="custom-price" className={INPUT} value={customPrice} onChange={setCustomPrice} placeholder="e.g. 500,000" required />
            </div>
            <div className={FORM_ROW_CLS}>
              <label className={FORM_LABEL_CLS}>Uses</label>
              <div className="flex gap-[0.4rem] flex-wrap items-center">
                <button className={FILTER_CHIP_CLS(customUnlimited)} type="button" onClick={() => setCustomUnlimited(true)}>Unlimited</button>
                <button className={FILTER_CHIP_CLS(!customUnlimited)} type="button" onClick={() => setCustomUnlimited(false)}>Limited</button>
              </div>
              {!customUnlimited && (
                <input className={INPUT + " mt-2"} type="number" min={1} value={customUses} onChange={(e) => setCustomUses(e.target.value)} />
              )}
            </div>
            <div className={FORM_ROW_CLS}>
              <label className={FORM_LABEL_CLS} htmlFor="custom-notes">Notes (optional)</label>
              <textarea id="custom-notes" className={INPUT + " min-h-30 resize-y leading-normal py-[0.85rem]"} rows={3} maxLength={2000} value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} placeholder="Describe the custom, delivery method, etc." />
            </div>
          </div>
        </div>

        {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}
        <button className={BTN} type="submit" disabled={submitting || uploading || !customEntityType || !uploadedPaths || (source === "faction" && !factionId)}>
          {submitting ? "Posting…" : "Post Custom Listing"}
        </button>
      </form>
    );
  }

  const selectedUids = new Set(selected.map((s) => s.uid));
  const isStockMode = selected.length > 1 && multiMode === "stock";
  const readyCount = isStockMode
    ? (selected.length > 0 && parseCreditInput(stockPrice) > 0 ? selected.length : 0)
    : selected.filter((s) => parseCreditInput(s.price) > 0).length;

  return (
    <form className={FORM_CLS} onSubmit={handleSubmitEntity}>
      <h3 className="h3" style={{ margin: 0 }}>Post Listings</h3>
      {sharedControls}

      {(source === "personal" || (source === "faction" && factionId)) && (
        <>
          <MarketInventoryPicker
            mode={source}
            factionId={source === "faction" ? factionId ?? undefined : undefined}
            entityType={entityType}
            onEntityTypeChange={(t) => { setEntityType(t); setSelected([]); }}
            selectedUid={null}
            onSelect={() => {}}
            allowedEntityTypes={source === "faction" ? allowedEntityTypes(factionId) : undefined}
            multiSelect
            selectedUids={selectedUids}
            onToggle={toggleItem}
            restrictTypeUid={isStockMode && selected.length > 0 ? (selected[0].typeUid ?? undefined) : undefined}
            onToggleAll={isStockMode ? (items) => {
              const allSelected = items.every((i) => selectedUids.has(i.uid));
              if (allSelected) {
                setSelected((prev) => prev.filter((s) => !items.some((i) => i.uid === s.uid)));
              } else {
                setSelected((prev) => {
                  const existingUids = new Set(prev.map((s) => s.uid));
                  const toAdd = items.filter((i) => !existingUids.has(i.uid));
                  return [...prev, ...toAdd.map((i) => ({ uid: i.uid, name: i.name, entityType, typeUid: i.typeUid ?? null, typeName: i.typeName ?? null, availableQuantity: i.quantity ?? null, price: globalPrice, quantity: "1", notes: "", imageWatermarked: false }))];
                });
              }
            } : undefined}
          />

          {selected.length > 1 && (
            <div className="flex flex-col gap-3 p-4 border border-white/8 rounded-[10px] bg-white/2">
              <div className={FORM_ROW_CLS}>
                <label className={FORM_LABEL_CLS}>Multi-item mode</label>
                <div className="flex gap-[0.4rem]">
                  <button className={FILTER_CHIP_CLS(multiMode === "bundle")} type="button" onClick={() => setMultiMode("bundle")}>Bundle</button>
                  <button className={FILTER_CHIP_CLS(multiMode === "stock")} type="button" onClick={() => {
                    setMultiMode("stock");
                    setSelected((prev) => {
                      if (prev.length === 0) return prev;
                      const firstTypeUid = prev[0].typeUid;
                      if (!firstTypeUid) return prev;
                      return prev.filter((s) => s.typeUid === firstTypeUid);
                    });
                  }}>Stock</button>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  {multiMode === "bundle"
                    ? "All items sold together as one listing."
                    : "Each item sold individually at the same price. Buyers purchase one unit at a time."}
                </p>
              </div>
              {multiMode === "bundle" && (
                <div className={FORM_ROW_CLS}>
                  <label className={FORM_LABEL_CLS}>Bundle Name *</label>
                  <input className={INPUT} type="text" value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="e.g. JOE Fleet Package" />
                </div>
              )}
              {multiMode === "stock" && (
                <div className={FORM_ROW_CLS}>
                  <label className={FORM_LABEL_CLS}>Price per unit (Credits) *</label>
                  <CreditInput className={INPUT} value={stockPrice} onChange={setStockPrice} placeholder="e.g. 500,000" />
                </div>
              )}
            </div>
          )}

          {selected.length > 0 && (
            <>
              {!isStockMode && (
                <div className="flex gap-2 items-center">
                  <CreditInput
                    className={INPUT + " flex-1"}
                    value={globalPrice}
                    onChange={setGlobalPrice}
                    placeholder="Price or total amount…"
                  />
                  <button className={BTN_GHOST} type="button" onClick={applyGlobalPrice} disabled={!globalPrice}>Each</button>
                  <button className={BTN_GHOST} type="button" onClick={splitTotal} disabled={!globalPrice || selected.length === 0}>Split Evenly</button>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {selected.map((s) => (
                  <div key={s.uid} className="flex flex-col gap-3 p-4 border border-white/8 rounded-[10px] bg-white/2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-[0.1rem] min-w-0">
                        <span className="small font-medium">{s.name}</span>
                        {s.typeName && <span className="text-[0.72rem] text-white/45">{s.typeName}</span>}
                      </div>
                      <button
                        className="bg-transparent border-0 text-white/55 cursor-pointer text-[0.8rem] px-[0.3rem] py-[0.1rem] hover:text-[#f87171] shrink-0 font-tektur"
                        type="button"
                        onClick={() => setSelected((prev) => prev.filter((x) => x.uid !== s.uid))}
                      >✕</button>
                    </div>
                    {!isStockMode && <div className="grid gap-3 grid-cols-2 max-[640px]:grid-cols-1">
                      <div className={FORM_ROW_CLS}>
                        <label className={FORM_LABEL_CLS}>Price{s.entityType === "material" ? " / unit" : ""} (Credits)</label>
                        <CreditInput className={INPUT} value={s.price} onChange={(v) => updateSelected(s.uid, { price: v })} placeholder="e.g. 50,000" />
                      </div>
                      {s.entityType === "material" && (
                        <div className={FORM_ROW_CLS}>
                          <label className={FORM_LABEL_CLS}>Quantity</label>
                          <input
                            className={INPUT}
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
                            <p className="small muted" style={{ margin: 0 }}>Up to {s.availableQuantity.toLocaleString()} in this pile.</p>
                          )}
                        </div>
                      )}
                      <div className={FORM_ROW_CLS}>
                        <label className={FORM_LABEL_CLS}>Notes</label>
                        <input className={INPUT} type="text" value={s.notes} onChange={(e) => updateSelected(s.uid, { notes: e.target.value })} placeholder="Optional" />
                      </div>
                      <div className={FORM_ROW_CLS}>
                        <label className="flex items-center gap-2 cursor-pointer text-[0.88rem]">
                          <input type="checkbox" checked={s.imageWatermarked} onChange={(e) => updateSelected(s.uid, { imageWatermarked: e.target.checked })} />
                          <span className="small">Watermark image</span>
                        </label>
                      </div>
                    </div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-[0.35rem] p-3 rounded-lg bg-white/3">
          {results.map((r, i) => (
            <p key={i} className="small" style={{ margin: 0, color: r.ok ? "#8fe1a8" : "#f87171" }}>
              {r.ok ? "✓" : "✕"} {r.name}{!r.ok && ` — ${r.message}`}
            </p>
          ))}
        </div>
      )}

      {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}

      {selected.length > 0 && (
        <button className={BTN} type="submit" disabled={submitting || loadingPrivs || readyCount === 0 || (source === "faction" && !factionId)}>
          {submitting ? "Posting…" : isStockMode ? `Post Stock Listing (${selected.length} units)` : `Post ${readyCount} Listing${readyCount !== 1 ? "s" : ""}`}
        </button>
      )}

      {cargoWarnings && (
        <MarketConfirmDialog
          eyebrow="Warning"
          title="Item(s) have cargo or passengers"
          message={`${cargoWarnings.join(". ")}. The buyer will receive the entity with its current contents. Are you sure you want to list it?`}
          confirmLabel="Post Anyway"
          onConfirm={handleCargoConfirm}
          onClose={() => { setCargoWarnings(null); pendingPostRef.current = null; }}
        />
      )}
    </form>
  );
};

export default MarketPostTab;
