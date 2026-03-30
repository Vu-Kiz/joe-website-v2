import React, { useEffect, useMemo, useState } from "react";
import type { PaymentTransfer } from "../../api/payments";

type Props = {
  allowSwcVerify?: boolean;
  canManualVerify: boolean;
  emptyMessage?: string;
  intro?: string | null;
  showPayer?: boolean;
  title?: string;
  transfers: PaymentTransfer[];
  onVerifyTransfer: (id: number) => Promise<void>;
  onManualVerifyTransfer: (transfer: PaymentTransfer) => Promise<void>;
};

const PaymentHistoryPanel: React.FC<Props> = ({
  allowSwcVerify = true,
  canManualVerify,
  emptyMessage = "No transfer history yet.",
  intro = null,
  showPayer = false,
  title = "History",
  transfers,
  onVerifyTransfer,
  onManualVerifyTransfer,
}) => {
  const getManualVerificationNote = (transfer: PaymentTransfer): string | null => {
    const manualVerification = transfer.meta?.manual_verification;

    if (!manualVerification || typeof manualVerification !== "object") {
      return null;
    }

    const note = (manualVerification as Record<string, unknown>).note;
    return typeof note === "string" && note.trim() ? note.trim() : null;
  };

  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [filterValue, setFilterValue] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const recipientOptions = useMemo(
    () => Array.from(new Set(transfers.map((transfer) => transfer.payee_handle ?? transfer.payee_label ?? "Unknown"))).sort((a, b) => a.localeCompare(b)),
    [transfers]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(transfers.map((transfer) => transfer.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [transfers]
  );

  const methodOptions = useMemo(
    () => Array.from(new Set(transfers.map((transfer) => transfer.payment_method).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [transfers]
  );

  const activeFilterOptions = useMemo(() => {
    switch (filterBy) {
      case "recipient":
        return recipientOptions;
      case "status":
        return statusOptions;
      case "method":
        return methodOptions;
      default:
        return [];
    }
  }, [filterBy, methodOptions, recipientOptions, statusOptions]);

  const statusTone = (status: string) => {
    if (status === "verified" || status === "paid") return "#8fe1a8";
    if (status === "opened") return "#ffbf73";
    return "#d4d4d4";
  };

  const filteredTransfers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return transfers.filter((transfer) => {
      const recipient = transfer.payee_handle ?? transfer.payee_label ?? "Unknown";
      const payer = transfer.payer_label ?? "Unknown";

      if (filterBy !== "all" && filterValue !== "all") {
        const currentValue =
          filterBy === "recipient"
            ? recipient
            : filterBy === "status"
              ? transfer.status
              : transfer.payment_method;

        if (currentValue !== filterValue) {
          return false;
        }
      }

      const haystack = [
        transfer.payee_handle ?? transfer.payee_label ?? "Unknown",
        recipient,
        payer,
        transfer.reference,
        transfer.payment_method,
        transfer.status,
        transfer.communication,
        transfer.verified_transaction_id ? String(transfer.verified_transaction_id) : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return needle ? haystack.includes(needle) : true;
    });
  }, [filterBy, filterValue, query, transfers]);

  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / pageSize));
  const pagedTransfers = filteredTransfers.slice((page - 1) * pageSize, page * pageSize);

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
      <h2>{title}</h2>

      {intro && <p className="small payments-panel__intro">{intro}</p>}

      <div className="payments-toolbar">
        <label className="small payments-field payments-field--compact">
          <strong>Search</strong>
          <input
            className="input"
            type="search"
            placeholder="Search recipient, reference, method, or communication"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <label className="small payments-field payments-field--compact">
          <strong>Filter By</strong>
          <select className="input" value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
            <option value="all">Everything</option>
            <option value="recipient">Recipient</option>
            <option value="status">Status</option>
            <option value="method">Method</option>
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

      {transfers.length > 0 && (
        <p className="small payments-panel__meta">
          Showing {pagedTransfers.length} of {filteredTransfers.length} transfer{filteredTransfers.length === 1 ? "" : "s"}.
        </p>
      )}

      {transfers.length === 0 && (
        <p className="small">{emptyMessage}</p>
      )}

      {transfers.length > 0 && pagedTransfers.length === 0 && (
        <p className="small">No transfer history matched your search.</p>
      )}

      {pagedTransfers.map((transfer) => (
        <div key={transfer.id} className="admin-card payments-card payments-card--history">
          {(() => {
            const manualVerificationNote = getManualVerificationNote(transfer);

            return (
              <>
          <div className="payments-card__header payments-card__header--split">
            <div className="payments-card__title-block">
              <p className="small payments-card__eyebrow">Recipient</p>
              <strong>{transfer.payee_handle ?? transfer.payee_label ?? "Unknown"}</strong>
            </div>
            <strong className="payments-card__status" style={{ color: statusTone(transfer.status) }}>
              {transfer.status}
            </strong>
          </div>

          <div className="payments-meta-list">
            {showPayer && (
              <p className="small">
                <strong>Payer:</strong> {transfer.payer_label ?? "Unknown"}
              </p>
            )}
            <p className="small">
              <strong>Ref:</strong> {transfer.reference}
            </p>
            <p className="small">
              <strong>Total:</strong> {transfer.total_amount.toLocaleString()}
            </p>
            <p className="small">
              <strong>Method:</strong> {transfer.payment_method}
            </p>
            {manualVerificationNote ? (
              <p className="small">
                <strong>Admin note:</strong> {manualVerificationNote}
              </p>
            ) : (
              <p className="small">
                <strong>SWC sync:</strong> {transfer.verified_transaction_id ? "Verified" : "Awaiting verification"}
              </p>
            )}
          </div>

          {transfer.communication && (
            <p className="small payments-note">Communication: {transfer.communication}</p>
          )}

          {transfer.verified_transaction_id && (
            <p className="small payments-note">
              Verified SWC transaction: {transfer.verified_transaction_id}
            </p>
          )}

          {transfer.status !== "verified" && transfer.status !== "paid" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {allowSwcVerify && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => onVerifyTransfer(transfer.id)}
                >
                  Verify via SWC Sync
                </button>
              )}

              {canManualVerify && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => onManualVerifyTransfer(transfer)}
                >
                  Mark Verified Manually
                </button>
              )}
            </div>
          )}
              </>
            );
          })()}
        </div>
      ))}

      {filteredTransfers.length > pageSize && (
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

export default PaymentHistoryPanel;
