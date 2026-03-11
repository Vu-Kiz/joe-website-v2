import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchAuthMe, type SwcUser } from "../../api/auth";
import { canAccessAdmin } from "../../auth/permissions";
import ForbiddenState from "../common/ForbiddenState";

type Props = {
  children: React.ReactNode;
};

const AdminRoute: React.FC<Props> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);

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
  }, []);

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
    return <Navigate to="/home" replace />;
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