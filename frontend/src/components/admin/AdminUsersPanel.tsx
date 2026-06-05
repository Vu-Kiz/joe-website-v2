import React, { useEffect, useMemo, useState } from "react";
import {
  fullResetAdminUserSystemUpdater,
  forceAdminUserLogout,
  listAdminUsers,
  listFactionSubscriptions,
  revokeAdminUserSwcAuthorization,
  revokeAdminUserSubscription,
  revokeFactionSubscription,
  revokeAllAdminUsersSwcAuthorization,
  updateAdminUserPermissions,
  type AdminFactionSubscription,
  type AdminManageableUser,
} from "../../api/admin/adminUsers";
import { fetchAuthMe } from "../../api/core/auth";
import { BTN_SM, BTN_GHOST_SM, INPUT} from "../../utils/ui";

type EditableUserState = {
  id: number;
  handle: string;
  swcHandle: string;
  discordIdentity: string;
  swcCharacterId: string;
  avatarUrl: string;
  factions: { id: number; name: string; abbreviation: string | null }[];
  scanWindowTopLeftGalx: string;
  scanWindowTopLeftGaly: string;
  scanWindowBottomRightGalx: string;
  scanWindowBottomRightGaly: string;

  isJoeMember: boolean;
  isAdmin: boolean;
  isSysadmin: boolean;
  isIntel: boolean;
  canViewAsteroidIntel: boolean;
  canAccessCombatCalc: boolean;
  canAccessWreckingHelperExtension: boolean;
  canAccessFleetCommander: boolean;
  canAccessRmBrowser: boolean;
  isRmBrowserServiceAccount: boolean;
  isCombatOpsServiceAccount: boolean;
  isGarry: boolean;
  isRaid: boolean;

  canManageBlog: boolean;
  activeSub: { id: number; plan_key: string; current_period_end: string | null } | null;
};

function mapUser(user: AdminManageableUser): EditableUserState {
  return {
    id: user.id,
    handle: user.handle ?? "User",
    swcHandle: user.swc_handle ?? "",
    discordIdentity:
      user.discord_global_name ??
      user.discord_username ??
      "",
    swcCharacterId:
      user.swc_character_id != null ? String(user.swc_character_id) : "",
    avatarUrl: user.swc_avatar_url ?? "",
    factions: user.factions ?? [],
    scanWindowTopLeftGalx:
      user.scan_window_top_left_galx != null ? String(user.scan_window_top_left_galx) : "",
    scanWindowTopLeftGaly:
      user.scan_window_top_left_galy != null ? String(user.scan_window_top_left_galy) : "",
    scanWindowBottomRightGalx:
      user.scan_window_bottom_right_galx != null ? String(user.scan_window_bottom_right_galx) : "",
    scanWindowBottomRightGaly:
      user.scan_window_bottom_right_galy != null ? String(user.scan_window_bottom_right_galy) : "",
    isJoeMember: !!user.is_joe_member,
    isAdmin: !!user.is_admin,
    isSysadmin: !!user.is_sysadmin,
    isIntel: !!user.is_intel,
    canViewAsteroidIntel: !!user.can_view_asteroid_intel,
    canAccessCombatCalc: !!user.can_access_combat_calc,
    canAccessWreckingHelperExtension: !!user.can_access_wrecking_helper_extension,
    canAccessFleetCommander: !!user.can_access_fleet_commander,
    canAccessRmBrowser: !!user.can_access_rm_browser,
    isRmBrowserServiceAccount: !!user.is_rm_browser_service_account,
    isCombatOpsServiceAccount: !!user.is_combat_ops_service_account,
    isGarry: !!user.is_garry,
    isRaid: !!user.is_raid,
    canManageBlog: !!user.can_manage_blog,
    activeSub: user.active_subscription ?? null,
  };
}

const AdminUsersPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [forcingLogoutId, setForcingLogoutId] = useState<number | null>(null);
  const [revokingSwcId, setRevokingSwcId] = useState<number | null>(null);
  const [revokingSubId, setRevokingSubId] = useState<number | null>(null);
  const [revokingAllSwc, setRevokingAllSwc] = useState(false);
  const [resettingSystemUpdaterId, setResettingSystemUpdaterId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openScanWindowId, setOpenScanWindowId] = useState<number | null>(null);
  const [users, setUsers] = useState<EditableUserState[]>([]);
  const [isSysadmin, setIsSysadmin] = useState(false);
  const [factionSubs, setFactionSubs] = useState<AdminFactionSubscription[]>([]);
  const [revokingFactionSubId, setRevokingFactionSubId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [res, meRes] = await Promise.all([listAdminUsers(), fetchAuthMe()]);
        if (cancelled) return;

        setUsers((res.users ?? []).map(mapUser));
        const sysadmin = Boolean(meRes.user?.is_sysadmin);
        setIsSysadmin(sysadmin);

        if (sysadmin) {
          const factionRes = await listFactionSubscriptions().catch(() => ({ ok: false, data: [] }));
          if (!cancelled) setFactionSubs(factionRes.data ?? []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load users");
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

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) => {
      return (
        user.handle.toLowerCase().includes(q) ||
        user.swcHandle.toLowerCase().includes(q) ||
        user.discordIdentity.toLowerCase().includes(q) ||
        user.swcCharacterId.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const menuButtonBaseClass = "inline-flex h-10 w-10 shrink-0 cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.03] text-inherit";
  const menuButtonOpenClass = "border-[#f5d546]/35 bg-[#f5d546]/10";
  const menuBarBaseClass = "block h-[2px] w-5 rounded-full bg-white/80 transition-colors duration-150";
  const menuBarOpenClass = "bg-[#f5d546]";
  const permTileBaseClass = "relative flex cursor-pointer flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.02] px-4 py-4 transition-all duration-150 hover:-translate-y-px hover:border-[#f5d546]/30 hover:bg-[#f5d546]/[0.04]";
  const permTileActiveClass = "border-[#f5d546]/40 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.15)]";
  const permSwitchActiveClass = "border-[#f5d546]/35 bg-[#f5d546]/25";
  const permSwitchKnobActiveClass = "translate-x-5";

  const updateLocalUser = (
    userId: number,
    updater: (current: EditableUserState) => EditableUserState
  ) => {
    setUsers((current) =>
      current.map((user) => (user.id === userId ? updater(user) : user))
    );
  };

  const handleToggle = (
    userId: number,
    key: "isAdmin" | "isIntel" | "canViewAsteroidIntel" | "canManageBlog"
      | "canAccessCombatCalc" | "canAccessWreckingHelperExtension"
      | "canAccessFleetCommander" | "canAccessRmBrowser" | "isRmBrowserServiceAccount"
  ) => {
    setNotice(null);

    updateLocalUser(userId, (user) => ({
      ...user,
      [key]: !user[key],
    }));
  };

  const handleSave = async (user: EditableUserState) => {
    try {
      setSavingId(user.id);
      setError(null);
      setNotice(null);

      const res = await updateAdminUserPermissions(user.id, {
        is_admin: user.isAdmin,
        is_intel: user.isIntel,
        can_view_asteroid_intel: user.canViewAsteroidIntel,
        can_access_combat_calc: user.canAccessCombatCalc,
        can_access_wrecking_helper_extension: user.canAccessWreckingHelperExtension,
        can_access_fleet_commander: user.canAccessFleetCommander,
        can_access_rm_browser: user.canAccessRmBrowser,
        is_rm_browser_service_account: user.isRmBrowserServiceAccount,
        is_combat_ops_service_account: user.isCombatOpsServiceAccount,
        scan_window_top_left_galx: user.scanWindowTopLeftGalx.trim() === "" ? null : Number(user.scanWindowTopLeftGalx),
        scan_window_top_left_galy: user.scanWindowTopLeftGaly.trim() === "" ? null : Number(user.scanWindowTopLeftGaly),
        scan_window_bottom_right_galx: user.scanWindowBottomRightGalx.trim() === "" ? null : Number(user.scanWindowBottomRightGalx),
        scan_window_bottom_right_galy: user.scanWindowBottomRightGaly.trim() === "" ? null : Number(user.scanWindowBottomRightGaly),
        can_manage_blog: user.canManageBlog,
      });

      const updated = mapUser(res.user);

      setUsers((current) =>
        current.map((item) => (item.id === user.id ? updated : item))
      );

      setNotice(`Saved permissions for ${updated.handle}.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save permissions");
    } finally {
      setSavingId(null);
    }
  };

  const handleForceLogout = async (user: EditableUserState) => {
    try {
      setForcingLogoutId(user.id);
      setError(null);
      setNotice(null);

      const res = await forceAdminUserLogout(user.id);
      setNotice(res.message || `Forced logout for ${user.handle}.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to force logout.");
    } finally {
      setForcingLogoutId(null);
    }
  };

  const handleFullResetSystemUpdater = async (user: EditableUserState) => {
    const shouldReset = window.confirm(
      `Full reset system updater for ${user.handle}? This preserves map data, resets cursor, and clears their legacy import linkage.`
    );

    if (!shouldReset) {
      return;
    }

    try {
      setResettingSystemUpdaterId(user.id);
      setError(null);
      setNotice(null);

      const res = await fullResetAdminUserSystemUpdater(user.id);
      setNotice(
        res.message ||
          `Full reset complete for ${user.handle}. Cleared ${res.legacy?.links_cleared ?? 0} legacy link(s).`
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to full-reset system updater.");
    } finally {
      setResettingSystemUpdaterId(null);
    }
  };

  const handleRevokeSwcAuthorization = async (user: EditableUserState) => {
    const shouldRevoke = window.confirm(
      `Revoke SWC authorization for ${user.handle}? They will be forced to reconnect Chain Code Verification.`
    );

    if (!shouldRevoke) {
      return;
    }

    try {
      setRevokingSwcId(user.id);
      setError(null);
      setNotice(null);

      const res = await revokeAdminUserSwcAuthorization(user.id);
      setNotice(
        res.message ||
          `Revoked SWC access for ${user.handle}.`
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to revoke SWC authorization.");
    } finally {
      setRevokingSwcId(null);
    }
  };

  const handleRevokeSubscription = async (user: EditableUserState) => {
    if (!window.confirm(`Revoke active subscription for ${user.handle}?`)) return;
    try {
      setRevokingSubId(user.id);
      setError(null);
      setNotice(null);
      const res = await revokeAdminUserSubscription(user.id);
      setNotice(res.message || `Subscription revoked for ${user.handle}.`);
      setUsers((current) =>
        current.map((u) => u.id === user.id ? { ...u, activeSub: null } : u)
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to revoke subscription.");
    } finally {
      setRevokingSubId(null);
    }
  };

  const handleRevokeFactionSubscription = async (sub: AdminFactionSubscription) => {
    if (!window.confirm(`Revoke subscription for ${sub.faction?.name ?? `faction #${sub.id}`}?`)) return;
    try {
      setRevokingFactionSubId(sub.id);
      setError(null);
      setNotice(null);
      const res = await revokeFactionSubscription(sub.id);
      setNotice(res.message || "Faction subscription revoked.");
      setFactionSubs((current) => current.filter((s) => s.id !== sub.id));
    } catch (e: any) {
      setError(e?.message ?? "Failed to revoke faction subscription.");
    } finally {
      setRevokingFactionSubId(null);
    }
  };

  const handleRevokeAllSwcAuthorizations = async () => {
    const confirmation = window.prompt(
      "Type REVOKE_ALL_SWC_AUTH to revoke SWC authorization for all users."
    );

    if (confirmation !== "REVOKE_ALL_SWC_AUTH") {
      return;
    }

    try {
      setRevokingAllSwc(true);
      setError(null);
      setNotice(null);

      const res = await revokeAllAdminUsersSwcAuthorization();
      setNotice(
        res.message ||
          `Revoked SWC authorization for ${res.result.affected_users} user(s).`
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to revoke SWC authorization for all users.");
    } finally {
      setRevokingAllSwc(false);
    }
  };

  if (loading) {
    return (
      <section className="panel flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="h2" style={{ margin: 0 }}>Users</h2>
          <p className="small" style={{ margin: 0 }}>
            Loading user permissions…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="h2" style={{ margin: 0 }}>Users</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage admin and feature permissions.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          className={INPUT}
          placeholder="Search by handle, Discord, or SWC ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={BTN_GHOST_SM}
          onClick={handleRevokeAllSwcAuthorizations}
          disabled={revokingAllSwc}
        >
          {revokingAllSwc ? "Revoking All SWC…" : "Revoke All SWC Auth"}
        </button>
      </div>

      {notice && (
        <p className="small" style={{ color: "#9fda9f", margin: 0 }}>
          {notice}
        </p>
      )}

      {error && (
        <p className="small" style={{ color: "salmon", margin: 0 }}>
          {error}
        </p>
      )}

      {!filteredUsers.length ? (
        <p className="small" style={{ margin: 0 }}>
          No matching users found.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredUsers.map((user) => {
            const isOpen = openId === user.id;
            const hasScanWindowValues = Boolean(
              user.scanWindowTopLeftGalx ||
              user.scanWindowTopLeftGaly ||
              user.scanWindowBottomRightGalx ||
              user.scanWindowBottomRightGaly
            );
            const isScanWindowOpen = openScanWindowId === user.id || hasScanWindowValues;

            return (
              <article key={user.id} className="panel flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4 max-md:flex-col max-md:items-stretch">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f5d546]/25 bg-white/5 font-extrabold text-[#f2c46f]">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.handle} />
                      ) : (
                        <span>{user.handle.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <div>
                      <h3 className="m-0">{user.handle}</h3>
                      <div className="small mt-1 opacity-80">
                        {user.swcCharacterId
                          ? `SWC ID ${user.swcCharacterId}`
                          : user.discordIdentity
                            ? `Discord ${user.discordIdentity}`
                            : "No linked identity"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 max-md:items-center max-md:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { show: user.isJoeMember,                        label: "JOE Member",     hue: 47  },
                        { show: user.isAdmin,                            label: "Admin",           hue: 25  },
                        { show: user.isSysadmin,                         label: "Sysadmin",        hue: 0   },
                        { show: user.isIntel,                            label: "Intel",           hue: 210 },
                        { show: user.isGarry,                            label: "GARRY",           hue: 280 },
                        { show: user.isRaid,                             label: "RAID",            hue: 145 },
                        { show: user.canViewAsteroidIntel,               label: "Asteroid Intel",  hue: 185 },
                        { show: user.canAccessCombatCalc,                label: "Combat Calc",     hue: 355 },
                        { show: user.canAccessWreckingHelperExtension,   label: "Wrecking Helper", hue: 90  },
                        { show: user.canAccessFleetCommander,            label: "Fleet Commander", hue: 230 },
                        { show: user.canAccessRmBrowser,                 label: "RM Browser",      hue: 165 },
                        { show: user.isRmBrowserServiceAccount,          label: "RM Service Acct",      hue: 165 },
                        { show: user.isCombatOpsServiceAccount,          label: "Combat Ops Acct",      hue: 0   },
                        { show: user.canManageBlog,                      label: "Blog",            hue: 320 },
                        { show: isSysadmin && !!user.activeSub,          label: user.activeSub ? `Subscriber (${user.activeSub.plan_key})` : "", hue: 145 },
                      ] as const).filter(b => b.show && b.label).map(b => (
                        <span
                          key={b.label}
                          className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold"
                          style={{
                            borderColor: `hsl(${b.hue}, 70%, 50%, 0.45)`,
                            background: `hsl(${b.hue}, 70%, 50%, 0.12)`,
                            color: `hsl(${b.hue}, 80%, 75%)`,
                          }}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>

                    {hasScanWindowValues && (
                      <span className="inline-flex min-h-8 items-center whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.72rem] text-white/45">
                        {user.scanWindowTopLeftGalx},{user.scanWindowTopLeftGaly} → {user.scanWindowBottomRightGalx},{user.scanWindowBottomRightGaly}
                      </span>
                    )}

                    <button
                      type="button"
                      className={`${menuButtonBaseClass} ${isOpen ? menuButtonOpenClass : ""}`}
                      onClick={() => setOpenId((current) => (current === user.id ? null : user.id))}
                      aria-label={isOpen ? "Close permissions" : "Open permissions"}
                      aria-expanded={isOpen}
                    >
                      <span className={`${menuBarBaseClass} ${isOpen ? menuBarOpenClass : ""}`} />
                      <span className={`${menuBarBaseClass} ${isOpen ? menuBarOpenClass : ""}`} />
                      <span className={`${menuBarBaseClass} ${isOpen ? menuBarOpenClass : ""}`} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <>
                    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                      <label className={`${permTileBaseClass} ${user.isAdmin ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.isAdmin}
                          onChange={() => handleToggle(user.id, "isAdmin")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">Admin</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.isAdmin ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.isAdmin ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Grants access to the admin area and permission tools.
                        </span>
                      </label>

                      <label className={`${permTileBaseClass} ${user.canManageBlog ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.canManageBlog}
                          onChange={() => handleToggle(user.id, "canManageBlog")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">Manage Blog</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.canManageBlog ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.canManageBlog ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Can create and edit JEN blog content.
                        </span>
                      </label>

                      <label className={`${permTileBaseClass} ${user.isIntel ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.isIntel}
                          onChange={() => handleToggle(user.id, "isIntel")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">Intel Role</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.isIntel ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.isIntel ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Grants intel-role access for DroidBrain and related intel workflows.
                        </span>
                      </label>

                      <label className={`${permTileBaseClass} ${user.canViewAsteroidIntel ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.canViewAsteroidIntel}
                          onChange={() => handleToggle(user.id, "canViewAsteroidIntel")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">Asteroid Intel</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.canViewAsteroidIntel ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.canViewAsteroidIntel ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Can view asteroid types, intel flags, and grid note data on the galaxy map.
                        </span>
                      </label>

                      <label className={`${permTileBaseClass} ${user.canAccessCombatCalc ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.canAccessCombatCalc}
                          onChange={() => handleToggle(user.id, "canAccessCombatCalc")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">Combat Calculator</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.canAccessCombatCalc ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.canAccessCombatCalc ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Grants access to the members-side combat calculator while the math is being validated.
                        </span>
                      </label>

                      <label className={`${permTileBaseClass} ${user.canAccessWreckingHelperExtension ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.canAccessWreckingHelperExtension}
                          onChange={() => handleToggle(user.id, "canAccessWreckingHelperExtension")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">Wrecking Helper Extension</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.canAccessWreckingHelperExtension ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.canAccessWreckingHelperExtension ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Grants backend authorization for this specific browser extension.
                        </span>
                      </label>

                      <label className={`${permTileBaseClass} ${user.canAccessFleetCommander ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.canAccessFleetCommander}
                          onChange={() => handleToggle(user.id, "canAccessFleetCommander")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">Fleet Commander</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.canAccessFleetCommander ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.canAccessFleetCommander ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Grants access to the Biometrics member skills tool.
                        </span>
                      </label>

                      <label className={`${permTileBaseClass} ${user.canAccessRmBrowser ? permTileActiveClass : ""}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={user.canAccessRmBrowser}
                          onChange={() => handleToggle(user.id, "canAccessRmBrowser")}
                        />
                        <span className="flex items-center justify-between gap-4">
                          <span className="font-bold leading-tight">RM Browser</span>
                          <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.canAccessRmBrowser ? permSwitchActiveClass : ""}`} aria-hidden="true">
                            <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.canAccessRmBrowser ? permSwitchKnobActiveClass : ""}`} />
                          </span>
                        </span>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Grants access to the Raw Materials browser tool.
                        </span>
                      </label>

                      {isSysadmin && (
                        <label className={`${permTileBaseClass} ${user.isRmBrowserServiceAccount ? permTileActiveClass : ""}`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={user.isRmBrowserServiceAccount}
                            onChange={() => handleToggle(user.id, "isRmBrowserServiceAccount")}
                          />
                          <span className="flex items-center justify-between gap-4">
                            <span className="font-bold leading-tight">RM Service Account</span>
                            <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.isRmBrowserServiceAccount ? permSwitchActiveClass : ""}`} aria-hidden="true">
                              <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.isRmBrowserServiceAccount ? permSwitchKnobActiveClass : ""}`} />
                            </span>
                          </span>
                          <span className="text-[0.82rem] leading-snug opacity-80">
                            Designates this user's SWC token as the source for RM Browser faction inventory calls. Only one user should have this set.
                          </span>
                        </label>
                      )}

                      {isSysadmin && (
                        <label className={`${permTileBaseClass} ${user.isCombatOpsServiceAccount ? permTileActiveClass : ""}`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={user.isCombatOpsServiceAccount}
                            onChange={() => handleToggle(user.id, "isCombatOpsServiceAccount")}
                          />
                          <span className="flex items-center justify-between gap-4">
                            <span className="font-bold leading-tight">Combat Ops Service Account</span>
                            <span className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/15 bg-white/10 transition-all duration-150 ${user.isCombatOpsServiceAccount ? permSwitchActiveClass : ""}`} aria-hidden="true">
                              <span className={`absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-150 ${user.isCombatOpsServiceAccount ? permSwitchKnobActiveClass : ""}`} />
                            </span>
                          </span>
                          <span className="text-[0.82rem] leading-snug opacity-80">
                            Designates this user's <code>combat_ops</code> SWC auth as the source for Fire Delay Tracker faction event calls. Only one user should have this set.
                          </span>
                        </label>
                      )}

                      <div className="relative flex cursor-pointer flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.02] px-4 py-4 transition-all duration-150 hover:-translate-y-px hover:border-[#f5d546]/30 hover:bg-[#f5d546]/[0.04]">
                        <div
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="font-bold leading-tight">Scan Window</span>
                          <button
                            type="button"
                            className={BTN_GHOST_SM}
                            onClick={() =>
                              setOpenScanWindowId((current) => (current === user.id ? null : user.id))
                            }
                          >
                            {isScanWindowOpen ? "Hide" : "Set Window"}
                          </button>
                        </div>
                        <span className="text-[0.82rem] leading-snug opacity-80">
                          Lets this user see scanned and rescan-due markers only inside a rectangular coordinate area.
                        </span>
                        {isScanWindowOpen ? (
                          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                            <input
                              className={INPUT}
                              type="number"
                              placeholder="Top Left X"
                              value={user.scanWindowTopLeftGalx}
                              onChange={(event) =>
                                updateLocalUser(user.id, (current) => ({
                                  ...current,
                                  scanWindowTopLeftGalx: event.target.value,
                                }))
                              }
                            />
                            <input
                              className={INPUT}
                              type="number"
                              placeholder="Top Left Y"
                              value={user.scanWindowTopLeftGaly}
                              onChange={(event) =>
                                updateLocalUser(user.id, (current) => ({
                                  ...current,
                                  scanWindowTopLeftGaly: event.target.value,
                                }))
                              }
                            />
                            <input
                              className={INPUT}
                              type="number"
                              placeholder="Bottom Right X"
                              value={user.scanWindowBottomRightGalx}
                              onChange={(event) =>
                                updateLocalUser(user.id, (current) => ({
                                  ...current,
                                  scanWindowBottomRightGalx: event.target.value,
                                }))
                              }
                            />
                            <input
                              className={INPUT}
                              type="number"
                              placeholder="Bottom Right Y"
                              value={user.scanWindowBottomRightGaly}
                              onChange={(event) =>
                                updateLocalUser(user.id, (current) => ({
                                  ...current,
                                  scanWindowBottomRightGaly: event.target.value,
                                }))
                              }
                            />
                          </div>
                        ) : null}
                      </div>

                    </div>

                    {user.factions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.75rem] uppercase tracking-wide opacity-40 shrink-0">Factions</span>
                        {user.factions.map((f) => (
                          <span
                            key={f.id}
                            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[0.78rem] text-white/70"
                          >
                            {f.abbreviation ?? f.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {isSysadmin && user.activeSub && (
                        <button
                          type="button"
                          className={BTN_GHOST_SM}
                          style={{ color: "salmon", borderColor: "salmon" }}
                          onClick={() => handleRevokeSubscription(user)}
                          disabled={revokingSubId === user.id}
                        >
                          {revokingSubId === user.id ? "Revoking…" : "Revoke Subscription"}
                        </button>
                      )}
                      <button
                        type="button"
                        className={BTN_GHOST_SM}
                        onClick={() => handleRevokeSwcAuthorization(user)}
                        disabled={
                          revokingSwcId === user.id ||
                          forcingLogoutId === user.id ||
                          savingId === user.id ||
                          resettingSystemUpdaterId === user.id
                        }
                      >
                        {revokingSwcId === user.id ? "Revoking SWC…" : "Revoke SWC Auth"}
                      </button>
                      <button
                        type="button"
                        className={BTN_GHOST_SM}
                        onClick={() => handleForceLogout(user)}
                        disabled={
                          forcingLogoutId === user.id ||
                          revokingSwcId === user.id ||
                          savingId === user.id ||
                          resettingSystemUpdaterId === user.id
                        }
                      >
                        {forcingLogoutId === user.id ? "Forcing Logout…" : "Force Logout"}
                      </button>
                      <button
                        type="button"
                        className={BTN_GHOST_SM}
                        onClick={() => handleFullResetSystemUpdater(user)}
                        disabled={
                          resettingSystemUpdaterId === user.id ||
                          revokingSwcId === user.id ||
                          savingId === user.id ||
                          forcingLogoutId === user.id
                        }
                      >
                        {resettingSystemUpdaterId === user.id
                          ? "Resetting…"
                          : "Full Reset System Updater"}
                      </button>
                      <button
                        type="button"
                        className={BTN_SM + " all"}
                        onClick={() => handleSave(user)}
                        disabled={savingId === user.id}
                      >
                        {savingId === user.id ? "Saving…" : "Save Permissions"}
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {isSysadmin && factionSubs.length > 0 && (
        <>
          <hr className="divider" style={{ margin: "24px 0" }} />
          <h3 className="h3" style={{ margin: "0 0 12px" }}>Active Faction Subscriptions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {factionSubs.map((sub) => (
              <article key={sub.id} className="panel flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4 max-md:flex-col max-md:items-stretch">
                  <div className="flex min-w-0 items-center gap-4">
                    <div>
                      <h3 className="m-0">
                        {sub.faction?.name ?? `Faction #${sub.id}`}
                      </h3>
                      <div className="small mt-1 opacity-80">
                        {sub.plan_key} — {sub.seats_used}{sub.seat_count != null ? ` / ${sub.seat_count}` : ""} seats used
                        {sub.current_period_end ? ` — renews ${new Date(sub.current_period_end).toLocaleDateString()}` : ""}
                        {sub.manager ? ` — managed by ${sub.manager.handle}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 max-md:items-center max-md:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex min-h-8 items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-[0.82rem] font-bold" style={{ borderColor: "hsl(145, 70%, 50%, 0.45)", background: "hsl(145, 70%, 50%, 0.12)", color: "hsl(145, 80%, 75%)" }}>
                        Faction Subscriber
                      </span>
                    </div>
                    <button
                      type="button"
                      className={BTN_GHOST_SM}
                      style={{ color: "salmon", borderColor: "salmon" }}
                      onClick={() => handleRevokeFactionSubscription(sub)}
                      disabled={revokingFactionSubId === sub.id}
                    >
                      {revokingFactionSubId === sub.id ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                </div>
                {sub.members.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {sub.members.map((m) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 8px" }}>
                        {m.avatar_url && (
                          <img src={m.avatar_url} alt={m.handle} style={{ width: 20, height: 20, borderRadius: "50%" }} />
                        )}
                        <span className="small">{m.handle}</span>
                      </div>
                    ))}
                  </div>
                )}
                {sub.members.length === 0 && (
                  <p className="small muted" style={{ marginTop: 8 }}>No seats granted yet.</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default AdminUsersPanel;
