import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAuthMe, getBackendOrigin } from "../api/auth";
import type { SwcUser } from "../api/auth";
import "../styles/_aboutme.sass";

type Pill = { key: string; label: string };

const AboutMe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SwcUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchAuthMe();
        if (!cancelled) {
          setUser(res.user ?? null);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load profile");
          setUser(null);
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

  if (loading) {
    return (
      <div className="panel">
        <h1 className="h1">About Me</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <h1 className="h1">About Me</h1>
        <p className="muted">Error: {error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="panel">
        <h1 className="h1">About Me</h1>
        <p className="muted">You’re not logged in.</p>
      </div>
    );
  }

  return (
    <div className="panel">
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
