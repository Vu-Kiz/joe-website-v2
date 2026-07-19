import React, { useEffect, useRef, useState } from "react";
import {
  browseMarketOwners,
  browseMarketVendors,
  type MarketOwnerSort,
  type MarketOwnerSuggestion,
  type MarketVendor,
  type PaginatedMeta,
} from "../../api/member/marketVendors";
import { BADGE_CLS, CARD_CLS, EMPTY_CLS } from "../market/marketDisplay";
import { FilterGroup, FilterSidebar } from "../market/FilterSidebar";
import Pagination from "../common/Pagination";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import { BTN_GHOST_SM, SELECT_INPUT } from "../../utils/ui";
import { VendorDetailPopup, VendorLocationBlock } from "./marketVendorShared";
import { formatVendorLocation } from "./marketVendorDisplay";

const OWNER_SORT_OPTIONS: Array<{ value: MarketOwnerSort; label: string }> = [
  { value: "label_asc", label: "Name (A-Z)" },
  { value: "vendors_desc", label: "Most Vendors" },
];

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 25;

const OwnerListView: React.FC<{ onSelectOwner: (owner: MarketOwnerSuggestion) => void }> = ({ onSelectOwner }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MarketOwnerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<number | null>(null);

  const [sort, setSort] = useState<MarketOwnerSort>("vendors_desc");
  const [page, setPage] = useState(1);

  const [owners, setOwners] = useState<MarketOwnerSuggestion[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(targetPage: number = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await browseMarketOwners({
        q: query.trim() || undefined,
        sort,
        page: targetPage,
        per_page: PAGE_SIZE,
      });
      if (res.ok) {
        setOwners(res.data);
        setMeta(res.meta);
        setPage(targetPage);
      } else {
        setError("Failed to load owners.");
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
        const res = await browseMarketOwners({ q: value.trim(), per_page: 8 });
        if (res.ok) setSuggestions(res.data);
      } catch {
        setSuggestions([]);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleSelectSuggestion(owner: MarketOwnerSuggestion) {
    onSelectOwner(owner);
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
        panelLabel="Owner Filters"
        summaryText={meta ? `${meta.total.toLocaleString()} owners` : "Browse vendors grouped by who owns them — a faction or an individual."}
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
              <SearchSuggestionPicker<MarketOwnerSuggestion>
                value={query}
                onChange={handleQueryChange}
                onSubmit={handleSubmit}
                placeholder="Search owners…"
                suggestions={suggestions}
                showSuggestions={showSuggestions}
                onShowSuggestions={setShowSuggestions}
                getKey={(o) => o.label}
                onSelect={handleSelectSuggestion}
                renderSuggestion={(o) => (
                  <>
                    <span>{o.label}</span>
                    <span className="text-white/45 text-[0.72rem]">{o.vendor_count} vendor{o.vendor_count === 1 ? "" : "s"}</span>
                  </>
                )}
              />
            </div>

            <FilterGroup title="Sort">
              <select
                className={SELECT_INPUT}
                value={sort}
                onChange={(e) => setSort(e.target.value as MarketOwnerSort)}
              >
                {OWNER_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FilterGroup>
          </>
        }
        results={
          <>
            {error && <p className={EMPTY_CLS} style={{ color: "#f87171" }}>{error}</p>}
            {loading && <p className={EMPTY_CLS}>Loading owners…</p>}
            {!loading && !error && owners.length === 0 && <p className={EMPTY_CLS}>No owners found.</p>}

            {!loading && owners.length > 0 && (
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] max-[480px]:grid-cols-1">
                {owners.map((owner) => (
                  <button
                    key={owner.label}
                    type="button"
                    className={CARD_CLS + " bg-transparent text-left cursor-pointer h-full self-stretch group"}
                    onClick={() => onSelectOwner(owner)}
                  >
                    <div className="flex items-center gap-[0.4rem] flex-wrap text-[0.72rem] opacity-60 uppercase tracking-[0.06em]">
                      <span className={owner.vendor_count >= 10 ? BADGE_CLS.bundle : BADGE_CLS.stock}>
                        {owner.vendor_count} vendor{owner.vendor_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="m-0 text-[0.95rem] font-semibold leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-accent">{owner.label}</p>
                  </button>
                ))}
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

const OwnerVendorsView: React.FC<{ owner: MarketOwnerSuggestion; onBack: () => void }> = ({ owner, onBack }) => {
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
      const res = await browseMarketVendors({ owner_label: owner.label, sort: "name_asc", page: targetPage, per_page: PAGE_SIZE });
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
  }, [owner.label]);

  return (
    <div className="flex flex-col gap-4 font-tektur">
      <div className="flex items-center gap-3">
        <button type="button" className={BTN_GHOST_SM} onClick={onBack}>← Back to Owners</button>
        <p className="m-0 text-[0.95rem] font-semibold">{owner.label}</p>
        <p className="m-0 text-[0.78rem] text-white/55">
          {(meta?.total ?? owner.vendor_count).toLocaleString()} vendor{(meta?.total ?? owner.vendor_count) === 1 ? "" : "s"}
        </p>
      </div>

      {error && <p className={EMPTY_CLS} style={{ color: "#f87171" }}>{error}</p>}
      {loading && <p className={EMPTY_CLS}>Loading vendors…</p>}
      {!loading && !error && vendors.length === 0 && <p className={EMPTY_CLS}>No vendors found.</p>}

      {!loading && vendors.length > 0 && (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] max-[480px]:grid-cols-1">
          {vendors.map((vendor) => {
            const location = formatVendorLocation(vendor);
            return (
              <button
                key={vendor.id}
                type="button"
                className={CARD_CLS + " bg-transparent text-left cursor-pointer h-full self-stretch group"}
                onClick={() => setOpenVendorId(vendor.id)}
              >
                <div className="flex items-center gap-[0.4rem] flex-wrap text-[0.72rem] opacity-60 uppercase tracking-[0.06em]">
                  <span className={BADGE_CLS.entity}>Vendor</span>
                  {!!vendor.listings_count && <span className={BADGE_CLS.stock}>{vendor.listings_count.toLocaleString()} wares</span>}
                </div>
                <p className="m-0 text-[0.95rem] font-semibold leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-accent">{vendor.name}</p>
                <div className="flex flex-col gap-[0.22rem] flex-1">
                  <div className="flex flex-col gap-[0.1rem] text-[0.76rem]">
                    <span className="text-white/40">Location</span>
                    <VendorLocationBlock location={location} />
                  </div>
                </div>
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

      {openVendorId !== null && (
        <VendorDetailPopup vendorId={openVendorId} onClose={() => setOpenVendorId(null)} />
      )}
    </div>
  );
};

type Props = {
  // Set when a member follows an owner link from Browse/Directory/Hubs — jumps
  // straight to that owner's vendor list instead of the owner directory.
  initialOwner?: MarketOwnerSuggestion | null;
};

const MarketVendorOwnersPanel: React.FC<Props> = ({ initialOwner }) => {
  const [selectedOwner, setSelectedOwner] = useState<MarketOwnerSuggestion | null>(initialOwner ?? null);

  useEffect(() => {
    if (initialOwner) setSelectedOwner(initialOwner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOwner?.label]);

  return selectedOwner ? (
    <OwnerVendorsView owner={selectedOwner} onBack={() => setSelectedOwner(null)} />
  ) : (
    <OwnerListView onSelectOwner={setSelectedOwner} />
  );
};

export default MarketVendorOwnersPanel;
