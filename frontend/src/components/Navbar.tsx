// src/components/Navbar.tsx
import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import jawaLogo from "../assets/branding/jawalogo.png";

const Navbar: React.FC = () => {
  const location = useLocation();

  // 🔕 Do NOT show navbar on the fake loading screen
  if (location.pathname === "/") {
    return null;
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // TODO: replace this with real auth state from /api/me or a useAuth() hook
  const user: null | {
    handle: string;
    is_sysadmin?: boolean;
    is_admin?: boolean;
    isJOEMember?: boolean;
    is_intel?: boolean;
    avatar_url?: string | null;
  } = null;

  const isLoggedIn = !!user;

  // Role flags (future: read from real user)
  const isSysadmin = !!user?.is_sysadmin;
  const isAdmin = !!user?.is_admin;
  const isJOEMember = !!user?.isJOEMember;
  const isIntel = !!user?.is_intel;

  // Gating rules (sysadmin overrides everything)
  const canAccessJobs = isSysadmin || isAdmin || isJOEMember;
  const canAccessTools = isSysadmin || isIntel;

  useEffect(() => {
    setMenuOpen(false);
    setToolsOpen(false);
  }, [location.pathname]);

  const mainNavItems = [
    { label: "Dashboard", to: "/home" },
    { label: "JEN", to: "/jen" },
  ];

  return (
    <nav className="main-nav">
      <div className="main-nav-inner">
        {/* Brand / logo */}
        <Link to="/home" className="main-nav-brand">
          <img
            src={jawaLogo}
            alt="Jawa Offworld Enterprises"
            className="main-nav-logo"
          />
          <span>Jawa Offworld Enterprises</span>
        </Link>

        {/* Mobile toggle */}
        <button
          type="button"
          className="main-nav-toggle"
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰ Menu
        </button>

        {/* Right side: nav + auth */}
        <div className={`main-nav-menu ${menuOpen ? "open" : ""}`}>
          {/* Left: primary links */}
          <ul className="main-nav-links">
            {mainNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `btn ${isActive ? "active" : ""}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}

            {/* Jobs – gated */}
            {canAccessJobs && (
              <li>
                <NavLink
                  to="/jobs"
                  className={({ isActive }) =>
                    `btn ${isActive ? "active" : ""}`
                  }
                >
                  Jobs
                </NavLink>
              </li>
            )}

            {/* Tools dropdown – also gated */}
            {canAccessTools && (
              <li
                className={`main-nav-tools ${toolsOpen ? "open" : ""}`}
              >
                <button
                  type="button"
                  className="btn main-nav-tools-toggle"
                  onClick={() => setToolsOpen((open) => !open)}
                >
                  Tools ▾
                </button>
                <ul className="main-nav-tools-menu">
                  <li>
                    <NavLink
                      to="/intel/droidbrain"
                      className={({ isActive }) =>
                        isActive ? "active" : ""
                      }
                    >
                      DroidBrain Intel
                    </NavLink>
                  </li>
                  {/* Add more tools here later */}
                </ul>
              </li>
            )}
          </ul>

          {/* Right: auth area */}
          <div className="main-nav-auth">
            <div className="main-nav-auth-row">
              {isLoggedIn ? (
                <>
                  {user?.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt={user.handle}
                      className="main-nav-avatar"
                    />
                  )}
                  <span className="small">{user?.handle}</span>
                  <button
                    type="button"
                    className="btn seg-btn"
                    onClick={() => {
                      window.location.href = "/oauth/logout";
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <span className="small">Guest</span>
                  <a
                    href="/oauth/login"
                    className="btn seg-btn"
                  >
                    Log in with SWC
                  </a>
                </>
              )}
            </div>

            {/* CGT clock placeholder */}
            <div className="nav-cgt">
              CGT clock coming soon…
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
