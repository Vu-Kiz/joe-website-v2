import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import LoadingScreen from "./pages/LoadingScreen";
import HomePage from "./pages/HomePage";
import AboutMe from "./pages/AboutMe";
import JenPage from "./pages/JenPage";
import AdminPage from "./pages/AdminPage";
import MembersPage from "./pages/MembersPage";
import MarketPage from "./pages/MarketPage";
import PaymentsPage from "./pages/PaymentsPage";
import DroidBrainPage from "./pages/DroidBrainPage";
import AdminRoute from "./components/auth/AdminRoute";
import SiteLockState from "./components/common/SiteLockState";
import { fetchSiteLockStatus } from "./api/admin/siteLock";
import SysDebugPage from "./pages/SysDebugPage";
import SysUniversePage from "./pages/SysUniversePage";
import MembersUniverseSystemPage from "./pages/MembersUniverseSystemPage";
import MembersUniverseLocationPage from "./pages/MembersUniverseLocationPage";
import SysWeaponHeatmapPage from "./pages/SysWeaponHeatmapPage";
import SysShipHeatmapPage from "./pages/SysShipHeatmapPage";
import ToolStorePage from "./pages/ToolStorePage";

function App() {
  const [checkingSiteLock, setCheckingSiteLock] = useState(true);
  const [siteLockMessage, setSiteLockMessage] = useState<string | null>(null);
  const [siteLockIsAuthenticated, setSiteLockIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchSiteLockStatus();

        if (cancelled) return;

        if (res.site_lock.enabled && !res.can_bypass) {
          setSiteLockMessage(res.site_lock.message);
          setSiteLockIsAuthenticated(res.is_authenticated);
        } else {
          setSiteLockMessage(null);
          setSiteLockIsAuthenticated(false);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load site lock status", e);
          setSiteLockMessage(null);
          setSiteLockIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingSiteLock(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingSiteLock) {
  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board flex flex-col gap-4">
          <p className="small">Checking site status…</p>
        </main>
      </div>
    </div>
  );
}

  if (siteLockMessage) {
    return (
      <SiteLockState
        message={siteLockMessage}
        isAuthenticated={siteLockIsAuthenticated}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoadingScreen />} />

        <Route element={<AppLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/aboutme" element={<AboutMe />} />
          <Route path="/jen" element={<JenPage />} />
          <Route path="/tools" element={<MembersPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/tools/universe/location/:galx/:galy" element={<MembersUniverseLocationPage />} />
          <Route path="/tools/universe/system/:systemIdentifier" element={<MembersUniverseSystemPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/intel/droidbrain" element={<DroidBrainPage />} />
          <Route path="/tools/store" element={<ToolStorePage />} />
          <Route path="/sys/debug" element={<SysDebugPage />} />
          <Route path="/sys/debug/universe" element={<SysUniversePage />} />
          <Route path="/sys/debug/weapon-heatmap" element={<SysWeaponHeatmapPage />} />
          <Route path="/sys/debug/ship-heatmap" element={<SysShipHeatmapPage />} />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
