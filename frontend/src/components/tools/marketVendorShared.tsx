import React, { useEffect, useState } from "react";
import { getMarketVendor, type MarketVendor, type MarketVendorListing } from "../../api/member/marketVendors";
import { formatMarketName } from "../market/marketDisplay";
import {
  formatCredits, formatVendorLocation, OWNER_LINK_CLS, type VendorLocation,
  POPUP_BASE, POPUP_CLOSE, POPUP_PANEL, POPUP_ROW,
} from "./marketVendorDisplay";

type OwnerLinkProps = {
  ownerLabel: string | null;
  onGoToOwner?: (ownerLabel: string) => void;
};

const OwnerLink: React.FC<OwnerLinkProps> = ({ ownerLabel, onGoToOwner }) => {
  if (!ownerLabel) return <span className="small">—</span>;
  if (!onGoToOwner) return <span className="small">{ownerLabel}</span>;

  return (
    <button
      type="button"
      className={OWNER_LINK_CLS + " small text-right"}
      onClick={() => onGoToOwner(ownerLabel)}
    >
      {ownerLabel}
    </button>
  );
};

// Shared "system -> planet/city/tile" location breakdown used by every vendor card
// and popup (Browse, Directory, Owners, Hubs) so styling stays identical everywhere.
export const VendorLocationBlock: React.FC<{ location: VendorLocation; size?: "card" | "popup" }> = ({
  location,
  size = "card",
}) => {
  const systemSize = size === "popup" ? "small" : "text-[0.76rem]";
  const detailSize = size === "popup" ? "text-[0.78rem]" : "text-[0.7rem]";

  return (
    <div className="flex flex-col gap-[0.1rem]">
      <span className={`${systemSize} ${location.system.colorClass} leading-snug`}>{location.system.text}</span>
      {location.details.length > 0 && (
        <span className={`${detailSize} leading-snug`}>
          {location.details.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-white/25"> · </span>}
              <span className={part.colorClass}>{part.text}</span>
            </React.Fragment>
          ))}
        </span>
      )}
    </div>
  );
};

export const ListingDetailPopup: React.FC<{
  listing: MarketVendorListing;
  onClose: () => void;
  onGoToOwner?: (ownerLabel: string) => void;
}> = ({ listing, onClose, onGoToOwner }) => {
  const location = formatVendorLocation(listing.vendor);
  const image = listing.image_large ?? listing.image_small;

  return (
    <div className={POPUP_BASE} onClick={onClose}>
      <div className={POPUP_PANEL} onClick={(e) => e.stopPropagation()}>
        <button className={POPUP_CLOSE} type="button" onClick={onClose} aria-label="Close">✕</button>

        <div className="flex flex-col gap-[0.2rem] pr-8">
          <p className="m-0 text-[1rem] font-semibold wrap-break-word">{formatMarketName(listing.ware_name)}</p>
          <p className="small muted" style={{ margin: 0 }}>{listing.matched_entity_type ?? "item"}</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
          {image ? (
            <img src={image} alt={listing.ware_name} style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 8 }} />
          ) : (
            <div className="w-full h-45 rounded-lg bg-white/2 flex items-center justify-center small muted">No image available</div>
          )}
          <div className={POPUP_ROW}>
            <span className="small muted">Price</span>
            <span className="small font-bold">{formatCredits(listing.price)}</span>
          </div>
          <div className={POPUP_ROW}>
            <span className="small muted">Stock</span>
            <span className="small">{listing.quantity.toLocaleString()}</span>
          </div>
          <div className={POPUP_ROW}>
            <span className="small muted">Vendor</span>
            <span className="small text-right wrap-break-word">{listing.vendor.name}</span>
          </div>
          <div className={POPUP_ROW}>
            <span className="small muted">Owner</span>
            <OwnerLink ownerLabel={listing.vendor.owner_label} onGoToOwner={onGoToOwner} />
          </div>
          <div className="flex flex-col gap-[0.15rem]">
            <span className="small muted">Location</span>
            <VendorLocationBlock location={location} size="popup" />
          </div>
          {listing.matched_item_type_uid && (
            <div className={POPUP_ROW}>
              <span className="small muted">Catalog UID</span>
              <span className="small">{listing.matched_item_type_uid}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const VendorDetailPopup: React.FC<{
  vendorId: number;
  onClose: () => void;
  onGoToOwner?: (ownerLabel: string) => void;
}> = ({ vendorId, onClose, onGoToOwner }) => {
  const [vendor, setVendor] = useState<MarketVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getMarketVendor(vendorId);
        if (cancelled) return;
        if (res.ok) setVendor(res.data);
        else setError("Failed to load vendor.");
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load vendor.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vendorId]);

  const location = vendor ? formatVendorLocation(vendor) : null;

  return (
    <div className={POPUP_BASE} onClick={onClose}>
      <div className={POPUP_PANEL} onClick={(e) => e.stopPropagation()}>
        <button className={POPUP_CLOSE} type="button" onClick={onClose} aria-label="Close">✕</button>

        {loading && <p className="small muted">Loading vendor…</p>}
        {error && <p className="small" style={{ color: "#f87171" }}>{error}</p>}

        {vendor && !loading && (
          <>
            <div className="flex flex-col gap-[0.2rem] pr-8">
              <p className="m-0 text-[1rem] font-semibold wrap-break-word">{vendor.name}</p>
              <p className="small" style={{ margin: 0 }}>
                {vendor.owner_label ? (
                  onGoToOwner ? (
                    <button
                      type="button"
                      className={OWNER_LINK_CLS + " small muted"}
                      onClick={() => onGoToOwner(vendor.owner_label as string)}
                    >
                      {vendor.owner_label}
                    </button>
                  ) : (
                    <span className="muted">{vendor.owner_label}</span>
                  )
                ) : null}
              </p>
              {location && <VendorLocationBlock location={location} size="popup" />}
              {vendor.description && (
                <p className="small" style={{ margin: 0, opacity: 0.75 }}>{vendor.description}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-3 max-h-80 overflow-y-auto">
              {(vendor.listings ?? []).map((listing) => (
                <div key={listing.id} className="flex items-center gap-[0.5rem]">
                  <div className="w-8 h-8 rounded-[4px] overflow-hidden shrink-0 flex items-center justify-center bg-white/2">
                    {listing.image_small ? (
                      <img
                        className="w-full h-full object-contain block"
                        src={listing.image_small}
                        alt={listing.ware_name}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                  <span className="small overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 1 }}>{formatMarketName(listing.ware_name)}</span>
                  <span className="small muted" style={{ flexShrink: 0 }}>{listing.quantity.toLocaleString()} in stock</span>
                  <span className="small font-bold" style={{ flexShrink: 0 }}>{formatCredits(listing.price)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
