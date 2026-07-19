import React, { useEffect, useRef, useState } from "react";
import {
  browseMarketHubs,
  browseMarketVendors,
  type MarketHub,
  type MarketHubSort,
  type MarketVendor,
  type PaginatedMeta,
} from "../../api/member/marketVendors";
import type { CharacterLocation } from "../../api/member/characterLocation";
import { BADGE_CLS, CARD_CLS, EMPTY_CLS } from "../market/marketDisplay";
import { FilterGroup, FilterSidebar } from "../market/FilterSidebar";
import Pagination from "../common/Pagination";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import { BTN_GHOST_SM, SELECT_INPUT } from "../../utils/ui";
import { VendorDetailPopup, VendorLocationBlock } from "./marketVendorShared";
import { NEAR_YOU_BADGE, NEAR_YOU_THRESHOLD, OWNER_LINK_CLS, formatDistance, formatVendorLocation, galaxyDistance } from "./marketVendorDisplay";

const BASE_HUB_SORT_OPTIONS: Array<{ value: MarketHubSort; label: string }> = [
  { value: "vendors_desc", label: "Most Vendors" },
  { value: "label_asc", label: "Name (A-Z)" },
];

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 25;

function formatCoords(galx: number, galy: number): string {
  return `(${galx}, ${galy})`;
}

