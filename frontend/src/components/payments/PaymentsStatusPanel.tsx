import React from "react";
import { getBackendOrigin, type SwcUser } from "../../api/core/auth";
import type { SwcAuthorizationStatus } from "../../api/members/swcAuthorization";
import type { PullCreditLogResponse } from "../../api/payments/payments";
import { BTN } from "../../utils/ui";

const CARD_CLS = "flex flex-col gap-3 p-[0.9rem] rounded-[12px] border border-white/[0.08] bg-white/[0.03]";
const cardBadgeCls = (variant?: "ok" | "warn") =>
  "inline-flex items-center min-h-[28px] px-[0.65rem] py-1 rounded-full border font-bold" +
  (variant === "ok" ? " border-[rgba(107,201,137,0.35)] bg-[rgba(107,201,137,0.12)] text-[#8fe1a8]" :
   variant === "warn" ? " border-[rgba(255,155,50,0.35)] bg-[rgba(255,155,50,0.12)] text-[#ffbf73]" :
   " border-[rgba(245,213,70,0.28)] bg-[rgba(245,213,70,0.1)] text-[#f2c46f]");
const noteCls = (variant?: "warn") =>
  "m-0 p-[0.65rem_0.8rem] rounded-[10px] border border-white/[0.08] bg-white/[0.025]" +
  (variant === "warn" ? " !border-[rgba(255,120,120,0.28)] !bg-[rgba(255,120,120,0.08)] !text-[#ffb3b3]" : "");
const ACTIONS_CLS = "flex gap-2 flex-wrap mt-1";
const GRID_METRICS_CLS = "grid gap-3 my-4 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]";
const CARD_EYEBROW_CLS = "m-0 opacity-[0.72] uppercase tracking-[0.06em]";
const SYNC_LIST_CLS = "grid gap-3 mt-3";
const SYNC_ALERT_CLS = "grid gap-[0.8rem] p-[0.85rem] rounded-[12px] border border-[rgba(255,120,120,0.28)] bg-[linear-gradient(180deg,rgba(60,18,18,0.55),rgba(36,12,12,0.72))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const SYNC_ALERT_HEADER_CLS = "flex justify-between items-start gap-3 flex-wrap";
const SYNC_ALERT_TITLE_BLOCK_CLS = "grid gap-[0.2rem] [&_strong]:text-[#ffb3b3] [&_p]:m-0";
const SYNC_ALERT_META_CLS = "grid [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-[0.6rem] [&_p]:m-0 [&_p]:p-[0.55rem_0.65rem] [&_p]:rounded-[10px] [&_p]:bg-[rgba(0,0,0,0.18)] [&_p]:border [&_p]:border-white/[0.06] [&_p]:grid [&_p]:gap-[0.2rem] [&_strong]:text-white/[0.58] [&_strong]:uppercase [&_strong]:tracking-[0.05em] [&_strong]:text-[0.76rem]";
const SYNC_ALERT_MESSAGE_CLS = "p-[0.7rem_0.8rem] rounded-[10px] border border-[rgba(255,120,120,0.2)] bg-[rgba(0,0,0,0.18)] [&_p]:m-0 [&_p]:text-[#ffd4d4]";

type Props = {
  user?: SwcUser | null;
  swcAuth: SwcAuthorizationStatus | null;
  onPullCreditLog: () => Promise<void>;
  onDismissLastSync: () => void;
  pullCreditLogLoading: boolean;
  lastSyncResult?: PullCreditLogResponse["data"] | null;
  lastSyncAt?: string | null;
};

