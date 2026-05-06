import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import jawaLogo from "../assets/branding/joe-banner.png";
import { fetchAuthMe, apiLogout, getBackendOrigin, subscribeToAuthStateChange } from "../api/auth";
import type { SwcUser } from "../api/auth";
import { getPendingPaymentsCount } from "../api/payments";
import CgtPill from "./CgtPill";
import { canAccessAdmin, canAccessMembers } from "../auth/permissions";

const Navbar: React.FC = () => {
  const location = useLocation();

  const [navOpen, setNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [hasPendingPayments, setHasPendingPayments] = useState(false);

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
      if (!cancelled) {
        setLoading(true);
        setUser(null);
        setHasPendingPayments(false);
        setNavOpen(false);
      }
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
        const res = await getPendingPaymentsCount();
        if (!cancelled) {
          setHasPendingPayments(Boolean(res.data?.has_pending));
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
    setNavOpen(false);
  }, [location.pathname, location.search, location.hash]);

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
      setHasPendingPayments(false);
      setNavOpen(false);
      setLoading(false);
    } catch (e) {
      console.error(e);
    }
  };

  const displayName = user?.handle || "Guest";
  const showMembersTools = canAccessMembers(user);
  const showToolsButton = canAccessAdmin(user) || showMembersTools;

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

            {showToolsButton && (
              <li>
                <Link
                  to="/members"
                  state={{ resetToOverview: true }}
                  className={`btn${hasPendingPayments && showMembersTools ? " btn--payments-alert" : ""}`}
                >
                  Tools
                </Link>
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
