import React, { useEffect, useMemo, useState } from "react";
import {
  forceAdminUserLogout,
  listAdminUsers,
  updateAdminUserPermissions,
  type AdminManageableUser,
} from "../../api/adminUsers";

type EditableUserState = {
  id: number;
  handle: string;
  swcHandle: string;
  discordIdentity: string;
  swcCharacterId: string;
  avatarUrl: string;
  scanWindowTopLeftGalx: string;
  scanWindowTopLeftGaly: string;
  scanWindowBottomRightGalx: string;
  scanWindowBottomRightGaly: string;

  isJoeMember: boolean;
  isAdmin: boolean;
  isSysadmin: boolean;
  isIntel: boolean;
  canViewAsteroidIntel: boolean;
  isGarry: boolean;
  isRaid: boolean;

  canManageBlog: boolean;
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
    isGarry: !!user.is_garry,
    isRaid: !!user.is_raid,
    canManageBlog: !!user.can_manage_blog,
  };
}

const AdminUsersPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [forcingLogoutId, setForcingLogoutId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openScanWindowId, setOpenScanWindowId] = useState<number | null>(null);
  const [users, setUsers] = useState<EditableUserState[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await listAdminUsers();
        if (cancelled) return;

        const mapped = (res.users ?? []).map(mapUser);
        setUsers(mapped);

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
    key: "isAdmin" | "canViewAsteroidIntel" | "canManageBlog"
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
        can_view_asteroid_intel: user.canViewAsteroidIntel,
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

  if (loading) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Users</h2>
          <p className="small" style={{ margin: 0 }}>
            Loading user permissions…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>Users</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage admin and feature permissions.
        </p>
      </div>

      <div className="admin-users-toolbar">
        <input
          type="text"
          className="input"
          placeholder="Search by handle, Discord, or SWC ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <div className="admin-users-list">
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
              <article key={user.id} className="panel admin-users-card">
                <div className="admin-users-card__top">
                  <div className="admin-users-card__identity">
                    <div className="admin-users-avatar">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.handle} />
                      ) : (
                        <span>{user.handle.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <div>
                      <h3 className="admin-users-card__title">{user.handle}</h3>
                      <div className="small admin-users-card__meta">
                        {user.swcCharacterId
                          ? `SWC ID ${user.swcCharacterId}`
                          : user.discordIdentity
                            ? `Discord ${user.discordIdentity}`
                            : "No linked identity"}
                      </div>
                    </div>
                  </div>

                  <div className="admin-users-card__controls">
                    <div className="admin-users-card__badges">
                      {user.isSysadmin && (
                        <span className="admin-badge admin-badge--strong">Sysadmin</span>
                      )}
                      {user.isAdmin && <span className="admin-badge">Admin</span>}
                      {user.isJoeMember && (
                        <span className="admin-badge admin-badge--soft">JOE Member</span>
                      )}
                      {user.isIntel && (
                        <span className="admin-badge admin-badge--intel">Intel</span>
                      )}
                      {user.canViewAsteroidIntel && (
                        <span className="admin-badge admin-badge--soft">Asteroid Intel</span>
                      )}
                      {user.isGarry && (
                        <span className="admin-badge admin-badge--garry">Garry</span>
                      )}
                      {user.isRaid && (
                        <span className="admin-badge admin-badge--raid">Raid</span>
                      )}
                      {user.canManageBlog && (
                        <span className="admin-badge admin-badge--content">Blog</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className={"admin-users-menu-btn" + (isOpen ? " is-open" : "")}
                      onClick={() => setOpenId((current) => (current === user.id ? null : user.id))}
                      aria-label={isOpen ? "Close permissions" : "Open permissions"}
                      aria-expanded={isOpen}
                    >
                      <span />
                      <span />
                      <span />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <>
                    <div className="admin-users-perms admin-users-perms--pretty">
                      <label className={"admin-perm-tile" + (user.isAdmin ? " is-active" : "")}>
                        <input
                          type="checkbox"
                          checked={user.isAdmin}
                          onChange={() => handleToggle(user.id, "isAdmin")}
                        />
                        <span className="admin-perm-tile__head">
                          <span className="admin-perm-tile__title">Admin</span>
                          <span className="admin-perm-tile__switch" aria-hidden="true">
                            <span className="admin-perm-tile__knob" />
                          </span>
                        </span>
                        <span className="admin-perm-tile__desc">
                          Grants access to the admin area and permission tools.
                        </span>
                      </label>

                      <label className={"admin-perm-tile" + (user.canManageBlog ? " is-active" : "")}>
                        <input
                          type="checkbox"
                          checked={user.canManageBlog}
                          onChange={() => handleToggle(user.id, "canManageBlog")}
                        />
                        <span className="admin-perm-tile__head">
                          <span className="admin-perm-tile__title">Manage Blog</span>
                          <span className="admin-perm-tile__switch" aria-hidden="true">
                            <span className="admin-perm-tile__knob" />
                          </span>
                        </span>
                        <span className="admin-perm-tile__desc">
                          Can create and edit JEN blog content.
                        </span>
                      </label>

                      <label className={"admin-perm-tile" + (user.canViewAsteroidIntel ? " is-active" : "")}>
                        <input
                          type="checkbox"
                          checked={user.canViewAsteroidIntel}
                          onChange={() => handleToggle(user.id, "canViewAsteroidIntel")}
                        />
                        <span className="admin-perm-tile__head">
                          <span className="admin-perm-tile__title">Asteroid Intel</span>
                          <span className="admin-perm-tile__switch" aria-hidden="true">
                            <span className="admin-perm-tile__knob" />
                          </span>
                        </span>
                        <span className="admin-perm-tile__desc">
                          Can view asteroid types, intel flags, and grid note data on the galaxy map.
                        </span>
                      </label>

                      <div className="admin-perm-tile">
                        <div
                          className="admin-perm-tile__head"
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                        >
                          <span className="admin-perm-tile__title">Scan Window</span>
                          <button
                            type="button"
                            className="btn btn--small btn--ghost"
                            onClick={() =>
                              setOpenScanWindowId((current) => (current === user.id ? null : user.id))
                            }
                          >
                            {isScanWindowOpen ? "Hide" : "Set Window"}
                          </button>
                        </div>
                        <span className="admin-perm-tile__desc">
                          Lets this user see scanned and rescan-due markers only inside a rectangular coordinate area.
                        </span>
                        {isScanWindowOpen ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: 8,
                              marginTop: 10,
                            }}
                          >
                            <input
                              className="input"
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
                              className="input"
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
                              className="input"
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
                              className="input"
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

                    <div className="admin-users-card__actions">
                      <button
                        type="button"
                        className="btn btn--small btn--ghost"
                        onClick={() => handleForceLogout(user)}
                        disabled={forcingLogoutId === user.id || savingId === user.id}
                      >
                        {forcingLogoutId === user.id ? "Forcing Logout…" : "Force Logout"}
                      </button>
                      <button
                        type="button"
                        className="btn btn--small"
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
    </section>
  );
};

export default AdminUsersPanel;
