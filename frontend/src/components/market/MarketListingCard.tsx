import React, { useState } from "react";
import { cancelListing } from "../../api/market/market";
import type { MarketListing } from "../../api/market/market";
import EntityDetailPopup from "./EntityDetailPopup";
import MarketConfirmDialog from "./MarketConfirmDialog";
import { useCart } from "./CartContext";
import { formatMarketName, BADGE_CLS, CARD_CLS } from "./marketDisplay";
import { BTN, BTN_GHOST } from "../../utils/ui";

type Props = {
  listing: MarketListing;
  isMine?: boolean;
  onCancelled?: () => void;
  hasPaymentsAccess?: boolean;
};

function formatCredits(n: number): string {
  return n.toLocaleString() + " Credits";
}


const isMaterial = (listing: MarketListing) => listing.entity_type === "material";

const QTY_BTN = (small?: boolean) =>
  `bg-white/[0.06] border border-white/[0.12] rounded-[6px] text-white/70 cursor-pointer leading-none transition-[background] duration-150 hover:not-disabled:bg-white/[0.12] hover:not-disabled:text-white disabled:opacity-35 disabled:cursor-default ${
    small ? "text-[0.75rem] px-2 py-[0.3rem]" : "text-[0.9rem] px-[0.6rem] py-[0.3rem]"
  }`;

const QTY_INPUT = "bg-white/[0.06] border border-white/[0.12] rounded-[6px] text-white text-[0.9rem] px-2 py-[0.3rem] text-center w-[70px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const POPUP_BASE = "fixed inset-0 z-[1200] flex items-center justify-center bg-black/65";
const POPUP_PANEL = "relative flex flex-col gap-4 w-[calc(100vw-2rem)] max-w-[480px] max-h-[90vh] overflow-y-auto p-5 rounded-[12px] border border-white/[0.12] bg-[#1a1c22] shadow-[0_24px_64px_rgba(0,0,0,0.6)]";
const POPUP_CLOSE = "absolute right-3 top-3 bg-white/[0.06] hover:bg-white/10 hover:text-white/90 border-0 rounded-[6px] text-white/50 text-[0.85rem] px-2 py-1 cursor-pointer";
const POPUP_ROW = "flex items-baseline gap-2 justify-between";

