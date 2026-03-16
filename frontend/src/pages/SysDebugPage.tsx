import React, { useEffect, useState } from "react";
import { fetchAuthMe, type SwcUser } from "../api/auth";
import {
  getDebugFactions,
  getDebugPayments,
  getDebugSwcAuth,
} from "../api/sysDebug";
import NotLoggedInState from "../components/common/NotLoggedInState";
import { testFactionPrivilege } from "../api/sysDebug";
import "../styles/main.sass";
import "../styles/_admin.sass";

const SysDebugPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [swcAuth, setSwcAuth] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [factions, setFactions] = useState<any[]>([]);

  async function loadAll(userId?: number) {
    const [authRes, swcAuthRes, paymentsRes, factionsRes] = await Promise.all([
      fetchAuthMe(),
      getDebugSwcAuth(userId),
      getDebugPayments(userId),
      getDebugFactions(),
    ]);

    setUser(authRes.user);
    setSwcAuth(swcAuthRes.data);
    setPayments(paymentsRes.data);
    setFactions(factionsRes.data);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        await loadAll();

        if (cancelled) return;
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load sys debug tools");
          setUser(null);
          setSwcAuth(null);
          setPayments(null);
          setFactions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onLoadTarget() {
    const parsed = Number(targetUserId);
    await loadAll(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
  }

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Sys Debug</h1>
            <p className="small">Loading debug tools…</p>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Sys Debug</h1>
            <p className="small" style={{ color: "salmon" }}>
              {error}
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <NotLoggedInState
              title="Not logged in"
              message="You need to sign in to access sys debug tools."
            />
          </main>
        </div>
      </div>
    );
  }

  if (!user.is_sysadmin) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Sys Debug</h1>
            <p className="small">Sysadmin access required.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board admin-board">
          <h1>Sys Debug</h1>

          <div className="panel">
            <h2>Target User</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="input"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="User ID (blank = me)"
              />
              <button className="btn" type="button" onClick={onLoadTarget}>
                Load
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>SWC Authorization</h2>
            <pre className="small" style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(swcAuth, null, 2)}
            </pre>
          </div>

          <div className="panel">
            <h2>Payments</h2>
            <pre className="small" style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(payments, null, 2)}
            </pre>
          </div>

          <div className="panel">
            <h2>Factions</h2>
            <pre className="small" style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(factions, null, 2)}
            </pre>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SysDebugPage;