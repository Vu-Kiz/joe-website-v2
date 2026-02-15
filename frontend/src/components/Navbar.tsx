import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import jawaLogo from "../assets/branding/jawalogo.png";
import {
  fetchAuthMe,
  apiLogout,
  getBackendOrigin,   // ⬅ change here
} from "../api/auth";
import type { SwcUser } from "../api/auth";

const Navbar: React.FC = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAuthMe();
        if (!cancelled && data.ok) {
          setUser(data.user);
        }
      } catch {
        // ignore for now; show as guest
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const handleLogin = () => {
    const origin = getBackendOrigin();

    if (!origin) {
      // worst case: just fall back to /oauth relative to current host
      window.location.href = "/oauth";
      return;
    }

    // You can add a ?redirect=/current/path later if you want
    window.location.href = `${origin}/oauth`;
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
      setUser(null);
    } catch (e) {
      console.error(e);
    }
  };

  const displayName = user?.name || user?.handle || "Guest";

  return (
    <nav className="main-nav">
      <div className="main-nav-inner">
        {/* Brand */}
        <Link to="/home" className="main-nav-brand">
          <img src={jawaLogo} alt="JOE Logo" className="main-nav-logo" />
          <span>Jawa Offworld Enterprises</span>
        </Link>

        {/* Mobile burger */}
        <button
          className="main-nav-toggle"
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ☰ Menu
        </button>

        {/* Right side menu */}
        <div className={`main-nav-menu ${menuOpen ? "open" : ""}`}>
          <ul className="main-nav-links">
            <li>
              <Link
                to="/home"
                className={`btn ${isActive("/home") ? "active" : ""}`}
              >
                Home
              </Link>
            </li>

            <li>
              <Link
                to="/jobs"
                className={`btn ${isActive("/jobs") ? "active" : ""}`}
              >
                Jobs
              </Link>
            </li>

            {/* Tools dropdown – can gate later on user flags */}
            <li
              className={`main-nav-tools ${toolsOpen ? "open" : ""}`}
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
            >
              <button
                type="button"
                className="btn main-nav-tools-toggle"
                onClick={() => setToolsOpen((o) => !o)}
              >
                Tools ▾
              </button>
              <ul className="main-nav-tools-menu">
                <li>
                  <Link to="/intel" className="tools-link">
                    Intel (DroidBrain)
                  </Link>
                </li>
                <li>
                  <Link to="/admin" className="tools-link">
                    Admin
                  </Link>
                </li>
              </ul>
            </li>
          </ul>

          {/* Auth section (right side) */}
          <div className="main-nav-auth">
            <div className="main-nav-auth-row">
              {!loading && user && (
                <>
                  <span className="small">Logged in as {displayName}</span>
                  <button
                    type="button"
                    className="btn seg-btn"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </>
              )}

              {!loading && !user && (
                <button
                  type="button"
                  className="btn seg-btn"
                  onClick={handleLogin}
                >
                  Login via SWC
                </button>
              )}

              {loading && <span className="small">Checking session…</span>}
            </div>

            {/* CGT clock placeholder – you can wire this later */}
            <div className="nav-cgt">
              CGT time: <span>Loading…</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
