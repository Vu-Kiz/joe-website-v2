import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import jawaLogo from "../assets/branding/jawalogo.png";
import { fetchAuthMe, apiLogout, getBackendOrigin } from "../api/auth";
import type { SwcUser } from "../api/auth";

const Navbar: React.FC = () => {
  const location = useLocation();

  // ✅ separate concerns
  const [navOpen, setNavOpen] = useState(false); // mobile menu
  const [dropdownOpen, setDropdownOpen] = useState(false); // Tools dropdown

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);

  // Only used for dropdown outside-click detection
  const dropdownRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAuthMe();
        if (!cancelled && data.ok) setUser(data.user);
      } catch {
        // ignore; show guest
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Close menus on route change (prevents stale open states)
  useEffect(() => {
    setDropdownOpen(false);
    setNavOpen(false);
  }, [location.pathname]);

  // Close dropdown on outside click / escape
  useEffect(() => {
    if (!dropdownOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const el = dropdownRef.current;
      if (!el) return;

      const path = (e.composedPath?.() ?? []) as EventTarget[];
      const inside = path.includes(el) || el.contains(e.target as Node);

      if (!inside) setDropdownOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  const isActive = (path: string) => location.pathname === path;

  const handleLogin = () => {
    const origin = getBackendOrigin();
    window.location.href = origin ? `${origin}/oauth` : "/oauth";
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
      setUser(null);
    } catch (e) {
      console.error(e);
    }
  };

  const displayName = user?.handle || "Guest";

  return (
    <nav className="main-nav">
      <div className="main-nav-inner">
        {/* Brand */}
        <Link to="/home" className="main-nav-brand">
          <img src={jawaLogo} alt="JOE Logo" className="main-nav-logo" />
        </Link>

        {/* Mobile burger */}
        <button
          className="main-nav-toggle"
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
        >
          ☰ Menu
        </button>

        {/* Right side menu */}
        <div className={`main-nav-menu ${navOpen ? "open" : ""}`}>
          <ul className="main-nav-links">
            <li>
              <Link to="/home" className={`btn ${isActive("/home") ? "active" : ""}`}>
                Home
              </Link>
            </li>

            <li>
              <Link to="/blogs" className={`btn ${isActive("/blogs") ? "active" : ""}`}>
                JEN
              </Link>
            </li>

            {/* Dropdown uses GENERIC dropdown styles (no tools-specific class names) */}
            <li ref={dropdownRef} className={`dropdown ${dropdownOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="btn dropdown__toggle"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                onPointerDown={(e) => {
                  // pointerdown stops "drag off" glitches
                  e.preventDefault();
                  e.stopPropagation();
                  setDropdownOpen((o) => !o);
                }}
              >
                Tools ▾
              </button>

              <ul className="dropdown__menu" role="menu">
                <li role="none">
                  <Link
                    to="/intel"
                    className="dropdown__item"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Intel (DroidBrain)
                  </Link>
                </li>
                <li role="none">
                  <Link
                    to="/admin"
                    className="dropdown__item"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
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
                  <span className="small">
                    Logged in as{" "}
                    <Link to="/aboutme" className="nav-user-link small">
                      {displayName}
                    </Link>
                  </span>

                  <button type="button" className="btn seg-btn" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              )}

              {!loading && !user && (
                <button type="button" className="btn seg-btn" onClick={handleLogin}>
                  Login via SWC
                </button>
              )}

              {loading && <span className="small">Checking session…</span>}
            </div>

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
