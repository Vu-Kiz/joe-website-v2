import React, { useEffect, useState } from "react";
import arrowLeftIcon from "../../assets/marketplace/ArrowLeftIcon.png";
import arrowRightIcon from "../../assets/marketplace/ArrowRightIcon.png";
import { ENTITY_TYPES, getMarketListings } from "../../api/market/market";
import type { MarketListing, EntityTypeKey } from "../../api/market/market";
import MarketListingCard from "./MarketListingCard";
import Pagination from "../common/Pagination";
import { EMPTY_CLS } from "./marketDisplay";
import { BTN_GHOST, INPUT} from "../../utils/ui";

const PAGE_SIZE = 50;

type MarketChannelFilter = "faction_store" | "member";
type MarketSaleTypeFilter = "standard" | "bundle" | "stock" | "custom";

type FilterSectionProps<T extends string> = {
  title: string;
  selected: T[];
  onClear: () => void;
  options: Array<{ value: T; label: string }>;
  onToggle: (value: T) => void;
  isFirst: boolean;
};

function FilterSection<T extends string>({ title, selected, onClear, options, onToggle, isFirst }: FilterSectionProps<T>) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className={`flex flex-col ${collapsed ? "gap-0" : "gap-[0.65rem]"} pt-[0.1rem] ${!isFirst ? "pt-[0.9rem] border-t border-white/[0.06]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          className="flex items-start justify-between gap-3 flex-1 min-w-0 bg-transparent border-0 text-inherit cursor-pointer p-0 text-left"
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <div>
            <p className="m-0 text-white/88 text-[0.8rem] font-bold tracking-[0.04em] uppercase">{title}</p>
            <p className="m-0 mt-[0.18rem] text-white/45 text-[0.76rem]">{selected.length > 0 ? `${selected.length} selected` : "All"}</p>
          </div>
          <span className="text-white/52 text-[1rem] font-bold leading-none pt-[0.1rem]" aria-hidden="true">
            {collapsed ? "+" : "−"}
          </span>
        </button>
        <button
          className="inline-flex items-center justify-center min-h-[1.45rem] px-[0.45rem] py-[0.12rem] rounded-full border border-white/10 bg-white/[0.025] text-white/58 cursor-pointer text-[0.68rem] font-semibold whitespace-nowrap transition-[background,border-color,color] duration-150 hover:bg-white/[0.05] hover:border-white/[0.16] hover:text-white/90"
          type="button"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-[0.45rem]">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={`flex items-center gap-[0.65rem] min-h-[2.25rem] px-[0.2rem] py-[0.3rem] cursor-pointer transition-[color] duration-150 ${checked ? "text-white/96" : "text-white/62 hover:text-white/90"}`}
              >
                <input
                  className="absolute opacity-0 pointer-events-none"
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.value)}
                />
                <span
                  className={`w-4 h-4 rounded-[0.28rem] shrink-0 transition-[border-color,background,box-shadow] duration-150 ${
                    checked
                      ? "border border-[rgba(183,138,67,0.78)] bg-[rgba(183,138,67,0.22)] shadow-[inset_0_0_0_2px_rgba(19,18,15,0.82)]"
                      : "border border-white/22 bg-white/[0.015] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[0.88rem] leading-[1.3]">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

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
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
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

  // Grid columns: collapsed sidebar is ~2.9rem wide; expanded is 240-280px
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gap: "1.25rem",
    gridTemplateColumns: filtersCollapsed
      ? "2.9rem minmax(0,1fr)"
      : "minmax(240px,280px) minmax(0,1fr)",
  };

  // Filter panel bg as inline style (gradient can't be Tailwind arbitrary)
  const filterPanelStyle: React.CSSProperties = filtersCollapsed
    ? {
        padding: "0.45rem",
        alignItems: "stretch",
        borderColor: "rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))",
      }
    : {
        background: "linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      };

  // Toggle button style when collapsed (vertical pill)
  const toggleBtnStyle: React.CSSProperties = filtersCollapsed
    ? {
        width: "2rem",
        minHeight: "8.75rem",
        padding: "0.55rem 0.1rem",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        borderRadius: "999px",
        borderColor: "rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.015)",
        color: "rgba(255,255,255,0.72)",
      }
    : {};

  const toggleLabelStyle: React.CSSProperties = filtersCollapsed
    ? { writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.12em" }
    : {};

  const toggleIconStyle: React.CSSProperties = filtersCollapsed
    ? { width: "0.72rem", height: "0.72rem", opacity: 0.8 }
    : {};

  return (
    <div style={gridStyle} className="max-[920px]:grid-cols-1!">
      <aside className="min-w-0">
        <section
          className="sticky top-4 flex flex-col gap-4 p-4 border border-white/[0.08] rounded-[14px] max-[920px]:static"
          style={filterPanelStyle}
        >
          {/* Toggle button */}
          <div className={`flex ${filtersCollapsed ? "justify-center" : "justify-start"}`}>
            <button
              className="inline-flex items-center gap-[0.45rem] w-full border border-white/[0.08] rounded-[10px] bg-white/[0.02] text-white/82 cursor-pointer text-[0.78rem] font-bold tracking-[0.03em] min-h-[2.6rem] px-[0.7rem] py-[0.55rem] transition-[border-color,background,color] duration-150 hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white/96"
              type="button"
              style={toggleBtnStyle}
              onClick={() => setFiltersCollapsed((c) => !c)}
              aria-expanded={!filtersCollapsed}
              aria-controls="market-browse-filters-body"
            >
              <span style={toggleLabelStyle}>{filtersCollapsed ? "Filters" : "Hide Filters"}</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-[0.28rem] rounded-full bg-[rgba(183,138,67,0.16)] text-[#e7c37d] text-[0.68rem] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
              <img
                src={filtersCollapsed ? arrowRightIcon : arrowLeftIcon}
                alt=""
                aria-hidden="true"
                className="shrink-0"
                style={filtersCollapsed ? toggleIconStyle : { width: "0.8rem", height: "0.8rem", objectFit: "contain", flexShrink: 0 }}
              />
            </button>
          </div>

          {!filtersCollapsed && (
            <div id="market-browse-filters-body" className="flex flex-col gap-4">
              <div className="flex flex-col gap-[0.45rem]">
                <div>
                  <p className="m-0 text-white/50 text-[0.72rem] font-bold tracking-[0.08em] uppercase">Marketplace Filters</p>
                  <p className="m-0 mt-[0.2rem] text-white/56 text-[0.82rem]">
                    {loading ? "Loading market..." : `${filteredListings.length} listing${filteredListings.length === 1 ? "" : "s"}`}
                  </p>
                  {activeFilterCount > 0 && (
                    <p className="m-0 text-white/56 text-[0.82rem]">{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-[0.45rem]">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white/62 text-[0.74rem] font-bold tracking-[0.06em] uppercase" htmlFor="market-browse-search">Search</label>
                  <button
                    className="inline-flex items-center justify-center self-start min-h-[1.6rem] px-[0.55rem] py-[0.18rem] rounded-full border border-white/[0.12] bg-white/[0.03] text-white/68 cursor-pointer text-[0.7rem] font-semibold whitespace-nowrap transition-[background,border-color,color] duration-150 hover:bg-white/[0.06] hover:border-white/[0.18] hover:text-white/92"
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
                <FilterSection title="Channel" selected={selectedChannels} onClear={() => setSelectedChannels([])} options={CHANNEL_OPTIONS} onToggle={(value) => toggleSelection(value, setSelectedChannels)} isFirst={true} />
                <FilterSection title="Listing Type" selected={selectedSaleTypes} onClear={() => setSelectedSaleTypes([])} options={SALE_TYPE_OPTIONS} onToggle={(value) => toggleSelection(value, setSelectedSaleTypes)} isFirst={false} />
                <FilterSection title="Entity Types" selected={selectedEntityTypes} onClear={() => setSelectedEntityTypes([])} options={ENTITY_TYPE_OPTIONS} onToggle={(value) => toggleSelection(value, setSelectedEntityTypes)} isFirst={false} />
              </div>
            </div>
          )}
        </section>
      </aside>

      <section className="min-w-0 flex flex-col gap-4">
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
      </section>

      {focusedListing && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/75"
          onClick={() => setFocusedListing(null)}
        >
          <div
            className="relative z-[1201] w-full max-w-[380px] max-h-[90vh] overflow-y-auto rounded-[10px] p-4"
            style={{ background: "var(--bg-panel, #1a1c22)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={BTN_GHOST + " block ml-auto mb-3"} type="button" onClick={() => setFocusedListing(null)}>Close</button>
            <MarketListingCard listing={focusedListing} hasPaymentsAccess={hasPaymentsAccess} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketBrowseTab;
