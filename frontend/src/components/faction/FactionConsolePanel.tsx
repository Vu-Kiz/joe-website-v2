import React, { useEffect, useState } from "react";
import {
  getFactionConsoles,
  getFactionConsole,
  grantFactionSeat,
  revokeFactionSeat,
  type FactionConsoleSubscription,
  type FactionConsoleDetail,
  type FactionConsoleMember,
} from "../../api/factionConsole";

const FactionConsolePanel: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<FactionConsoleSubscription[]>([]);
  const [selected, setSelected] = useState<FactionConsoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFactionConsoles()
      .then((res) => {
        setSubscriptions(res.data ?? []);
        if (res.data?.length === 1) {
          loadDetail(res.data[0].id);
        }
      })
      .catch(() => setError("Failed to load faction consoles."))
      .finally(() => setLoading(false));
  }, []);

  async function loadDetail(subscriptionId: number) {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await getFactionConsole(subscriptionId);
      setSelected(res.data);
    } catch {
      setError("Failed to load faction details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleGrant(member: FactionConsoleMember) {
    if (!selected) return;
    setSaving(member.id);
    try {
      await grantFactionSeat(selected.subscription.id, member.id);
      setSelected((s) =>
        s ? {
          ...s,
          seats_used: s.seats_used + 1,
          members: s.members.map((m) => m.id === member.id ? { ...m, granted: true } : m),
        } : s
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to grant seat.");
    } finally {
      setSaving(null);
    }
  }

  async function handleRevoke(member: FactionConsoleMember) {
    if (!selected) return;
    if (confirmRevokeId !== member.id) {
      setConfirmRevokeId(member.id);
      return;
    }
    setConfirmRevokeId(null);
    setSaving(member.id);
    try {
      await revokeFactionSeat(selected.subscription.id, member.id);
      setSelected((s) =>
        s ? {
          ...s,
          seats_used: s.seats_used - 1,
          members: s.members.map((m) => m.id === member.id ? { ...m, granted: false } : m),
        } : s
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to revoke seat.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <h2 className="h2">Faction Console</h2>
        <p className="muted small">Loading…</p>
      </div>
    );
  }

  if (subscriptions.length === 0) return null;

  const sub = selected?.subscription;
  const seatsUsed = selected?.seats_used ?? 0;
  const seatCount = sub?.seat_count ?? null;
  const seatsLeft = seatCount !== null ? seatCount - seatsUsed : null;
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  return (
    <div className="panel">
      <h2 className="h2">Faction Console</h2>

      {subscriptions.length > 1 && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {subscriptions.map((s) => (
            <button
              key={s.id}
              className={`btn btn--sm${selected?.subscription.id === s.id ? "" : " btn--ghost"}`}
              type="button"
              onClick={() => loadDetail(s.id)}
            >
              {s.faction_abbreviation ?? s.faction_name ?? `#${s.id}`}
            </button>
          ))}
        </div>
      )}

      {error && <p className="small" style={{ color: "salmon", marginBottom: 12 }}>{error}</p>}

      {detailLoading && <p className="muted small">Loading…</p>}

      {selected && !detailLoading && (
        <>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <p className="small muted" style={{ margin: 0 }}>Faction</p>
              <p className="small" style={{ margin: 0 }}>{sub?.faction_name ?? "—"}</p>
            </div>
            <div>
              <p className="small muted" style={{ margin: 0 }}>Seats</p>
              <p className="small" style={{ margin: 0 }}>
                {seatsUsed}{seatCount !== null ? ` / ${seatCount}` : ""} used
                {seatsLeft !== null && seatsLeft <= 3 && seatsLeft > 0 && (
                  <span style={{ color: "orange", marginLeft: 8 }}>{seatsLeft} remaining</span>
                )}
                {seatsLeft === 0 && (
                  <span style={{ color: "salmon", marginLeft: 8 }}>No seats left</span>
                )}
              </p>
            </div>
            {periodEnd && (
              <div>
                <p className="small muted" style={{ margin: 0 }}>Renews</p>
                <p className="small" style={{ margin: 0 }}>{periodEnd}</p>
              </div>
            )}
          </div>

          <hr className="divider" />

          <h3 className="h3" style={{ marginBottom: 12 }}>Faction Members</h3>
          <p className="small muted" style={{ marginBottom: 12 }}>
            {selected.members.length} faction member{selected.members.length !== 1 ? "s" : ""} have linked their SWC account on the site.
            Grant access to up to {seatCount ?? "unlimited"} of them.
          </p>

          {selected.members.length === 0 && (
            <p className="small muted">No faction members have linked their account yet.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selected.members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.handle ?? ""}
                    style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                )}

                <span className="small" style={{ flex: 1 }}>{member.handle ?? `User #${member.id}`}</span>

                {member.granted ? (
                  confirmRevokeId === member.id ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span className="small" style={{ color: "orange", textAlign: "right" }}>
                        This member cannot be re-granted for 7 days. Confirm?
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          onClick={() => setConfirmRevokeId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn--sm"
                          type="button"
                          style={{ borderColor: "salmon", color: "salmon" }}
                          disabled={saving === member.id}
                          onClick={() => handleRevoke(member)}
                        >
                          {saving === member.id ? "…" : "Confirm Revoke"}
                        </button>
                      </div>
                    </div>
                  ) : (
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    disabled={saving === member.id}
                    onClick={() => handleRevoke(member)}
                  >
                    {saving === member.id ? "…" : "Revoke"}
                  </button>
                  )
                ) : (
                  <button
                    className="btn btn--sm"
                    type="button"
                    disabled={saving === member.id || (seatsLeft !== null && seatsLeft <= 0)}
                    onClick={() => handleGrant(member)}
                  >
                    {saving === member.id ? "…" : "Grant"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FactionConsolePanel;
