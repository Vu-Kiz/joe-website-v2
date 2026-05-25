import React, { useEffect, useMemo, useState } from "react";
import type { PaymentItem } from "../../api/payments/payments";
import { BTN, INPUT, SELECT_INPUT } from "../../utils/ui";

const CARD_CLS = "flex flex-col gap-3 p-[0.9rem] rounded-[12px] border border-white/[0.08] bg-white/[0.03]";
const cardBadgeCls = (variant?: "ok" | "warn") =>
  "inline-flex items-center min-h-[28px] px-[0.65rem] py-1 rounded-full border font-bold" +
  (variant === "ok" ? " border-[rgba(107,201,137,0.35)] bg-[rgba(107,201,137,0.12)] text-[#8fe1a8]" :
   variant === "warn" ? " border-[rgba(255,155,50,0.35)] bg-[rgba(255,155,50,0.12)] text-[#ffbf73]" :
   " border-[rgba(245,213,70,0.28)] bg-[rgba(245,213,70,0.1)] text-[#f2c46f]");
const CARD_HEADER_SPLIT_CLS = "flex flex-row justify-between items-start gap-3 flex-wrap";
const CARD_TITLE_BLOCK_CLS = "flex flex-col gap-1";
const CARD_EYEBROW_CLS = "m-0 opacity-[0.72] uppercase tracking-[0.06em]";
const META_LIST_CLS = "grid gap-[0.35rem] [&_p]:m-0";
const TOOLBAR_CLS = "flex gap-3 flex-wrap items-end mb-4";
const FIELD_CLS = "grid gap-[0.4rem]";
const FIELD_COMPACT_CLS = FIELD_CLS + " w-[min(100%,420px)]";
const PAGINATION_CLS = "flex gap-3 items-center justify-start flex-wrap mt-4";
const PAGINATION_LABEL_CLS = "m-0 min-w-[88px]";

type Props = {
  items: PaymentItem[];
};

const OwedPaymentsPanel: React.FC<Props> = ({ items }) => {
  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [filterValue, setFilterValue] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const payerOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.payer_label ?? "-"))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const toolOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.tool_key).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const activeFilterOptions = useMemo(() => {
    switch (filterBy) {
      case "payer":
        return payerOptions;
      case "status":
        return statusOptions;
      case "tool":
        return toolOptions;
      default:
        return [];
    }
  }, [filterBy, payerOptions, statusOptions, toolOptions]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filterBy !== "all" && filterValue !== "all") {
        const currentValue =
          filterBy === "payer"
            ? item.payer_label ?? "-"
            : filterBy === "status"
              ? item.status
              : item.tool_key;

        if (currentValue !== filterValue) {
          return false;
        }
      }

      const haystack = [
        item.tool_key,
        item.source_type,
        String(item.source_id),
        item.payer_label,
        item.status,
        item.payee_handle,
        item.payee_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return needle ? haystack.includes(needle) : true;
    });
  }, [filterBy, filterValue, items, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterBy, filterValue, query]);

  useEffect(() => {
    setFilterValue("all");
  }, [filterBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="panel">
      <h2 className="h2">Owed To Me</h2>

      <div className={TOOLBAR_CLS}>
        <label className={"small " + FIELD_COMPACT_CLS}>
          <strong>Search</strong>
          <input
            className={INPUT + " rounded-full pl-4"}
            type="search"
            placeholder="Search payer, source, tool, or status"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <label className={"small " + FIELD_COMPACT_CLS}>
          <strong>Filter By</strong>
          <select className={SELECT_INPUT} value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
            <option value="all">Everything</option>
            <option value="payer">Payer</option>
            <option value="status">Status</option>
            <option value="tool">Tool</option>
          </select>
        </label>

        {filterBy !== "all" && (
          <label className={"small " + FIELD_COMPACT_CLS}>
            <strong>Value</strong>
            <select className={SELECT_INPUT} value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
              <option value="all">All {filterBy}s</option>
              {activeFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        {(query || filterBy !== "all" || filterValue !== "all") && (
          <label className={"small " + FIELD_COMPACT_CLS}>
            <strong>Quick Reset</strong>
            <button
              className={BTN}
              type="button"
              onClick={() => {
                setQuery("");
                setFilterBy("all");
                setFilterValue("all");
              }}
            >
              Clear Filters
            </button>
          </label>
        )}
      </div>

      {items.length > 0 && (
        <p className="small mb-4 opacity-[0.85]">
          Showing {pagedItems.length} of {filteredItems.length} owed item{filteredItems.length === 1 ? "" : "s"}.
        </p>
      )}

      {items.length === 0 && (
        <p className="small">Nothing is currently owed to you.</p>
      )}

      {items.length > 0 && pagedItems.length === 0 && (
        <p className="small">No owed items matched your search.</p>
      )}

      {pagedItems.map((item) => (
        <div key={item.id} className={CARD_CLS}>
          <div className={CARD_HEADER_SPLIT_CLS}>
            <div className={CARD_TITLE_BLOCK_CLS}>
              <p className={"small " + CARD_EYEBROW_CLS}>Tool</p>
              <strong>{item.tool_key}</strong>
            </div>
            <span className={"small " + cardBadgeCls()}>{item.status}</span>
          </div>

          <div className={META_LIST_CLS}>
            <p className="small">
              <strong>Source:</strong> {item.source_type} #{item.source_id}
            </p>
            <p className="small">
              <strong>Payer:</strong> {item.payer_label ?? "-"}
            </p>
            <p className="small">
              <strong>Total:</strong> {item.total_amount.toLocaleString()}
            </p>
          </div>
        </div>
      ))}

      {filteredItems.length > pageSize && (
        <div className={PAGINATION_CLS}>
          <button className={BTN} type="button" onClick={() => setPage((curr) => Math.max(1, curr - 1))} disabled={page === 1}>
            Previous
          </button>
          <p className={"small " + PAGINATION_LABEL_CLS}>
            Page {page} of {totalPages}
          </p>
          <button className={BTN} type="button" onClick={() => setPage((curr) => Math.min(totalPages, curr + 1))} disabled={page === totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default OwedPaymentsPanel;
