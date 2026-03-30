import React, { useEffect, useState } from "react";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../../api/auth";
import { canAccessAdmin } from "../../auth/permissions";
import ForbiddenState from "../common/ForbiddenState";
import NotLoggedInState from "../common/NotLoggedInState";

type Props = {
  children: React.ReactNode;
};

const AdminRoute: React.FC<Props> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);

  useEffect(() => {
    return subscribeToAuthStateChange(() => {
      setAuthRefreshNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchAuthMe();
        if (!cancelled) {
          setUser(res?.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
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
  }, [authRefreshNonce]);

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Admin Control</h1>
            <p className="small">Checking access…</p>
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <NotLoggedInState
              title="Not logged in"
              message="You need to sign in to access the admin control area."
            />
          </main>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin(user)) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <ForbiddenState
              title="403 Forbidden"
              message="You do not have permission to access the admin control area."
            />
          </main>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