const PaymentsStatusPanel: React.FC<Props> = ({
  user,
  swcAuth,
  onPullCreditLog,
  onDismissLastSync,
  pullCreditLogLoading,
  lastSyncResult,
  lastSyncAt,
}) => {
  function formatSyncFailure(error?: string): string {
    const message = String(error ?? "").trim();

    if (!message) {
      return "Unknown sync failure.";
    }

    const statusMatch = message.match(/SWC status\s+(\d{3})/i);
    const status = statusMatch ? Number(statusMatch[1]) : null;

    if (status === 401) {
      return "SWC returned 401. Your Chain Code Verification has expired or logged out. Please use Resync Chain Code Verification and then try the payment sync again.";
    }

    if (status === 403) {
      return "SWC returned 403. Your current Chain Code Verification does not have permission for this credit-log request. Please resync Chain Code Verification and try again.";
    }

    if (status === 404) {
      return "SWC returned 404 for this credit-log request. Please resync Chain Code Verification and try again. If it keeps happening, the payer context may need checking.";
    }

    if (status !== null) {
      return `SWC returned ${status}. Please try Resync Chain Code Verification and then run the payment sync again.`;
    }

    return message;
  }

  function extractSwcStatus(error?: string): string | null {
    const message = String(error ?? "").trim();
    const statusMatch = message.match(/SWC status\s+(\d{3})/i);

    return statusMatch ? statusMatch[1] : null;
  }

  function onLinkSwc() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;
    window.location.href = `${backendOrigin}/oauth`;
  }

  function onResyncSwcAccess() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;

    const savedPreferences = swcAuth?.member_tool_preferences;
    const selectedTools = [
      savedPreferences?.galaxy !== false ? "galaxy" : null,
      savedPreferences?.payments !== false ? "payments" : null,
    ].filter((value): value is string => value !== null);

    const query = new URLSearchParams({
      return_to: "/payments",
      ...(selectedTools.length > 0 ? { tools: selectedTools.join(",") } : {}),
    });

    window.location.href = `${backendOrigin}/oauth/member-tools?${query.toString()}`;
  }

  return (
    <div className="panel">
      <h2 className="h2">SWC Payment Sync</h2>

      <p className="small mb-4 max-w-[68ch]">
        Keep local payment history aligned with SWC and verify transfers by reference, amount, and recipient.
      </p>

      {swcAuth?.connected && (!swcAuth?.has_character_credits_write_access || !swcAuth?.has_faction_credits_write_access) && (
        <p className={"small " + noteCls("warn")}>
          Direct website credit sending needs `character_credits_write` and `faction_credits_write` scopes. Use Resync Chain Code Verification to refresh payment scopes.
        </p>
      )}

      {!user?.swc_character_id && (
        <>
          <p className="small">
            Link your SWC account before connecting credit log access.
          </p>
          <button className={BTN} type="button" onClick={onLinkSwc}>
            Link SWC Account
          </button>
        </>
      )}

      {!!user?.swc_character_id && !swcAuth?.connected && (
        <div className={CARD_CLS}>
          <strong>Access Needed</strong>
          <p className="small">
            Payments access is not connected yet. Connect Chain Code Verification to enable sync and verification.
          </p>
        </div>
      )}

      {lastSyncResult && (
        <div className={CARD_CLS}>
          <strong>Latest SWC Sync</strong>

          <p className="small">
            {lastSyncResult.message}
          </p>

          <div className={GRID_METRICS_CLS}>
            <div className={CARD_CLS}>
              <p className={"small " + CARD_EYEBROW_CLS}>Verified</p>
              <strong>{lastSyncResult.verified}</strong>
            </div>
            <div className={CARD_CLS}>
              <p className={"small " + CARD_EYEBROW_CLS}>Already Verified</p>
              <strong>{lastSyncResult.already_verified}</strong>
            </div>
            <div className={CARD_CLS}>
              <p className={"small " + CARD_EYEBROW_CLS}>Unmatched</p>
              <strong>{lastSyncResult.unmatched}</strong>
            </div>
            <div className={CARD_CLS}>
              <p className={"small " + CARD_EYEBROW_CLS}>Errors</p>
              <strong>{lastSyncResult.errors}</strong>
            </div>
          </div>

          <p className="small mb-4 opacity-[0.85]">
            Contexts loaded: {lastSyncResult.contexts_loaded} · Transfers processed: {lastSyncResult.processed}
          </p>

          {lastSyncAt && (
            <p className="small">Last synced: {lastSyncAt}</p>
          )}

          {lastSyncResult.failures.length > 0 && (
            <div className={SYNC_LIST_CLS}>
              <strong>Sync Failures</strong>
              {lastSyncResult.failures.map((failure) => (
                <div
                  key={`${failure.transfer_id}-${failure.reference}-${failure.context}`}
                  className={SYNC_ALERT_CLS}
                >
                  <div className={SYNC_ALERT_HEADER_CLS}>
                    <div className={SYNC_ALERT_TITLE_BLOCK_CLS}>
                      <strong>Sync Error</strong>
                      <p className="small">Transfer #{failure.transfer_id}</p>
                    </div>
                    {extractSwcStatus(failure.error) && (
                      <span className={"small " + cardBadgeCls("warn")}>
                        SWC {extractSwcStatus(failure.error)}
                      </span>
                    )}
                  </div>

                  <div className={SYNC_ALERT_META_CLS}>
                    <p className="small">
                      <strong>Reference</strong>
                      <span>{failure.reference}</span>
                    </p>
                    <p className="small">
                      <strong>Context</strong>
                      <span>{failure.context}</span>
                    </p>
                    {failure.payee ? (
                      <p className="small">
                        <strong>Payee</strong>
                        <span>{failure.payee}</span>
                      </p>
                    ) : null}
                    {typeof failure.amount === "number" ? (
                      <p className="small">
                        <strong>Amount</strong>
                        <span>{failure.amount.toLocaleString()}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className={SYNC_ALERT_MESSAGE_CLS}>
                    <p className="small">
                      {formatSyncFailure(failure.error)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lastSyncResult.matches.length > 0 && (
            <details className="mt-3 [&_summary]:cursor-pointer">
              <summary className="small">Verified Matches</summary>
              <div className={SYNC_LIST_CLS}>
                {lastSyncResult.matches.map((match) => (
                  <div
                    key={`${match.transfer_id}-${match.transaction_id}-${match.context}`}
                    className={noteCls()}
                  >
                    <p className="small">
                      <strong>Transfer:</strong> #{match.transfer_id} · <strong>Ref:</strong> {match.reference}
                    </p>
                    <p className="small">
                      <strong>Transaction:</strong> {match.transaction_id} · <strong>Context:</strong> {match.context}
                    </p>
                    {match.payee ? (
                      <p className="small">
                        <strong>Payee:</strong> {match.payee}
                      </p>
                    ) : null}
                    <p className="small">
                      <strong>Amount:</strong> {match.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className={ACTIONS_CLS}>
            <button className={BTN} type="button" onClick={onDismissLastSync}>
              Close
            </button>
          </div>
        </div>
      )}

      {!!user?.swc_character_id && (
        <div className={ACTIONS_CLS}>
          <button
            className={BTN}
            type="button"
            onClick={onPullCreditLog}
            disabled={pullCreditLogLoading}
          >
            {pullCreditLogLoading ? "Resyncing..." : "Resync SWC Payments"}
          </button>

          <button className={BTN} type="button" onClick={onResyncSwcAccess}>
            Resync Chain Code Verification
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentsStatusPanel;
