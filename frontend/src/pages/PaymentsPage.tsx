import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthMe, type SwcUser } from "../api/auth";
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
import PaymentsNav from "../components/payments/PaymentsNav";
import PaymentsStatusPanel from "../components/payments/PaymentsStatusPanel";
import PendingPaymentsPanel from "../components/payments/PendingPaymentsPanel";
import OwedPaymentsPanel from "../components/payments/OwedPaymentsPanel";
import PaymentHistoryPanel from "../components/payments/PaymentHistoryPanel";
import type { PaymentGroup, PaymentsActionState, PaymentsView } from "../components/payments/types";

import "../styles/main.sass";
import "../styles/_admin.sass";

const privilegeGroup = "finance";
const privilegeName = "pay";

const PaymentsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [pendingItems, setPendingItems] = useState<PaymentItem[]>([]);
  const [owedItems, setOwedItems] = useState<PaymentItem[]>([]);
  const [transfers, setTransfers] = useState<PaymentTransfer[]>([]);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [privileges, setPrivileges] = useState<FactionPrivilegeCheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PaymentsView>("pending");
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkLines, setBulkLines] = useState("");
  const [bulkUrl, setBulkUrl] = useState<string | null>(null);
  const [actionState, setActionState] = useState<PaymentsActionState>({
    working: false,
    message: null,
    error: null,
  });

  const isLoggedIn = !!user;

  const grouped = useMemo<PaymentGroup[]>(() => {
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [
          authRes,
          swcAuthRes,
          pendingRes,
          owedRes,
          transferRes,
          privilegeRes,
        ] = await Promise.all([
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
      } catch (e: any) {
        if (cancelled) return;

        setError(e?.message ?? "Failed to load payments");
        setUser(null);
        setSwcAuth(null);
        setPendingItems([]);
        setOwedItems([]);
        setTransfers([]);
        setPrivileges([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function clearActionState() {
    setActionState({
      working: false,
      message: null,
      error: null,
    });
  }

  function toggleItem(id: number) {
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
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

  async function onPayRecipient(ids: number[]) {
    try {
      setActionState({
        working: true,
        message: "Opening payment link…",
        error: null,
      });

      const res = await buildSinglePayment(ids);
      window.open(res.data.url, "_blank", "noopener,noreferrer");

      await reloadPayments();

      setActionState({
        working: false,
        message: "Payment link opened.",
        error: null,
      });
    } catch (e: any) {
      setActionState({
        working: false,
        message: null,
        error: e?.message ?? "Failed to build single payment",
      });
    }
  }

  async function onBuildBulk() {
    if (selected.length === 0) return;

    try {
      setActionState({
        working: true,
        message: "Building bulk payment lines…",
        error: null,
      });

      const res = await buildBulkPayment(selected);
      setBulkLines(res.data.pipe_lines);
      setBulkUrl(res.data.bulk_page_url);

      if (res.data.pipe_lines) {
        await navigator.clipboard.writeText(res.data.pipe_lines);
      }

      await reloadPayments();

      setActionState({
        working: false,
        message: "Bulk payment lines copied to clipboard.",
        error: null,
      });
    } catch (e: any) {
      setActionState({
        working: false,
        message: null,
        error: e?.message ?? "Failed to build bulk payment",
      });
    }
  }

  async function onVerifyTransfer(id: number) {
    try {
      setActionState({
        working: true,
        message: "Checking credit log…",
        error: null,
      });

      const res = await verifyPaymentTransfer(id);
      await reloadPayments();

      setActionState({
        working: false,
        message: res.data.message,
        error: null,
      });
    } catch (e: any) {
      setActionState({
        working: false,
        message: null,
        error: e?.message ?? "Failed to verify transfer",
      });
    }
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
            Transfers are tracked locally and verified against SWC credit log by
            reference, amount and recipient.
          </p>

          {(actionState.message || actionState.error) && (
            <div className="panel">
              {actionState.message && (
                <p className="small">{actionState.message}</p>
              )}

              {actionState.error && (
                <p className="small" style={{ color: "salmon" }}>
                  {actionState.error}
                </p>
              )}

              <button className="btn" type="button" onClick={clearActionState}>
                Clear
              </button>
            </div>
          )}

          <PaymentsStatusPanel swcAuth={swcAuth} />

          <PaymentsNav activeView={activeView} onChange={setActiveView} />

          {activeView === "pending" && (
            <PendingPaymentsPanel
              grouped={grouped}
              selected={selected}
              bulkLines={bulkLines}
              bulkUrl={bulkUrl}
              swcAuth={swcAuth}
              privileges={privileges}
              privilegeGroup={privilegeGroup}
              privilegeName={privilegeName}
              onToggleItem={toggleItem}
              onPayRecipient={onPayRecipient}
              onBuildBulk={onBuildBulk}
            />
          )}

          {activeView === "owed" && <OwedPaymentsPanel items={owedItems} />}

          {activeView === "history" && (
            <PaymentHistoryPanel
              transfers={transfers}
              onVerifyTransfer={onVerifyTransfer}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default PaymentsPage;