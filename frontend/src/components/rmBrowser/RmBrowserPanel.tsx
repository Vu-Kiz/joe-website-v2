import React, { useState } from "react";
import { searchRmMaterials, type RmMaterial } from "../../api/rmBrowser";
import RmBrowserFilterBar, { type RmBrowserFilters } from "./RmBrowserFilterBar";
import RmBrowserResultsTable from "./RmBrowserResultsTable";

import type { SortKey, SortDir } from "./RmBrowserResultsTable";

const DEFAULT_FILTERS: RmBrowserFilters = {
  factions: ["1376", "1791", "1796"],
  sectorUid: null,
  systemUid: null,
  typeUid: null,
};

const RmBrowserPanel: React.FC = () => {
  const [filters, setFilters] = useState<RmBrowserFilters>(DEFAULT_FILTERS);
  const [materials, setMaterials] = useState<RmMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiErrors, setApiErrors] = useState<string[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function handleSearch() {
    if (filters.factions.length === 0) return;

    setLoading(true);
    setError(null);
    setApiErrors(null);
    setPage(1);

    try {
      const res = await searchRmMaterials({
        factions: filters.factions,
        sector_uid: filters.sectorUid,
        system_uid: filters.systemUid,
        type_uid: filters.typeUid,
      });

      if (!res.ok) {
        setError("Search failed. Check the service account configuration.");
        setMaterials([]);
      } else {
        setMaterials(res.data);
        setApiErrors(res.errors);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setMaterials([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <div className="rm-browser">
      <div className="rm-browser__header">
        <h1 className="rm-browser__title">RM Browser</h1>
        <p className="small rm-browser__subtitle">
          Browse raw materials across JOE, GARRY, and RAID faction inventories.
          {hasSearched && materials.length > 0 && (
            <> &mdash; <strong>{materials.length.toLocaleString()}</strong> results</>
          )}
        </p>
      </div>

      <RmBrowserFilterBar
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        loading={loading}
      />

      {(hasSearched || loading) && (
        <RmBrowserResultsTable
          materials={materials}
          loading={loading}
          error={error}
          apiErrors={apiErrors}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      {!hasSearched && !loading && (
        <p className="rm-browser__status">Select factions and apply filters, then hit Search.</p>
      )}
    </div>
  );
};

export default RmBrowserPanel;
