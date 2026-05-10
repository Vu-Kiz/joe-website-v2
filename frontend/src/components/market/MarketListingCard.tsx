import React, { useState } from "react";
import { cancelListing } from "../../api/market";
import type { MarketListing } from "../../api/market";
import EntityDetailPopup from "./EntityDetailPopup";
import MarketConfirmDialog from "./MarketConfirmDialog";
import { useCart } from "./CartContext";
import { formatMarketName } from "./marketDisplay";

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
  const qty = Math.min(Math.max(1, buyQty || 1), listing.quantity_available);
  const totalPrice = listing.price_credits * (material ? qty : 1);

  function handleAddToCart() {
    add(listing, material ? qty : 1);
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

  const displayName =
    listing.sale_type === "custom"
      ? formatMarketName(listing.custom_entity_name ?? listing.entity_name)
      : listing.sale_type === "bundle"
      ? formatMarketName(listing.entity_name)
      : formatMarketName(listing.entity_snapshot?.type_name ?? listing.entity_name);

  const imageUrl =
    listing.sale_type === "custom" ? listing.custom_image_url : listing.entity_image_url;
  const isCustom = listing.sale_type === "custom";
  const sellerLabel = listing.channel === "faction_store"
    ? (listing.seller_name ?? "Faction")
    : (listing.seller_name ?? listing.listed_by?.handle ?? null);
  const hideOwnerInDetails = listing.channel === "faction_store" && listing.seller_type === "faction";

  return (
    <div className={`market-card${isCustom ? " market-card--custom" : ""}`}>
      <div className="market-card__eyebrow">
        <span className={`market-badge market-badge--${listing.channel === "faction_store" ? "faction" : "member"}`}>
          {listing.channel === "faction_store" ? "Faction Store" : "Member"}
        </span>
        {(listing.channel === "member" || listing.channel === "faction_store") && (
          <span className={`market-badge market-badge--${listing.audience === "joe_members" ? "restricted" : "public"}`}>
            {listing.audience === "joe_members" ? "JOE Members" : "Public"}
          </span>
        )}
        {listing.sale_type === "custom" ? (
          <span className="market-badge market-badge--custom">Custom Art</span>
        ) : listing.sale_type === "bundle" ? (
          <span className="market-badge market-badge--bundle">Bundle · {listing.bundle_items?.length ?? 0} items</span>
        ) : (
          <span className="market-badge market-badge--entity">{listing.entity_type}</span>
        )}
      </div>

      <div className={`market-card__image-wrap${isCustom ? " market-card__image-wrap--custom" : ""}`}>
        {imageUrl ? (
          <img
            className={`market-card__image${isCustom ? " market-card__image--custom" : ""}`}
            src={imageUrl}
            alt={displayName}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="market-card__image-placeholder" />
        )}
      </div>

      <p className="market-card__name">{displayName}</p>

      {listing.sale_type === "bundle" && listing.bundle_items && (
        <div className="market-card__bundle-items">
          {listing.bundle_items.map((item, i) => (
            <div key={i} className="market-card__bundle-item">
              {item.entity_image_url && (
                <img className="market-card__bundle-item-img" src={item.entity_image_url} alt={item.entity_name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <span className="market-card__bundle-item-name">{formatMarketName(item.type_name ?? item.entity_name)}</span>
              <span className="market-card__bundle-item-price">{formatCredits(item.price_credits)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="market-card__details">
        {/* Location */}
        {(listing.location_label || (listing.location_galx != null && listing.location_galy != null)) && (
          <div className="market-card__detail-row">
            <span className="market-card__detail-label">Location</span>
            <span className="market-card__detail-value">{listing.location_label ?? `(${listing.location_galx}, ${listing.location_galy})`}</span>
          </div>
        )}

        {/* Custom availability */}
        {listing.sale_type === "custom" && (
          <div className="market-card__detail-row">
            <span className="market-card__detail-label">Uses</span>
            <span className="market-card__detail-value">
              {listing.is_unlimited ? "Unlimited" : `${listing.quantity_available} remaining`}
            </span>
          </div>
        )}

        {/* Material stock */}
        {material && (
          <div className="market-card__detail-row">
            <span className="market-card__detail-label">Stock</span>
            <span className="market-card__detail-value">{listing.quantity_available.toLocaleString()} / {listing.quantity_total.toLocaleString()}</span>
          </div>
        )}

        {/* Snapshot stats for ships/vehicles/etc */}
        {listing.entity_snapshot && listing.sale_type === "standard" && (
          <>
            {listing.entity_snapshot.hull != null && listing.entity_snapshot.max_hull != null && listing.entity_snapshot.max_hull > 0 && (
              <div className="market-card__detail-row">
                <span className="market-card__detail-label">Hull</span>
                <div className="market-card__stat-bar-wrap">
                  <div className="market-card__stat-bar" style={{
                    width: `${Math.round((listing.entity_snapshot.hull / listing.entity_snapshot.max_hull) * 100)}%`,
                    background: listing.entity_snapshot.hull / listing.entity_snapshot.max_hull > 0.66 ? "#4ade80" : listing.entity_snapshot.hull / listing.entity_snapshot.max_hull > 0.33 ? "#facc15" : "#f87171"
                  }} />
                </div>
                <span className="market-card__stat-val">{listing.entity_snapshot.hull}/{listing.entity_snapshot.max_hull}</span>
              </div>
            )}
            {listing.entity_snapshot.shield != null && listing.entity_snapshot.max_shield != null && listing.entity_snapshot.max_shield > 0 && (
              <div className="market-card__detail-row">
                <span className="market-card__detail-label">Shield</span>
                <div className="market-card__stat-bar-wrap">
                  <div className="market-card__stat-bar" style={{
                    width: `${Math.round((listing.entity_snapshot.shield / listing.entity_snapshot.max_shield) * 100)}%`,
                    background: "#60a5fa"
                  }} />
                </div>
                <span className="market-card__stat-val">{listing.entity_snapshot.shield}/{listing.entity_snapshot.max_shield}</span>
              </div>
            )}
          </>
        )}

        {/* Seller */}
        {sellerLabel && (
          <div className="market-card__detail-row">
            <span className="market-card__detail-label">Seller</span>
            <span className="market-card__detail-value">{sellerLabel}</span>
          </div>
        )}

        {/* Notes */}
        {listing.notes && (
          <div className="market-card__detail-row market-card__detail-row--notes">
            <span className="market-card__detail-value market-card__detail-value--notes">{listing.notes}</span>
          </div>
        )}
      </div>

      {!isMine && material && listing.quantity_available > 0 && (
        <div className="market-card__qty-row">
          <label className="small muted">Quantity</label>
          <div className="market-card__qty-controls">
            <button
              className="market-card__qty-btn"
              type="button"
              onClick={() => setBuyQty((v) => Math.max(1, v - 1))}
              disabled={buyQty <= 1}
            >−</button>
            <input
              className="market-card__qty-input"
              type="number"
              min={1}
              max={listing.quantity_available}
              value={buyQty}
              onChange={(e) => setBuyQty(Math.min(listing.quantity_available, Math.max(1, parseInt(e.target.value) || 1)))}
            />
            <button
              className="market-card__qty-btn"
              type="button"
              onClick={() => setBuyQty((v) => Math.min(listing.quantity_available, v + 1))}
              disabled={buyQty >= listing.quantity_available}
            >+</button>
            <button
              className="market-card__qty-btn market-card__qty-btn--all"
              type="button"
              onClick={() => setBuyQty(listing.quantity_available)}
              disabled={buyQty === listing.quantity_available}
            >All</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Total: <strong>{formatCredits(totalPrice)}</strong>
          </p>
        </div>
      )}

      <div className="market-card__price-row">
        <span className="market-card__price">
          {formatCredits(listing.price_credits)}
          {material && <span className="market-card__price-sub"> / unit</span>}
          {listing.sale_type === "custom" && !listing.is_unlimited && <span className="market-card__price-sub"> / use</span>}
        </span>
      </div>

      <div className="market-card__actions">
        <div className="market-card__actions-row">
          <button className="btn btn--ghost" type="button" onClick={() => setShowDetail(true)}>
            Details
          </button>
          <button className="btn btn--ghost" type="button" onClick={handleShare}>
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
        {!isMine && listing.quantity_available > 0 && (
          hasPaymentsAccess ? (
            <button className="btn" type="button" onClick={handleAddToCart}>
              {added ? "Added!" : material ? `Add ${qty.toLocaleString()} to Cart` : "Add to Cart"}
            </button>
          ) : (
            <div>
              <p className="small muted">Link Chain Code Verification (Payments) on your About Me page to buy.</p>
              <a className="btn btn--ghost" href="/aboutme">Open About Me</a>
            </div>
          )
        )}
        {isMine && (
          <button className="btn" type="button" onClick={() => setShowCancelConfirm(true)} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel Listing"}
          </button>
        )}
      </div>

      {isMine && showCancelConfirm && (
        <MarketConfirmDialog
          title="Cancel Listing"
          message={`Cancel ${displayName}? This will remove it from the marketplace and release the listing.`}
          confirmLabel="Cancel Listing"
          onConfirm={() => {
            setShowCancelConfirm(false);
            void handleCancel();
          }}
          onClose={() => setShowCancelConfirm(false)}
        />
      )}

      {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}

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
        <div className="entity-popup-backdrop" onClick={() => setShowDetail(false)}>
          <div className="entity-popup" onClick={(e) => e.stopPropagation()}>
            <button className="entity-popup__close" type="button" onClick={() => setShowDetail(false)} aria-label="Close">✕</button>
            <div className="entity-popup__header">
              <div className="entity-popup__title-block">
                <p className="entity-popup__name">{formatMarketName(listing.entity_name)}</p>
                <p className="small muted" style={{ margin: 0 }}>Bundle · {listing.bundle_items?.length ?? 0} items</p>
              </div>
            </div>
            <div className="entity-popup__body">
              {listing.bundle_items?.map((item, i) => (
                <div key={i} className="entity-popup__row" style={{ alignItems: "center", gap: "0.75rem" }}>
                  {item.entity_image_url && (
                    <img src={item.entity_image_url} alt={item.entity_name} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600 }}>{formatMarketName(item.type_name ?? item.entity_name)}</div>
                    <div className="small muted">{formatMarketName(item.entity_name)}</div>
                  </div>
                  <span className="small">{formatCredits(item.price_credits)}</span>
                </div>
              ))}
              <div className="entity-popup__row" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                <span className="small muted">Total</span>
                <span className="small" style={{ fontWeight: 700 }}>{formatCredits(listing.price_credits)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetail && listing.sale_type === "custom" && (
        <div className="entity-popup-backdrop" onClick={() => setShowDetail(false)}>
          <div className="entity-popup" onClick={(e) => e.stopPropagation()}>
            <button className="entity-popup__close" type="button" onClick={() => setShowDetail(false)} aria-label="Close">✕</button>
            <div className="entity-popup__header">
              <div className="entity-popup__title-block">
                <p className="entity-popup__name">{formatMarketName(listing.custom_entity_name ?? listing.entity_name)}</p>
                {listing.custom_entity_category && (
                  <p className="small muted" style={{ margin: 0 }}>{listing.custom_entity_category}</p>
                )}
              </div>
            </div>
            <div className="entity-popup__body">
              {listing.custom_image_url && (
                <img src={listing.custom_image_url} alt={listing.custom_entity_name ?? ""} style={{ width: "100%", borderRadius: 8 }} />
              )}
              {listing.notes && (
                <div className="entity-popup__row" style={{ alignItems: "flex-start" }}>
                  <span className="small muted" style={{ flexShrink: 0 }}>Notes</span>
                  <span className="small" style={{ textAlign: "right" }}>{listing.notes}</span>
                </div>
              )}
              <div className="entity-popup__row">
                <span className="small muted">Price</span>
                <span className="small" style={{ fontWeight: 700 }}>{formatCredits(listing.price_credits)}{!listing.is_unlimited && " / use"}</span>
              </div>
              <div className="entity-popup__row">
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
