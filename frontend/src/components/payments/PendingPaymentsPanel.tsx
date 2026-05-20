import React, { useEffect, useMemo, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factionPrivileges";
import type { PaymentItem, PaymentSubjectType } from "../../api/payments";
import type { PaymentGroup } from "./types";

type Props = {
  grouped: PaymentGroup[];
  payerFilter: "all" | "user" | "faction";
  selected: number[];
  selectedPayerContextKey: string | null;
  selectedPayerLabel: string | null;
  bulkLines: string;
  bulkUrl: string | null;
  privileges: FactionPrivilegeCheckResult[];
  privilegeGroup: string;
  privilegeName: string;
  onPayerFilterChange: (value: "all" | "user" | "faction") => void;
  onToggleItem: (id: number) => void;
  onToggleGroup: (ids: number[]) => void;
  onPayRecipient: (ids: number[], payerType: PaymentSubjectType) => Promise<void>;
  onBuildBulk: () => Promise<void>;
};

function numberFormat(value: number): string {
  return value.toLocaleString();
}

function sourceLabel(sourceType: string): string {
  switch (sourceType) {
    case "manual_template":
      return "Manual Template";
    case "job":
      return "Job";
    default:
      return sourceType.replace(/_/g, " ");
  }
}

const PendingPaymentsPanel: React.FC<Props> = ({
  grouped,
  payerFilter,
  selected,
  selectedPayerContextKey,
  selectedPayerLabel,
  bulkLines,
  bulkUrl,
  privileges,
  privilegeGroup,
  privilegeName,
  onPayerFilterChange,
  onToggleItem,
  onToggleGroup,
  onPayRecipient,
  onBuildBulk,
}) => {
  const [recipientFilter, setRecipientFilter] = useState("all");

  const recipientOptions = useMemo(
    () => Array.from(new Set(grouped.map((group) => group.payee).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [grouped]
  );

  const visibleGroups = useMemo(() => {
    if (recipientFilter === "all") {
      return grouped;
    }

    return grouped.filter((group) => group.payee === recipientFilter);
  }, [grouped, recipientFilter]);

  useEffect(() => {
    setRecipientFilter("all");
  }, [payerFilter]);

  return (
    <div className="panel">
      <h2>Pending</h2>

      <div className="payments-toolbar">
        <label className="small" htmlFor="payments-payer-filter">
          <strong>Show Payer Type</strong>
        </label>
        <select
          id="payments-payer-filter"
          className="input"
          value={payerFilter}
          onChange={(e) =>
            onPayerFilterChange(e.target.value as "all" | "user" | "faction")
          }
        >
          <option value="all">All pending payments</option>
          <option value="user">Personal only</option>
          <option value="faction">Faction only</option>
        </select>

        <label className="small payments-field payments-field--compact" htmlFor="payments-recipient-filter">
          <strong>Recipient</strong>
          <select
            id="payments-recipient-filter"
            className="input"
            value={recipientFilter}
            onChange={(e) => setRecipientFilter(e.target.value)}
          >
            <option value="all">All recipients</option>
            {recipientOptions.map((recipient) => (
              <option key={recipient} value={recipient}>
                {recipient}
              </option>
            ))}
          </select>
        </label>
      </div>

      {grouped.length > 0 && (
        <p className="small payments-panel__meta">
          Showing {visibleGroups.length} of {grouped.length} recipient group{grouped.length === 1 ? "" : "s"}.
        </p>
      )}

      {grouped.length === 0 && <p className="small">No pending payments.</p>}
      {grouped.length > 0 && visibleGroups.length === 0 && <p className="small">No pending payments matched that recipient.</p>}

      {visibleGroups.map((group) => {
        const groupIds = group.items.map((i) => i.id);
        const allGroupSelected = groupIds.every((id) => selected.includes(id));
        const groupPayerContextKey = `${group.payerType}:${group.payerSubjectId ?? ""}`;
        const factionPrivilege =
          group.payerType === "faction"
            ? privileges.find((f) => f.id === group.payerSubjectId)
            : null;

        const hasFactionPrivilege = !!factionPrivilege?.check?.allowed;
        const selectionLockedToAnotherPayer =
          !!selectedPayerContextKey && selectedPayerContextKey !== groupPayerContextKey;

        return (
          <div key={group.key} className="admin-card payments-card payments-card--group">
            <div className="payments-card__header payments-card__header--split">
              <div className="payments-card__title-block">
                <p className="small payments-card__eyebrow">Recipient</p>
                <strong>{group.payee}</strong>
              </div>
              <div className="payments-card__header-actions">
                <label className="small payments-select-all">
                  <input
                    type="checkbox"
                    checked={allGroupSelected}
                    disabled={selectionLockedToAnotherPayer}
                    onChange={() => onToggleGroup(groupIds)}
                  />
                  {" "}Select all
                </label>
                <span className="small payments-card__badge">
                  {group.payerType === "faction" ? "Faction Payment" : "Personal Payment"}
                </span>
              </div>
            </div>

            <div className="payments-meta-list">
              <p className="small">
                <strong>Payer:</strong> {group.payer}
              </p>
              <p className="small">
                <strong>Total queued:</strong> {numberFormat(group.total)}
              </p>
              <p className="small">
                <strong>Items:</strong> {group.items.length}
              </p>
            </div>

            {group.payerType === "faction" && (
              <p className="small payments-note">
                SWC privilege ({privilegeGroup}/{privilegeName}):{" "}
                {factionPrivilege?.check?.ok
                  ? factionPrivilege.check.allowed
                    ? "Allowed"
                    : "Denied"
                  : factionPrivilege?.check?.message ?? "Not checked"}
              </p>
            )}

            {group.payerType === "faction" && !hasFactionPrivilege && (
              <p className="small payments-note payments-note--warn">
                SWC faction privilege check did not currently show this action as allowed, but the backend will still validate on send.
              </p>
            )}

            <div className="payments-item-list">
              {group.items.map((item: PaymentItem) => (
                <label key={item.id} className="small payments-item-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    disabled={selectionLockedToAnotherPayer}
                    onChange={() => onToggleItem(item.id)}
                  />
                  <span>
                    #{item.id} {sourceLabel(item.source_type)} · {numberFormat(item.total_amount)}
                  </span>
                </label>
              ))}
            </div>

            {selectionLockedToAnotherPayer && (
              <p className="small payments-note">
                Bulk selection is currently locked to {selectedPayerLabel ?? "another payer"}.
                Finish or clear that selection before adding items from this payer.
              </p>
            )}

            <div className="payments-actions">
              <button
                className="btn"
                type="button"
                onClick={() => onPayRecipient(group.items.map((i) => i.id), group.payerType)}
              >
                Send Credits
              </button>
            </div>
          </div>
        );
      })}

      <div className="admin-card payments-card">
        <strong>Batch Payment</strong>
        <p className="small">
          Selected payments run from this site one recipient transfer at a time.
        </p>

        {selectedPayerLabel && (
          <p className="small payments-note">
            Current bulk payer: {selectedPayerLabel}
          </p>
        )}

        <div className="payments-actions">
          <button
            className="btn"
            type="button"
            onClick={onBuildBulk}
            disabled={selected.length === 0}
          >
            Run Batch Payment
          </button>

          {bulkUrl && (
            <a
              className="btn"
              href={bulkUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Combine Bulk Page
            </a>
          )}
        </div>

        {bulkLines && (
          <textarea
            className="input"
            readOnly
            value={bulkLines}
            style={{ minHeight: 220, width: "100%" }}
          />
        )}
      </div>
    </div>
  );
};

export default PendingPaymentsPanel;
