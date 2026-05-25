import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import jawaLogo from "../assets/branding/joe-banner.png";
import { fetchAuthMe, apiLogout, getBackendOrigin, subscribeToAuthStateChange } from "../api/core/auth";
import type { SwcUser } from "../api/core/auth";
import { getPendingPaymentsCount } from "../api/payments/payments";
import CgtPill from "./CgtPill";
import { canAccessAdmin, canAccessMembers, canAccessPublicTools } from "../auth/permissions";
import { BTN } from "../utils/ui";

const BTN_ACTIVE = " border-[rgba(245,213,70,0.7)] bg-[rgba(245,213,70,0.18)] text-white";
const NAV_BTN = BTN + " max-[900px]:w-full max-[900px]:justify-center";

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
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
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

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!canAccessMembers(user)) { setHasPendingPayments(false); return; }

    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await getPendingPaymentsCount();
        if (!cancelled) setHasPendingPayments(Boolean(res.data?.has_pending));
      } catch { if (!cancelled) setHasPendingPayments(false); }
    };

    void refresh();
    const id = window.setInterval(refresh, 60000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [user, location.pathname, location.search, location.hash]);

  useEffect(() => { setNavOpen(false); }, [location.pathname, location.search, location.hash]);

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
    } catch (e) { console.error(e); }
  };

  const displayName = user?.handle || "Guest";
  const showMembersTools = canAccessMembers(user);
  const showToolsButton = canAccessAdmin(user) || showMembersTools || canAccessPublicTools(user);
  const showMarketButton = Boolean(user);
  const showStoreButton = !user || canAccessAdmin(user) || (!showMembersTools && (user.store_has_active_plans ?? false));

  return (
    <nav className="w-full sticky top-0 z-[999] mx-auto mb-[10px] rounded-[8px] border border-[rgba(245,213,70,0.35)] bg-[#111] py-[10px] max-[900px]:static max-[900px]:mb-3">

      {/* Inner container */}
      <div className="w-full max-w-[1800px] mx-auto px-4 flex items-center justify-between gap-4 max-[480px]:gap-2 max-[900px]:flex-wrap">

        {/* Brand */}
        <Link to="/home" className="flex items-center gap-[10px] no-underline text-[var(--accent)] font-extrabold tracking-[0.06em] uppercase whitespace-nowrap min-w-0 shrink" aria-label="Go to home">
          <img src={jawaLogo} alt="JOE Logo" className="w-auto max-h-[60px] max-w-[700px] object-contain border-2 border-[var(--accent)] max-[900px]:hidden" />
        </Link>

        {/* CGT pill — mobile only (closed state) */}
        <div className="hidden max-[900px]:block min-w-0">
          <div className="min-w-0 max-w-[calc(100vw-100px)] overflow-hidden shrink">
            <CgtPill />
          </div>
        </div>

        {/* Hamburger toggle row */}
        <div className="hidden max-[900px]:flex items-center gap-2 shrink-0 ml-auto">
          <button
            className="inline-flex items-center justify-center px-3 py-[6px] border border-[var(--accent)] bg-transparent text-[var(--accent)] rounded-[6px] cursor-pointer"
            type="button"
            onClick={() => setNavOpen((o) => !o)}
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
          >
            ☰ Menu
          </button>
        </div>

        {/* Nav menu */}
        <div className={`flex items-center gap-4 max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-[10px] max-[900px]:mt-[10px] max-[900px]:w-full ${navOpen ? "max-[900px]:flex" : "max-[900px]:hidden"}`}>

          {/* Nav links */}
          <ul className="list-none flex items-center gap-2 m-0 p-0 max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:w-full">
            <li>
              <Link to="/home" className={NAV_BTN + (isActive("/home") ? BTN_ACTIVE : "")}>Home</Link>
            </li>
            <li>
              <Link to="/jen" className={NAV_BTN + (isActive("/jen") ? BTN_ACTIVE : "")}>JEN</Link>
            </li>
            {showMarketButton && (
              <li>
                <Link to="/market" className={NAV_BTN + (isActive("/market") ? BTN_ACTIVE : "")}>Market</Link>
              </li>
            )}
            {showStoreButton && (
              <li>
                <Link to="/tools/store" className={NAV_BTN + (isActive("/tools/store") ? BTN_ACTIVE : "")}>Tools Store</Link>
              </li>
            )}
            {showToolsButton && (
              <li>
                <Link
                  to="/tools"
                  state={{ resetToOverview: true }}
                  className={NAV_BTN + (hasPendingPayments && showMembersTools ? " !border-[#ff9b32] !text-[#ffd2a1] animate-payments-alert" : "") + (isActive("/tools") ? BTN_ACTIVE : "")}
                >
                  Tools
                </Link>
              </li>
            )}
          </ul>

          {/* Auth + CGT */}
          <div className="flex flex-col items-end gap-1 max-[900px]:w-full max-[900px]:items-stretch">
            <div className="flex items-center gap-2 max-[900px]:flex-wrap max-[900px]:gap-[6px] max-[900px]:w-full max-[900px]:justify-center max-[900px]:[&>button]:flex-1 max-[900px]:[&>a]:flex-1">
              {!loading && user && (
                <>
                  <span className="small">
                    <span className="max-[480px]:hidden">Logged in as </span>
                    <Link to="/aboutme" className="text-[var(--accent)] font-tektur font-extrabold underline underline-offset-2 hover:opacity-90 small">
                      {displayName}
                    </Link>
                  </span>
                  <button type="button" className={BTN} onClick={handleLogout}>Logout</button>
                </>
              )}
              {!loading && !user && (
                <button type="button" className={BTN} onClick={handleLogin}>Login via Discord</button>
              )}
              {loading && <span className="small">Checking session…</span>}
            </div>

            <div className="flex items-center justify-end mt-[0.35rem] min-w-[260px] max-[900px]:hidden">
              <CgtPill />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
