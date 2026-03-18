import React from "react";
import type { FactionPrivilegeCheckResult } from "../../api/factionPrivileges";
import type { PaymentItem } from "../../api/payments";
import type { SwcAuthorizationStatus } from "../../api/swcAuthorization";
import type { PaymentGroup } from "./types";

type Props = {
  grouped: PaymentGroup[];
  selected: number[];
  bulkLines: string;
  bulkUrl: string | null;
  swcAuth: SwcAuthorizationStatus | null;
  privileges: FactionPrivilegeCheckResult[];
  privilegeGroup: string;
  privilegeName: string;
  onToggleItem: (id: number) => void;
  onPayRecipient: (ids: number[]) => Promise<void>;
  onBuildBulk: () => Promise<void>;
};

function numberFormat(value: number): string {
  return value.toLocaleString();
}

const PendingPaymentsPanel: React.FC<Props> = ({
  grouped,
  selected,
  bulkLines,
  bulkUrl,
  swcAuth,
  privileges,
  privilegeGroup,
  privilegeName,
  onToggleItem,
  onPayRecipient,
  onBuildBulk,
}) => {
  return (
    <div className="panel">
      <h2>Pending</h2>

      {grouped.length === 0 && <p className="small">No pending payments.</p>}

      {grouped.map((group) => {
        const factionPrivilege =
          group.payerType === "faction"
            ? privileges.find((f) => f.id === group.payerSubjectId)
            : null;

        const hasFactionPrivilege = !!factionPrivilege?.check?.allowed;
        const canPayPersonally = group.payerType === "user";

        const canPayAsFaction =
          group.payerType === "faction" &&
          !!swcAuth?.has_faction_credit_log_access &&
          !!swcAuth?.has_character_privileges_access &&
          hasFactionPrivilege;

        const canPay = canPayPersonally || canPayAsFaction;

        return (
          <div
            key={group.key}
            className="admin-card"
            style={{ marginBottom: 12 }}
          >
            <strong>{group.payee}</strong>

            <p className="small">
              Payer: {group.payer} · Total: {numberFormat(group.total)}
            </p>

            <p className="small">
              Payment source: {group.payerType === "faction" ? "Faction" : "Personal"}
            </p>

            {group.payerType === "user" &&
              !swcAuth?.has_personal_credit_log_access && (
                <p className="small">
                  This payment can still be made, but it will not auto-verify until
                  personal credit log access is connected.
                </p>
              )}

            {group.payerType === "faction" && (
              <>
                <p className="small">
                  SWC faction privilege ({privilegeGroup}/{privilegeName}):{" "}
                  {factionPrivilege?.check?.ok
                    ? factionPrivilege.check.allowed
                      ? "Allowed"
                      : "Denied"
                    : factionPrivilege?.check?.message ?? "Not checked"}
                </p>

                {!canPay && (
                  <p className="small" style={{ color: "salmon" }}>
                    {!swcAuth?.has_faction_credit_log_access
                      ? "Faction credit log access is required before paying as this faction."
                      : !swcAuth?.has_character_privileges_access
                      ? "Character privileges access is required before paying as this faction."
                      : !hasFactionPrivilege
                      ? "SWC faction privilege check did not allow this action."
                      : "Faction payment is not available."}
                  </p>
                )}
              </>
            )}

            {group.items.map((item: PaymentItem) => (
              <label
                key={item.id}
                className="small"
                style={{ display: "flex", gap: 8, marginBottom: 4 }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => onToggleItem(item.id)}
                />
                <span>
                  #{item.id} {item.source_type} · {numberFormat(item.total_amount)}
                </span>
              </label>
            ))}

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn"
                type="button"
                onClick={() => onPayRecipient(group.items.map((i) => i.id))}
                disabled={!canPay}
              >
                Pay Recipient
              </button>
            </div>
          </div>
        );
      })}

      <div className="admin-card">
        <strong>Bulk Payment</strong>
        <p className="small">Bulk payments must use one payer context at a time.</p>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn"
            type="button"
            onClick={onBuildBulk}
            disabled={selected.length === 0}
          >
            Copy Bulk Payment Lines
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
            style={{ minHeight: 220, marginTop: 12, width: "100%" }}
          />
        )}
      </div>
    </div>
  );
};

export default PendingPaymentsPanel;