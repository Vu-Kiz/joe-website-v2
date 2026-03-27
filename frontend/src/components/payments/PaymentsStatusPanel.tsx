import React from "react";
import { Link } from "react-router-dom";
import { getBackendOrigin, type SwcUser } from "../../api/auth";
import type { SwcAuthorizationStatus } from "../../api/swcAuthorization";

type Props = {
  user?: SwcUser | null;
  swcAuth: SwcAuthorizationStatus | null;
};

const PaymentsStatusPanel: React.FC<Props> = ({ user, swcAuth }) => {
  function onLinkSwc() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;
    window.location.href = `${backendOrigin}/oauth`;
  }

  return (
    <div className="panel">
      <h2>SWC Credit Log Verification</h2>

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
        <p className="small">Payments access is not connected yet.</p>
      )}

      {!!user?.swc_character_id && swcAuth?.connected && (
        <>
          <p className="small">
            Personal payments access:{" "}
            {swcAuth.has_personal_credit_log_access ? "Yes" : "No"}
          </p>
          <p className="small">
            Faction payments access:{" "}
            {swcAuth.has_faction_credit_log_access ? "Yes" : "No"}
          </p>
          <p className="small">
            Faction payment controls:{" "}
            {swcAuth.has_character_privileges_access ? "Yes" : "No"}
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

      {!!user?.swc_character_id && (
        <Link className="btn" to="/aboutme">
          Manage SWC Access
        </Link>
      )}
    </div>
  );
};

export default PaymentsStatusPanel;
