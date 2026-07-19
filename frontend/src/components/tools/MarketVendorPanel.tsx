import React, { useEffect, useRef, useState } from "react";
import {
  browseMarketVendors,
  searchMarketVendorListings,
  type MarketOwnerSuggestion,
  type MarketVendor,
  type MarketVendorListing,
  type MarketVendorSort,
  type PaginatedMeta,
} from "../../api/member/marketVendors";
import type { CharacterLocation } from "../../api/member/characterLocation";
import { BADGE_CLS, CARD_CLS, EMPTY_CLS, formatMarketName } from "../market/marketDisplay";
import { FilterCheckboxSection, FilterGroup, FilterSidebar } from "../market/FilterSidebar";
import Pagination from "../common/Pagination";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import { BTN, INPUT, SELECT_INPUT } from "../../utils/ui";
import { ListingDetailPopup, VendorDetailPopup, VendorLocationBlock } from "./marketVendorShared";
import {
  BEST_PRICE_BADGE, NEAR_YOU_BADGE, NEAR_YOU_THRESHOLD, OWNER_LINK_CLS,
  formatCredits, formatDistance, formatVendorLocation, galaxyDistance,
} from "./marketVendorDisplay";

const VENDOR_SEARCH_DEBOUNCE_MS = 250;

type VendorSuggestion =
  | { kind: "vendor"; vendor: MarketVendor }
  | { kind: "owner"; owner: MarketOwnerSuggestion };

const ENTITY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "item", label: "Items" },
  { value: "droid", label: "Droids" },
  { value: "weapon", label: "Weapons" },
  { value: "material", label: "Materials" },
  { value: "vehicle", label: "Vehicles" },
  { value: "ship", label: "Ships" },
  { value: "creature", label: "Creatures" },
];

const BASE_SORT_OPTIONS: Array<{ value: MarketVendorSort; label: string }> = [
  { value: "price_asc", label: "Price (Low to High)" },
  { value: "price_desc", label: "Price (High to Low)" },
  { value: "quantity_desc", label: "Stock (Highest first)" },
  { value: "name_asc", label: "Name (A-Z)" },
];

const PAGE_SIZE = 25;

type Props = {
  playerLocation?: CharacterLocation | null;
  onGoToOwner?: (ownerLabel: string) => void;
};

