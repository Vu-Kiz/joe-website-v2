import React, { useEffect, useMemo, useState } from "react";
import type { PaymentItem } from "../../api/payments";

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
      <h2>Owed To Me</h2>

      <div className="payments-toolbar">
        <label className="small payments-field payments-field--compact">
          <strong>Search</strong>
          <input
            className="input"
            type="search"
            placeholder="Search payer, source, tool, or status"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <label className="small payments-field payments-field--compact">
          <strong>Filter By</strong>
          <select className="input" value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
            <option value="all">Everything</option>
            <option value="payer">Payer</option>
            <option value="status">Status</option>
            <option value="tool">Tool</option>
          </select>
        </label>

        {filterBy !== "all" && (
          <label className="small payments-field payments-field--compact">
            <strong>Value</strong>
            <select className="input" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
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
          <label className="small payments-field payments-field--compact">
            <strong>Quick Reset</strong>
            <button
              className="btn"
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
        <p className="small payments-panel__meta">
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
        <div key={item.id} className="admin-card payments-card">
          <div className="payments-card__header payments-card__header--split">
            <div className="payments-card__title-block">
              <p className="small payments-card__eyebrow">Tool</p>
              <strong>{item.tool_key}</strong>
            </div>
            <span className="small payments-card__badge">{item.status}</span>
          </div>

          <div className="payments-meta-list">
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
        <div className="payments-pagination">
          <button className="btn" type="button" onClick={() => setPage((curr) => Math.max(1, curr - 1))} disabled={page === 1}>
            Previous
          </button>
          <p className="small payments-pagination__label">
            Page {page} of {totalPages}
          </p>
          <button className="btn" type="button" onClick={() => setPage((curr) => Math.min(totalPages, curr + 1))} disabled={page === totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default OwedPaymentsPanel;
