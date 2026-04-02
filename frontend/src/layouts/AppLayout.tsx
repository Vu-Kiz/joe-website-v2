import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import { emitAuthStateChanged, fetchAuthMe, getSessionStreamUrl } from "../api/auth";

const AppLayout: React.FC = () => {
  useEffect(() => {
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

        eventSource.addEventListener("session_invalidated", () => {
          emitAuthStateChanged();
          window.location.href = "/home?session_invalidated=1";
        });
      } catch {
        // Ignore startup failures here; normal auth checks still handle signed-out states.
      }
    };

    void start();

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, []);

  return (
    <>
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
