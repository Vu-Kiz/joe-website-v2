import React from "react";
import { getBackendOrigin } from "../../api/core/auth";
import { BTN } from "../../utils/ui";

type Props = {
  message: string;
  isAuthenticated: boolean;
};

const SiteLockState: React.FC<Props> = ({ message, isAuthenticated }) => {
  const oauthUrl = `${getBackendOrigin()}/auth/discord`;

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board flex flex-col gap-4">
          <h1 className="h1">Site Locked</h1>
          <p className="small">{message}</p>

          {isAuthenticated && (
            <p className="small">
              You are already signed in, but this account cannot bypass the site lock.
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            {!isAuthenticated && (
              <a href={oauthUrl} className={BTN}>
                Login
              </a>
            )}

            <button
              type="button"
              className={BTN}
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SiteLockState;
