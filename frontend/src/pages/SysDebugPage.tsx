import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin, type SwcUser } from "../api/auth";
import { getStoredSector, type StoredSectorDetail } from "../api/universe";
import SectorGridMap from "../components/maps/SectorGridMap";
import {
  getDebugFactions,
  getDebugPayments,
  getDebugRawSwc,
  getDebugSwcAuth,
  runUniversePull,
  testFactionPrivilege,
  testManualPayment,
  testPaymentTransfer,
} from "../api/sysDebug";
import NotLoggedInState from "../components/common/NotLoggedInState";
import "../styles/main.sass";
import "../styles/_admin.sass";

type DebugPanelState = {
  loading: boolean;
  error: string | null;
  result: any | null;
  ranAt: string | null;
};

type PanelKey =
  | "swcAuth"
  | "payments"
  | "factions"
  | "rawSwc"
  | "privilegeTest"
  | "paymentTest"
  | "universePull";

type UniverseResource = "system" | "sector" | "planet" | "station";
type UniverseTrailItem = {
  resource: UniverseResource;
  identifier: string;
};
type SysDebugTab = "debug" | "systemPuller";

const emptyPanel = (): DebugPanelState => ({
  loading: false,
  error: null,
  result: null,
  ranAt: null,
});

const initialPanels: Record<PanelKey, DebugPanelState> = {
  swcAuth: emptyPanel(),
  payments: emptyPanel(),
  factions: emptyPanel(),
  rawSwc: emptyPanel(),
  privilegeTest: emptyPanel(),
  paymentTest: emptyPanel(),
  universePull: emptyPanel(),
};

const pretty = (value: any) => JSON.stringify(value, null, 2);

const parseQueryStringToObject = (input: string): Record<string, string> => {
  const trimmed = input.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")])
        );
      }
    } catch {
      throw new Error("Raw SWC query JSON is invalid.");
    }
  }

  const params = new URLSearchParams(trimmed);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};

