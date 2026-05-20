import React from "react";
import type { RmMaterial } from "../../api/rmBrowser";
import RmBrowserResultRow from "./RmBrowserResultRow";
import Pagination from "../common/Pagination";

export type SortKey = "name" | "type" | "quantity" | "system" | "planet" | "sector" | "container" | "faction";
export type SortDir = "asc" | "desc";

type Props = {
  materials: RmMaterial[];
  loading: boolean;
  error: string | null;
  apiErrors: string[] | null;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
};

function getEntityValue(m: RmMaterial): Record<string, unknown> {
  const v = m.value;
  return (v && typeof v === "object") ? (v as Record<string, unknown>) : m;
}

function nestedStr(obj: unknown): string {
  if (!obj) return "";
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  const o = obj as Record<string, unknown>;
  if (typeof o.value === "string" || typeof o.value === "number") return String(o.value);
  return "";
}

function getValue(m: RmMaterial, key: SortKey): string | number {
  const v = getEntityValue(m);
  const loc = (v.location && typeof v.location === "object") ? (v.location as Record<string, unknown>) : {};
  switch (key) {
    case "name": return nestedStr(v.name).toLowerCase();
    case "type": return nestedStr(v.type).toLowerCase();
    case "quantity": return Number(v.quantity ?? 0);
    case "system": return nestedStr(loc.system).toLowerCase();
    case "planet": return nestedStr(loc.planet).toLowerCase();
    case "sector": return nestedStr(loc.sector).toLowerCase();
    case "container": return nestedStr(loc.container).toLowerCase();
    case "faction": return m._faction_label.toLowerCase();
    default: return "";
  }
}

const RmBrowserResultsTable: React.FC<Props> = ({
  materials,
  loading,
  error,
  apiErrors,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortKey,
  sortDir,
  onSort,
}) => {
  if (loading) {
    return <p className="rm-browser__status">Fetching materials…</p>;
  }

  if (error) {
    return <p className="rm-browser__status rm-browser__status--error">{error}</p>;
  }

  if (materials.length === 0) {
    return <p className="rm-browser__status">No results. Adjust filters and search.</p>;
  }

  const sorted = [...materials].sort((a, b) => {
    const va = getValue(a, sortKey);
    const vb = getValue(b, sortKey);
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const start = (page - 1) * pageSize;
  const pageMaterials = sorted.slice(start, start + pageSize);

  function headerCell(key: SortKey, label: string) {
    const isSorted = sortKey === key;
    return (
      <th
        key={label}
        className={`rm-browser__th rm-browser__th--sortable${isSorted ? " is-sorted" : ""}`}
        onClick={() => onSort(key)}
      >
        {label}
        {isSorted && <span className="rm-browser__sort-arrow">{sortDir === "asc" ? " ▲" : " ▼"}</span>}
      </th>
    );
  }

  return (
    <div className="rm-browser__results">
      {apiErrors && apiErrors.length > 0 && (
        <div className="rm-browser__api-errors">
          {apiErrors.map((e, i) => (
            <p key={i} className="rm-browser__status rm-browser__status--warn">{e}</p>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={materials.length}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[25, 50, 100, 200]}
      />

      <div className="rm-browser__table-wrap">
        <table className="rm-browser__table">
          <thead>
            <tr>
              {headerCell("name", "Name")}
              {headerCell("type", "Type")}
              {headerCell("quantity", "Qty")}
              {headerCell("system", "System")}
              {headerCell("planet", "Planet")}
              {headerCell("sector", "Sector")}
              {headerCell("container", "Container")}
              {headerCell("faction", "Faction")}
            </tr>
          </thead>
          <tbody>
            {pageMaterials.map((m) => (
              <RmBrowserResultRow key={(getEntityValue(m).uid as string | undefined) ?? `${m._faction_uid}-${String(getEntityValue(m).name)}`} material={m} />
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={materials.length}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[25, 50, 100, 200]}
        showPageSize={false}
      />
    </div>
  );
};

export default RmBrowserResultsTable;
