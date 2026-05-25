import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin } from "../api/core/auth";
import type { SwcUser } from "../api/core/auth";
import {
  getSwcAuthorizationStatus,
  updateSwcAuthorizationPreferences,
  updateSwcPublicAuthorizationPreferences,
  type SwcAuthorizationStatus,
} from "../api/members/swcAuthorization";
import SwcToolAccessSection from "../components/aboutme/SwcToolAccessSection";
import FactionConsolePanel from "../components/faction/FactionConsolePanel";
import { BTN_SM } from "../utils/ui";

type Pill = { key: string; label: string; hue: number };
type MemberToolKey = "galaxy" | "payments" | "fleet_command" | "market_personal" | "market_faction";
type PublicToolKey = "payments" | "astrogation";
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
    fleet_command: true,
    market_personal: false,
    market_faction: false,
  });
  const [selectedPublicTools, setSelectedPublicTools] = useState<Record<PublicToolKey, boolean>>({
    payments: true,
    astrogation: true,
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
            fleet_command: true,
            market_personal: false,
            market_faction: false,
          });
          setSelectedPublicTools({
            payments: true,
            astrogation: true,
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
              fleet_command: swcAuthRes.data?.member_tool_preferences?.fleet_command ?? true,
              market_personal: swcAuthRes.data?.member_tool_preferences?.market_personal ?? false,
              market_faction: swcAuthRes.data?.member_tool_preferences?.market_faction ?? false,
            });
            setSelectedPublicTools({
              payments: swcAuthRes.data?.public_tool_preferences?.payments ?? true,
              astrogation: swcAuthRes.data?.public_tool_preferences?.astrogation ?? true,
            });
          }
        } catch {
          if (!cancelled) {
            setSwcAuth(null);
            setSelectedMemberTools({
              galaxy: true,
              payments: true,
              fleet_command: true,
              market_personal: false,
              market_faction: false,
            });
            setSelectedPublicTools({
              payments: true,
              astrogation: true,
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
          has_character_skills_access: false,
          granted_scopes: null,
          token_expires_at: null,
          last_verified_at: null,
          revoked_at: null,
          member_tool_preferences: { galaxy: true, payments: true, fleet_command: true, market_personal: false, market_faction: false },
          public_tool_preferences: { payments: true, astrogation: true },
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
          has_character_skills_access: false,
          granted_scopes: null,
          token_expires_at: null,
          last_verified_at: null,
          revoked_at: null,
          member_tool_preferences: { galaxy: true, payments: true, fleet_command: true, market_personal: false, market_faction: false },
          public_tool_preferences: { payments: true, astrogation: true },
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
      { key: "is_joe_member",                        label: "JOE Member",      hue: 47,  enabled: user.is_joe_member },
      { key: "is_admin",                             label: "Admin",            hue: 25,  enabled: user.is_admin },
      { key: "is_sysadmin",                          label: "Sysadmin",         hue: 0,   enabled: user.is_sysadmin },
      { key: "is_intel",                             label: "Intel",            hue: 210, enabled: user.is_intel },
      { key: "is_garry",                             label: "GARRY",            hue: 280, enabled: user.is_garry },
      { key: "is_raid",                              label: "RAID",             hue: 145, enabled: user.is_raid },
      { key: "can_view_asteroid_intel",              label: "Asteroid Intel",   hue: 185, enabled: user.can_view_asteroid_intel },
      { key: "can_access_combat_calc",               label: "Combat Calc",      hue: 355, enabled: user.can_access_combat_calc },
      { key: "can_access_wrecking_helper_extension", label: "Wrecking Helper",  hue: 90,  enabled: user.can_access_wrecking_helper_extension },
      { key: "can_access_fleet_commander",           label: "Fleet Command",    hue: 230, enabled: user.can_access_fleet_commander },
      { key: "can_manage_blog",                      label: "Manage Blog",      hue: 320, enabled: user.can_manage_blog },
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
      key: "fleet_command",
      title: "Biometrics",
      description: "Grant SWC character skills access for leaders to be able to see your skill stats.",
      enabled: selectedMemberTools.fleet_command,
      accessNow: Boolean(swcAuth?.has_character_skills_access),
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
  ], [selectedMemberTools.galaxy, selectedMemberTools.payments, selectedMemberTools.fleet_command, selectedMemberTools.market_personal, selectedMemberTools.market_faction, swcAuth?.has_character_credits_write_access, swcAuth?.has_character_skills_access, swcAuth?.has_faction_inventory_access, swcAuth?.has_personal_inventory_access, swcAuth?.has_personal_events_access]);

  const isSubscriber = user?.tool_access_tier !== "none" && user?.tool_access_tier != null;

  const publicToolCards = useMemo<Array<ToolCard<PublicToolKey>>>(() => {
    const cards: Array<ToolCard<PublicToolKey>> = [];

    if (isSubscriber) {
      cards.push({
        key: "astrogation",
        title: "Astrogation",
        description: "Pull your personal SWC travel arrivals into the astrogation map so you can scout cells and track your routes.",
        enabled: selectedPublicTools.astrogation,
        accessNow: Boolean(swcAuth?.has_personal_events_access),
      });
    }

    cards.push({
      key: "payments",
      title: "Payments",
      description: "Grant SWC payments access so you can buy items through market checkout or pay for subscription to tools.",
      enabled: selectedPublicTools.payments,
      accessNow: Boolean(swcAuth?.has_character_credits_write_access),
    });

    return cards;
  }, [isSubscriber, selectedPublicTools.astrogation, selectedPublicTools.payments, swcAuth?.has_personal_events_access, swcAuth?.has_character_credits_write_access]);

  if (loading) {
    return (
      <div className="panel !px-3 !py-2.5 grid gap-2 sm:gap-2.5">
        <h1 className="h1 m-0">About Me</h1>
        <p className="muted m-0">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel !px-3 !py-2.5 grid gap-2 sm:gap-2.5">
        <h1 className="h1 m-0">About Me</h1>
        <p className="muted m-0">Error: {error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="panel !px-3 !py-2.5 grid gap-2 sm:gap-2.5">
        <h1 className="h1 m-0">About Me</h1>
        <p className="muted m-0">You’re not logged in.</p>
      </div>
    );
  }

  return (
    <div className="panel !px-3 !py-2.5 grid gap-2 sm:gap-2.5">
      <h1 className="h1 m-0">About Me</h1>

      {swcLinked && (
        <p className="small m-0">Your SWC account has been linked to this profile.</p>
      )}

      <div className="flex items-center gap-2">
        {user.avatar_url ? (
          <img
            className="h-12 w-12 rounded-full border-2 border-[var(--accent)] object-cover"
            src={user.avatar_url}
            alt={user.handle ?? "Avatar"}
          />
        ) : (
          <div className="h-12 w-12 rounded-full border-2 border-[var(--accent)] bg-white/5" />
        )}

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="text-[1.65rem] leading-none font-extrabold tracking-[0.02em]">{user.handle ?? "Unknown"}</div>

          <div className="muted text-[0.94rem] leading-tight">
            Character ID: {user.swc_character_id ?? "—"}
          </div>

          <div className="muted text-[0.94rem] leading-tight">
            User Row ID: {user.id}
          </div>
        </div>
      </div>

      <hr className="w-full border-0 border-t border-white/22 my-1.5" />

      <h2 className="h2 m-0">SWC Account</h2>

      <p className="muted m-0">
        {user.swc_character_id
          ? `Linked as ${user.handle ?? "Unknown"} (${user.swc_character_id}).`
          : "No SWC account linked yet."}
      </p>

      <button className={BTN_SM + " w-full sm:w-auto sm:self-start"} type="button" onClick={onLinkSwc}>
        {user.swc_character_id ? "Relink SWC Account" : "Link SWC Account"}
      </button>

      {user.is_joe_member ? (
        <>
          <hr className="w-full border-0 border-t border-white/22 my-1.5" />
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
          <hr className="w-full border-0 border-t border-white/22 my-1.5" />
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

      <hr className="w-full border-0 border-t border-white/22 my-1.5" />

      <FactionConsolePanel />

      <h2 className="h2 m-0">Permissions</h2>

      <div className="mt-2 flex flex-wrap gap-2">
        {pills.length > 0 ? (
          pills.map(p => (
            <span
              key={p.key}
              className="inline-flex items-center rounded-full border border-transparent bg-transparent px-2.5 py-1 text-xs font-bold tracking-[0.02em]"
              style={{
                borderColor: `hsl(${p.hue}, 70%, 50%, 0.45)`,
                background: `hsl(${p.hue}, 70%, 50%, 0.12)`,
                color: `hsl(${p.hue}, 80%, 75%)`,
              }}
            >
              {p.label}
            </span>
          ))
        ) : (
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold tracking-[0.02em] opacity-70">
            No permissions granted
          </span>
        )}
        {user.tool_subscription && (
          <span
            className="inline-flex items-center rounded-full border border-transparent bg-transparent px-2.5 py-1 text-xs font-bold tracking-[0.02em]"
            style={{ borderColor: "hsl(145, 70%, 50%, 0.45)", background: "hsl(145, 70%, 50%, 0.12)", color: "hsl(145, 80%, 75%)" }}
          >
            Subscriber ({user.tool_subscription.subscriber_type === "faction" ? "Faction" : "Individual"})
          </span>
        )}
        {(user.scan_window_top_left_galx != null || user.scan_window_bottom_right_galx != null) && (
          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[0.72rem] text-white/45">
            {user.scan_window_top_left_galx ?? "—"},{user.scan_window_top_left_galy ?? "—"} → {user.scan_window_bottom_right_galx ?? "—"},{user.scan_window_bottom_right_galy ?? "—"}
          </span>
        )}
      </div>
    </div>
  );
};

export default AboutMe;
