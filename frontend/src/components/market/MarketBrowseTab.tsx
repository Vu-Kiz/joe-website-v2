import React, { useEffect, useState } from "react";
import { ENTITY_TYPES, getMarketListings } from "../../api/market/market";
import type { MarketListing, EntityTypeKey } from "../../api/market/market";
import MarketListingCard from "./MarketListingCard";
import Pagination from "../common/Pagination";
import { EMPTY_CLS } from "./marketDisplay";
import { FilterCheckboxSection, FilterSidebar } from "./FilterSidebar";
import { BTN_GHOST, INPUT} from "../../utils/ui";

const PAGE_SIZE = 50;

type MarketChannelFilter = "faction_store" | "member";
type MarketSaleTypeFilter = "standard" | "bundle" | "stock" | "custom";

const CHANNEL_OPTIONS: Array<{ value: MarketChannelFilter; label: string }> = [
  { value: "faction_store", label: "Faction Store" },
  { value: "member", label: "Member" },
];

const SALE_TYPE_OPTIONS: Array<{ value: MarketSaleTypeFilter; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "bundle", label: "Bundle" },
  { value: "stock", label: "Stock" },
  { value: "custom", label: "Custom Item" },
];

const ENTITY_TYPE_OPTIONS = ENTITY_TYPES.map((entityType) => ({
  value: entityType.key,
  label: entityType.label,
}));

type Props = {
  hasPaymentsAccess: boolean;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
};

const MarketBrowseTab: React.FC<Props> = ({ hasPaymentsAccess, focusListingId, onFocusConsumed }) => {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<EntityTypeKey[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<MarketChannelFilter[]>([]);
  const [selectedSaleTypes, setSelectedSaleTypes] = useState<MarketSaleTypeFilter[]>([]);
  const [nameSearch, setNameSearch] = useState("");
  const [focusedListing, setFocusedListing] = useState<MarketListing | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  function toggleSelection<T extends string>(value: T, setSelected: React.Dispatch<React.SetStateAction<T[]>>) {
    setSelected((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
    );
    setCurrentPage(1);
  }

  function clearAllFilters() {
    setSelectedChannels([]);
    setSelectedSaleTypes([]);
    setSelectedEntityTypes([]);
    setNameSearch("");
    setCurrentPage(1);
  }

  const activeFilterCount =
    selectedChannels.length + selectedSaleTypes.length + selectedEntityTypes.length + (nameSearch.trim() ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMarketListings({
      channel: selectedChannels.length > 0 ? selectedChannels : undefined,
      entity_type: selectedEntityTypes.length > 0 ? selectedEntityTypes : undefined,
      sale_type: selectedSaleTypes.length > 0 ? selectedSaleTypes : undefined,
      page: currentPage,
    })
      .then((res) => {
        if (!cancelled) {
          const data = res.data ?? [];
          setListings(data);
          setLastPage(res.meta?.last_page ?? 1);
          setTotalItems(res.meta?.total ?? data.length);
          if (focusListingId) {
            const match = data.find((l) => l.id === focusListingId);
            if (match) { setFocusedListing(match); onFocusConsumed?.(); }
          }
        }
      })
      .catch(() => { if (!cancelled) { setListings([]); setLastPage(1); setTotalItems(0); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedEntityTypes, selectedChannels, selectedSaleTypes, currentPage, focusListingId, onFocusConsumed]);

  const filteredListings = listings.filter((listing) => {
    if (nameSearch.trim() && !listing.entity_name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <FilterSidebar
        panelLabel="Marketplace Filters"
        summaryText={loading ? "Loading market..." : `${filteredListings.length} listing${filteredListings.length === 1 ? "" : "s"}`}
        activeFilterCount={activeFilterCount}
        children={
          <>
            <div className="flex flex-col gap-[0.45rem]">
              <div className="flex items-center justify-between gap-3">
                <label className="text-white/62 text-[0.74rem] font-bold tracking-[0.06em] uppercase" htmlFor="market-browse-search">Search</label>
                <button
                  className="inline-flex items-center justify-center self-start min-h-[1.6rem] px-[0.55rem] py-[0.18rem] rounded-full border border-white/12 bg-white/3 text-white/68 cursor-pointer text-[0.7rem] font-semibold whitespace-nowrap transition-[background,border-color,color] duration-150 hover:bg-white/6 hover:border-white/18 hover:text-white/92 font-tektur"
                  type="button"
                  onClick={clearAllFilters}
                >
                  {activeFilterCount > 0 ? `Clear All (${activeFilterCount})` : "Clear All"}
                </button>
              </div>
              <input
                id="market-browse-search"
                className={INPUT + " rounded-full pl-4"}
                type="search"
                placeholder="Search listings by name…"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-[0.9rem]">
              <FilterCheckboxSection title="Channel" selected={selectedChannels} onClear={() => setSelectedChannels([])} options={CHANNEL_OPTIONS} onToggle={(value) => toggleSelection(value, setSelectedChannels)} isFirst={true} />
              <FilterCheckboxSection title="Listing Type" selected={selectedSaleTypes} onClear={() => setSelectedSaleTypes([])} options={SALE_TYPE_OPTIONS} onToggle={(value) => toggleSelection(value, setSelectedSaleTypes)} isFirst={false} />
              <FilterCheckboxSection title="Entity Types" selected={selectedEntityTypes} onClear={() => setSelectedEntityTypes([])} options={ENTITY_TYPE_OPTIONS} onToggle={(value) => toggleSelection(value, setSelectedEntityTypes)} isFirst={false} />
            </div>
          </>
        }
        results={
          <>
            {loading ? (
              <p className={EMPTY_CLS}>Loading listings…</p>
            ) : filteredListings.length === 0 ? (
              <p className={EMPTY_CLS}>{nameSearch.trim() ? `No listings match "${nameSearch}".` : "No listings found."}</p>
            ) : (
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] max-[480px]:grid-cols-1">
                {filteredListings.map((listing) => (
                  <MarketListingCard key={listing.id} listing={listing} hasPaymentsAccess={hasPaymentsAccess} />
                ))}
              </div>
            )}
            {lastPage > 1 && (
              <Pagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={totalItems}
                showPageSize={false}
                onPageChange={setCurrentPage}
                onPageSizeChange={() => {}}
              />
            )}
          </>
        }
      />

      {focusedListing && (
        <div
          className="fixed inset-0 z-1200 flex items-center justify-center p-4 bg-black/75"
          onClick={() => setFocusedListing(null)}
        >
          <div
            className="relative z-1201 w-full max-w-95 max-h-[90vh] overflow-y-auto rounded-[10px] p-4"
            style={{ background: "var(--bg-panel, #1a1c22)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={BTN_GHOST + " block ml-auto mb-3"} type="button" onClick={() => setFocusedListing(null)}>Close</button>
            <MarketListingCard listing={focusedListing} hasPaymentsAccess={hasPaymentsAccess} />
          </div>
        </div>
      )}
    </>
  );
};

export default MarketBrowseTab;
