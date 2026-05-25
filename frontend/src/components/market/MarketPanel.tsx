import React, { useCallback, useEffect, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factions/factionPrivileges";
import { getMyFactionPrivileges } from "../../api/factions/factionPrivileges";
import { ENTITY_TYPES } from "../../api/market/market";
import type { SwcAuthorizationStatus } from "../../api/members/swcAuthorization";
import { CartProvider, useCart } from "./CartContext";
import CartSidebar from "./CartSidebar";
import MarketBrowseTab from "./MarketBrowseTab";
import MarketMyListingsTab from "./MarketMyListingsTab";
import MarketMyOrdersTab from "./MarketMyOrdersTab";
import MarketPostTab from "./MarketPostTab";
import ReportBugButton from "../support/ReportBugButton";

type MarketTab = "browse" | "my_listings" | "my_orders" | "post";

type Props = {
  swcAuth: SwcAuthorizationStatus | null;
  canManageListings: boolean;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
};

const tabCls = (active: boolean) =>
  `border rounded-lg text-[0.85rem] px-[0.9rem] py-[0.4rem] cursor-pointer transition-[background,color,border-color] duration-150 ${
    active
      ? "bg-white/10 border-white/30 text-white"
      : "bg-transparent border-white/[0.12] text-white/65 hover:bg-white/[0.06] hover:text-white/90"
  }`;

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
        isLoggedIn={swcAuth !== null}
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
  isLoggedIn: boolean;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
};

const MarketPanelInner: React.FC<InnerProps> = ({
  tab, setTab, canPost, canViewMyListings, hasPaymentsAccess, hasPersonalInventoryAccess,
  hasFactionInventoryAccess, manageableFactions, privsByEntityType,
  loadingPrivs, isLoggedIn, focusListingId, onFocusConsumed,
}) => {
  const { totalItems } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 font-tektur">
      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap border-b border-white/[0.08] pb-3 items-center">
        <button className={tabCls(tab === "browse")} onClick={() => setTab("browse")} type="button">Browse</button>
        <button className={tabCls(tab === "my_orders")} onClick={() => setTab("my_orders")} type="button">My Orders</button>
        {canViewMyListings && (
          <button className={tabCls(tab === "my_listings")} onClick={() => setTab("my_listings")} type="button">My Listings</button>
        )}
        {canPost && (
          <button className={tabCls(tab === "post")} onClick={() => setTab("post")} type="button">Post a Listing</button>
        )}
        <button
          className="flex items-center gap-[0.4rem] ml-auto bg-transparent border border-white/[0.15] rounded-[6px] text-white/[var(--text-muted,0.55)] text-[0.85rem] px-3 py-[0.35rem] cursor-pointer transition-[border-color,color] duration-150 hover:border-white/35 hover:text-white"
          type="button"
          onClick={() => setCartOpen(true)}
        >
          Cart
          {totalItems > 0 && (
            <span className="flex items-center justify-center min-w-[1.2rem] px-[0.3rem] rounded-full bg-[#f5c842] text-black text-[0.7rem] font-bold">
              {totalItems}
            </span>
          )}
        </button>
      </div>
      {isLoggedIn && (
        <div>
          <ReportBugButton toolKey="market" toolLabel="Market" />
        </div>
      )}

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
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div
            className="relative z-[1201] w-[min(100%,760px)] max-h-[min(86vh,920px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <CartSidebar onClose={() => setCartOpen(false)} hasPaymentsAccess={hasPaymentsAccess} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketPanel;
