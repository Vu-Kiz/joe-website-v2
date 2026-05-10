import React, { useCallback, useEffect, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factionPrivileges";
import { getMyFactionPrivileges } from "../../api/factionPrivileges";
import { ENTITY_TYPES } from "../../api/market";
import type { SwcAuthorizationStatus } from "../../api/swcAuthorization";
import "../../styles/_market.sass";
import { CartProvider, useCart } from "./CartContext";
import CartSidebar from "./CartSidebar";
import MarketBrowseTab from "./MarketBrowseTab";
import MarketMyListingsTab from "./MarketMyListingsTab";
import MarketMyOrdersTab from "./MarketMyOrdersTab";
import MarketPostTab from "./MarketPostTab";

type MarketTab = "browse" | "my_listings" | "my_orders" | "post";

type Props = {
  swcAuth: SwcAuthorizationStatus | null;
  canManageListings: boolean;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
};

const MarketPanel: React.FC<Props> = ({ swcAuth, canManageListings, focusListingId, onFocusConsumed }) => {
  const [tab, setTab] = useState<MarketTab>("browse");
  const [factionPrivs, setFactionPrivs] = useState<FactionPrivilegeCheckResult[]>([]);
  const [privsByEntityType, setPrivsByEntityType] = useState<Record<string, FactionPrivilegeCheckResult[]>>({});
  const [loadingPrivs, setLoadingPrivs] = useState(true);

  const loadPrivileges = useCallback(async () => {
    if (!canManageListings) {
      setFactionPrivs([]);
      setPrivsByEntityType({});
      setLoadingPrivs(false);
      return;
    }

    setLoadingPrivs(true);
    try {
      const res = await getMyFactionPrivileges("ship", "makeover");
      setFactionPrivs(res.data ?? []);

      const results: Record<string, FactionPrivilegeCheckResult[]> = {};
      await Promise.all(
        ENTITY_TYPES.map(async ({ key, privilegeGroup }) => {
          try {
            const r = await getMyFactionPrivileges(privilegeGroup, "makeover");
            results[key] = r.data ?? [];
          } catch {
            results[key] = [];
          }
        })
      );
      setPrivsByEntityType(results);
    } catch {
      setFactionPrivs([]);
    } finally {
      setLoadingPrivs(false);
    }
  }, [canManageListings]);

  useEffect(() => { loadPrivileges(); }, [loadPrivileges]);

  const EXCLUDED_FACTION_SUFFIXES = [": RAID", ": GARRY", ": RICH"];
  const manageableFactions = factionPrivs.filter((p) =>
    p.check.allowed &&
    !EXCLUDED_FACTION_SUFFIXES.some((suffix) => p.name.toUpperCase().endsWith(suffix.toUpperCase()))
  );
  const hasPersonalInventoryAccess = Boolean(swcAuth?.has_personal_inventory_access);
  const hasFactionInventoryAccess = Boolean(swcAuth?.has_faction_inventory_access);
  const hasPaymentsAccess = Boolean(swcAuth?.has_character_credits_write_access);
  const canPost = canManageListings && (hasPersonalInventoryAccess || (hasFactionInventoryAccess && manageableFactions.length > 0));
  const canViewMyListings = canManageListings;

  return (
    <CartProvider>
      <MarketPanelInner
        tab={tab} setTab={setTab} canPost={canPost}
        canViewMyListings={canViewMyListings}
        hasPaymentsAccess={hasPaymentsAccess}
        hasPersonalInventoryAccess={hasPersonalInventoryAccess}
        hasFactionInventoryAccess={hasFactionInventoryAccess}
        manageableFactions={manageableFactions}
        privsByEntityType={privsByEntityType}
        loadingPrivs={loadingPrivs}
        focusListingId={focusListingId}
        onFocusConsumed={onFocusConsumed}
      />
    </CartProvider>
  );
};

type InnerProps = {
  tab: MarketTab; setTab: (t: MarketTab) => void; canPost: boolean;
  canViewMyListings: boolean;
  hasPaymentsAccess: boolean; hasPersonalInventoryAccess: boolean;
  hasFactionInventoryAccess: boolean;
  manageableFactions: FactionPrivilegeCheckResult[];
  privsByEntityType: Record<string, FactionPrivilegeCheckResult[]>;
  loadingPrivs: boolean;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
};

const MarketPanelInner: React.FC<InnerProps> = ({
  tab, setTab, canPost, canViewMyListings, hasPaymentsAccess, hasPersonalInventoryAccess,
  hasFactionInventoryAccess, manageableFactions, privsByEntityType,
  loadingPrivs, focusListingId, onFocusConsumed,
}) => {
  const { totalItems } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="market-panel">
      <div className="market-tabs">
        <button className={`market-tab${tab === "browse" ? " is-active" : ""}`} onClick={() => setTab("browse")} type="button">Browse</button>
        <button className={`market-tab${tab === "my_orders" ? " is-active" : ""}`} onClick={() => setTab("my_orders")} type="button">My Orders</button>
        {canViewMyListings && (
          <button className={`market-tab${tab === "my_listings" ? " is-active" : ""}`} onClick={() => setTab("my_listings")} type="button">My Listings</button>
        )}
        {canPost && (
          <button className={`market-tab${tab === "post" ? " is-active" : ""}`} onClick={() => setTab("post")} type="button">Post a Listing</button>
        )}
        <button className="market-cart-btn" type="button" onClick={() => setCartOpen(true)}>
          Cart{totalItems > 0 && <span className="market-cart-btn__badge">{totalItems}</span>}
        </button>
      </div>

      {tab === "browse" && <MarketBrowseTab hasPaymentsAccess={hasPaymentsAccess} focusListingId={focusListingId} onFocusConsumed={onFocusConsumed} />}
      {tab === "my_orders" && <MarketMyOrdersTab hasPaymentsAccess={hasPaymentsAccess} />}
      {tab === "my_listings" && canViewMyListings && <MarketMyListingsTab />}
      {tab === "post" && (
        <MarketPostTab
          hasPersonalInventoryAccess={hasPersonalInventoryAccess}
          hasFactionInventoryAccess={hasFactionInventoryAccess}
          manageableFactions={manageableFactions}
          privsByEntityType={privsByEntityType}
          loadingPrivs={loadingPrivs}
          onPosted={() => setTab("my_listings")}
        />
      )}

      {cartOpen && (
        <div className="cart-overlay" onClick={() => setCartOpen(false)}>
          <div className="cart-backdrop" onClick={() => setCartOpen(false)} />
          <div className="cart-overlay__panel" onClick={(e) => e.stopPropagation()}>
            <CartSidebar onClose={() => setCartOpen(false)} hasPaymentsAccess={hasPaymentsAccess} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketPanel;
