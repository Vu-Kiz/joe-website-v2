import React from "react";
import { getBackendOrigin } from "../../api/auth";
import type { SwcAuthorizationStatus } from "../../api/swcAuthorization";

type Props = {
  swcAuth: SwcAuthorizationStatus | null;
};

const PaymentsStatusPanel: React.FC<Props> = ({ swcAuth }) => {
  function onConnectCreditLog() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;
    window.location.href = `${backendOrigin}/oauth/creditlog`;
  }

  return (
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

          <details style={{ marginTop: 8 }}>
            <summary className="small">Auth Diagnostics</summary>
            <div style={{ marginTop: 8 }}>
              <p className="small">Connected: {swcAuth.connected ? "Yes" : "No"}</p>
              <p className="small">
                Granted scopes: {swcAuth.granted_scopes ?? "None"}
              </p>
              <p className="small">
                Token expires at: {swcAuth.token_expires_at ?? "Unknown"}
              </p>
            </div>
          </details>
        </>
      )}

      <button className="btn" type="button" onClick={onConnectCreditLog}>
        Connect Credit Log Access
      </button>
    </div>
  );
};

export default PaymentsStatusPanel;