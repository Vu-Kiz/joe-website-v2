import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import jawaLogo from "../assets/branding/joe-banner.png";
import { fetchAuthMe, apiLogout, getBackendOrigin, subscribeToAuthStateChange } from "../api/auth";
import type { SwcUser } from "../api/auth";
import { getPayments } from "../api/payments";
import CgtPill from "./CgtPill";
import { canAccessAdmin, canAccessMembers } from "../auth/permissions";

const Navbar: React.FC = () => {
  const location = useLocation();

  const [navOpen, setNavOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [hasPendingPayments, setHasPendingPayments] = useState(false);

  const dropdownRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refreshUser = async () => {
      try {
        const data = await fetchAuthMe();
        if (!cancelled && data.ok) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void refreshUser();
    const unsubscribe = subscribeToAuthStateChange(() => {
      void refreshUser();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!canAccessMembers(user)) {
      setHasPendingPayments(false);
      return;
    }

    let cancelled = false;

    const refreshPendingPayments = async () => {
      try {
        const res = await getPayments();
        if (!cancelled) {
          setHasPendingPayments((res.data?.length ?? 0) > 0);
        }
      } catch {
        if (!cancelled) {
          setHasPendingPayments(false);
        }
      }
    };

    void refreshPendingPayments();
    const intervalId = window.setInterval(refreshPendingPayments, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user, location.pathname, location.search, location.hash]);

  useEffect(() => {
    setDropdownOpen(false);
    setNavOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const el = dropdownRef.current;
      if (!el) return;

      const path = (e.composedPath?.() ?? []) as EventTarget[];
      const inside = path.includes(el) || el.contains(e.target as Node);

      if (!inside) {
        setDropdownOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
      }
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
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const qs = `return_to=${encodeURIComponent(returnTo)}`;

    window.location.href = origin ? `${origin}/auth/discord?${qs}` : `/auth/discord?${qs}`;
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
  const showAdminTools = canAccessAdmin(user);
  const showMembersTools = canAccessMembers(user);
  const showToolsDropdown = showAdminTools || showMembersTools;

  return (
    <nav className="main-nav">
      <div className="main-nav-inner">
        <Link to="/home" className="main-nav-brand" aria-label="Go to home">
          <img src={jawaLogo} alt="JOE Logo" className="main-nav-logo" />
        </Link>

        <button
          className="main-nav-toggle"
          type="button"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
        >
          ☰ Menu
        </button>

        <div className={`main-nav-menu ${navOpen ? "open" : ""}`}>
          <ul className="main-nav-links">
            <li>
              <Link to="/home" className={`btn ${isActive("/home") ? "active" : ""}`}>
                Home
              </Link>
            </li>

            <li>
              <Link to="/jen" className={`btn ${isActive("/jen") ? "active" : ""}`}>
                JEN
              </Link>
            </li>

            {showToolsDropdown && (
              <li
                ref={dropdownRef}
                className={`dropdown ${dropdownOpen ? "is-open" : ""}`}
              >
                <button
                  type="button"
                  className={`btn dropdown__toggle${hasPendingPayments && showMembersTools ? " btn--payments-alert dropdown__toggle--alert" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropdownOpen((open) => !open);
                  }}
                >
                  Tools ▾
                </button>

                <ul className="dropdown__menu" role="menu">
                  {showAdminTools && (
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
                  )}

                  {showMembersTools && (
                    <li role="none">
                      <Link
                        to="/members"
                        className={`dropdown__item${hasPendingPayments ? " dropdown__item--alert" : ""}`}
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Members
                      </Link>
                    </li>
                  )}
                </ul>
              </li>
            )}
          </ul>

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
                  Login via Discord
                </button>
              )}

              {loading && <span className="small">Checking session…</span>}
            </div>

            <div className="nav-cgt">
              <CgtPill />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
