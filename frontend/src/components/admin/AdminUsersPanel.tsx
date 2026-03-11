import React, { useEffect, useMemo, useState } from "react";
import {
  listAdminUsers,
  updateAdminUserPermissions,
  type AdminManageableUser,
} from "../../api/adminUsers";

type EditableUserState = {
  id: number;
  handle: string;
  swcCharacterId: string;
  avatarUrl: string;

  isJoeMember: boolean;
  isAdmin: boolean;
  isSysadmin: boolean;
  isIntel: boolean;
  isGarry: boolean;
  isRaid: boolean;

  canManageBlog: boolean;
  canManageTips: boolean;
  canManageEotm: boolean;
};

function mapUser(user: AdminManageableUser): EditableUserState {
  return {
    id: user.id,
    handle: user.handle ?? "Unknown",
    swcCharacterId:
      user.swc_character_id != null ? String(user.swc_character_id) : "",
    avatarUrl: user.swc_avatar_url ?? "",
    isJoeMember: !!user.is_joe_member,
    isAdmin: !!user.is_admin,
    isSysadmin: !!user.is_sysadmin,
    isIntel: !!user.is_intel,
    isGarry: !!user.is_garry,
    isRaid: !!user.is_raid,
    canManageBlog: !!user.can_manage_blog,
    canManageTips: !!user.can_manage_tips,
    canManageEotm: !!user.can_manage_eotm,
  };
}

const AdminUsersPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
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
    key: "isAdmin" | "canManageBlog" | "canManageTips" | "canManageEotm"
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
        can_manage_blog: user.canManageBlog,
        can_manage_tips: user.canManageTips,
        can_manage_eotm: user.canManageEotm,
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
          placeholder="Search by handle or SWC ID"
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
                        {user.swcCharacterId ? `SWC ID ${user.swcCharacterId}` : "No SWC ID"}
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
                      {user.isGarry && (
                        <span className="admin-badge admin-badge--garry">Garry</span>
                      )}
                      {user.isRaid && (
                        <span className="admin-badge admin-badge--raid">Raid</span>
                      )}
                      {user.canManageBlog && (
                        <span className="admin-badge admin-badge--content">Blog</span>
                      )}
                      {user.canManageTips && (
                        <span className="admin-badge admin-badge--content">Tips</span>
                      )}
                      {user.canManageEotm && (
                        <span className="admin-badge admin-badge--content">EoTM</span>
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

                      <label className={"admin-perm-tile" + (user.canManageTips ? " is-active" : "")}>
                        <input
                          type="checkbox"
                          checked={user.canManageTips}
                          onChange={() => handleToggle(user.id, "canManageTips")}
                        />
                        <span className="admin-perm-tile__head">
                          <span className="admin-perm-tile__title">Manage Tips</span>
                          <span className="admin-perm-tile__switch" aria-hidden="true">
                            <span className="admin-perm-tile__knob" />
                          </span>
                        </span>
                        <span className="admin-perm-tile__desc">
                          Can create and maintain tips content.
                        </span>
                      </label>

                      <label className={"admin-perm-tile" + (user.canManageEotm ? " is-active" : "")}>
                        <input
                          type="checkbox"
                          checked={user.canManageEotm}
                          onChange={() => handleToggle(user.id, "canManageEotm")}
                        />
                        <span className="admin-perm-tile__head">
                          <span className="admin-perm-tile__title">Manage EoTM</span>
                          <span className="admin-perm-tile__switch" aria-hidden="true">
                            <span className="admin-perm-tile__knob" />
                          </span>
                        </span>
                        <span className="admin-perm-tile__desc">
                          Can manage Employee of the Month entries.
                        </span>
                      </label>
                    </div>

                    <div className="admin-users-card__actions">
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