const SysDebugPage: React.FC = () => {
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [activeTab, setActiveTab] = useState<SysDebugTab>("debug");

  const [targetUserId, setTargetUserId] = useState("");
  const [activeTargetUserId, setActiveTargetUserId] = useState<number | undefined>(undefined);

  const [panels, setPanels] = useState<Record<PanelKey, DebugPanelState>>(initialPanels);

  const [rawSwcPath, setRawSwcPath] = useState("character/");
  const [rawSwcQuery, setRawSwcQuery] = useState("");

  const [privGroup, setPrivGroup] = useState("finance");
  const [privName, setPrivName] = useState("can_transfer");
  const [privFactionId, setPrivFactionId] = useState("");

  const [paymentTransferId, setPaymentTransferId] = useState("");
  const [pullResource, setPullResource] = useState<UniverseResource>("system");
  const [pullIdentifier, setPullIdentifier] = useState("Tatoo");
  const [universeTrail, setUniverseTrail] = useState<UniverseTrailItem[]>([]);
  const [inspectSectorIdentifier, setInspectSectorIdentifier] = useState("25:308");
  const [inspectSectorLoading, setInspectSectorLoading] = useState(false);
  const [inspectSectorError, setInspectSectorError] = useState<string | null>(null);
  const [inspectSectorDetail, setInspectSectorDetail] = useState<StoredSectorDetail | null>(null);
  const [manualPayerType, setManualPayerType] = useState<"user" | "faction">("user");
  const [manualPayerId, setManualPayerId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReceiverUid, setManualReceiverUid] = useState("");
  const [manualCommunication, setManualCommunication] = useState("");
  const [manualItemCount, setManualItemCount] = useState("100");

  const targetLabel = useMemo(() => {
    return activeTargetUserId ? `User #${activeTargetUserId}` : "Me";
  }, [activeTargetUserId]);

  function setPanelLoading(key: PanelKey, loading: boolean) {
    setPanels((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading,
        error: loading ? null : prev[key].error,
      },
    }));
  }

  function setPanelSuccess(key: PanelKey, result: any) {
    setPanels((prev) => ({
      ...prev,
      [key]: {
        loading: false,
        error: null,
        result,
        ranAt: new Date().toISOString(),
      },
    }));
  }

  function setPanelError(key: PanelKey, error: any) {
    setPanels((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: false,
        error: error?.message ?? "Request failed.",
        ranAt: new Date().toISOString(),
      },
    }));
  }

  async function runPanel(
    key: PanelKey,
    fn: () => Promise<any>,
    pick?: (res: any) => any
  ) {
    try {
      setPanelLoading(key, true);
      const res = await fn();
      setPanelSuccess(key, pick ? pick(res) : res);
    } catch (e: any) {
      setPanelError(key, e);
    }
  }

  async function loadViewer() {
    const authRes = await fetchAuthMe();
    setViewer(authRes.user);
  }

  async function loadSwcAuth(userId?: number) {
    await runPanel("swcAuth", () => getDebugSwcAuth(userId), (res) => res.data);
  }

  async function loadPayments(userId?: number) {
    await runPanel("payments", () => getDebugPayments(userId), (res) => res.data);
  }

  async function loadFactions() {
    await runPanel("factions", () => getDebugFactions(), (res) => res.data);
  }

  async function loadInitial() {
    await loadViewer();
    await Promise.all([
      loadSwcAuth(undefined),
      loadPayments(undefined),
      loadFactions(),
    ]);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPageLoading(true);
        await loadInitial();
        if (!cancelled) {
          setPageError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setPageError(e?.message ?? "Failed to load sys debug page.");
          setViewer(null);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onLoadTarget() {
    const parsed = Number(targetUserId);
    const userId = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

    setActiveTargetUserId(userId);

    await Promise.all([
      loadSwcAuth(userId),
      loadPayments(userId),
    ]);
  }

  async function onRunRawSwc() {
    const queryObj = parseQueryStringToObject(rawSwcQuery);

    await runPanel(
      "rawSwc",
      () => getDebugRawSwc(rawSwcPath, queryObj, activeTargetUserId),
      (res) => res
    );
  }

  async function onRunPrivilegeTest() {
    if (!privFactionId.trim()) {
      setPanelError("privilegeTest", new Error("Faction ID is required."));
      return;
    }

    await runPanel(
      "privilegeTest",
      () =>
        testFactionPrivilege(
          privGroup,
          privName,
          privFactionId.trim(),
          activeTargetUserId
        ),
      (res) => res
    );
  }

  async function onRunPaymentTransferTest() {
    const parsedTransferId = Number(paymentTransferId);

    if (!Number.isFinite(parsedTransferId) || parsedTransferId <= 0) {
      setPanelError("paymentTest", new Error("Valid payment transfer ID is required."));
      return;
    }

    await runPanel(
      "paymentTest",
      () => testPaymentTransfer(parsedTransferId, activeTargetUserId),
      (res) => res
    );
  }

  async function onRunManualPaymentTest() {
    const parsedPayerId = Number(manualPayerId);
    const parsedAmount = Number(manualAmount);
    const parsedItemCount = Number(manualItemCount || "100");

    if (!Number.isFinite(parsedPayerId) || parsedPayerId <= 0) {
      setPanelError("paymentTest", new Error("Valid payer subject ID is required."));
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setPanelError("paymentTest", new Error("Valid amount is required."));
      return;
    }

    await runPanel(
      "paymentTest",
      () =>
        testManualPayment(
          {
            payer_subject_type: manualPayerType,
            payer_subject_id: parsedPayerId,
            amount: parsedAmount,
            receiver_uid: manualReceiverUid.trim() || undefined,
            communication: manualCommunication.trim() || undefined,
            item_count:
              Number.isFinite(parsedItemCount) && parsedItemCount > 0
                ? parsedItemCount
                : 100,
          },
          activeTargetUserId
        ),
      (res) => res
    );
  }

  async function onRunUniversePull() {
    const identifier = pullIdentifier.trim();

    if (!identifier) {
      setPanelError("universePull", new Error("Identifier is required."));
      return;
    }

    await runPanel(
      "universePull",
      () => runUniversePull({ resource: pullResource, identifier }),
      (res) => res
    );

    setUniverseTrail((prev) => [
      ...prev,
      { resource: pullResource, identifier },
    ]);
  }

  async function drillUniverse(resource: UniverseResource, identifier?: string | null) {
    const nextIdentifier = (identifier ?? "").trim();

    if (!nextIdentifier) return;

    setPullResource(resource);
    setPullIdentifier(nextIdentifier);

    await runPanel(
      "universePull",
      () => runUniversePull({ resource, identifier: nextIdentifier }),
      (res) => res
    );

    setUniverseTrail((prev) => [
      ...prev,
      { resource, identifier: nextIdentifier },
    ]);
  }

  function resetUniverseTrail() {
    setUniverseTrail([]);
  }

  function copyPanel(key: PanelKey) {
    const data = panels[key].result;
    if (!data) return;
    navigator.clipboard.writeText(pretty(data)).catch(() => {});
  }

  async function onInspectStoredSector() {
    const identifier = inspectSectorIdentifier.trim();

    if (!identifier) {
      setInspectSectorError("Sector UID or identifier is required.");
      setInspectSectorDetail(null);
      return;
    }

    try {
      setInspectSectorLoading(true);
      setInspectSectorError(null);
      const response = await getStoredSector(identifier);
      setInspectSectorDetail(response.data ?? null);
    } catch (e: any) {
      setInspectSectorDetail(null);
      setInspectSectorError(e?.message ?? "Failed to load stored sector detail.");
    } finally {
      setInspectSectorLoading(false);
    }
  }

  if (pageLoading) {
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

  if (pageError) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board admin-board">
            <h1>Sys Debug</h1>
            <p className="small" style={{ color: "salmon" }}>
              {pageError}
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (!viewer) {
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

  if (!viewer.is_sysadmin) {
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

  const renderPanel = (
    key: PanelKey,
    title: string,
    children?: React.ReactNode
  ) => {
    const panel = panels[key];

    return (
      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {panel.ranAt ? (
              <span className="small" style={{ opacity: 0.75 }}>
                Last run: {panel.ranAt}
              </span>
            ) : null}
            <button
              className="btn"
              type="button"
              onClick={() => copyPanel(key)}
              disabled={!panel.result}
            >
              Copy JSON
            </button>
          </div>
        </div>

        {children}

        {panel.loading ? <p className="small">Running…</p> : null}

        {panel.error ? (
          <p className="small" style={{ color: "salmon" }}>
            {panel.error}
          </p>
        ) : null}

        <pre className="small" style={{ whiteSpace: "pre-wrap" }}>
          {panel.result ? pretty(panel.result) : "No data yet."}
        </pre>
      </div>
    );
  };

  const universeData = panels.universePull.result?.data;

  const renderUniverseExplorer = () => {
    if (!universeData) return null;

    const resource = universeData.resource as UniverseResource | undefined;

    return (
      <div
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 12,
          padding: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <strong>Explorer</strong>
          {universeTrail.length > 0 ? (
            <span className="small">
              {universeTrail.map((item) => `${item.resource}:${item.identifier}`).join(" -> ")}
            </span>
          ) : null}
          <button className="btn" type="button" onClick={resetUniverseTrail}>
            Clear path
          </button>
        </div>

        {resource === "sector" && Array.isArray(universeData.systems) && (
          <div style={{ display: "grid", gap: 8 }}>
            <strong>Systems In Sector</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {universeData.systems.slice(0, 40).map((system: any, index: number) => (
                <button
                  key={`${system.uid ?? system.name ?? index}`}
                  className="btn"
                  type="button"
                  onClick={() => drillUniverse("system", system.uid ?? system.name)}
                >
                  {system.name ?? system.uid ?? `System ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {resource === "system" && (
          <>
            {Array.isArray(universeData.planet_stubs) && universeData.planet_stubs.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <strong>Planets In System</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {universeData.planet_stubs.slice(0, 60).map((planet: any, index: number) => (
                    <button
                      key={`${planet.uid ?? planet.name ?? index}`}
                      className="btn"
                      type="button"
                      onClick={() => drillUniverse("planet", planet.uid ?? planet.name)}
                    >
                      {planet.name ?? planet.uid ?? `Planet ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(universeData.station_stubs) && universeData.station_stubs.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <strong>Stations In System</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {universeData.station_stubs.slice(0, 60).map((station: any, index: number) => (
                    <button
                      key={`${station.uid ?? station.name ?? index}`}
                      className="btn"
                      type="button"
                      onClick={() => drillUniverse("station", station.uid ?? station.name)}
                    >
                      {station.name ?? station.uid ?? `Station ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {resource === "planet" && universeData.planet?.system_uid && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <strong>Related:</strong>
            <button
              className="btn"
              type="button"
              onClick={() => drillUniverse("system", universeData.planet.system_uid)}
            >
              Open Parent System
            </button>
          </div>
        )}

        {resource === "station" && universeData.station?.system_uid && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <strong>Related:</strong>
            <button
              className="btn"
              type="button"
              onClick={() => drillUniverse("system", universeData.station.system_uid)}
            >
              Open Parent System
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board admin-board">
          <h1>Sys Debug</h1>
          <p className="small">Target: {targetLabel}</p>

          <nav className="admin-nav" aria-label="Sys debug sections">
            <button
              type="button"
              className={activeTab === "debug" ? "active" : undefined}
              onClick={() => setActiveTab("debug")}
            >
              Debug Tools
            </button>
            <button
              type="button"
              className={activeTab === "systemPuller" ? "active" : undefined}
              onClick={() => setActiveTab("systemPuller")}
            >
              System Puller
            </button>
          </nav>

          {activeTab === "debug" ? (
            <>
              <div className="panel">
                <h2>SWC Debug Auth</h2>
                <p className="small">
                  Re-authorize your SWC account with broader debug scopes for sys/debug testing.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <a className="btn" href={`${getBackendOrigin()}/oauth/debug`}>
                    Re-auth with debug scopes
                  </a>
                </div>
              </div>

              <div className="panel">
                <h2>Target User</h2>
                <p className="small">
                  Leave blank to inspect your own sysadmin session.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    className="input"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="User ID (blank = me)"
                  />
                  <button className="btn" type="button" onClick={onLoadTarget}>
                    Load target
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setTargetUserId("");
                      setActiveTargetUserId(undefined);
                      void Promise.all([loadSwcAuth(undefined), loadPayments(undefined)]);
                    }}
                  >
                    Reset to me
                  </button>
                </div>
              </div>

              {renderPanel(
                "swcAuth",
                "SWC Authorization",
                <div style={{ marginBottom: 12 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => loadSwcAuth(activeTargetUserId)}
                    disabled={panels.swcAuth.loading}
                  >
                    Refresh SWC auth
                  </button>
                </div>
              )}

              {renderPanel(
                "payments",
                "Payments",
                <div style={{ marginBottom: 12 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => loadPayments(activeTargetUserId)}
                    disabled={panels.payments.loading}
                  >
                    Refresh payments
                  </button>
                </div>
              )}

              {renderPanel(
                "factions",
                "Factions",
                <div style={{ marginBottom: 12 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => loadFactions()}
                    disabled={panels.factions.loading}
                  >
                    Refresh factions
                  </button>
                </div>
              )}

              {renderPanel(
                "rawSwc",
                "Raw SWC Test",
                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <input
                    className="input"
                    value={rawSwcPath}
                    onChange={(e) => setRawSwcPath(e.target.value)}
                    placeholder="SWC path, e.g. character/ or character/1:1479821/"
                  />
                  <textarea
                    className="input"
                    value={rawSwcQuery}
                    onChange={(e) => setRawSwcQuery(e.target.value)}
                    placeholder='Query string or JSON, e.g. faction_id=12 or {"faction_id":"12"}'
                    rows={4}
                  />
                  <div>
                    <button
                      className="btn"
                      type="button"
                      onClick={onRunRawSwc}
                      disabled={panels.rawSwc.loading}
                    >
                      Run raw SWC test
                    </button>
                  </div>
                </div>
              )}

              {renderPanel(
                "privilegeTest",
                "Faction Privilege Test",
                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <input
                    className="input"
                    value={privGroup}
                    onChange={(e) => setPrivGroup(e.target.value)}
                    placeholder="Privilege group"
                  />
                  <input
                    className="input"
                    value={privName}
                    onChange={(e) => setPrivName(e.target.value)}
                    placeholder="Privilege name"
                  />
                  <input
                    className="input"
                    value={privFactionId}
                    onChange={(e) => setPrivFactionId(e.target.value)}
                    placeholder="Faction ID"
                  />
                  <div>
                    <button
                      className="btn"
                      type="button"
                      onClick={onRunPrivilegeTest}
                      disabled={panels.privilegeTest.loading}
                    >
                      Run privilege test
                    </button>
                  </div>
                </div>
              )}

              {renderPanel(
                "paymentTest",
                "Payment Credit Log Test",
                <div style={{ display: "grid", gap: 14, marginBottom: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Test existing transfer</h3>
                    <p className="small" style={{ margin: 0 }}>
                      Uses a real local payment transfer and checks whether the backend can match it in SWC credit log.
                    </p>
                    <input
                      className="input"
                      value={paymentTransferId}
                      onChange={(e) => setPaymentTransferId(e.target.value)}
                      placeholder="Payment transfer ID"
                    />
                    <div>
                      <button
                        className="btn"
                        type="button"
                        onClick={onRunPaymentTransferTest}
                        disabled={panels.paymentTest.loading}
                      >
                        Test transfer
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Manual test</h3>
                    <p className="small" style={{ margin: 0 }}>
                      Checks whether a payment with these exact details is visible in the payer credit log.
                    </p>

                    <select
                      className="input"
                      value={manualPayerType}
                      onChange={(e) => setManualPayerType(e.target.value as "user" | "faction")}
                    >
                      <option value="user">user</option>
                      <option value="faction">faction</option>
                    </select>

                    <input
                      className="input"
                      value={manualPayerId}
                      onChange={(e) => setManualPayerId(e.target.value)}
                      placeholder="Payer subject ID"
                    />

                    <input
                      className="input"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="Amount"
                    />

                    <input
                      className="input"
                      value={manualReceiverUid}
                      onChange={(e) => setManualReceiverUid(e.target.value)}
                      placeholder="Receiver SWC UID (optional, e.g. 1:1479821)"
                    />

                    <input
                      className="input"
                      value={manualCommunication}
                      onChange={(e) => setManualCommunication(e.target.value)}
                      placeholder="Communication (optional, but best for exact match)"
                    />

                    <input
                      className="input"
                      value={manualItemCount}
                      onChange={(e) => setManualItemCount(e.target.value)}
                      placeholder="Credit log item count to search (default 100)"
                    />

                    <div>
                      <button
                        className="btn"
                        type="button"
                        onClick={onRunManualPaymentTest}
                        disabled={panels.paymentTest.loading}
                      >
                        Run manual payment test
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="panel">
                <h2>Universe Explorer</h2>
                <p className="small">
                  Use the dedicated universe page for sector {"->"} system {"->"} planet/station drill-down.
                </p>
                <Link to="/sys/debug/universe" className="btn">
                  Open Universe Explorer
                </Link>
              </div>

              {renderPanel(
                "universePull",
                "Universe Pull Test",
                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <select
                    className="input"
                    value={pullResource}
                    onChange={(e) =>
                      setPullResource(e.target.value as UniverseResource)
                    }
                  >
                    <option value="system">System</option>
                    <option value="sector">Sector</option>
                    <option value="planet">Planet</option>
                    <option value="station">Station</option>
                  </select>
                  <input
                    className="input"
                    value={pullIdentifier}
                    onChange={(e) => setPullIdentifier(e.target.value)}
                    placeholder="UID or name, e.g. Tatoo or 9:178"
                  />
                  <div>
                    <button
                      className="btn"
                      type="button"
                      onClick={onRunUniversePull}
                      disabled={panels.universePull.loading}
                    >
                      Run universe pull
                    </button>
                  </div>
                  <p className="small" style={{ margin: 0 }}>
                    Start with a sector like <code>Arkanis</code>, then drill into systems, planets, and stations.
                  </p>
                  {renderUniverseExplorer()}
                </div>
              )}

              <div className="panel">
                <h2>Stored Sector Shape Inspector</h2>
                <p className="small">
                  Load a sector from the local database and inspect the stored bounds, outline,
                  systems, and filled sector cells to find bad overlays.
                </p>

                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <input
                    className="input"
                    value={inspectSectorIdentifier}
                    onChange={(e) => setInspectSectorIdentifier(e.target.value)}
                    placeholder="Sector UID or identifier, e.g. 25:308 or arkanis"
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={onInspectStoredSector}
                      disabled={inspectSectorLoading}
                    >
                      {inspectSectorLoading ? "Loading sector…" : "Inspect stored sector"}
                    </button>
                    {inspectSectorDetail ? (
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(pretty(inspectSectorDetail))
                            .catch(() => {})
                        }
                      >
                        Copy sector JSON
                      </button>
                    ) : null}
                  </div>
                </div>

                {inspectSectorError ? (
                  <p className="small" style={{ color: "salmon" }}>
                    {inspectSectorError}
                  </p>
                ) : null}

                {inspectSectorDetail ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      }}
                    >
                      <div className="panel" style={{ margin: 0 }}>
                        <span className="small">Sector</span>
                        <strong>
                          {inspectSectorDetail.sector.name ?? inspectSectorDetail.sector.uid}
                        </strong>
                      </div>
                      <div className="panel" style={{ margin: 0 }}>
                        <span className="small">UID</span>
                        <strong>{inspectSectorDetail.sector.uid}</strong>
                      </div>
                      <div className="panel" style={{ margin: 0 }}>
                        <span className="small">Bounds</span>
                        <strong>
                          {inspectSectorDetail.bounds
                            ? `${inspectSectorDetail.bounds.width} x ${inspectSectorDetail.bounds.height}`
                            : "Unknown"}
                        </strong>
                      </div>
                      <div className="panel" style={{ margin: 0 }}>
                        <span className="small">Outline Points</span>
                        <strong>{inspectSectorDetail.outline_coordinates.length}</strong>
                      </div>
                      <div className="panel" style={{ margin: 0 }}>
                        <span className="small">Systems</span>
                        <strong>{inspectSectorDetail.systems.length}</strong>
                      </div>
                    </div>

                    <SectorGridMap
                      bounds={inspectSectorDetail.bounds}
                      outlineCoordinates={inspectSectorDetail.outline_coordinates}
                      systems={inspectSectorDetail.systems.map((system) => ({
                        uid: system.uid,
                        name: system.name,
                        identifier: system.identifier,
                        galx: system.galx,
                        galy: system.galy,
                      }))}
                      annotations={inspectSectorDetail.annotations}
                      color={{
                        r: inspectSectorDetail.sector.color_r,
                        g: inspectSectorDetail.sector.color_g,
                        b: inspectSectorDetail.sector.color_b,
                      }}
                      onSystemSelect={() => {}}
                      readOnly={false}
                      showDebugByDefault={true}
                    />

                    <div className="panel">
                      <h3 style={{ marginTop: 0 }}>Stored Sector JSON</h3>
                      <pre className="small" style={{ whiteSpace: "pre-wrap" }}>
                        {pretty(inspectSectorDetail)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SysDebugPage;
