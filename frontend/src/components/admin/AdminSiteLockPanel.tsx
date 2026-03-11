import React, { useEffect, useState } from "react";
import { getSiteLock, updateSiteLock, type SiteLockMeta } from "../../api/siteLock";

const AdminSiteLockPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [meta, setMeta] = useState<SiteLockMeta | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await getSiteLock();

        if (cancelled) return;

        setMeta(res.site_lock);
        setEnabled(!!res.site_lock.enabled);
        setMessage(res.site_lock.message ?? "");
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load site lock settings.");
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setSuccess(null);
      setError(null);

      const res = await updateSiteLock({
        enabled,
        message,
      });

      setMeta(res.site_lock);
      setEnabled(!!res.site_lock.enabled);
      setMessage(res.site_lock.message ?? "");
      setSuccess(res.message ?? "Site lock settings saved.");

      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save site lock settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel admin-card">
      <div className="admin-card__header">
        <h3 className="admin-card__title">Site Lock</h3>
        <p className="admin-card__desc">
          Lock the whole site for everyone except sysadmins. OAuth login remains
          available so a sysadmin can still sign in and disable the lock.
        </p>
      </div>

      {loading ? (
        <p className="small">Loading site lock settings…</p>
      ) : (
        <>
          <div className="admin-card__body">
            <p className="small">
              <strong>Current state:</strong>{" "}
              {meta?.enabled ? "LOCKED" : "UNLOCKED"}
            </p>

            {(meta?.updated_at || meta?.updated_by) && (
              <p className="small">
                <strong>Last updated:</strong> {meta?.updated_at || "n/a"}{" "}
                <strong>By:</strong> {meta?.updated_by || "n/a"}
              </p>
            )}

            {success && (
              <p className="small" style={{ color: "lightgreen" }}>
                {success}
              </p>
            )}

            {error && (
              <p className="small" style={{ color: "salmon" }}>
                {error}
              </p>
            )}

            <form onSubmit={handleSave} className="admin-form">
              <label className="admin-form__check">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>Enable site lock</span>
              </label>

              <label className="admin-form__group">
                <span className="admin-form__label">Lock message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="input"
                  placeholder="Maintenance / incident message..."
                />
              </label>

              <div className="admin-form__actions">
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </section>
  );
};

export default AdminSiteLockPanel;