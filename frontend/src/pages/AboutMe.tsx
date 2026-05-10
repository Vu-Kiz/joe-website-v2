import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin } from "../api/auth";
import type { SwcUser } from "../api/auth";
import {
  getSwcAuthorizationStatus,
  updateSwcAuthorizationPreferences,
  updateSwcPublicAuthorizationPreferences,
  type SwcAuthorizationStatus,
} from "../api/swcAuthorization";
import SwcToolAccessSection from "../components/aboutme/SwcToolAccessSection";
import "../styles/_aboutme.sass";

type Pill = { key: string; label: string };
type MemberToolKey = "galaxy" | "payments" | "market_personal" | "market_faction";
type PublicToolKey = "payments";
type ToolCard<K extends string> = {
  key: K;
  title: string;
  description: string;
  enabled: boolean;
  accessNow: boolean;
};

const AboutMe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [swcAuth, setSwcAuth] = useState<SwcAuthorizationStatus | null>(null);
  const [selectedMemberTools, setSelectedMemberTools] = useState<Record<MemberToolKey, boolean>>({
    galaxy: true,
    payments: true,
    market_personal: false,
    market_faction: false,
  });
  const [selectedPublicTools, setSelectedPublicTools] = useState<Record<PublicToolKey, boolean>>({
    payments: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchAuthMe();

        if (!cancelled) {
          setUser(res.user ?? null);
          setSwcAuth(null);
          setSelectedMemberTools({
            galaxy: true,
            payments: true,
            market_personal: false,
            market_faction: false,
          });
          setSelectedPublicTools({
            payments: true,
          });
          setError(null);
        }

        if (!res.user) {
          return;
        }

        try {
          const swcAuthRes = await getSwcAuthorizationStatus();

          if (!cancelled) {
            setSwcAuth(swcAuthRes.data ?? null);
            setSelectedMemberTools({
              galaxy: swcAuthRes.data?.member_tool_preferences?.galaxy ?? true,
              payments: swcAuthRes.data?.member_tool_preferences?.payments ?? true,
              market_personal: swcAuthRes.data?.member_tool_preferences?.market_personal ?? false,
              market_faction: swcAuthRes.data?.member_tool_preferences?.market_faction ?? false,
            });
            setSelectedPublicTools({
              payments: swcAuthRes.data?.public_tool_preferences?.payments ?? true,
            });
          }
        } catch {
          if (!cancelled) {
            setSwcAuth(null);
            setSelectedMemberTools({
              galaxy: true,
              payments: true,
              market_personal: false,
              market_faction: false,
            });
            setSelectedPublicTools({
              payments: true,
            });
          }
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

  function onConnectMemberToolAccess() {
    redirectMemberToolAccess(selectedMemberTools);
  }

  function redirectMemberToolAccess(preferences: Record<MemberToolKey, boolean>) {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;

    const tools = (Object.entries(preferences) as Array<[MemberToolKey, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([tool]) => tool);

    const query = new URLSearchParams({
      return_to: "/aboutme",
      tools: tools.length > 0 ? tools.join(",") : "none",
    });

    window.location.href = `${backendOrigin}/oauth/member-tools?${query.toString()}`;
  }

  function onConnectPublicToolAccess() {
    redirectPublicToolAccess(selectedPublicTools);
  }

  function redirectPublicToolAccess(preferences: Record<PublicToolKey, boolean>) {
    const backendOrigin = getBackendOrigin();
    if (!backendOrigin) return;

    const tools = (Object.entries(preferences) as Array<[PublicToolKey, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([tool]) => tool);

    const query = new URLSearchParams({
      return_to: "/aboutme",
      tools: tools.length > 0 ? tools.join(",") : "none",
    });

    window.location.href = `${backendOrigin}/oauth/public-tools?${query.toString()}`;
  }

  async function toggleMemberTool(tool: MemberToolKey) {
    const previous = selectedMemberTools;
    const nextPreferences = {
      ...selectedMemberTools,
      [tool]: !selectedMemberTools[tool],
    };

    setSelectedMemberTools(nextPreferences);

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
          member_tool_preferences: { galaxy: true, payments: true, market_personal: false, market_faction: false },
          public_tool_preferences: { payments: true },
        }),
        member_tool_preferences: response.data.member_tool_preferences,
        public_tool_preferences: response.data.public_tool_preferences,
      }));
    } catch {
      setSelectedMemberTools(previous);
    }
  }

  async function togglePublicTool(tool: PublicToolKey) {
    const previous = selectedPublicTools;
    const nextPreferences = {
      ...selectedPublicTools,
      [tool]: !selectedPublicTools[tool],
    };

    setSelectedPublicTools(nextPreferences);

    try {
      const response = await updateSwcPublicAuthorizationPreferences(nextPreferences);
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
          member_tool_preferences: { galaxy: true, payments: true, market_personal: false, market_faction: false },
          public_tool_preferences: { payments: true },
        }),
        member_tool_preferences: response.data.member_tool_preferences,
        public_tool_preferences: response.data.public_tool_preferences,
      }));
    } catch {
      setSelectedPublicTools(previous);
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

  const hasSelectedMemberTools = useMemo(
    () => Object.values(selectedMemberTools).some(Boolean),
    [selectedMemberTools]
  );
  const hasSelectedPublicTools = useMemo(
    () => Object.values(selectedPublicTools).some(Boolean),
    [selectedPublicTools]
  );

  const memberToolCards = useMemo<Array<ToolCard<MemberToolKey>>>(() => [
    {
      key: "galaxy",
      title: "Astrogation",
      description: "Pull your personal SWC travel arrivals into the shared astrogation intel map.",
      enabled: selectedMemberTools.galaxy,
      accessNow: Boolean(swcAuth?.has_personal_events_access),
    },
    {
      key: "payments",
      title: "Payments",
      description: "Verify logs and run faction payment checks from the payments tools.",
      enabled: selectedMemberTools.payments,
      accessNow: Boolean(swcAuth?.has_character_credits_write_access),
    },
    {
      key: "market_personal",
      title: "Market (Personal Inventory)",
      description: "Grant access to your personal SWC inventory for browsing and listing in the internal market.",
      enabled: selectedMemberTools.market_personal,
      accessNow: Boolean(swcAuth?.has_personal_inventory_access),
    },
    {
      key: "market_faction",
      title: "Market (Faction Store)",
      description: "Grant access to faction inventory for the internal market. Requires faction privileges.",
      enabled: selectedMemberTools.market_faction,
      accessNow: Boolean(swcAuth?.has_faction_inventory_access),
    },
  ], [selectedMemberTools.galaxy, selectedMemberTools.payments, selectedMemberTools.market_personal, selectedMemberTools.market_faction, swcAuth?.has_character_credits_write_access, swcAuth?.has_faction_inventory_access, swcAuth?.has_personal_inventory_access, swcAuth?.has_personal_events_access]);

  const publicToolCards = useMemo<Array<ToolCard<PublicToolKey>>>(() => [
    {
      key: "payments",
      title: "Payments",
      description: "Grant SWC payments access so you can buy items through market checkout.",
      enabled: selectedPublicTools.payments,
      accessNow: Boolean(swcAuth?.has_character_credits_write_access),
    },
  ], [selectedPublicTools.payments, swcAuth?.has_character_credits_write_access]);

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

      {user.is_joe_member ? (
        <>
          <hr className="divider" />
          <SwcToolAccessSection
            title="SWC Tool Access"
            description="Turn tools on or off here, then sync once to grant only the access you want."
            cards={memberToolCards}
            hasSelectedTools={hasSelectedMemberTools}
            isConnected={Boolean(swcAuth?.member_tools_connected)}
            onConnect={onConnectMemberToolAccess}
            onToggle={toggleMemberTool}
            connectLabel="Connect Selected Tool Access"
            resyncLabel="Resync Selected Tool Access"
            allowConnectWhenEmpty
            emptySelectionActionLabel="Disable All SWC Tool Access"
            emptySelectionMessage="All tools are off. Click the button above to resync and remove tool access."
          />
        </>
      ) : (
        <>
          <hr className="divider" />
          <SwcToolAccessSection
            title="Public Tool Access"
            description="Enable public tools and sync SWC access for the tools you want to use."
            cards={publicToolCards}
            hasSelectedTools={hasSelectedPublicTools}
            isConnected={Boolean(swcAuth?.public_tools_connected || swcAuth?.payments_connected)}
            onConnect={onConnectPublicToolAccess}
            onToggle={togglePublicTool}
            connectLabel="Connect Selected Public Access"
            resyncLabel="Resync Selected Public Access"
            allowConnectWhenEmpty
            emptySelectionActionLabel="Disable All Public Tool Access"
            emptySelectionMessage="All public tools are off. Click the button above to resync and remove public tool access."
          />
        </>
      )}

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
