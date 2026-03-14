import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthMe, type SwcUser } from "../api/auth";
import { canAccessAdmin, canAccessSysadmin } from "../auth/permissions";

import AdminHeader from "../components/admin/AdminHeader";
import AdminNav, { type AdminView } from "../components/admin/AdminNav";
import AdminHomePanel from "../components/admin/AdminHomePanel";
import AdminTipsPanel from "../components/admin/AdminTipsPanel";
import AdminTenetsPanel from "../components/admin/AdminTenetsPanel";
import AdminEotmPanel from "../components/admin/AdminEotmPanel";
import AdminSystemPanel from "../components/admin/AdminSystemPanel";
import AdminUsersPanel from "../components/admin/AdminUsersPanel";
import AdminWeatherPanel from "../components/admin/AdminWeatherPanel";
import AdminActionLogPanel from "../components/admin/AdminActionLogPanel";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import AdminSiteLockPanel from "../components/admin/AdminSiteLockPanel";

import "../styles/main.sass";
import "../styles/_admin.sass";

const AdminPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AdminView>("home");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchAuthMe();

        if (cancelled) return;

        setUser(res?.user ?? null);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load admin data");
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

  const isLoggedIn = !!user;
  const canSeeAdmin = useMemo(() => canAccessAdmin(user), [user]);
  const showSystemTools = useMemo(() => canAccessSysadmin(user), [user]);
  const canSeeLogs = useMemo(() => canAccessSysadmin(user), [user]);

  useEffect(() => {
    if (!showSystemTools && (activeView === "system" || activeView === "logs")) {
      setActiveView("home");
    }
  }, [showSystemTools, canSeeLogs, activeView]);

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Admin Control</h1>
            <p className="small">Loading admin tools…</p>
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
            <h1>Admin Control</h1>
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
            <NotLoggedInState />
          </main>
        </div>
      </div>
    );
  }

  if (!canSeeAdmin) {
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

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board admin-board">
          <AdminHeader user={user} />

          <AdminNav
            activeView={activeView}
            onChange={setActiveView}
            showSystemTools={showSystemTools}
            canSeeLogs={canSeeLogs}
          />

          {activeView === "home" && (
            <AdminHomePanel showSystemTools={showSystemTools} />
          )}
          {activeView === "tips" && <AdminTipsPanel />}
          {activeView === "tenets" && <AdminTenetsPanel />}
          {activeView === "eotm" && <AdminEotmPanel />}
          {activeView === "users" && <AdminUsersPanel />}
          {activeView === "logs" && canSeeLogs && <AdminActionLogPanel />}
          {activeView === "weather" && <AdminWeatherPanel />}
          {activeView === "system" && showSystemTools && <AdminSystemPanel />}
          {activeView === "siteLock" && showSystemTools && <AdminSiteLockPanel />}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;