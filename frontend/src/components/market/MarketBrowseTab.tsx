import React, { useEffect, useState } from "react";
import arrowLeftIcon from "../../assets/marketplace/ArrowLeftIcon.png";
import arrowRightIcon from "../../assets/marketplace/ArrowRightIcon.png";
import { ENTITY_TYPES, getMarketListings } from "../../api/market";
import type { MarketListing, EntityTypeKey } from "../../api/market";
import MarketListingCard from "./MarketListingCard";

type MarketChannelFilter = "faction_store" | "member";
type MarketSaleTypeFilter = "standard" | "bundle" | "custom";
type FilterSectionProps<T extends string> = {
  title: string;
  selected: T[];
  onClear: () => void;
  options: Array<{ value: T; label: string }>;
  onToggle: (value: T) => void;
};

function FilterSection<T extends string>({ title, selected, onClear, options, onToggle }: FilterSectionProps<T>) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className={`market-browse-facet${collapsed ? " is-collapsed" : ""}`}>
      <div className="market-browse-facet__header">
        <button
          className="market-browse-facet__toggle"
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-expanded={!collapsed}
        >
          <div>
            <p className="market-browse-facet__title">{title}</p>
            <p className="market-browse-facet__meta">{selected.length > 0 ? `${selected.length} selected` : "All"}</p>
          </div>
          <span className="market-browse-facet__chevron" aria-hidden="true">
            {collapsed ? "+" : "-"}
          </span>
        </button>
        <button className="market-browse-facet__clear" type="button" onClick={onClear}>
          Clear
        </button>
      </div>

      {!collapsed && (
        <div className="market-browse-facet__options">
        {options.map((option) => {
          const checked = selected.includes(option.value);

          return (
            <label key={option.value} className={`market-browse-facet-option${checked ? " is-selected" : ""}`}>
              <input
                className="market-browse-facet-option__input"
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option.value)}
              />
              <span className="market-browse-facet-option__check" aria-hidden="true" />
              <span className="market-browse-facet-option__label">{option.label}</span>
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

  function toggleSelection<T extends string>(value: T, setSelected: React.Dispatch<React.SetStateAction<T[]>>) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
    );
  }

  function clearAllFilters() {
    setSelectedChannels([]);
    setSelectedSaleTypes([]);
    setSelectedEntityTypes([]);
    setNameSearch("");
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
    })
      .then((res) => {
        if (!cancelled) {
          const data = res.data ?? [];
          setListings(data);
          if (focusListingId) {
            const match = data.find((l) => l.id === focusListingId);
            if (match) {
              setFocusedListing(match);
              onFocusConsumed?.();
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedEntityTypes, selectedChannels, selectedSaleTypes, focusListingId, onFocusConsumed]);

  const filteredListings = listings.filter((listing) => {
    if (nameSearch.trim() && !listing.entity_name.toLowerCase().includes(nameSearch.toLowerCase())) {
      return false;
    }

    return true;
  });

  return (
    <div className={`market-browse${filtersCollapsed ? " is-filters-collapsed" : ""}`}>
      <aside className="market-browse__sidebar">
        <section className="market-browse__filters">
          <div className="market-browse__rail-toggle-wrap">
            <button
              className="market-browse__rail-toggle"
              type="button"
              onClick={() => setFiltersCollapsed((current) => !current)}
              aria-expanded={!filtersCollapsed}
              aria-controls="market-browse-filters-body"
            >
              <span className="market-browse__rail-toggle-label">
                {filtersCollapsed ? "Filters" : "Hide Filters"}
              </span>
              {activeFilterCount > 0 && (
                <span className="market-browse__rail-toggle-count">
                  {activeFilterCount}
                </span>
              )}
              <img
                className="market-browse__rail-toggle-icon"
                src={filtersCollapsed ? arrowRightIcon : arrowLeftIcon}
                alt=""
                aria-hidden="true"
              />
            </button>
          </div>

          {!filtersCollapsed && (
          <div
            id="market-browse-filters-body"
            className="market-browse__filters-body"
          >
            <div className="market-browse__filters-top">
              <div>
                <p className="market-browse__eyebrow">Marketplace Filters</p>
                <p className="market-browse__filters-meta">
                  {loading ? "Loading market..." : `${filteredListings.length} listing${filteredListings.length === 1 ? "" : "s"}`}
                </p>
                {activeFilterCount > 0 && (
                  <p className="market-browse__filters-meta">
                    {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>

            <div className="market-browse__search">
              <div className="market-browse__search-top">
                <label className="market-browse__search-label" htmlFor="market-browse-search">
                  Search
                </label>
                <button className="market-browse__reset" type="button" onClick={clearAllFilters}>
                  {activeFilterCount > 0 ? `Clear All (${activeFilterCount})` : "Clear All"}
                </button>
              </div>
              <input
                id="market-browse-search"
                className="input"
                type="search"
                placeholder="Search listings by name…"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
              />
            </div>

            <div className="market-browse__facet-list">
              <FilterSection
                title="Channel"
                selected={selectedChannels}
                onClear={() => setSelectedChannels([])}
                options={CHANNEL_OPTIONS}
                onToggle={(value) => toggleSelection(value, setSelectedChannels)}
              />
              <FilterSection
                title="Listing Type"
                selected={selectedSaleTypes}
                onClear={() => setSelectedSaleTypes([])}
                options={SALE_TYPE_OPTIONS}
                onToggle={(value) => toggleSelection(value, setSelectedSaleTypes)}
              />
              <FilterSection
                title="Entity Types"
                selected={selectedEntityTypes}
                onClear={() => setSelectedEntityTypes([])}
                options={ENTITY_TYPE_OPTIONS}
                onToggle={(value) => toggleSelection(value, setSelectedEntityTypes)}
              />
            </div>
          </div>
          )}
        </section>
      </aside>

      <section className="market-browse__results">
        {loading ? (
          <p className="market-empty">Loading listings…</p>
        ) : filteredListings.length === 0 ? (
          <p className="market-empty">{nameSearch.trim() ? `No listings match "${nameSearch}".` : "No listings found."}</p>
        ) : (
          <div className="market-grid">
            {filteredListings.map((listing) => (
              <MarketListingCard key={listing.id} listing={listing} hasPaymentsAccess={hasPaymentsAccess} />
            ))}
          </div>
        )}
      </section>

      {focusedListing && (
        <div className="market-focus-overlay" onClick={() => setFocusedListing(null)}>
          <div className="market-focus-overlay__card" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn--ghost market-focus-overlay__close" type="button" onClick={() => setFocusedListing(null)}>Close</button>
            <MarketListingCard listing={focusedListing} hasPaymentsAccess={hasPaymentsAccess} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketBrowseTab;
