import React, { useEffect, useMemo, useState } from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factions/factionPrivileges";
import type { PaymentItem, PaymentSubjectType } from "../../api/payments/payments";
import type { PaymentGroup } from "./types";
import { BTN, INPUT } from "../../utils/ui";

const CARD_CLS = "flex flex-col gap-3 p-[0.9rem] rounded-[12px] border border-white/[0.08] bg-white/[0.03]";
const cardBadgeCls = (variant?: "ok" | "warn") =>
  "inline-flex items-center min-h-[28px] px-[0.65rem] py-1 rounded-full border font-bold" +
  (variant === "ok" ? " border-[rgba(107,201,137,0.35)] bg-[rgba(107,201,137,0.12)] text-[#8fe1a8]" :
   variant === "warn" ? " border-[rgba(255,155,50,0.35)] bg-[rgba(255,155,50,0.12)] text-[#ffbf73]" :
   " border-[rgba(245,213,70,0.28)] bg-[rgba(245,213,70,0.1)] text-[#f2c46f]");
const CARD_HEADER_SPLIT_CLS = "flex flex-row justify-between items-start gap-3 flex-wrap";
const CARD_TITLE_BLOCK_CLS = "flex flex-col gap-1";
const CARD_EYEBROW_CLS = "m-0 opacity-[0.72] uppercase tracking-[0.06em]";
const CARD_HEADER_ACTIONS_CLS = "flex flex-col items-end gap-[0.4rem]";
const SELECT_ALL_CLS = "flex items-center gap-[0.3rem] cursor-pointer opacity-[0.85]";
const META_LIST_CLS = "grid gap-[0.35rem] [&_p]:m-0";
const noteCls = (variant?: "warn") =>
  "m-0 p-[0.65rem_0.8rem] rounded-[10px] border border-white/[0.08] bg-white/[0.025]" +
  (variant === "warn" ? " !border-[rgba(255,120,120,0.28)] !bg-[rgba(255,120,120,0.08)] !text-[#ffb3b3]" : "");
const ACTIONS_CLS = "flex gap-2 flex-wrap mt-1";
const TOOLBAR_CLS = "flex gap-3 flex-wrap items-end mb-4";
const FIELD_CLS = "grid gap-[0.4rem]";
const FIELD_COMPACT_CLS = FIELD_CLS + " w-[min(100%,420px)]";
const ITEM_LIST_CLS = "grid gap-[0.45rem]";
const ITEM_ROW_CLS = "flex gap-[0.6rem] items-start p-[0.55rem_0.65rem] rounded-[10px] bg-[rgba(0,0,0,0.18)] border border-white/[0.05]";

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
      <h2 className="h2">Pending</h2>

      <div className={TOOLBAR_CLS}>
        <label className="small" htmlFor="payments-payer-filter">
          <strong>Show Payer Type</strong>
        </label>
        <select
          id="payments-payer-filter"
          className={INPUT}
          value={payerFilter}
          onChange={(e) =>
            onPayerFilterChange(e.target.value as "all" | "user" | "faction")
          }
        >
          <option value="all">All pending payments</option>
          <option value="user">Personal only</option>
          <option value="faction">Faction only</option>
        </select>

        <label className={"small " + FIELD_COMPACT_CLS} htmlFor="payments-recipient-filter">
          <strong>Recipient</strong>
          <select
            id="payments-recipient-filter"
            className={INPUT}
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
        <p className="small mb-4 opacity-[0.85]">
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
          <div key={group.key} className={CARD_CLS}>
            <div className={CARD_HEADER_SPLIT_CLS}>
              <div className={CARD_TITLE_BLOCK_CLS}>
                <p className={"small " + CARD_EYEBROW_CLS}>Recipient</p>
                <strong>{group.payee}</strong>
              </div>
              <div className={CARD_HEADER_ACTIONS_CLS}>
                <label className={"small " + SELECT_ALL_CLS}>
                  <input
                    type="checkbox"
                    checked={allGroupSelected}
                    disabled={selectionLockedToAnotherPayer}
                    onChange={() => onToggleGroup(groupIds)}
                  />
                  {" "}Select all
                </label>
                <span className={"small " + cardBadgeCls()}>
                  {group.payerType === "faction" ? "Faction Payment" : "Personal Payment"}
                </span>
              </div>
            </div>

            <div className={META_LIST_CLS}>
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
              <p className={"small " + noteCls()}>
                SWC privilege ({privilegeGroup}/{privilegeName}):{" "}
                {factionPrivilege?.check?.ok
                  ? factionPrivilege.check.allowed
                    ? "Allowed"
                    : "Denied"
                  : factionPrivilege?.check?.message ?? "Not checked"}
              </p>
            )}

            {group.payerType === "faction" && !hasFactionPrivilege && (
              <p className={"small " + noteCls("warn")}>
                SWC faction privilege check did not currently show this action as allowed, but the backend will still validate on send.
              </p>
            )}

            <div className={ITEM_LIST_CLS}>
              {group.items.map((item: PaymentItem) => (
                <label key={item.id} className={"small " + ITEM_ROW_CLS}>
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
              <p className={"small " + noteCls()}>
                Bulk selection is currently locked to {selectedPayerLabel ?? "another payer"}.
                Finish or clear that selection before adding items from this payer.
              </p>
            )}

            <div className={ACTIONS_CLS}>
              <button
                className={BTN}
                type="button"
                onClick={() => onPayRecipient(group.items.map((i) => i.id), group.payerType)}
              >
                Send Credits
              </button>
            </div>
          </div>
        );
      })}

      <div className={CARD_CLS}>
        <strong>Batch Payment</strong>
        <p className="small">
          Selected payments run from this site one recipient transfer at a time.
        </p>

        {selectedPayerLabel && (
          <p className={"small " + noteCls()}>
            Current bulk payer: {selectedPayerLabel}
          </p>
        )}

        <div className={ACTIONS_CLS}>
          <button
            className={BTN}
            type="button"
            onClick={onBuildBulk}
            disabled={selected.length === 0}
          >
            Run Batch Payment
          </button>

          {bulkUrl && (
            <a
              className={BTN}
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
            className={INPUT}
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
