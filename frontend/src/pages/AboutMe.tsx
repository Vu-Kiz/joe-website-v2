import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin } from "../api/auth";
import type { SwcUser } from "../api/auth";
import {
  getSwcAuthorizationStatus,
  updateSwcAuthorizationPreferences,
  type SwcAuthorizationStatus,
} from "../api/swcAuthorization";
import "../styles/_aboutme.sass";

type Pill = { key: string; label: string };
type ToolKey = "galaxy" | "payments";
type ToolCard = {
  key: ToolKey;
  title: string;
  description: string;
  route: string;
  routeLabel: string;
  enabled: boolean;
  accessNow: boolean;
};

const AboutMe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [selectedTools, setSelectedTools] = useState<Record<ToolKey, boolean>>({
    galaxy: true,
    payments: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [res, swcAuthRes] = await Promise.all([
          fetchAuthMe(),
          getSwcAuthorizationStatus(),
        ]);
        if (!cancelled) {
          setUser(res.user ?? null);
          setSwcAuth(swcAuthRes.data ?? null);
          setSelectedTools({
            galaxy: swcAuthRes.data?.member_tool_preferences?.galaxy ?? true,
            payments: swcAuthRes.data?.member_tool_preferences?.payments ?? true,
          });
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load profile");
          setUser(null);
          setSwcAuth(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const swcLinked = searchParams.get("swc_linked") === "1";

  function onLinkSwc() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;
    window.location.href = `${backendOrigin}/oauth`;
  }

  function onConnectToolAccess() {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;

    const tools = (Object.entries(selectedTools) as Array<[ToolKey, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([tool]) => tool);

    const query = new URLSearchParams({
      return_to: "/aboutme",
      ...(tools.length > 0 ? { tools: tools.join(",") } : {}),
    });

    window.location.href = `${backendOrigin}/oauth/member-tools?${query.toString()}`;
  }

  async function toggleTool(tool: ToolKey) {
    const previous = selectedTools;
    const nextPreferences = {
      ...selectedTools,
      [tool]: !selectedTools[tool],
    };

    setSelectedTools(nextPreferences);

    try {
      const response = await updateSwcAuthorizationPreferences(nextPreferences);
      setSwcAuth((current) => ({
        ...(current ?? {
          connected: false,
          has_personal_events_access: false,
          has_personal_credit_log_access: false,
          has_faction_credit_log_access: false,
          has_character_privileges_access: false,
          granted_scopes: null,
          token_expires_at: null,
          last_verified_at: null,
          revoked_at: null,
        }),
        member_tool_preferences: response.data.member_tool_preferences,
      }));
    } catch {
      setSelectedTools(previous);
    }
  }

  const pills: Pill[] = useMemo(() => {
    if (!user) return [];

    const possible: Array<Pill & { enabled: boolean }> = [
      { key: "is_joe_member", label: "JOE Member", enabled: user.is_joe_member },
      { key: "is_admin", label: "Admin", enabled: user.is_admin },
      { key: "is_sysadmin", label: "Sysadmin", enabled: user.is_sysadmin },
      { key: "is_intel", label: "Intel", enabled: user.is_intel },
      { key: "is_garry", label: "GARRY", enabled: user.is_garry },
      { key: "is_raid", label: "RAID", enabled: user.is_raid },
    ];

    return possible.filter(p => p.enabled).map(({ enabled, ...rest }) => rest);
  }, [user]);

  const hasSelectedTools = useMemo(
    () => Object.values(selectedTools).some(Boolean),
    [selectedTools]
  );

  const toolCards = useMemo<ToolCard[]>(() => [
    {
      key: "galaxy",
      title: "Astrogation",
      description: "Pull your personal SWC travel arrivals into the shared astrogation intel map.",
      route: "/members?members_view=universe",
      routeLabel: "Go to Astrogation",
      enabled: selectedTools.galaxy,
      accessNow: Boolean(swcAuth?.has_personal_events_access),
    },
    {
      key: "payments",
      title: "Payments",
      description: "Verify logs and run faction payment checks from the payments tools.",
      route: "/payments",
      routeLabel: "Go to Payments",
      enabled: selectedTools.payments,
      accessNow: Boolean(
        swcAuth?.has_personal_credit_log_access
          || swcAuth?.has_faction_credit_log_access
          || swcAuth?.has_character_privileges_access
      ),
    },
  ], [selectedTools.galaxy, selectedTools.payments, swcAuth?.has_character_privileges_access, swcAuth?.has_faction_credit_log_access, swcAuth?.has_personal_credit_log_access, swcAuth?.has_personal_events_access]);

  if (loading) {
    return (
      <div className="panel aboutme-panel">
        <h1 className="h1">About Me</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel aboutme-panel">
        <h1 className="h1">About Me</h1>
        <p className="muted">Error: {error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="panel aboutme-panel">
        <h1 className="h1">About Me</h1>
        <p className="muted">You’re not logged in.</p>
      </div>
    );
  }

  return (
    <div className="panel aboutme-panel">
      <h1 className="h1">About Me</h1>

      {swcLinked && (
        <p className="small">Your SWC account has been linked to this profile.</p>
      )}

      <div className="aboutme-header">
        {user.avatar_url ? (
          <img className="aboutme-avatar" src={user.avatar_url} alt={user.handle ?? "Avatar"} />
        ) : (
          <div className="aboutme-avatar aboutme-avatar--placeholder" />
        )}

        <div className="aboutme-meta">
          <div className="aboutme-handle">{user.handle ?? "Unknown"}</div>

          <div className="aboutme-sub muted">
            Character ID: {user.swc_character_id ?? "—"}
          </div>

          <div className="aboutme-sub muted">
            User Row ID: {user.id}
          </div>
        </div>
      </div>

      <hr className="divider" />

      <h2 className="h2">SWC Account</h2>

      <p className="muted">
        {user.swc_character_id
          ? `Linked as ${user.handle ?? "Unknown"} (${user.swc_character_id}).`
          : "No SWC account linked yet."}
      </p>

      <button className="btn" type="button" onClick={onLinkSwc}>
        {user.swc_character_id ? "Relink SWC Account" : "Link SWC Account"}
      </button>

      <hr className="divider" />

      <h2 className="h2">SWC Tool Access</h2>

      <p className="muted">
        Turn tools on or off here, then sync once to grant only the access you want.
      </p>

      <button className="btn" type="button" onClick={onConnectToolAccess} disabled={!hasSelectedTools}>
        {swcAuth?.member_tools_connected ? "Resync Selected Tool Access" : "Connect Selected Tool Access"}
      </button>

      {!hasSelectedTools && (
        <p className="small">Turn on at least one tool before syncing SWC access.</p>
      )}

      <div className="aboutme-access-grid">
        {toolCards.map((tool) => (
          <section key={tool.key} className="aboutme-access-card">
            <div className="aboutme-access-row">
              <h3 className="aboutme-access-title">{tool.title}</h3>
            </div>

            <p className="muted aboutme-access-copy">{tool.description}</p>

            <div className="aboutme-access-status-row">
              <span className="small">Access now</span>
              <strong>{tool.accessNow ? "Yes" : "No"}</strong>
            </div>

            <div className="aboutme-access-actions">
              <button
                className={`aboutme-access-toggle${tool.enabled ? " aboutme-access-toggle--on" : ""}`}
                type="button"
                aria-pressed={tool.enabled}
                onClick={() => toggleTool(tool.key)}
              >
                {tool.enabled ? "Enabled" : "Disabled"}
              </button>

              <Link className="btn" to={tool.route}>
                {tool.routeLabel}
              </Link>
            </div>
          </section>
        ))}
      </div>

      <hr className="divider" />

      <h2 className="h2">Permissions</h2>

      <div className="pill-row">
        {pills.length > 0 ? (
          pills.map(p => (
            <span key={p.key} className="pill">
              {p.label}
            </span>
          ))
        ) : (
          <span className="pill pill--muted">No permissions granted</span>
        )}
      </div>
    </div>
  );
};

export default AboutMe;
