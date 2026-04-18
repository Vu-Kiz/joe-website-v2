import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/auth";
import { canAccessAdmin, canAccessSysadmin } from "../auth/permissions";

import AdminHeader from "../components/admin/AdminHeader";
import AdminNav, { type AdminView } from "../components/admin/AdminNav";
import AdminHomePanel from "../components/admin/AdminHomePanel";
import AdminWebsiteHealthPanel from "../components/admin/AdminWebsiteHealthPanel";
import AdminTipsPanel from "../components/admin/AdminTipsPanel";
import AdminTenetsPanel from "../components/admin/AdminTenetsPanel";
import AdminEotmPanel from "../components/admin/AdminEotmPanel";
import AdminSystemPanel from "../components/admin/AdminSystemPanel";
import AdminUsersPanel from "../components/admin/AdminUsersPanel";
import AdminWeatherPanel from "../components/admin/AdminWeatherPanel";
import AdminActionLogPanel from "../components/admin/AdminActionLogPanel";
import AdminMemberAccessLogPanel from "../components/admin/AdminMemberAccessLogPanel";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import AdminSiteLockPanel from "../components/admin/AdminSiteLockPanel";
import AdminEntityStatsPanel from "../components/admin/AdminEntityStatsPanel";
import AdminDiscordBotPanel from "../components/admin/AdminDiscordBotPanel";
import AdminCombatValuesPanel from "../components/admin/AdminCombatValuesPanel";

import "../styles/main.sass";
import "../styles/_admin.sass";

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AdminView>("home");
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
  }, [authRefreshNonce]);

  const isLoggedIn = !!user;
  const canSeeAdmin = useMemo(() => canAccessAdmin(user), [user]);
  const showSystemTools = useMemo(() => canAccessSysadmin(user), [user]);
  const canSeeLogs = useMemo(() => canAccessSysadmin(user), [user]);

  useEffect(() => {
    if (!showSystemTools && (activeView === "websiteHealth" || activeView === "system" || activeView === "discordBot" || activeView === "combatValues" || activeView === "logs" || activeView === "entityStats" || activeView === "memberAccessLogs")) {
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

          <div className="members-tool-back">
            <button className="btn" type="button" onClick={() => navigate("/members")}>
              Back to Tools Overview
            </button>
          </div>

          <AdminNav
            activeView={activeView}
            onChange={setActiveView}
            showSystemTools={showSystemTools}
            canSeeLogs={canSeeLogs}
          />

          {activeView === "home" && (
            <AdminHomePanel
              showSystemTools={showSystemTools}
              canSeeLogs={canSeeLogs}
            />
          )}
          {activeView === "websiteHealth" && showSystemTools && <AdminWebsiteHealthPanel />}
          {activeView === "tips" && <AdminTipsPanel />}
          {activeView === "tenets" && <AdminTenetsPanel />}
          {activeView === "eotm" && <AdminEotmPanel />}
          {activeView === "users" && <AdminUsersPanel />}
          {activeView === "logs" && canSeeLogs && <AdminActionLogPanel />}
          {activeView === "memberAccessLogs" && canSeeLogs && <AdminMemberAccessLogPanel />}
          {activeView === "weather" && <AdminWeatherPanel />}
          {activeView === "system" && showSystemTools && <AdminSystemPanel />}
          {activeView === "discordBot" && showSystemTools && <AdminDiscordBotPanel />}
          {activeView === "combatValues" && showSystemTools && <AdminCombatValuesPanel />}
          {activeView === "entityStats" && showSystemTools && <AdminEntityStatsPanel user={user} />}
          {activeView === "siteLock" && showSystemTools && <AdminSiteLockPanel />}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
