import React, { useEffect, useMemo, useState } from "react";
import { getAdminWebsiteHealth, type AdminWebsiteHealthState } from "../../api/admin/adminWebsiteHealth";
import { ensureCsrfCookie, fetchAuthMe, getApiBaseUrl, getBackendOrigin } from "../../api/core/auth";

declare const __APP_VERSION__: string;

type FrontendCheckState = {
  status: "loading" | "ok" | "warn" | "error";
  origin: string;
  apiBaseUrl: string;
  backendOrigin: string;
  appVersion: string;
  apiHealthReachable: boolean;
  csrfCookieReady: boolean;
  authReachable: boolean;
  authUserPresent: boolean | null;
  error: string | null;
};

const toneForStatus = (status: string): string => {
  switch (status) {
    case "ok":
      return "#7CFFB2";
    case "warn":
      return "#FFD166";
    case "error":
      return "#FF8A8A";
    default:
      return "#D7E0EA";
  }
};

const boolLabel = (value: boolean): string => (value ? "Writable" : "Blocked");

const formatEnv = (value: string | null | undefined): string => {
  const env = String(value ?? "").trim().toLowerCase();
  if (!env) {
    return "Unknown";
  }

  if (env === "local" || env === "development") {
    return "dev";
  }

  return env;
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  overflowX: "auto",
  alignItems: "stretch",
  paddingBottom: 4,
};

const cardStyle: React.CSSProperties = {
  minWidth: 260,
  flex: "0 0 260px",
};

const AdminWebsiteHealthPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<AdminWebsiteHealthState | null>(null);
  const [frontendCheck, setFrontendCheck] = useState<FrontendCheckState>({
    status: "loading",
    origin: typeof window !== "undefined" ? window.location.origin : "",
    apiBaseUrl: getApiBaseUrl(),
    backendOrigin: getBackendOrigin(),
    appVersion: __APP_VERSION__,
    apiHealthReachable: false,
    csrfCookieReady: false,
    authReachable: false,
    authUserPresent: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await getAdminWebsiteHealth();
        if (cancelled) return;

        setHealth(response.data);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load website health.");
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const apiBaseUrl = getApiBaseUrl();
      const backendOrigin = getBackendOrigin();

      const nextState: FrontendCheckState = {
        status: "loading",
        origin: typeof window !== "undefined" ? window.location.origin : "",
        apiBaseUrl,
        backendOrigin,
        appVersion: __APP_VERSION__,
        apiHealthReachable: false,
        csrfCookieReady: false,
        authReachable: false,
        authUserPresent: null,
        error: null,
      };

      try {
        if (!apiBaseUrl) {
          throw new Error("VITE_API_BASE_URL is missing");
        }

        const healthResponse = await fetch(`${apiBaseUrl}/time`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        nextState.apiHealthReachable = healthResponse.ok;

        await ensureCsrfCookie();
        nextState.csrfCookieReady = true;

        const auth = await fetchAuthMe();
        nextState.authReachable = true;
        nextState.authUserPresent = !!auth.user;

        nextState.status = nextState.apiHealthReachable && nextState.csrfCookieReady && nextState.authReachable
          ? "ok"
          : "warn";
      } catch (e: any) {
        nextState.status = "error";
        nextState.error = e?.message ?? "Frontend health checks failed.";
      }

      if (!cancelled) {
        setFrontendCheck(nextState);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const storageChecks = useMemo(() => {
    if (!health) {
      return [];
    }

    return [
      ["App Storage", health.storage.app_storage_writable],
      ["Framework", health.storage.framework_writable],
      ["Framework Cache", health.storage.cache_writable],
      ["Bootstrap Cache", health.storage.bootstrap_cache_writable],
    ] as const;
  }, [health]);

  return (
    <div className="panel">
      <h2 className="h2" style={{ marginTop: 0 }}>Website Health</h2>
      <p className="small">
        Sysadmin-only snapshot of backend health, queue pressure, and writable runtime paths.
      </p>

      {loading ? <p className="small">Loading website health…</p> : null}
      {error ? <p className="small" style={{ color: "salmon" }}>{error}</p> : null}

      {!loading && !error && health ? (
        <>
          <div style={{ ...rowStyle, marginBottom: "1rem" }}>
            <section className="panel flex flex-col gap-4" style={cardStyle}>
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Application</h3>
                <p className="small"><strong>Name:</strong> {health.app.name ?? "Unknown"}</p>
                <p className="small"><strong>Env:</strong> {formatEnv(health.app.env)}</p>
                <p className="small"><strong>URL:</strong> {health.app.app_url ?? "Unknown"}</p>
                <p className="small"><strong>PHP:</strong> {health.app.php ?? "Unknown"}</p>
                <p className="small"><strong>Laravel:</strong> {health.app.laravel ?? "Unknown"}</p>
                <p className="small"><strong>Server Time:</strong> {health.app.now ? new Date(health.app.now).toLocaleString() : "Unknown"}</p>
              </div>
            </section>

            <section className="panel flex flex-col gap-4" style={cardStyle}>
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Frontend Path</h3>
                <p className="small">
                  <strong>Status:</strong>{" "}
                  <span style={{ color: toneForStatus(frontendCheck.status) }}>
                    {frontendCheck.status.toUpperCase()}
                  </span>
                </p>
                <p className="small"><strong>Browser Origin:</strong> {frontendCheck.origin || "Unknown"}</p>
                <p className="small"><strong>Webapp Version:</strong> {frontendCheck.appVersion || "Unknown"}</p>
                <p className="small"><strong>API Base:</strong> {frontendCheck.apiBaseUrl || "Missing"}</p>
                <p className="small"><strong>Backend Origin:</strong> {frontendCheck.backendOrigin || "Missing"}</p>
                <p className="small"><strong>API Health Reachable:</strong> {frontendCheck.apiHealthReachable ? "Yes" : "No"}</p>
                <p className="small"><strong>CSRF Cookie:</strong> {frontendCheck.csrfCookieReady ? "Ready" : "Not confirmed"}</p>
                <p className="small"><strong>Auth Endpoint:</strong> {frontendCheck.authReachable ? "Reachable" : "Not confirmed"}</p>
                <p className="small">
                  <strong>Active Session:</strong>{" "}
                  {frontendCheck.authUserPresent === null ? "Unknown" : frontendCheck.authUserPresent ? "Signed in" : "Guest"}
                </p>
                {frontendCheck.error ? (
                  <p className="small" style={{ color: "salmon" }}>
                    {frontendCheck.error}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="panel flex flex-col gap-4" style={cardStyle}>
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Database</h3>
                <p className="small">
                  <strong>Status:</strong>{" "}
                  <span style={{ color: toneForStatus(health.database.status) }}>
                    {health.database.status.toUpperCase()}
                  </span>
                </p>
                <p className="small"><strong>Driver:</strong> {health.database.driver ?? "Unknown"}</p>
                <p className="small"><strong>Host:</strong> {health.database.host ?? "Unknown"}</p>
                <p className="small"><strong>Database:</strong> {health.database.database ?? "Unknown"}</p>
                {health.database.error ? (
                  <p className="small" style={{ color: "salmon" }}>
                    {health.database.error}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="panel flex flex-col gap-4" style={cardStyle}>
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Queue</h3>
                <p className="small">
                  <strong>Status:</strong>{" "}
                  <span style={{ color: toneForStatus(health.queue.status) }}>
                    {health.queue.status.toUpperCase()}
                  </span>
                </p>
                <p className="small"><strong>Connection:</strong> {health.queue.default_connection ?? "Unknown"}</p>
                <p className="small"><strong>Driver:</strong> {health.queue.driver ?? "Unknown"}</p>
                <p className="small"><strong>Pending Jobs:</strong> {health.queue.pending_jobs ?? "Unknown"}</p>
                <p className="small">
                  <strong>Recent Failed Jobs:</strong> {health.queue.recent_failed_jobs ?? "Unknown"}
                  {health.queue.recent_failure_window_hours
                    ? ` (last ${health.queue.recent_failure_window_hours}h)`
                    : ""}
                </p>
                <p className="small"><strong>All-Time Failed Jobs:</strong> {health.queue.failed_jobs ?? "Unknown"}</p>
                <p className="small">
                  <strong>Last Failure:</strong>{" "}
                  {health.queue.last_failed_at ? new Date(health.queue.last_failed_at).toLocaleString() : "None recorded"}
                </p>
                {health.queue.error ? (
                  <p className="small" style={{ color: "salmon" }}>
                    {health.queue.error}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="panel flex flex-col gap-4" style={cardStyle}>
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0">Discord Bot</h3>
                <p className="small">
                  <strong>Status:</strong>{" "}
                  <span style={{ color: toneForStatus(health.discord_bot.status) }}>
                    {health.discord_bot.status.toUpperCase()}
                  </span>
                </p>
                <p className="small"><strong>Configured:</strong> {health.discord_bot.configured ? "Yes" : "No"}</p>
                <p className="small"><strong>Known Guilds:</strong> {health.discord_bot.known_guilds ?? "Unknown"}</p>
                <p className="small"><strong>Available Guilds:</strong> {health.discord_bot.available_guilds ?? "Unknown"}</p>
                <p className="small"><strong>Outbox Pending:</strong> {health.discord_bot.outbox_pending ?? "Unknown"}</p>
                <p className="small"><strong>Outbox Processing:</strong> {health.discord_bot.outbox_processing ?? "Unknown"}</p>
                <p className="small"><strong>Outbox Failed:</strong> {health.discord_bot.outbox_failed ?? "Unknown"}</p>
                {health.discord_bot.last_seen_guild ? (
                  <p className="small">
                    <strong>Last Seen Guild:</strong> {health.discord_bot.last_seen_guild.guild_name ?? health.discord_bot.last_seen_guild.guild_id ?? "Unknown"}
                    {health.discord_bot.last_seen_guild.last_seen_at
                      ? ` · ${new Date(health.discord_bot.last_seen_guild.last_seen_at).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
                {health.discord_bot.error ? (
                  <p className="small" style={{ color: "salmon" }}>
                    {health.discord_bot.error}
                  </p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="panel">
            <h3 className="h3" style={{ marginTop: 0 }}>Writable Paths</h3>
            <div style={rowStyle}>
              {storageChecks.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-4" style={cardStyle}>
                  <h3 className="m-0">{label}</h3>
                  <p className="small" style={{ color: value ? toneForStatus("ok") : toneForStatus("error") }}>
                    {boolLabel(value)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default AdminWebsiteHealthPanel;
