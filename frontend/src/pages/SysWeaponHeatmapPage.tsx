import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/core/auth";
import { canAccessSysadmin } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";
import WeaponHeatmapTool from "../components/tools/weaponHeatmap/WeaponHeatmapTool";

const SysWeaponHeatmapPage: React.FC = () => {
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
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
        setPageLoading(true);
        const authRes = await fetchAuthMe();

        if (cancelled) return;

        setViewer(authRes.user);
        setPageError(null);
      } catch (error: any) {
        if (!cancelled) {
          setViewer(null);
          setPageError(error?.message ?? "Failed to load weapon heatmap page.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authRefreshNonce]);

  if (pageLoading) {
    return (
      <main className="board flex flex-col gap-4">
        <p className="small">Checking sysadmin access…</p>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="board flex flex-col gap-4">
        <p className="small">{pageError}</p>
      </main>
    );
  }

  if (!viewer) {
    return <NotLoggedInState />;
  }

  if (!canAccessSysadmin(viewer)) {
    return <ForbiddenState title="Sysadmin Access Required" message="This debug heatmap is limited to sysadmins." />;
  }

  return (
    <main className="board grid gap-4">
      <div className="flex justify-between gap-4">
        <div>
          <p className="small">
            <Link to="/sys/debug">Back to Sys Debug</Link>
          </p>
        </div>
      </div>
      <WeaponHeatmapTool />
    </main>
  );
};

export default SysWeaponHeatmapPage;
