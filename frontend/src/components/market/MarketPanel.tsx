import React, { useCallback, useEffect, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factions/factionPrivileges";
import { getMyFactionPrivileges } from "../../api/factions/factionPrivileges";
import { ENTITY_TYPES } from "../../api/market/market";
import type { SwcAuthorizationStatus } from "../../api/members/swcAuthorization";
import type { CharacterLocation } from "../../api/member/characterLocation";
import { usePlayerLocation } from "../../hooks/usePlayerLocation";
import { CartProvider, useCart } from "./CartContext";
import CartSidebar from "./CartSidebar";
import MarketBrowseTab from "./MarketBrowseTab";
import MarketMyListingsTab from "./MarketMyListingsTab";
import MarketMyOrdersTab from "./MarketMyOrdersTab";
import MarketPostTab from "./MarketPostTab";
import MarketVendorPanel from "../tools/MarketVendorPanel";
import MarketVendorDirectoryPanel from "../tools/MarketVendorDirectoryPanel";
import MarketVendorOwnersPanel from "../tools/MarketVendorOwnersPanel";
import MarketVendorHubsPanel from "../tools/MarketVendorHubsPanel";
import ReportBugButton from "../support/ReportBugButton";
import SlideTabNav, { type TabItem } from "../common/SlideTabNav";
import { defaultTabForSection, sectionForTab, type MarketSection, type MarketTab } from "./marketTabs";
import type { MarketOwnerSuggestion } from "../../api/member/marketVendors";

type Props = {
  swcAuth: SwcAuthorizationStatus | null;
  canManageListings: boolean;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
  initialTab?: MarketTab;
  onTabChange?: (tab: MarketTab) => void;
};

const MarketPanel: React.FC<Props> = ({ swcAuth, canManageListings, focusListingId, onFocusConsumed, initialTab, onTabChange }) => {
  const [tab, setTabState] = useState<MarketTab>(initialTab ?? "browse");

  const setTab = (next: MarketTab) => {
    setTabState(next);
    onTabChange?.(next);
  };
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
  const playerLocation = usePlayerLocation(canManageListings && Boolean(swcAuth?.has_character_location_access));

  return (
    <CartProvider>
      <MarketPanelInner
        tab={tab} setTab={setTab} canPost={canPost}
        canViewMyListings={canViewMyListings}
        canViewVendors={canManageListings}
        hasPaymentsAccess={hasPaymentsAccess}
        hasPersonalInventoryAccess={hasPersonalInventoryAccess}
        hasFactionInventoryAccess={hasFactionInventoryAccess}
        manageableFactions={manageableFactions}
        privsByEntityType={privsByEntityType}
        loadingPrivs={loadingPrivs}
        isLoggedIn={swcAuth !== null}
        focusListingId={focusListingId}
        onFocusConsumed={onFocusConsumed}
        playerLocation={playerLocation}
      />
    </CartProvider>
  );
};

type InnerProps = {
  tab: MarketTab; setTab: (t: MarketTab) => void; canPost: boolean;
  canViewMyListings: boolean;
  canViewVendors: boolean;
  hasPaymentsAccess: boolean; hasPersonalInventoryAccess: boolean;
  hasFactionInventoryAccess: boolean;
  manageableFactions: FactionPrivilegeCheckResult[];
  privsByEntityType: Record<string, FactionPrivilegeCheckResult[]>;
  loadingPrivs: boolean;
  isLoggedIn: boolean;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
  playerLocation: CharacterLocation | null;
};

const MarketPanelInner: React.FC<InnerProps> = ({
  tab, setTab, canPost, canViewMyListings, canViewVendors, hasPaymentsAccess, hasPersonalInventoryAccess,
  hasFactionInventoryAccess, manageableFactions, privsByEntityType,
  loadingPrivs, isLoggedIn, focusListingId, onFocusConsumed, playerLocation,
}) => {
  const { totalItems } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  // Set when a member clicks an owner name from Browse/Directory/Hubs — jumps the
  // "By Owner" tab straight to that owner's vendor list instead of the directory.
  // vendor_count is a placeholder; OwnerVendorsView shows the real count once loaded.
  const [ownerNavRequest, setOwnerNavRequest] = useState<MarketOwnerSuggestion | null>(null);

  function goToOwner(ownerLabel: string) {
    setOwnerNavRequest({ label: ownerLabel, vendor_count: 0 });
    setTab("vendor_owners");
  }

  const activeSection = sectionForTab(tab);

  const sectionItems: TabItem<MarketSection>[] = [
    { key: "market", label: "JOSH Market" },
    ...(canViewVendors ? [{ key: "vendors" as const, label: "Public Vendors" }] : []),
  ];

  function handleSectionChange(section: MarketSection) {
    setTab(defaultTabForSection(section));
  }

  const marketSubTabItems: TabItem<MarketTab>[] = [
    { key: "browse", label: "Browse" },
    { key: "my_orders", label: "My Orders" },
    ...(canViewMyListings ? [{ key: "my_listings" as const, label: "My Listings" }] : []),
    ...(canPost ? [{ key: "post" as const, label: "Post a Listing" }] : []),
  ];

  const vendorSubTabItems: TabItem<MarketTab>[] = [
    { key: "vendor", label: "Browse" },
    { key: "vendor_directory", label: "Directory" },
    { key: "vendor_owners", label: "By Owner" },
    { key: "vendor_hubs", label: "Hubs" },
  ];

  return (
    <div className="flex flex-col gap-4 font-tektur">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <SlideTabNav items={sectionItems} activeKey={activeSection} onChange={handleSectionChange} size="lg" color="jen" />
        </div>
        {activeSection === "market" && (
          <button
            className="flex items-center gap-[0.4rem] shrink-0 bg-transparent border border-white/15 rounded-md text-white/(--text-muted,0.55) text-[0.85rem] px-3 py-[0.35rem] cursor-pointer transition-[border-color,color] duration-150 hover:border-white/35 hover:text-white font-tektur"
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
        )}
      </div>

      {activeSection === "market" && (
        <SlideTabNav items={marketSubTabItems} activeKey={tab} onChange={setTab} size="md" color="jen" />
      )}
      {activeSection === "vendors" && (
        <SlideTabNav items={vendorSubTabItems} activeKey={tab} onChange={setTab} size="md" color="jen" />
      )}

      {isLoggedIn && (
        <div>
          {activeSection === "market"
            ? <ReportBugButton toolKey="market" toolLabel="Market" />
            : <ReportBugButton toolKey="market_vendors" toolLabel="Merchant Vendors" />}
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
      {tab === "vendor" && canViewVendors && <MarketVendorPanel playerLocation={playerLocation} onGoToOwner={goToOwner} />}
      {tab === "vendor_directory" && canViewVendors && <MarketVendorDirectoryPanel playerLocation={playerLocation} onGoToOwner={goToOwner} />}
      {tab === "vendor_owners" && canViewVendors && <MarketVendorOwnersPanel initialOwner={ownerNavRequest} />}
      {tab === "vendor_hubs" && canViewVendors && <MarketVendorHubsPanel playerLocation={playerLocation} onGoToOwner={goToOwner} />}

      {cartOpen && (
        <div className="fixed inset-0 z-1200 flex items-center justify-center p-4" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div
            className="relative z-1201 w-[min(100%,760px)] max-h-[min(86vh,920px)]"
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
