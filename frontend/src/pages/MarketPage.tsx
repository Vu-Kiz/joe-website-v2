import React, { Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/core/auth";
import { canAccessMembers } from "../auth/permissions";
import { getSwcAuthorizationStatus, type SwcAuthorizationStatus } from "../api/members/swcAuthorization";
import NotLoggedInState from "../components/common/NotLoggedInState";
import joshBanner from "../assets/marketplace/JOSHBanner.png";
import { MARKET_TABS, type MarketTab } from "../components/market/marketTabs";

const MarketPanel = React.lazy(() => import("../components/market/MarketPanel"));

function parseMarketView(value: string | null): MarketTab | null {
  return value && (MARKET_TABS as string[]).includes(value) ? (value as MarketTab) : null;
}

const MarketPage: React.FC = () => {
  const [user, setUser] = useState<SwcUser | null | undefined>(undefined);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const focusListingId = Number(searchParams.get("listing")) || null;
  const initialTab = parseMarketView(searchParams.get("market_view")) ?? "browse";

  function clearListingParam() {
    const params = new URLSearchParams(location.search);
    params.delete("listing");
    navigate(`/market${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
  }

  function handleTabChange(tab: MarketTab) {
    const params = new URLSearchParams(location.search);
    if (tab === "browse") {
      params.delete("market_view");
    } else {
      params.set("market_view", tab);
    }
    navigate(`/market${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { user: me } = await fetchAuthMe();
        setUser(me);
        if (me) {
          const res = await getSwcAuthorizationStatus();
          setSwcAuth(res?.data ?? null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
    return subscribeToAuthStateChange(load);
  }, []);

  if (loading) return null;
  if (!user) return <NotLoggedInState />;

  return (
    <main className="page-content font-tektur">
      <section className="panel">
        <img
          src={joshBanner}
          alt="Jawa Offworld Sales Hub"
          className="block w-[min(100%,780px)] h-auto mx-auto mb-5 object-contain"
        />
        <Suspense fallback={<p className="small opacity-60">Loading market…</p>}>
          <MarketPanel
            swcAuth={swcAuth}
            canManageListings={canAccessMembers(user)}
            focusListingId={focusListingId}
            onFocusConsumed={clearListingParam}
            initialTab={initialTab}
            onTabChange={handleTabChange}
          />
        </Suspense>
      </section>
    </main>
  );
};

export default MarketPage;
