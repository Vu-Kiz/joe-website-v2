import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import LoadingScreen from "./pages/LoadingScreen";
import HomePage from "./pages/HomePage";
import AboutMe from "./pages/AboutMe";
import JenPage from "./pages/JenPage";
import AdminPage from "./pages/AdminPage";
import MembersPage from "./pages/MembersPage";
import PaymentsPage from "./pages/PaymentsPage";
import AdminRoute from "./components/auth/AdminRoute";
import SiteLockState from "./components/common/SiteLockState";
import { fetchSiteLockStatus } from "./api/siteLock";

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
        <main className="board admin-board">
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
          <Route path="/members" element={<MembersPage />} />
          <Route path="/payments" element={<PaymentsPage />} />

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