const HubListView: React.FC<{ onSelectHub: (hub: MarketHub) => void; playerLocation?: CharacterLocation | null }> = ({ onSelectHub, playerLocation }) => {
  const myGalx = playerLocation?.galx ?? null;
  const myGaly = playerLocation?.galy ?? null;
  const hasPlayerLocation = myGalx != null && myGaly != null;
  const HUB_SORT_OPTIONS = hasPlayerLocation
    ? [...BASE_HUB_SORT_OPTIONS, { value: "distance_asc" as const, label: "Distance (Nearest)" }]
    : BASE_HUB_SORT_OPTIONS;

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MarketHub[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<number | null>(null);

  const [sort, setSort] = useState<MarketHubSort>(hasPlayerLocation ? "distance_asc" : "vendors_desc");
  const sortDefaultedRef = useRef(hasPlayerLocation);
  useEffect(() => {
    if (!sortDefaultedRef.current && hasPlayerLocation) {
      sortDefaultedRef.current = true;
      setSort("distance_asc");
    }
  }, [hasPlayerLocation]);
  const [page, setPage] = useState(1);

  const [hubs, setHubs] = useState<MarketHub[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(targetPage: number = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await browseMarketHubs({
        q: query.trim() || undefined,
        sort,
        my_galx: sort === "distance_asc" ? myGalx : null,
        my_galy: sort === "distance_asc" ? myGaly : null,
        page: targetPage,
        per_page: PAGE_SIZE,
      });
      if (res.ok) {
        setHubs(res.data);
        setMeta(res.meta);
        setPage(targetPage);
      } else {
        setError("Failed to load hubs.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    };
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(async () => {
      if (!value.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await browseMarketHubs({ q: value.trim(), per_page: 8 });
        if (res.ok) setSuggestions(res.data);
      } catch {
        setSuggestions([]);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleSelectSuggestion(hub: MarketHub) {
    onSelectHub(hub);
  }

  function handleSubmit() {
    load(1);
  }

  function clearAllFilters() {
    setQuery("");
    setSuggestions([]);
    load(1);
  }

  const activeFilterCount = query.trim() ? 1 : 0;

  return (
    <div className="flex flex-col gap-4 font-tektur">
      <FilterSidebar
        panelLabel="Hub Filters"
        summaryText={meta ? `${meta.total.toLocaleString()} hubs` : "Locations with 10 or more vendors clustered together — worth a single trip to shop a whole bazaar at once."}
        activeFilterCount={activeFilterCount}
        children={
          <>
            <div className="flex flex-col gap-[0.45rem]">
              <div className="flex items-center justify-between gap-3">
                <label className="text-white/62 text-[0.74rem] font-bold tracking-[0.06em] uppercase">Search</label>
                <button
                  className="inline-flex items-center justify-center self-start min-h-[1.6rem] px-[0.55rem] py-[0.18rem] rounded-full border border-white/12 bg-white/3 text-white/68 cursor-pointer text-[0.7rem] font-semibold whitespace-nowrap transition-[background,border-color,color] duration-150 hover:bg-white/6 hover:border-white/18 hover:text-white/92 font-tektur"
                  type="button"
                  onClick={clearAllFilters}
                >
                  {activeFilterCount > 0 ? `Clear All (${activeFilterCount})` : "Clear All"}
                </button>
              </div>
              <SearchSuggestionPicker<MarketHub>
                value={query}
                onChange={handleQueryChange}
                onSubmit={handleSubmit}
                placeholder="Search hub locations…"
                suggestions={suggestions}
                showSuggestions={showSuggestions}
                onShowSuggestions={setShowSuggestions}
                getKey={(h) => `${h.galx}-${h.galy}`}
                onSelect={handleSelectSuggestion}
                renderSuggestion={(h) => (
                  <>
                    <span>{h.hub_label ?? formatCoords(h.galx, h.galy)}</span>
                    <span className="text-white/45 text-[0.72rem]">{h.vendor_count} vendors</span>
                  </>
                )}
              />
            </div>

            <FilterGroup title="Sort">
              <select
                className={SELECT_INPUT}
                value={sort}
                onChange={(e) => setSort(e.target.value as MarketHubSort)}
              >
                {HUB_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FilterGroup>
          </>
        }
        results={
          <>
            {error && <p className={EMPTY_CLS} style={{ color: "#f87171" }}>{error}</p>}
            {loading && <p className={EMPTY_CLS}>Loading hubs…</p>}
            {!loading && !error && hubs.length === 0 && <p className={EMPTY_CLS}>No hub locations found.</p>}

            {!loading && hubs.length > 0 && (
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] max-[480px]:grid-cols-1">
                {hubs.map((hub) => {
                  const distance = galaxyDistance(myGalx, myGaly, hub.galx, hub.galy);
                  const isNearYou = distance != null && distance <= NEAR_YOU_THRESHOLD;

                  return (
                    <button
                      key={`${hub.galx}-${hub.galy}`}
                      type="button"
                      className={CARD_CLS + " bg-transparent text-left cursor-pointer h-full self-stretch group"}
                      onClick={() => onSelectHub(hub)}
                    >
                      <div className="flex items-center gap-[0.4rem] flex-wrap text-[0.72rem] opacity-60 uppercase tracking-[0.06em]">
                        <span className={hub.vendor_count >= 20 ? BADGE_CLS.bundle : BADGE_CLS.stock}>
                          {hub.vendor_count} vendors
                        </span>
                        {isNearYou && <span className={NEAR_YOU_BADGE}>Near You</span>}
                      </div>
                      <p className="m-0 text-[0.95rem] font-semibold leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-accent">
                        {hub.hub_label ?? formatCoords(hub.galx, hub.galy)}
                      </p>
                      <p className="m-0 text-[0.78rem] text-white/55">{formatCoords(hub.galx, hub.galy)}</p>
                      {distance != null && (
                        <p className={isNearYou ? "m-0 text-[0.78rem] text-[#5ddec8]" : "m-0 text-[0.78rem] text-white/55"}>{formatDistance(distance)}</p>
                      )}
                    </button>
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
                onPageChange={load}
                onPageSizeChange={() => {}}
              />
            )}
          </>
        }
      />
    </div>
  );
};

const HubVendorsView: React.FC<{
  hub: MarketHub;
  onBack: () => void;
  playerLocation?: CharacterLocation | null;
  onGoToOwner?: (ownerLabel: string) => void;
}> = ({ hub, onBack, playerLocation, onGoToOwner }) => {
  const myGalx = playerLocation?.galx ?? null;
  const myGaly = playerLocation?.galy ?? null;
  const [page, setPage] = useState(1);
  const [vendors, setVendors] = useState<MarketVendor[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openVendorId, setOpenVendorId] = useState<number | null>(null);

  async function load(targetPage: number = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await browseMarketVendors({ galx: hub.galx, galy: hub.galy, sort: "name_asc", page: targetPage, per_page: PAGE_SIZE });
      if (res.ok) {
        setVendors(res.data);
        setMeta(res.meta);
        setPage(targetPage);
      } else {
        setError("Failed to load vendors.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub.galx, hub.galy]);

  return (
    <div className="flex flex-col gap-4 font-tektur">
      <div className="flex items-center gap-3">
        <button type="button" className={BTN_GHOST_SM} onClick={onBack}>← Back to Hubs</button>
        <p className="m-0 text-[0.95rem] font-semibold">{hub.hub_label ?? formatCoords(hub.galx, hub.galy)}</p>
        <p className="m-0 text-[0.78rem] text-white/55">{formatCoords(hub.galx, hub.galy)} · {hub.vendor_count} vendors</p>
      </div>

      {error && <p className={EMPTY_CLS} style={{ color: "#f87171" }}>{error}</p>}
      {loading && <p className={EMPTY_CLS}>Loading vendors…</p>}
      {!loading && !error && vendors.length === 0 && <p className={EMPTY_CLS}>No vendors found.</p>}

      {!loading && vendors.length > 0 && (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] max-[480px]:grid-cols-1">
          {vendors.map((vendor) => {
            const distance = galaxyDistance(myGalx, myGaly, vendor.galx, vendor.galy);
            const isNearYou = distance != null && distance <= NEAR_YOU_THRESHOLD;
            const location = formatVendorLocation(vendor);

            return (
              <div key={vendor.id} className={CARD_CLS + " h-full self-stretch group"}>
                <button
                  type="button"
                  className="bg-transparent border-0 p-0 m-0 flex flex-col gap-[0.22rem] w-full text-left cursor-pointer font-tektur"
                  onClick={() => setOpenVendorId(vendor.id)}
                >
                  <div className="flex items-center gap-[0.4rem] flex-wrap text-[0.72rem] opacity-60 uppercase tracking-[0.06em]">
                    <span className={BADGE_CLS.entity}>Vendor</span>
                    {!!vendor.listings_count && <span className={BADGE_CLS.stock}>{vendor.listings_count.toLocaleString()} wares</span>}
                    {isNearYou && <span className={NEAR_YOU_BADGE}>Near You</span>}
                  </div>
                  <p className="m-0 text-[0.95rem] font-semibold leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-accent">{vendor.name}</p>
                </button>
                <div className="flex flex-col gap-[0.22rem] flex-1">
                  <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
                    <span className="text-white/40 shrink-0 w-14">Owner</span>
                    {vendor.owner_label && onGoToOwner ? (
                      <button
                        type="button"
                        className={OWNER_LINK_CLS + " flex-1 overflow-hidden text-ellipsis whitespace-nowrap"}
                        onClick={() => onGoToOwner(vendor.owner_label as string)}
                      >
                        {vendor.owner_label}
                      </button>
                    ) : (
                      <span className="text-white/75 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{vendor.owner_label ?? "—"}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-[0.1rem] text-[0.76rem]">
                    <span className="text-white/40">Location</span>
                    <VendorLocationBlock location={location} />
                  </div>
                  {distance != null && (
                    <div className="flex items-center gap-[0.4rem] text-[0.76rem] min-h-[1.05rem]">
                      <span className="text-white/40 shrink-0 w-14">Distance</span>
                      <span className={isNearYou ? "text-[#5ddec8] flex-1" : "text-white/75 flex-1"}>{formatDistance(distance)}</span>
                    </div>
                  )}
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
          onPageChange={load}
          onPageSizeChange={() => {}}
        />
      )}

      {openVendorId !== null && (
        <VendorDetailPopup vendorId={openVendorId} onClose={() => setOpenVendorId(null)} onGoToOwner={onGoToOwner} />
      )}
    </div>
  );
};

type Props = {
  playerLocation?: CharacterLocation | null;
  onGoToOwner?: (ownerLabel: string) => void;
};

const MarketVendorHubsPanel: React.FC<Props> = ({ playerLocation, onGoToOwner }) => {
  const [selectedHub, setSelectedHub] = useState<MarketHub | null>(null);

  return selectedHub ? (
    <HubVendorsView hub={selectedHub} onBack={() => setSelectedHub(null)} playerLocation={playerLocation} onGoToOwner={onGoToOwner} />
  ) : (
    <HubListView onSelectHub={setSelectedHub} playerLocation={playerLocation} />
  );
};

export default MarketVendorHubsPanel;
