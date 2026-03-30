import React from "react";
import { getBackendOrigin, type SwcUser } from "../../api/auth";
import type { SwcAuthorizationStatus } from "../../api/swcAuthorization";
import type { PullCreditLogResponse } from "../../api/payments";

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
      <h2>SWC Payment Sync</h2>

      <p className="small payments-panel__intro">
        Keep local payment history aligned with SWC and verify transfers by reference, amount, and recipient.
      </p>

      {!user?.swc_character_id && (
        <>
          <p className="small">
            Link your SWC account before connecting credit log access.
          </p>
          <button className="btn" type="button" onClick={onLinkSwc}>
            Link SWC Account
          </button>
        </>
      )}

      {!!user?.swc_character_id && !swcAuth?.connected && (
        <div className="admin-card payments-card">
          <strong>Access Needed</strong>
          <p className="small">
            Payments access is not connected yet. Connect Chain Code Verification to enable sync and verification.
          </p>
        </div>
      )}

      {lastSyncResult && (
        <div className="admin-card payments-card">
          <strong>Latest SWC Sync</strong>

          <p className="small">
            {lastSyncResult.message}
          </p>

          <div className="payments-grid payments-grid--metrics">
            <div className="admin-card payments-card payments-card--metric">
              <p className="small payments-card__eyebrow">Verified</p>
              <strong>{lastSyncResult.verified}</strong>
            </div>
            <div className="admin-card payments-card payments-card--metric">
              <p className="small payments-card__eyebrow">Already Verified</p>
              <strong>{lastSyncResult.already_verified}</strong>
            </div>
            <div className="admin-card payments-card payments-card--metric">
              <p className="small payments-card__eyebrow">Unmatched</p>
              <strong>{lastSyncResult.unmatched}</strong>
            </div>
            <div className="admin-card payments-card payments-card--metric">
              <p className="small payments-card__eyebrow">Errors</p>
              <strong>{lastSyncResult.errors}</strong>
            </div>
          </div>

          <p className="small payments-panel__meta">
            Contexts loaded: {lastSyncResult.contexts_loaded} · Transfers processed: {lastSyncResult.processed}
          </p>

          {lastSyncAt && (
            <p className="small">Last synced: {lastSyncAt}</p>
          )}

          {lastSyncResult.failures.length > 0 && (
            <div className="payments-sync-list">
              <strong>Sync Failures</strong>
              {lastSyncResult.failures.map((failure) => (
                <div
                  key={`${failure.transfer_id}-${failure.reference}-${failure.context}`}
                  className="payments-sync-alert"
                >
                  <div className="payments-sync-alert__header">
                    <div className="payments-sync-alert__title-block">
                      <strong>Sync Error</strong>
                      <p className="small">Transfer #{failure.transfer_id}</p>
                    </div>
                    {extractSwcStatus(failure.error) && (
                      <span className="payments-card__badge is-warn">
                        SWC {extractSwcStatus(failure.error)}
                      </span>
                    )}
                  </div>

                  <div className="payments-sync-alert__meta">
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

                  <div className="payments-sync-alert__message">
                    <p className="small">
                      {formatSyncFailure(failure.error)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lastSyncResult.matches.length > 0 && (
            <details className="payments-details">
              <summary className="small">Verified Matches</summary>
              <div className="payments-sync-list">
                {lastSyncResult.matches.map((match) => (
                  <div
                    key={`${match.transfer_id}-${match.transaction_id}-${match.context}`}
                    className="payments-note"
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

          <div className="payments-actions">
            <button className="btn" type="button" onClick={onDismissLastSync}>
              Close
            </button>
          </div>
        </div>
      )}

      {!!user?.swc_character_id && (
        <div className="payments-actions">
          <button
            className="btn"
            type="button"
            onClick={onPullCreditLog}
            disabled={pullCreditLogLoading}
          >
            {pullCreditLogLoading ? "Resyncing..." : "Resync SWC Payments"}
          </button>

          <button className="btn" type="button" onClick={onResyncSwcAccess}>
            Resync Chain Code Verification
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentsStatusPanel;
