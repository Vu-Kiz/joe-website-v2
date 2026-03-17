import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAuthMe,
  getBackendOrigin,
  type SwcUser,
} from "../api/auth";
import {
  buildBulkPayment,
  buildSinglePayment,
  getPaymentTransfers,
  getPayments,
  getPaymentsOwedToMe,
  verifyPaymentTransfer,
  type PaymentItem,
  type PaymentTransfer,
} from "../api/payments";
import {
  getSwcAuthorizationStatus,
  type SwcAuthorizationStatus,
} from "../api/swcAuthorization";
import {
  getMyFactionPrivileges,
  type FactionPrivilegeCheckResult,
} from "../api/factionPrivileges";
import NotLoggedInState from "../components/common/NotLoggedInState";
import PaymentsNav, { type PaymentsView } from "../components/payments/PaymentsNav";

import "../styles/main.sass";
import "../styles/_admin.sass";

const PaymentsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [pendingItems, setPendingItems] = useState<PaymentItem[]>([]);
  const [owedItems, setOwedItems] = useState<PaymentItem[]>([]);
  const [transfers, setTransfers] = useState<PaymentTransfer[]>([]);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PaymentsView>("pending");
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkLines, setBulkLines] = useState("");
  const [bulkUrl, setBulkUrl] = useState<string | null>(null);
  const [privileges, setPrivileges] = useState<FactionPrivilegeCheckResult[]>([]);

  const privilegeGroup = "finance";
  const privilegeName = "pay";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [authRes, swcAuthRes, pendingRes, owedRes, transferRes, privilegeRes] =
          await Promise.all([
            fetchAuthMe(),
            getSwcAuthorizationStatus(),
            getPayments(),
            getPaymentsOwedToMe(),
            getPaymentTransfers(),
            getMyFactionPrivileges(privilegeGroup, privilegeName),
          ]);

        if (cancelled) return;

        setUser(authRes?.user ?? null);
        setSwcAuth(swcAuthRes?.data ?? null);
        setPendingItems(pendingRes?.data ?? []);
        setOwedItems(owedRes?.data ?? []);
        setTransfers(transferRes?.data ?? []);
        setPrivileges(privilegeRes?.data ?? []);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load payments");
          setUser(null);
          setSwcAuth(null);
          setPendingItems([]);
          setOwedItems([]);
          setTransfers([]);
          setPrivileges([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoggedIn = !!user;

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentItem[]>();

    for (const item of pendingItems) {
      const key = [
        item.payer_subject_type,
        item.payer_subject_id,
        item.payee_subject_id,
        item.payee_handle,
      ].join(":");

      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }

    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      items,
      total: items.reduce((sum, item) => sum + item.total_amount, 0),
      payee: items[0]?.payee_handle ?? "Unknown",
      payer: items[0]?.payer_label ?? "Unknown",
      payerType: items[0]?.payer_subject_type ?? "user",
      payerSubjectId: items[0]?.payer_subject_id ?? null,
    }));
  }, [pendingItems]);

  useEffect(() => {
    setBulkLines("");
    setBulkUrl(null);
  }, [selected]);

  function toggleItem(id: number) {
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  }

  function onConnectCreditLog() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;
    window.location.href = `${backendOrigin}/oauth/creditlog`;
  }

  async function reloadPayments() {
    const [swcAuthRes, pendingRes, owedRes, transferRes, privilegeRes] =
      await Promise.all([
        getSwcAuthorizationStatus(),
        getPayments(),
        getPaymentsOwedToMe(),
        getPaymentTransfers(),
        getMyFactionPrivileges(privilegeGroup, privilegeName),
      ]);

    setSwcAuth(swcAuthRes.data);
    setPendingItems(pendingRes.data);
    setOwedItems(owedRes.data);
    setTransfers(transferRes.data);
    setPrivileges(privilegeRes.data);
  }

  async function onBuildSingle(ids: number[]) {
    const res = await buildSinglePayment(ids);
    window.open(res.data.url, "_blank", "noopener,noreferrer");
    await reloadPayments();
  }

  async function onBuildBulk() {
    if (selected.length === 0) return;

    const res = await buildBulkPayment(selected);
    setBulkLines(res.data.pipe_lines);
    setBulkUrl(res.data.bulk_page_url);
    await navigator.clipboard.writeText(res.data.pipe_lines);
    await reloadPayments();
  }

  async function onVerifyTransfer(id: number) {
    const res = await verifyPaymentTransfer(id);
    alert(res.data.message);
    await reloadPayments();
  }

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Payments</h1>
            <p className="small">Loading payments…</p>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Payments</h1>
            <p className="small" style={{ color: "salmon" }}>
              {error}
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <NotLoggedInState
              title="Not logged in"
              message="You need to sign in to access payments."
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board admin-board">
          <h1>Payments</h1>
          <p className="small">
            Transfers are tracked locally and verified against SWC credit log by reference, amount and recipient.
          </p>

          <div className="panel">
            <h2>SWC Credit Log Verification</h2>

            {!swcAuth?.connected && (
              <p className="small">SWC credit log access is not connected yet.</p>
            )}

            {swcAuth?.connected && (
              <>
                <p className="small">
                  Personal credit log access:{" "}
                  {swcAuth.has_personal_credit_log_access ? "Connected" : "Missing"}
                </p>
                <p className="small">
                  Faction credit log access:{" "}
                  {swcAuth.has_faction_credit_log_access ? "Connected" : "Missing"}
                </p>
                <p className="small">
                  Character privileges access:{" "}
                  {swcAuth.has_character_privileges_access ? "Connected" : "Missing"}
                </p>
              </>
            )}

            <button className="btn" type="button" onClick={onConnectCreditLog}>
              Connect Credit Log Access
            </button>
          </div>

          <PaymentsNav activeView={activeView} onChange={setActiveView} />

          {activeView === "pending" && (
            <div className="panel">
              <h2>Pending</h2>

              {grouped.length === 0 && (
                <p className="small">No pending payments.</p>
              )}

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
                      Payer: {group.payer} · Total:{" "}
                      {group.total.toLocaleString()}
                    </p>
                    <p className="small">
                      Payment source:{" "}
                      {group.payerType === "faction" ? "Faction" : "Personal"}
                    </p>

                    {group.payerType === "user" &&
                      !swcAuth?.has_personal_credit_log_access && (
                        <p className="small">
                          This payment can still be made, but it will not auto-verify until personal credit log access is connected.
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

                    {group.items.map((item) => (
                      <label
                        key={item.id}
                        className="small"
                        style={{ display: "flex", gap: 8 }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                        <span>
                          #{item.id} {item.source_type} ·{" "}
                          {item.total_amount.toLocaleString()}
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
                        onClick={() =>
                          onBuildSingle(group.items.map((i) => i.id))
                        }
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
                <p className="small">
                  Bulk payments must use one payer context at a time.
                </p>

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
          )}

          {activeView === "owed" && (
            <div className="panel">
              <h2>Owed To Me</h2>

              {owedItems.length === 0 && (
                <p className="small">Nothing is currently owed to you.</p>
              )}

              {owedItems.map((item) => (
                <div
                  key={item.id}
                  className="admin-card"
                  style={{ marginBottom: 12 }}
                >
                  <strong>{item.tool_key}</strong>
                  <p className="small">
                    Source: {item.source_type} #{item.source_id}
                  </p>
                  <p className="small">
                    Payer: {item.payer_label ?? "-"} · Total:{" "}
                    {item.total_amount.toLocaleString()} · Status: {item.status}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeView === "history" && (
            <div className="panel">
              <h2>History</h2>

              {transfers.length === 0 && (
                <p className="small">No transfer history yet.</p>
              )}

              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="admin-card"
                  style={{ marginBottom: 12 }}
                >
                  <strong>{transfer.payee_handle}</strong>
                  <p className="small">
                    Ref: {transfer.reference} · Total:{" "}
                    {transfer.total_amount.toLocaleString()}
                  </p>
                  <p className="small">
                    Method: {transfer.payment_method} · Status: {transfer.status}
                  </p>
                  {transfer.verified_transaction_id && (
                    <p className="small">
                      Verified SWC transaction: {transfer.verified_transaction_id}
                    </p>
                  )}

                  {transfer.status !== "verified" && transfer.status !== "paid" && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => onVerifyTransfer(transfer.id)}
                    >
                      Verify in Credit Log
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PaymentsPage;