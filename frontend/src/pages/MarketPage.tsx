import React, { Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/auth";
import { canAccessMembers } from "../auth/permissions";
import { getSwcAuthorizationStatus, type SwcAuthorizationStatus } from "../api/swcAuthorization";
import NotLoggedInState from "../components/common/NotLoggedInState";
import joshBanner from "../assets/marketplace/JOSHBanner.png";
import "../styles/main.sass";
import "../styles/_market.sass";

const MarketPanel = React.lazy(() => import("../components/market/MarketPanel"));

const MarketPage: React.FC = () => {
  const [user, setUser] = useState<SwcUser | null | undefined>(undefined);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const focusListingId = Number(new URLSearchParams(location.search).get("listing")) || null;

  function clearListingParam() {
    navigate("/market", { replace: true });
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
    <main className="page-content market-page">
      <section className="panel market-page__panel">
        <img
          className="market-page__banner"
          src={joshBanner}
          alt="Jawa Offworld Sales Hub"
        />
        <Suspense fallback={<p className="muted">Loading market…</p>}>
          <MarketPanel
            swcAuth={swcAuth}
            canManageListings={canAccessMembers(user)}
            focusListingId={focusListingId}
            onFocusConsumed={clearListingParam}
          />
        </Suspense>
      </section>
    </main>
  );
};

export default MarketPage;
