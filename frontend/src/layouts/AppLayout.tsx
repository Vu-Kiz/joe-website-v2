import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import { emitAuthStateChanged, fetchAuthMe, getApiBaseUrl, getSessionStreamUrl } from "../api/auth";

const AppLayout: React.FC = () => {
  const envLabel = (() => {
    const viteEnv = String((import.meta as any).env?.VITE_APP_ENV ?? "").trim().toLowerCase();
    if (viteEnv === "development" || viteEnv === "local") {
      return "dev";
    }
    if (viteEnv) {
      return viteEnv;
    }

    const apiBase = getApiBaseUrl().toLowerCase();
    if (apiBase.includes("dev")) {
      return "dev";
    }

    if (typeof window !== "undefined") {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("dev-")) {
        return "dev";
      }
    }

    return "";
  })();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("joe:401-redirecting");
      window.sessionStorage.removeItem("joe:401-fallback-pending");
    }

    const url = new URL(window.location.href);
    if (!url.searchParams.has("session_invalidated")) {
      return;
    }

    url.searchParams.delete("session_invalidated");
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleSessionInvalidated = () => {
      emitAuthStateChanged();
      window.location.href = "/home?session_invalidated=1";
    };

    const scheduleAuthCheck = () => {
      clearReconnectTimer();
      reconnectTimer = window.setTimeout(async () => {
        if (cancelled) {
          return;
        }

        try {
          const auth = await fetchAuthMe();
          if (!auth?.user) {
            handleSessionInvalidated();
          }
        } catch {
          handleSessionInvalidated();
        }
      }, 1200);
    };

    const start = async () => {
      try {
        const auth = await fetchAuthMe();
        if (cancelled || !auth?.user) {
          return;
        }

        const streamUrl = getSessionStreamUrl();
        if (!streamUrl) {
          return;
        }

        eventSource = new EventSource(streamUrl, { withCredentials: true });

        eventSource.addEventListener("session_invalidated", handleSessionInvalidated);
        eventSource.onerror = () => {
          // Browser/SSE can transiently drop. Validate auth quickly so navbar/pages
          // still react even if the stream does not recover cleanly.
          scheduleAuthCheck();
        };
      } catch {
        // Ignore startup failures here; normal auth checks still handle signed-out states.
      }
    };

    void start();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      eventSource?.close();
    };
  }, []);

  return (
    <>
      {envLabel === "dev" ? (
        <div className="page-shell">
          <div className="env-dev-banner" role="status" aria-live="polite">
            DEV
          </div>
        </div>
      ) : null}

      <div className="page-shell">
        <Navbar />
      </div>

      <div className="page-shell">
        <Outlet />
      </div>

      <footer className="page-footer">
        <div className="page-shell">
          <div className="page-footer__copy">
            <p className="page-footer__brand">&copy; 2026 Jawa Offworld Enterprises</p>
            <p className="page-footer__credit">Developed by Anarchy Industries</p>
            <p className="page-footer__credit">Designed by Sarlacc Integrated Design</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default AppLayout;
