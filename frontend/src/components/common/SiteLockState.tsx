import React from "react";
import { getBackendOrigin } from "../../api/auth";

type Props = {
  message: string;
  isAuthenticated: boolean;
};

const SiteLockState: React.FC<Props> = ({ message, isAuthenticated }) => {
  const oauthUrl = `${getBackendOrigin()}/auth/discord`;

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board admin-board">
          <h1>Site Locked</h1>
          <p className="small">{message}</p>

          {isAuthenticated && (
            <p className="small">
              You are already signed in, but this account cannot bypass the site lock.
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            {!isAuthenticated && (
              <a href={oauthUrl} className="btn">
                Login
              </a>
            )}

            <button
              type="button"
              className="btn"
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
