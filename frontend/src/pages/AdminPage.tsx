import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/core/auth";
import { canAccessAdmin, canAccessSysadmin } from "../auth/permissions";

import AdminHeader from "../components/admin/AdminHeader";
import AdminNav, { type AdminView } from "../components/admin/AdminNav";
import AdminHomePanel from "../components/admin/AdminHomePanel";
import AdminWorkerHealthPanel from "../components/admin/AdminWorkerHealthPanel";
import AdminWebsiteHealthPanel from "../components/admin/AdminWebsiteHealthPanel";
import AdminTipsPanel from "../components/admin/AdminTipsPanel";
import AdminTenetsPanel from "../components/admin/AdminTenetsPanel";
import AdminEotmPanel from "../components/admin/AdminEotmPanel";
import AdminSystemPanel from "../components/admin/AdminSystemPanel";
import AdminUsersPanel from "../components/admin/AdminUsersPanel";
import AdminWeatherPanel from "../components/admin/AdminWeatherPanel";
import AdminActionLogPanel from "../components/admin/AdminActionLogPanel";
import AdminMemberAccessLogPanel from "../components/admin/AdminMemberAccessLogPanel";
import AdminDroidBrainUploadsPanel from "../components/admin/AdminDroidBrainUploadsPanel";
import AdminAstrogationUploadsPanel from "../components/admin/AdminAstrogationUploadsPanel";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import AdminSiteLockPanel from "../components/admin/AdminSiteLockPanel";
import AdminEntityStatsPanel from "../components/admin/AdminEntityStatsPanel";
import AdminDiscordBotPanel from "../components/admin/AdminDiscordBotPanel";
import AdminCombatValuesPanel from "../components/admin/AdminCombatValuesPanel";
import AdminMemberChangelogPanel from "../components/admin/AdminMemberChangelogPanel";
import AdminToolStorePanel from "../components/admin/AdminToolStorePanel";
import AdminJobPayRatesPanel from "../components/admin/AdminJobPayRatesPanel";
import AdminSupportTicketsPanel from "../components/admin/AdminSupportTicketsPanel";
import { BTN } from "../utils/ui";


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
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to load admin data";
          setError(message);
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
  const sysadminOnlyViews: AdminView[] = useMemo(
    () => [
      "workerHealth",
      "websiteHealth",
      "siteLock",
      "system",
      "discordBot",
      "combatValues",
      "entityStats",
      "droidbrainUploads",
      "toolStore",
    ],
    []
  );

  useEffect(() => {
    if (!showSystemTools && sysadminOnlyViews.includes(activeView)) {
      setActiveView("home");
      return;
    }
    if (!canSeeLogs && (activeView === "logs" || activeView === "memberAccessLogs")) {
      setActiveView("home");
    }
  }, [showSystemTools, canSeeLogs, activeView, sysadminOnlyViews]);

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board flex flex-col gap-4">
            <h1 className="h1">Admin Control</h1>
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
          <main className="board flex flex-col gap-4">
            <h1 className="h1">Admin Control</h1>
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
          <main className="board flex flex-col gap-4">
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
          <main className="board flex flex-col gap-4">
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
        <main className="board flex flex-col gap-4">
          <AdminHeader user={user} />

          <div className="flex justify-start mb-4">
            <button className={BTN} type="button" onClick={() => navigate("/tools")}>
              Back to Tools Overview
            </button>
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-start lg:gap-4">
            <div>
              <AdminNav
                activeView={activeView}
                onChange={setActiveView}
                showSystemTools={showSystemTools}
                canSeeLogs={canSeeLogs}
                userId={user?.id}
              />
            </div>

            <div className="min-w-0">
              {activeView === "home" && (
                <AdminHomePanel
                  showSystemTools={showSystemTools}
                  canSeeLogs={canSeeLogs}
                />
              )}
              {activeView === "workerHealth" && showSystemTools && <AdminWorkerHealthPanel />}
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
              {activeView === "memberChangelog" && <AdminMemberChangelogPanel />}
              {activeView === "droidbrainUploads" && showSystemTools && <AdminDroidBrainUploadsPanel />}
              {activeView === "astrogationUploads" && showSystemTools && <AdminAstrogationUploadsPanel />}
              {activeView === "siteLock" && showSystemTools && <AdminSiteLockPanel />}
              {activeView === "toolStore" && showSystemTools && <AdminToolStorePanel />}
              {activeView === "jobPayRates" && <AdminJobPayRatesPanel />}
              {activeView === "supportTickets" && <AdminSupportTicketsPanel />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
