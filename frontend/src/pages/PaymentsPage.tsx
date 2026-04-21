import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/auth";
import {
  buildBulkPayment,
  buildSinglePayment,
  getDroidBrainPaymentSettings,
  getPaymentTransfers,
  getPayments,
  getPaymentsOwedToMe,
  getUnverifiedSupportTransfers,
  manualVerifyPaymentTransfer,
  pullCreditLog,
  updateDroidBrainPaymentSettings,
  verifyPaymentTransfer,
  type PaymentItem,
  type PaymentTransfer,
  type PullCreditLogResponse,
} from "../api/payments";
import {
  createManualPaymentTemplate,
  deleteManualPaymentTemplate,
  generateManualPaymentTemplate,
  getManualPaymentTemplateOptions,
  getManualPaymentTemplates,
  toggleManualPaymentTemplate,
  type ManualPaymentTemplate,
  type ManualPaymentTemplateFormPayload,
  type ManualPaymentTemplateOptionsResponse,
} from "../api/manualPayments";
import {
  getSwcAuthorizationStatus,
  type SwcAuthorizationStatus,
} from "../api/swcAuthorization";
import {
  getMyFactionPrivileges,
  type FactionPrivilegeCheckResult,
} from "../api/factionPrivileges";
import { logMemberToolOpen } from "../api/memberTools";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import PaymentsNav from "../components/payments/PaymentsNav";
import PaymentsStatusPanel from "../components/payments/PaymentsStatusPanel";
import PendingPaymentsPanel from "../components/payments/PendingPaymentsPanel";
import OwedPaymentsPanel from "../components/payments/OwedPaymentsPanel";
import PaymentHistoryPanel from "../components/payments/PaymentHistoryPanel";
import PaymentsTemplatesPanel from "../components/payments/PaymentsTemplatesPanel";
import DroidBrainPaymentsPanel from "../components/payments/DroidBrainPaymentsPanel";
import type { PaymentGroup, PaymentsActionState, PaymentsView } from "../components/payments/types";
import { canAccessPayments } from "../auth/permissions";

import "../styles/main.sass";
import "../styles/_admin.sass";

const privilegeGroup = "finance";
const privilegeName = "send_credits";
type PendingPayerFilter = "all" | "user" | "faction";

const PaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [pendingItems, setPendingItems] = useState<PaymentItem[]>([]);
  const [owedItems, setOwedItems] = useState<PaymentItem[]>([]);
  const [transfers, setTransfers] = useState<PaymentTransfer[]>([]);
  const [supportTransfers, setSupportTransfers] = useState<PaymentTransfer[]>([]);
  const [supportTransfersError, setSupportTransfersError] = useState<string | null>(null);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [privileges, setPrivileges] = useState<FactionPrivilegeCheckResult[]>([]);
  const [templates, setTemplates] = useState<ManualPaymentTemplate[]>([]);
  const [templateOptions, setTemplateOptions] = useState<ManualPaymentTemplateOptionsResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PaymentsView>("pending");
  const [pendingPayerFilter, setPendingPayerFilter] = useState<PendingPayerFilter>("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkLines, setBulkLines] = useState("");
  const [bulkUrl, setBulkUrl] = useState<string | null>(null);
  const [pullCreditLogLoading, setPullCreditLogLoading] = useState(false);
  const [templatesWorking, setTemplatesWorking] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<PullCreditLogResponse["data"] | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [actionState, setActionState] = useState<PaymentsActionState>({
    working: false,
    message: null,
    error: null,
  });
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
  const [droidBrainSettings, setDroidBrainSettings] = useState<{
    default_payer_faction_id: number | null;
    payer_options: Array<{
      id: number;
      name: string;
      swc_uid: string | null;
      abbreviation: string | null;
    }>;
  } | null>(null);
  const [droidBrainSettingsWorking, setDroidBrainSettingsWorking] = useState(false);

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

  const filteredGrouped = useMemo(() => {
    if (pendingPayerFilter === "all") {
      return grouped;
    }

    return grouped.filter((group) => group.payerType === pendingPayerFilter);
  }, [grouped, pendingPayerFilter]);

  const selectedPayerContext = useMemo(() => {
    if (selected.length === 0) {
      return null;
    }

    const selectedItems = pendingItems.filter((item) => selected.includes(item.id));
    const first = selectedItems[0];

    if (!first) {
      return null;
    }

    return {
      key: `${first.payer_subject_type}:${first.payer_subject_id ?? ""}`,
      label: first.payer_label ?? (first.payer_subject_type === "faction" ? "Faction" : "Personal"),
    };
  }, [pendingItems, selected]);

  useEffect(() => {
    setBulkLines("");
    setBulkUrl(null);
  }, [selected]);

  useEffect(() => {
    setSelected([]);
  }, [pendingPayerFilter]);

  useEffect(() => {
    return subscribeToAuthStateChange(() => {
      setAuthRefreshNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (!user || !canAccessPayments(user)) {
      return;
    }

    void logMemberToolOpen("payments", "/payments").catch(() => {});
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const authRes = await fetchAuthMe();
        const currentUser = authRes?.user ?? null;

        if (cancelled) return;

        setUser(currentUser);

        if (!currentUser) {
          setSwcAuth(null);
          setPendingItems([]);
          setOwedItems([]);
          setTransfers([]);
          setSupportTransfers([]);
          setSupportTransfersError(null);
          setPrivileges([]);
          setTemplates([]);
          setTemplateOptions(null);
          setDroidBrainSettings(null);
          return;
        }

        if (!currentUser.is_joe_member) {
          setSwcAuth(null);
          setPendingItems([]);
          setOwedItems([]);
          setTransfers([]);
          setSupportTransfers([]);
          setSupportTransfersError(null);
          setPrivileges([]);
          setTemplates([]);
          setTemplateOptions(null);
          setDroidBrainSettings(null);
          return;
        }

        const [
          swcAuthRes,
          pendingRes,
          owedRes,
          transferRes,
          privilegeRes,
          templatesRes,
          templateOptionsRes,
          supportTransferRes,
          droidBrainSettingsRes,
        ] = await Promise.all([
          getSwcAuthorizationStatus(),
          getPayments(),
          getPaymentsOwedToMe(),
          getPaymentTransfers(),
          getMyFactionPrivileges(privilegeGroup, privilegeName),
          getManualPaymentTemplates(),
          getManualPaymentTemplateOptions(),
          currentUser?.is_sysadmin
            ? getUnverifiedSupportTransfers().catch((e: any) => ({
                ok: false as const,
                data: [] as PaymentTransfer[],
                message: String(e?.message ?? "Failed to load the unverified support queue."),
              }))
            : Promise.resolve({ ok: true as const, data: [] as PaymentTransfer[] }),
          currentUser?.is_sysadmin ? getDroidBrainPaymentSettings() : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setSwcAuth(swcAuthRes?.data ?? null);
        setPendingItems(pendingRes?.data ?? []);
        setOwedItems(owedRes?.data ?? []);
        setTransfers(transferRes?.data ?? []);
        setSupportTransfers(supportTransferRes?.data ?? []);
        setSupportTransfersError("message" in supportTransferRes ? supportTransferRes.message : null);
        setPrivileges(privilegeRes?.data ?? []);
        setTemplates(templatesRes?.data ?? []);
        setTemplateOptions(templateOptionsRes?.data ?? null);
        setDroidBrainSettings(
          droidBrainSettingsRes
            ? {
                default_payer_faction_id: droidBrainSettingsRes.data.settings.default_payer_faction_id,
                payer_options: droidBrainSettingsRes.data.payer_options ?? [],
              }
            : null
        );
      } catch (e: any) {
        if (cancelled) return;

        setError(e?.message ?? "Failed to load payments");
        setUser(null);
        setSwcAuth(null);
        setPendingItems([]);
        setOwedItems([]);
        setTransfers([]);
        setSupportTransfers([]);
        setSupportTransfersError(null);
        setPrivileges([]);
        setTemplates([]);
        setTemplateOptions(null);
        setDroidBrainSettings(null);
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
  }, [authRefreshNonce]);

  function clearActionState() {
    setActionState({
      working: false,
      message: null,
      error: null,
    });
  }

  function normalizeVerifyError(message: string): string {
    if (/timed out|expired|reconnect|not connected|401/i.test(message)) {
      return "Your Chain Code Verification for payments has timed out. Please use Resync Chain Code Verification and try again.";
    }

    if (/could not confirm this payment|no matching swc credit log transaction/i.test(message)) {
      return "We could not confirm this payment from SWC yet. Try SWC Sync again in a moment. If you have already confirmed it in SWC, a sysadmin can override it with the SWC transaction ID.";
    }

    return message;
  }

  function toggleItem(id: number) {
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  }

  function dismissLastSync() {
    setLastSyncResult(null);
    setLastSyncAt(null);
  }

  async function reloadPayments() {
    const [swcAuthRes, pendingRes, owedRes, transferRes, privilegeRes, templatesRes, templateOptionsRes, supportTransferRes] =
      await Promise.all([
        getSwcAuthorizationStatus(),
        getPayments(),
        getPaymentsOwedToMe(),
        getPaymentTransfers(),
        getMyFactionPrivileges(privilegeGroup, privilegeName),
        getManualPaymentTemplates(),
        getManualPaymentTemplateOptions(),
        user?.is_sysadmin
          ? getUnverifiedSupportTransfers().catch((e: any) => ({
              ok: false as const,
              data: [] as PaymentTransfer[],
              message: String(e?.message ?? "Failed to load the unverified support queue."),
            }))
          : Promise.resolve({ ok: true as const, data: [] as PaymentTransfer[] }),
      ]);

    setSwcAuth(swcAuthRes.data);
    setPendingItems(pendingRes.data);
    setOwedItems(owedRes.data);
    setTransfers(transferRes.data);
    setSupportTransfers(supportTransferRes.data);
    setSupportTransfersError("message" in supportTransferRes ? supportTransferRes.message : null);
    setPrivileges(privilegeRes.data);
    setTemplates(templatesRes.data);
    setTemplateOptions(templateOptionsRes.data);
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
        error: normalizeVerifyError(String(e?.message ?? "Failed to verify transfer")),
      });
    }
  }

  async function onManualVerifyTransfer(transfer: PaymentTransfer) {
    const transactionInput = window.prompt(
      "Optional: enter the SWC transaction ID if you have it. Leave blank if this payment has already fallen off the SWC log.",
      transfer.verified_transaction_id ? String(transfer.verified_transaction_id) : ""
    );

    if (transactionInput === null) {
      return;
    }

    const trimmedTransaction = transactionInput.trim();

    const transactionId =
      trimmedTransaction === ""
        ? null
        : Number(trimmedTransaction);

    if (transactionId !== null && (!Number.isFinite(transactionId) || transactionId <= 0)) {
      setActionState({
        working: false,
        message: null,
        error: "SWC transaction ID must be a positive number.",
      });
      return;
    }

    const note = window.prompt(
      "Add a short note explaining why this sysadmin manual verification is being used.",
      transfer.reference
        ? `Verified manually after falling outside the SWC log window for ${transfer.reference}`
        : "Verified manually after falling outside the SWC log window"
    );

    if (note === null) {
      return;
    }

    const trimmedNote = note.trim();

    if (trimmedNote === "") {
      setActionState({
        working: false,
        message: null,
        error: "A short note is required for manual verification.",
      });
      return;
    }

    try {
      setActionState({
        working: true,
        message: "Saving sysadmin verification override…",
        error: null,
      });

      const res = await manualVerifyPaymentTransfer(transfer.id, {
        swc_transaction_id: transactionId,
        note: trimmedNote,
      });

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
        error: String(e?.message ?? "Failed to save the sysadmin verification override."),
      });
    }
  }

  async function onPullCreditLog() {
    try {
      setPullCreditLogLoading(true);
      setActionState({
        working: true,
        message: "Pulling SWC credit log…",
        error: null,
      });

      const res = await pullCreditLog();
      await reloadPayments();
      setLastSyncResult(res.data);
      setLastSyncAt(new Date().toLocaleString());

      setActionState({
        working: false,
        message: `SWC payment sync complete. ${res.data.message}`,
        error: null,
      });
    } catch (e: any) {
      const message = String(e?.message ?? "Failed to pull SWC credit log.");
      const statusCode = Number(e?.status ?? 0);
      const isReconnectStatus = statusCode === 401 || statusCode === 403 || statusCode === 422;
      const normalizedMessage =
        isReconnectStatus || /timed out|expired|reconnect|not connected|unauthenticated|forbidden/i.test(message)
          ? "Your Chain Code Verification for payments has timed out. Please reconnect it and try again."
          : message;

      setActionState({
        working: false,
        message: null,
        error: normalizedMessage,
      });
    } finally {
      setPullCreditLogLoading(false);
    }
  }

  async function onCreateTemplate(payload: ManualPaymentTemplateFormPayload) {
    try {
      setTemplatesWorking(true);
      setActionState({
        working: true,
        message: "Creating manual payment template…",
        error: null,
      });

      await createManualPaymentTemplate({
        ...payload,
        payee_user_id: payload.payee_subject_id,
      });
      await reloadPayments();

      setActionState({
        working: false,
        message: "Manual payment template created.",
        error: null,
      });
    } catch (e: any) {
      setActionState({
        working: false,
        message: null,
        error: e?.message ?? "Failed to create manual payment template.",
      });
    } finally {
      setTemplatesWorking(false);
    }
  }

  async function onToggleTemplate(id: number) {
    try {
      setTemplatesWorking(true);
      setActionState({
        working: true,
        message: "Updating template status…",
        error: null,
      });

      await toggleManualPaymentTemplate(id);
      await reloadPayments();

      setActionState({
        working: false,
        message: "Template status updated.",
        error: null,
      });
    } catch (e: any) {
      setActionState({
        working: false,
        message: null,
        error: e?.message ?? "Failed to update template status.",
      });
    } finally {
      setTemplatesWorking(false);
    }
  }

  async function onGenerateTemplate(id: number) {
    try {
      setTemplatesWorking(true);
      setActionState({
        working: true,
        message: "Generating manual payment…",
        error: null,
      });

      const res = await generateManualPaymentTemplate(id);
      await reloadPayments();

      setActionState({
        working: false,
        message: res.data.payment_item
          ? `Manual payment generated as pending item #${res.data.payment_item.id}.`
          : "No payment item was created for that template.",
        error: null,
      });
    } catch (e: any) {
      setActionState({
        working: false,
        message: null,
        error: e?.message ?? "Failed to generate manual payment.",
      });
    } finally {
      setTemplatesWorking(false);
    }
  }

  async function onDeleteTemplate(id: number) {
    try {
      setTemplatesWorking(true);
      setActionState({
        working: true,
        message: "Deleting template…",
        error: null,
      });

      await deleteManualPaymentTemplate(id);
      await reloadPayments();

      setActionState({
        working: false,
        message: "Template deleted.",
        error: null,
      });
    } catch (e: any) {
      setActionState({
        working: false,
        message: null,
        error: e?.message ?? "Failed to delete template.",
      });
    } finally {
      setTemplatesWorking(false);
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

  if (!user?.is_joe_member) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <ForbiddenState
              title="403 Forbidden"
              message="You do not have permission to access payments."
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
          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => navigate("/members")}>
              Back to Overview
            </button>
          </div>
          <p className="small">
            Transfers are tracked locally and can be resynced against SWC credit logs for
            live payment verification by transfer reference, amount, and recipient.
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

          <PaymentsStatusPanel
            user={user}
            swcAuth={swcAuth}
            onPullCreditLog={onPullCreditLog}
            onDismissLastSync={dismissLastSync}
            pullCreditLogLoading={pullCreditLogLoading}
            lastSyncResult={lastSyncResult}
            lastSyncAt={lastSyncAt}
          />

          <PaymentsNav
            activeView={activeView}
            onChange={setActiveView}
            showDroidBrain={!!user?.is_sysadmin}
          />

          {activeView === "pending" && (
            <PendingPaymentsPanel
              grouped={filteredGrouped}
              payerFilter={pendingPayerFilter}
              selected={selected}
              selectedPayerContextKey={selectedPayerContext?.key ?? null}
              selectedPayerLabel={selectedPayerContext?.label ?? null}
              bulkLines={bulkLines}
              bulkUrl={bulkUrl}
              swcAuth={swcAuth}
              privileges={privileges}
              privilegeGroup={privilegeGroup}
              privilegeName={privilegeName}
              onPayerFilterChange={setPendingPayerFilter}
              onToggleItem={toggleItem}
              onPayRecipient={onPayRecipient}
              onBuildBulk={onBuildBulk}
            />
          )}

          {activeView === "owed" && <OwedPaymentsPanel items={owedItems} />}

          {activeView === "history" && (
            <>
              <PaymentHistoryPanel
                canManualVerify={!!user?.is_sysadmin}
                transfers={transfers}
                onVerifyTransfer={onVerifyTransfer}
                onManualVerifyTransfer={onManualVerifyTransfer}
              />

              {user?.is_sysadmin && (
                <>
                  {supportTransfersError ? (
                    <div className="panel">
                      <h2>Unverified Support Queue</h2>
                      <p className="small" style={{ color: "salmon" }}>
                        Support queue is temporarily unavailable: {supportTransfersError}
                      </p>
                    </div>
                  ) : null}
                  <PaymentHistoryPanel
                    title="Unverified Support Queue"
                    intro="Use this queue to help members when a transfer exists in SWC but normal verification did not complete."
                    emptyMessage="No unverified transfers need sysadmin attention right now."
                    allowSwcVerify={false}
                    canManualVerify={true}
                    showPayer={true}
                    transfers={supportTransfers}
                    onVerifyTransfer={onVerifyTransfer}
                    onManualVerifyTransfer={onManualVerifyTransfer}
                  />
                </>
              )}
            </>
          )}

          {activeView === "templates" && (
            <PaymentsTemplatesPanel
              templates={templates}
              options={templateOptions}
              onCreateTemplate={onCreateTemplate}
              onToggleTemplate={onToggleTemplate}
              onGenerateTemplate={onGenerateTemplate}
              onDeleteTemplate={onDeleteTemplate}
              working={templatesWorking}
            />
          )}

          {activeView === "droidbrain" && user?.is_sysadmin && droidBrainSettings && (
            <DroidBrainPaymentsPanel
              defaultPayerFactionId={droidBrainSettings.default_payer_faction_id}
              payerOptions={droidBrainSettings.payer_options}
              working={droidBrainSettingsWorking}
              onSave={async (defaultPayerFactionId) => {
                try {
                  setDroidBrainSettingsWorking(true);
                  const response = await updateDroidBrainPaymentSettings({
                    default_payer_faction_id: defaultPayerFactionId,
                  });
                  setDroidBrainSettings((current) =>
                    current
                      ? {
                          ...current,
                          default_payer_faction_id: response.data.default_payer_faction_id,
                        }
                      : current
                  );
                  setActionState({
                    working: false,
                    message: "DroidBrain payment defaults saved.",
                    error: null,
                  });
                } catch (e: any) {
                  setActionState({
                    working: false,
                    message: null,
                    error: e?.message ?? "Failed to save DroidBrain payment defaults.",
                  });
                } finally {
                  setDroidBrainSettingsWorking(false);
                }
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default PaymentsPage;
