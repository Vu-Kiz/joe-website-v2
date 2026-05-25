import React from "react";
import type { RmMaterial } from "../../api/universe/rmBrowser";
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
    return <p className="text-center opacity-50 py-8 text-[0.85rem]">Fetching materials…</p>;
  }

  if (error) {
    return <p className="text-center py-8 text-[0.85rem] text-[salmon]">{error}</p>;
  }

  if (materials.length === 0) {
    return <p className="text-center opacity-50 py-8 text-[0.85rem]">No results. Adjust filters and search.</p>;
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
        className={`px-3 py-2 text-left font-medium whitespace-nowrap select-none cursor-pointer border-b border-white/[0.08] ${isSorted ? "opacity-100 text-[#ffc107]" : "opacity-60 hover:opacity-90"}`}
        onClick={() => onSort(key)}
      >
        {label}
        {isSorted && <span className="text-[0.7rem] ml-[2px]">{sortDir === "asc" ? " ▲" : " ▼"}</span>}
      </th>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {apiErrors && apiErrors.length > 0 && (
        <div className="mb-3">
          {apiErrors.map((e, i) => (
            <p key={i} className="text-center py-8 text-[0.85rem] text-[#ffc107]">{e}</p>
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

      <div className="overflow-x-auto border border-white/[0.08] rounded-[6px]">
        <table className="w-full border-collapse text-[0.82rem]">
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
