import React, { useState } from "react";
import { createPortal } from "react-dom";
import { apiLogout, getBackendOrigin } from "../../api/core/auth";
import { BTN } from "../../utils/ui";

const SwcLinkRequiredState: React.FC = () => {
  const [loggingOut, setLoggingOut] = useState(false);
  const oauthUrl = `${getBackendOrigin()}/oauth?return_to=${encodeURIComponent("/home")}`;

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("oauth_error");

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await apiLogout();
      window.location.href = "/home";
    } catch {
      window.location.href = "/home";
    }
  };

  const modal = (
    <div className="fixed inset-0 z-2000 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      {/* Panel */}
      <div
        className="panel relative z-2001 flex flex-col gap-4 mx-4 w-full max-w-2xl"
        style={{ maxHeight: "min(90vh, 700px)" }}
      >
        <div className="flex flex-col gap-1 shrink-0">
          <h2 className="h2" style={{ margin: 0 }}>Link Your SWC Account</h2>
        </div>

        <div
          className="overflow-y-auto flex-1 pr-1"
          style={{ minHeight: 0 }}
        >
          <p className="small" style={{ margin: 0 }}>
            Before you can continue, you need to link your Star Wars Combine character to your JOENet account.
          </p>
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            This only grants basic character identity access (your character name, ID and avatar).
          </p>
        </div>

        {oauthError && (
          <p className="small" style={{ color: "salmon", margin: 0 }}>
            {oauthError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 border-t border-white/10">
          <a href={oauthUrl} className={BTN}>
            {oauthError ? "Try Again" : "Link SWC Account"}
          </a>
          <button
            type="button"
            className={BTN + " all"}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default SwcLinkRequiredState;