const MarketListingCard: React.FC<Props> = ({ listing, isMine, onCancelled, hasPaymentsAccess = false }) => {
  const { add } = useCart();
  const [showDetail, setShowDetail] = useState(false);
  const [added, setAdded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [buyQty, setBuyQty] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const shareUrl = `${window.location.origin}/share/listing/${listing.id}`;

  function handleShare() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const material = isMaterial(listing);
  const isStock = listing.sale_type === "stock";
  const qty = Math.min(Math.max(1, buyQty || 1), listing.quantity_available);
  const totalPrice = listing.price_credits * (material || isStock ? qty : 1);

  function handleAddToCart() {
    add(listing, material || isStock ? qty : 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelListing(listing.id);
      onCancelled?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to cancel listing.");
    } finally {
      setCancelling(false);
    }
  }

  const isCustom = listing.sale_type === "custom";
  const displayName =
    isCustom
      ? formatMarketName(listing.custom_entity_name ?? listing.entity_name)
      : listing.sale_type === "bundle"
      ? formatMarketName(listing.entity_name)
      : formatMarketName(listing.entity_snapshot?.type_name ?? listing.entity_name);

  const imageUrl = isCustom ? listing.custom_image_url : listing.entity_image_url;
  const sellerLabel = listing.channel === "faction_store"
    ? (listing.seller_name ?? "Faction")
    : (listing.seller_name ?? listing.listed_by?.handle ?? null);
  const hideOwnerInDetails = listing.channel === "faction_store" && listing.seller_type === "faction";

  return (
    <div className={CARD_CLS}>
      {/* Eyebrow badges */}
      <div className="flex items-center gap-[0.4rem] flex-wrap text-[0.72rem] opacity-60 uppercase tracking-[0.06em]">
        <span className={BADGE_CLS[listing.channel === "faction_store" ? "faction" : "member"]}>
          {listing.channel === "faction_store" ? "Faction Store" : "Member"}
        </span>
        {(listing.channel === "member" || listing.channel === "faction_store") && (
          <span className={BADGE_CLS[listing.audience === "joe_members" ? "restricted" : "public"]}>
            {listing.audience === "joe_members" ? "JOE Members" : "Public"}
          </span>
        )}
        {isCustom ? (
          <span className={BADGE_CLS.custom}>Custom Art</span>
        ) : listing.sale_type === "bundle" ? (
          <span className={BADGE_CLS.bundle}>Bundle · {listing.bundle_items?.length ?? 0} items</span>
        ) : isStock ? (
          <span className={BADGE_CLS.stock}>Stock · {listing.quantity_available} units</span>
        ) : (
          <span className={BADGE_CLS.entity}>{listing.entity_type}</span>
        )}
      </div>

      {/* Image */}
      <div className={`w-full rounded-[6px] overflow-hidden shrink-0 flex items-center justify-center ${isCustom ? "bg-white/[0.015] p-[0.2rem]" : "h-[102px] bg-white/[0.02]"}`}>
        {imageUrl ? (
          <img
            className={isCustom ? "w-full h-auto max-h-[240px] object-contain" : "w-full h-full object-contain block"}
            src={imageUrl}
            alt={displayName}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      <p className="m-0 text-[0.95rem] font-semibold leading-[1.2]">{displayName}</p>

      {/* Bundle items */}
      {listing.sale_type === "bundle" && listing.bundle_items && (
        <div
          className="flex flex-col gap-[0.3rem] border-t border-white/[0.06] pt-2"
          style={{ maxHeight: "calc(5 * (24px + 0.3rem))", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" } as React.CSSProperties}
        >
          {listing.bundle_items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.entity_image_url && (
                <img className="shrink-0 w-6 h-6 rounded-[3px] object-contain" src={item.entity_image_url} alt={item.entity_name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <span className="flex-1 text-[0.78rem] overflow-hidden text-ellipsis whitespace-nowrap">{formatMarketName(item.type_name ?? item.entity_name)}</span>
              <span className="shrink-0 text-white/50 text-[0.72rem]">{formatCredits(item.price_credits)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Details */}
      <div className="flex flex-col gap-[0.22rem] flex-1">
        {listing.sale_type !== "bundle" && (listing.location_label || (listing.location_galx != null && listing.location_galy != null)) && (
          <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
            <span className="text-white/40 shrink-0 w-12">Location</span>
            <span className="text-white/75 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{listing.location_label ?? `(${listing.location_galx}, ${listing.location_galy})`}</span>
          </div>
        )}
        {isCustom && (
          <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
            <span className="text-white/40 shrink-0 w-12">Uses</span>
            <span className="text-white/75 flex-1">{listing.is_unlimited ? "Unlimited" : `${listing.quantity_available} remaining`}</span>
          </div>
        )}
        {material && (
          <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
            <span className="text-white/40 shrink-0 w-12">Stock</span>
            <span className="text-white/75 flex-1">{listing.quantity_available.toLocaleString()} / {listing.quantity_total.toLocaleString()}</span>
          </div>
        )}
        {isStock && (
          <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
            <span className="text-white/40 shrink-0 w-12">Units</span>
            <span className="text-white/75 flex-1">{listing.quantity_available.toLocaleString()} available / {listing.quantity_total.toLocaleString()} total</span>
          </div>
        )}
        {listing.entity_snapshot && listing.sale_type === "standard" && (
          <>
            {listing.entity_snapshot.hull != null && listing.entity_snapshot.max_hull != null && listing.entity_snapshot.max_hull > 0 && (
              <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
                <span className="text-white/40 shrink-0 w-12">Hull</span>
                <div className="bg-white/[0.08] rounded-[3px] flex-1 h-1 overflow-hidden">
                  <div className="rounded-[3px] h-full transition-[width] duration-300" style={{
                    width: `${Math.round((listing.entity_snapshot.hull / listing.entity_snapshot.max_hull) * 100)}%`,
                    background: listing.entity_snapshot.hull / listing.entity_snapshot.max_hull > 0.66 ? "#4ade80" : listing.entity_snapshot.hull / listing.entity_snapshot.max_hull > 0.33 ? "#facc15" : "#f87171"
                  }} />
                </div>
                <span className="text-white/50 shrink-0 text-[0.7rem] w-16 text-right">{listing.entity_snapshot.hull}/{listing.entity_snapshot.max_hull}</span>
              </div>
            )}
            {listing.entity_snapshot.shield != null && listing.entity_snapshot.max_shield != null && listing.entity_snapshot.max_shield > 0 && (
              <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
                <span className="text-white/40 shrink-0 w-12">Shield</span>
                <div className="bg-white/[0.08] rounded-[3px] flex-1 h-1 overflow-hidden">
                  <div className="rounded-[3px] h-full bg-[#60a5fa]" style={{ width: `${Math.round((listing.entity_snapshot.shield / listing.entity_snapshot.max_shield) * 100)}%` }} />
                </div>
                <span className="text-white/50 shrink-0 text-[0.7rem] w-16 text-right">{listing.entity_snapshot.shield}/{listing.entity_snapshot.max_shield}</span>
              </div>
            )}
          </>
        )}
        {sellerLabel && (
          <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
            <span className="text-white/40 shrink-0 w-12">Seller</span>
            <span className="text-white/75 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{sellerLabel}</span>
          </div>
        )}
        {listing.notes && (
          <div className="flex items-center gap-[0.4rem] text-[0.76rem] mt-[0.05rem]">
            <span className="text-white/55 flex-1 whitespace-normal leading-[1.4]">{listing.notes}</span>
          </div>
        )}
      </div>

      {/* Quantity selector for materials and stock */}
      {!isMine && (material || isStock) && listing.quantity_available > 0 && (
        <div className="flex flex-col gap-[0.4rem] border-t border-white/[0.06] pt-[0.6rem]">
          <label className="small muted">Quantity</label>
          <div className="flex items-center gap-[0.35rem]">
            <button className={QTY_BTN()} type="button" onClick={() => setBuyQty((v) => Math.max(1, v - 1))} disabled={buyQty <= 1}>−</button>
            <input
              className={QTY_INPUT}
              type="number"
              min={1}
              max={listing.quantity_available}
              value={buyQty}
              onChange={(e) => setBuyQty(Math.min(listing.quantity_available, Math.max(1, parseInt(e.target.value) || 1)))}
            />
            <button className={QTY_BTN()} type="button" onClick={() => setBuyQty((v) => Math.min(listing.quantity_available, v + 1))} disabled={buyQty >= listing.quantity_available}>+</button>
            <button className={QTY_BTN(true)} type="button" onClick={() => setBuyQty(listing.quantity_available)} disabled={buyQty === listing.quantity_available}>All</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Total: <strong>{formatCredits(totalPrice)}</strong></p>
        </div>
      )}

      {/* Price */}
      <div className="mt-auto">
        <span className="text-[1.12rem] font-bold">
          {formatCredits(listing.price_credits)}
          {(material || isStock) && <span className="text-[0.75rem] opacity-60"> / unit</span>}
          {isCustom && !listing.is_unlimited && <span className="text-[0.75rem] opacity-60"> / use</span>}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-[0.42rem] pt-[0.15rem]">
        <div className="flex gap-[0.42rem] [&>*]:flex-1">
          <button className={BTN_GHOST} type="button" onClick={() => setShowDetail(true)}>Details</button>
          <button className={BTN_GHOST} type="button" onClick={handleShare}>{copied ? "Copied!" : "Share"}</button>
        </div>
        {!isMine && listing.quantity_available > 0 && (
          hasPaymentsAccess ? (
            <button className={BTN + " w-full"} type="button" onClick={handleAddToCart}>
              {added ? "Added!" : (material || isStock) ? `Add ${qty.toLocaleString()} to Cart` : "Add to Cart"}
            </button>
          ) : (
            <div>
              <p className="small muted">Link Chain Code Verification (Payments) on your About Me page to buy.</p>
              <a className={BTN_GHOST} href="/aboutme">Open About Me</a>
            </div>
          )
        )}
        {isMine && (
          <button className={BTN} type="button" onClick={() => setShowCancelConfirm(true)} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel Listing"}
          </button>
        )}
      </div>

      {isMine && showCancelConfirm && (
        <MarketConfirmDialog
          title="Cancel Listing"
          message={`Cancel ${displayName}? This will remove it from the marketplace and release the listing.`}
          confirmLabel="Cancel Listing"
          onConfirm={() => { setShowCancelConfirm(false); void handleCancel(); }}
          onClose={() => setShowCancelConfirm(false)}
        />
      )}

      {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}

      {showDetail && isStock && (
        <div className={POPUP_BASE} onClick={() => setShowDetail(false)}>
          <div className={POPUP_PANEL} onClick={(e) => e.stopPropagation()}>
            <button className={POPUP_CLOSE} type="button" onClick={() => setShowDetail(false)} aria-label="Close">✕</button>
            <div className="flex flex-col gap-[0.2rem] pr-8">
              <p className="m-0 text-[1rem] font-semibold wrap-break-word">{displayName}</p>
              <p className="small muted" style={{ margin: 0 }}>Stock listing · {listing.entity_type}</p>
            </div>
            <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
              {listing.entity_image_url && (
                <img src={listing.entity_image_url} alt={displayName} style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 8 }} />
              )}
              <div className={POPUP_ROW}>
                <span className="small muted">Units available</span>
                <span className="small">{listing.quantity_available.toLocaleString()} / {listing.quantity_total.toLocaleString()}</span>
              </div>
              <div className={POPUP_ROW}>
                <span className="small muted">Price per unit</span>
                <span className="small font-bold">{formatCredits(listing.price_credits)}</span>
              </div>
              {(listing.location_label || (listing.location_galx != null && listing.location_galy != null)) && (
                <div className={POPUP_ROW}>
                  <span className="small muted">Location</span>
                  <span className="small">{listing.location_label ?? `(${listing.location_galx}, ${listing.location_galy})`}</span>
                </div>
              )}
              {listing.notes && (
                <div className={POPUP_ROW} style={{ alignItems: "flex-start" }}>
                  <span className="small muted" style={{ flexShrink: 0 }}>Notes</span>
                  <span className="small" style={{ textAlign: "right" }}>{listing.notes}</span>
                </div>
              )}
              {sellerLabel && (
                <div className={POPUP_ROW}>
                  <span className="small muted">Seller</span>
                  <span className="small">{sellerLabel}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDetail && listing.sale_type === "standard" && (
        <EntityDetailPopup
          entityType={listing.entity_type}
          entityUid={listing.entity_uid}
          entityName={formatMarketName(listing.entity_name)}
          snapshot={listing.entity_snapshot}
          overrideImageUrl={listing.image_watermarked ? listing.entity_image_url : null}
          hideOwner={hideOwnerInDetails}
          onClose={() => setShowDetail(false)}
        />
      )}

      {showDetail && listing.sale_type === "bundle" && (
        <div className={POPUP_BASE} onClick={() => setShowDetail(false)}>
          <div className={POPUP_PANEL} onClick={(e) => e.stopPropagation()}>
            <button className={POPUP_CLOSE} type="button" onClick={() => setShowDetail(false)} aria-label="Close">✕</button>
            <div className="flex items-start gap-4 pr-8">
              <div className="flex flex-col gap-[0.2rem] min-w-0">
                <p className="m-0 text-[1rem] font-semibold wrap-break-word">{formatMarketName(listing.entity_name)}</p>
                <p className="small muted" style={{ margin: 0 }}>Bundle · {listing.bundle_items?.length ?? 0} items</p>
              </div>
            </div>
            <div className="flex flex-col gap-4 border-t border-white/[0.07] pt-3">
              {listing.bundle_items?.map((item, i) => {
                const hasStats = (item.hull != null && item.max_hull != null && item.max_hull > 0)
                  || (item.shield != null && item.max_shield != null && item.max_shield > 0)
                  || (item.ionic != null && item.max_ionic != null && item.max_ionic > 0);
                const loc = item.location;
                const hasLoc = loc && (loc.system || loc.sector || loc.docked);
                return (
                  <div key={i} className="flex flex-col gap-2 pb-3" style={{ borderBottom: i < (listing.bundle_items!.length - 1) ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    {/* Header row */}
                    <div className="flex items-center gap-3">
                      {item.entity_image_url && (
                        <img src={item.entity_image_url} alt={item.entity_name} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="small" style={{ fontWeight: 600 }}>{formatMarketName(item.type_name ?? item.entity_name)}</div>
                        <div className="small muted">{formatMarketName(item.entity_name)}</div>
                      </div>
                      <span className="small shrink-0">{formatCredits(item.price_credits)}</span>
                    </div>
                    {/* Stats */}
                    {hasStats && (
                      <div className="flex flex-col gap-[0.3rem] pl-12">
                        {item.hull != null && item.max_hull != null && item.max_hull > 0 && (() => {
                          const pct = Math.round((item.hull / item.max_hull) * 100);
                          const col = pct > 66 ? "#4ade80" : pct > 33 ? "#facc15" : "#f87171";
                          return (
                            <div className="flex items-center gap-2">
                              <span className="small muted" style={{ width: 40, flexShrink: 0 }}>Hull</span>
                              <div className="flex-1 bg-white/8 rounded-[3px] h-1.25 overflow-hidden">
                                <div style={{ width: `${pct}%`, background: col, height: "100%", borderRadius: 3 }} />
                              </div>
                              <span className="small muted" style={{ width: 64, textAlign: "right", flexShrink: 0 }}>{item.hull}/{item.max_hull}</span>
                            </div>
                          );
                        })()}
                        {item.shield != null && item.max_shield != null && item.max_shield > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="small muted" style={{ width: 40, flexShrink: 0 }}>Shield</span>
                            <div className="flex-1 bg-white/8 rounded-[3px] h-1.25 overflow-hidden">
                              <div style={{ width: `${Math.round((item.shield / item.max_shield) * 100)}%`, background: "#60a5fa", height: "100%", borderRadius: 3 }} />
                            </div>
                            <span className="small muted" style={{ width: 64, textAlign: "right", flexShrink: 0 }}>{item.shield}/{item.max_shield}</span>
                          </div>
                        )}
                        {item.ionic != null && item.max_ionic != null && item.max_ionic > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="small muted" style={{ width: 40, flexShrink: 0 }}>Ionic</span>
                            <div className="flex-1 bg-white/8 rounded-[3px] h-1.25 overflow-hidden">
                              <div style={{ width: `${Math.round((item.ionic / item.max_ionic) * 100)}%`, background: "#a78bfa", height: "100%", borderRadius: 3 }} />
                            </div>
                            <span className="small muted" style={{ width: 64, textAlign: "right", flexShrink: 0 }}>{item.ionic}/{item.max_ionic}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Location */}
                    {hasLoc && (
                      <div className="flex items-start gap-2 pl-12">
                        <span className="small muted" style={{ width: 40, flexShrink: 0 }}>Loc</span>
                        <div className="flex flex-col gap-[0.1rem]">
                          {loc!.docked && loc!.container?.name && (
                            <span className="small">Docked in <strong>{loc!.container.name}</strong>{loc!.container.type ? ` (${loc!.container.type})` : ""}</span>
                          )}
                          {loc!.system && <span className="small muted">{loc!.system}{loc!.sector ? `, ${loc!.sector}` : ""}</span>}
                          {!loc!.system && loc!.sector && <span className="small muted">{loc!.sector}</span>}
                          {loc!.galx != null && loc!.galy != null && <span className="small muted">({loc!.galx}, {loc!.galy})</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className={POPUP_ROW} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.5rem" }}>
                <span className="small muted">Total</span>
                <span className="small" style={{ fontWeight: 700 }}>{formatCredits(listing.price_credits)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetail && isCustom && (
        <div className={POPUP_BASE} onClick={() => setShowDetail(false)}>
          <div className={POPUP_PANEL} onClick={(e) => e.stopPropagation()}>
            <button className={POPUP_CLOSE} type="button" onClick={() => setShowDetail(false)} aria-label="Close">✕</button>
            <div className="flex items-start gap-4 pr-8">
              <div className="flex flex-col gap-[0.2rem] min-w-0">
                <p className="m-0 text-[1rem] font-semibold wrap-break-word">{formatMarketName(listing.custom_entity_name ?? listing.entity_name)}</p>
                {listing.custom_entity_category && <p className="small muted" style={{ margin: 0 }}>{listing.custom_entity_category}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
              {listing.custom_image_url && (
                <img src={listing.custom_image_url} alt={listing.custom_entity_name ?? ""} style={{ width: "100%", borderRadius: 8 }} />
              )}
              {listing.notes && (
                <div className={POPUP_ROW} style={{ alignItems: "flex-start" }}>
                  <span className="small muted" style={{ flexShrink: 0 }}>Notes</span>
                  <span className="small" style={{ textAlign: "right" }}>{listing.notes}</span>
                </div>
              )}
              <div className={POPUP_ROW}>
                <span className="small muted">Price</span>
                <span className="small" style={{ fontWeight: 700 }}>{formatCredits(listing.price_credits)}{!listing.is_unlimited && " / use"}</span>
              </div>
              <div className={POPUP_ROW}>
                <span className="small muted">Availability</span>
                <span className="small">{listing.is_unlimited ? "Unlimited uses" : `${listing.quantity_available} use${listing.quantity_available !== 1 ? "s" : ""} remaining`}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketListingCard;