const MarketVendorPanel: React.FC<Props> = ({ playerLocation, onGoToOwner }) => {
  const myGalx = playerLocation?.galx ?? null;
  const myGaly = playerLocation?.galy ?? null;
  const hasPlayerLocation = myGalx != null && myGaly != null;
  const SORT_OPTIONS = hasPlayerLocation
    ? [...BASE_SORT_OPTIONS, { value: "distance_asc" as const, label: "Distance (Nearest)" }]
    : BASE_SORT_OPTIONS;
  const [query, setQuery] = useState("");
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  const [sort, setSort] = useState<MarketVendorSort>(hasPlayerLocation ? "distance_asc" : "price_asc");
  const sortDefaultedRef = useRef(hasPlayerLocation);
  useEffect(() => {
    if (!sortDefaultedRef.current && hasPlayerLocation) {
      sortDefaultedRef.current = true;
      setSort("distance_asc");
    }
  }, [hasPlayerLocation]);
  const [page, setPage] = useState(1);

  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorSuggestion[]>([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<MarketVendor | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<MarketOwnerSuggestion | null>(null);
  const vendorSearchTimerRef = useRef<number | null>(null);

  const [listings, setListings] = useState<MarketVendorListing[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [openVendorId, setOpenVendorId] = useState<number | null>(null);
  const [openListing, setOpenListing] = useState<MarketVendorListing | null>(null);

  function toggleEntityType(value: string) {
    setSelectedEntityTypes((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  }

  function handleVendorQueryChange(value: string) {
    setVendorQuery(value);
    if (!value.trim()) {
      setSelectedVendor(null);
      setSelectedOwner(null);
    }
    if (vendorSearchTimerRef.current) {
      window.clearTimeout(vendorSearchTimerRef.current);
    }
    vendorSearchTimerRef.current = window.setTimeout(async () => {
      if (!value.trim()) {
        setVendorSuggestions([]);
        return;
      }
      try {
        const res = await browseMarketVendors({ q: value.trim(), per_page: 8 });
        if (res.ok) {
          const ownerSuggestions: VendorSuggestion[] = (res.owners ?? []).map((owner) => ({ kind: "owner", owner }));
          const vendorSuggestionList: VendorSuggestion[] = res.data.map((vendor) => ({ kind: "vendor", vendor }));
          setVendorSuggestions([...ownerSuggestions, ...vendorSuggestionList]);
        }
      } catch {
        setVendorSuggestions([]);
      }
    }, VENDOR_SEARCH_DEBOUNCE_MS);
  }

  function handleSelectSuggestion(suggestion: VendorSuggestion) {
    if (suggestion.kind === "owner") {
      setSelectedOwner(suggestion.owner);
      setSelectedVendor(null);
      setVendorQuery(suggestion.owner.label);
    } else {
      setSelectedVendor(suggestion.vendor);
      setSelectedOwner(null);
      setVendorQuery(suggestion.vendor.name);
    }
  }

  function clearVendorFilter() {
    setSelectedVendor(null);
    setSelectedOwner(null);
    setVendorQuery("");
  }

  function clearAllFilters() {
    setQuery("");
    setSelectedEntityTypes([]);
    clearVendorFilter();
    setListings([]);
    setMeta(null);
    setHasSearched(false);
  }

  useEffect(() => {
    return () => {
      if (vendorSearchTimerRef.current) window.clearTimeout(vendorSearchTimerRef.current);
    };
  }, []);

  async function runSearch(targetPage: number = 1) {
    if (!query.trim() && selectedEntityTypes.length === 0 && !selectedVendor && !selectedOwner) {
      setListings([]);
      setMeta(null);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Backend currently filters by a single entity_type; use the first selected chip.
      const res = await searchMarketVendorListings({
        q: query.trim() || undefined,
        entity_type: selectedEntityTypes[0] ?? null,
        vendor_id: selectedVendor?.id ?? null,
        owner_label: selectedOwner?.label ?? null,
        sort,
        my_galx: sort === "distance_asc" ? myGalx : null,
        my_galy: sort === "distance_asc" ? myGaly : null,
        page: targetPage,
        per_page: PAGE_SIZE,
      });
      if (res.ok) {
        setListings(res.data);
        setMeta(res.meta);
        setPage(targetPage);
      } else {
        setError("Search failed. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(1);
  }

  // Lowest price per matched item within the current page — surfaces the actual
  // value of comparing vendors rather than just listing every match flatly.
  const bestPriceByItem = new Map<string, number>();
  for (const listing of listings) {
    const key = listing.matched_item_type_uid ?? listing.ware_name;
    const current = bestPriceByItem.get(key);
    if (current === undefined || listing.price < current) {
      bestPriceByItem.set(key, listing.price);
    }
  }

  const activeFilterCount = selectedEntityTypes.length + (query.trim() ? 1 : 0) + (selectedVendor || selectedOwner ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 font-tektur">
      <FilterSidebar
        panelLabel="Vendor Filters"
        summaryText={hasSearched && meta ? `${meta.total.toLocaleString()} results` : "Search what public SWC vendors are selling, synced from SWC twice a day."}
        activeFilterCount={activeFilterCount}
        children={
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-[0.45rem]">
              <div className="flex items-center justify-between gap-3">
                <label className="text-white/62 text-[0.74rem] font-bold tracking-[0.06em] uppercase" htmlFor="vendor-item-search">Search</label>
                <button
                  className="inline-flex items-center justify-center self-start min-h-[1.6rem] px-[0.55rem] py-[0.18rem] rounded-full border border-white/12 bg-white/3 text-white/68 cursor-pointer text-[0.7rem] font-semibold whitespace-nowrap transition-[background,border-color,color] duration-150 hover:bg-white/6 hover:border-white/18 hover:text-white/92 font-tektur"
                  type="button"
                  onClick={clearAllFilters}
                >
                  {activeFilterCount > 0 ? `Clear All (${activeFilterCount})` : "Clear All"}
                </button>
              </div>
              <input
                id="vendor-item-search"
                className={INPUT + " rounded-full pl-4"}
                type="search"
                placeholder="Search by item…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            <FilterGroup title="Vendor / Owner">
              <SearchSuggestionPicker<VendorSuggestion>
                value={vendorQuery}
                onChange={handleVendorQueryChange}
                onSubmit={() => runSearch(1)}
                placeholder="Filter by vendor or owner…"
                suggestions={vendorSuggestions}
                showSuggestions={showVendorSuggestions}
                onShowSuggestions={setShowVendorSuggestions}
                getKey={(s) => s.kind === "vendor" ? `vendor-${s.vendor.id}` : `owner-${s.owner.label}`}
                isActive={(s) =>
                  s.kind === "vendor"
                    ? s.vendor.id === selectedVendor?.id
                    : s.owner.label === selectedOwner?.label
                }
                onSelect={handleSelectSuggestion}
                renderSuggestion={(s) =>
                  s.kind === "owner" ? (
                    <>
                      <span className="text-accent">All vendors — {s.owner.label}</span>
                      <span className="text-white/45 text-[0.72rem]">{s.owner.vendor_count} vendor{s.owner.vendor_count === 1 ? "" : "s"}</span>
                    </>
                  ) : (
                    <>
                      <span>{s.vendor.name}</span>
                      <span className="text-white/45 text-[0.72rem]">{s.vendor.owner_label}</span>
                    </>
                  )
                }
              />
              {(selectedVendor || selectedOwner) && (
                <div className="flex items-center gap-2 text-[0.76rem] text-white/65">
                  {selectedVendor && <span className="text-white/90">{selectedVendor.name}</span>}
                  {selectedOwner && <span className="text-white/90">{selectedOwner.label} ({selectedOwner.vendor_count})</span>}
                  <button type="button" className="bg-transparent border-0 p-0 m-0 cursor-pointer text-accent hover:underline font-tektur" onClick={clearVendorFilter}>
                    Clear
                  </button>
                </div>
              )}
            </FilterGroup>

            <FilterGroup title="Sort">
              <select
                className={SELECT_INPUT}
                value={sort}
                onChange={(e) => setSort(e.target.value as MarketVendorSort)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FilterGroup>

            <FilterCheckboxSection
              title="Entity Types"
              selected={selectedEntityTypes}
              onClear={() => setSelectedEntityTypes([])}
              options={ENTITY_TYPE_OPTIONS}
              onToggle={toggleEntityType}
            />

            <button type="submit" className={BTN} disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </button>
          </form>
        }
        results={
          <>
            {error && <p className={EMPTY_CLS} style={{ color: "#f87171" }}>{error}</p>}

            {!hasSearched && !loading && !error && (
              <p className={EMPTY_CLS}>
                Search by item, droid, or ship — or filter to a specific vendor or owner. The cheapest result is marked Best Price.
              </p>
            )}

            {hasSearched && !loading && listings.length === 0 && !error && (
              <p className={EMPTY_CLS}>No vendors found selling that. Try a different search term.</p>
            )}

            {listings.length > 0 && (
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] max-[480px]:grid-cols-1">
                {listings.map((listing) => {
                  const key = listing.matched_item_type_uid ?? listing.ware_name;
                  const isBest = bestPriceByItem.get(key) === listing.price;
                  const location = formatVendorLocation(listing.vendor);
                  const distance = galaxyDistance(myGalx, myGaly, listing.vendor.galx, listing.vendor.galy);
                  const isNearYou = distance != null && distance <= NEAR_YOU_THRESHOLD;

                  return (
                    <div key={listing.id} className={CARD_CLS}>
                      <div className="flex items-center gap-[0.4rem] flex-wrap text-[0.72rem] opacity-60 uppercase tracking-[0.06em]">
                        <span className={BADGE_CLS.entity}>{listing.matched_entity_type ?? "item"}</span>
                        {isBest && <span className={BEST_PRICE_BADGE}>Best Price</span>}
                        {isNearYou && <span className={NEAR_YOU_BADGE}>Near You</span>}
                      </div>

                      <button
                        type="button"
                        className="bg-transparent border-0 p-0 m-0 cursor-pointer block w-full text-left font-tektur"
                        onClick={() => setOpenListing(listing)}
                      >
                        <div className="w-full h-25.5 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-white/2">
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

                        <p className="m-0 mt-[0.45rem] text-[0.95rem] font-semibold leading-[1.2] hover:text-accent overflow-hidden text-ellipsis whitespace-nowrap">{formatMarketName(listing.ware_name)}</p>
                      </button>

                      <div className="flex flex-col gap-[0.3rem] flex-1">
                        <div className="flex items-baseline gap-[0.4rem] text-[0.76rem]">
                          <span className="text-white/40 shrink-0 w-14">Vendor</span>
                          <button
                            type="button"
                            className="bg-transparent border-0 p-0 m-0 cursor-pointer text-white/75 flex-1 text-left hover:text-accent underline-offset-2 hover:underline font-tektur"
                            onClick={() => setOpenVendorId(listing.vendor.id)}
                          >
                            {listing.vendor.name}
                          </button>
                        </div>
                        <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
                          <span className="text-white/40 shrink-0 w-14">Owner</span>
                          {listing.vendor.owner_label && onGoToOwner ? (
                            <button
                              type="button"
                              className={OWNER_LINK_CLS + " flex-1 overflow-hidden text-ellipsis whitespace-nowrap"}
                              onClick={() => onGoToOwner(listing.vendor.owner_label as string)}
                            >
                              {listing.vendor.owner_label}
                            </button>
                          ) : (
                            <span className="text-white/75 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{listing.vendor.owner_label ?? "—"}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-[0.1rem] text-[0.76rem]">
                          <span className="text-white/40">Location</span>
                          <VendorLocationBlock location={location} />
                        </div>
                        <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
                          <span className="text-white/40 shrink-0 w-14">Stock</span>
                          <span className="text-white/75 flex-1">{listing.quantity.toLocaleString()}</span>
                        </div>
                        {distance != null && (
                          <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
                            <span className="text-white/40 shrink-0 w-14">Distance</span>
                            <span className={isNearYou ? "text-[#5ddec8] flex-1" : "text-white/75 flex-1"}>{formatDistance(distance)}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto">
                        <span className="text-[1.12rem] font-bold">{formatCredits(listing.price)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {meta && meta.last_page > 1 && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalItems={meta.total}
                showPageSize={false}
                onPageChange={runSearch}
                onPageSizeChange={() => {}}
              />
            )}
          </>
        }
      />

      {openVendorId !== null && (
        <VendorDetailPopup vendorId={openVendorId} onClose={() => setOpenVendorId(null)} onGoToOwner={onGoToOwner} />
      )}

      {openListing && (
        <ListingDetailPopup listing={openListing} onClose={() => setOpenListing(null)} onGoToOwner={onGoToOwner} />
      )}
    </div>
  );
};

export default MarketVendorPanel;
