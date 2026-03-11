import React, { useEffect, useMemo, useState } from "react";
import {
  listLoadingTipsAdmin,
  createLoadingTip,
  updateLoadingTip,
  deleteLoadingTip,
  type LoadingTipItem,
} from "../../api/loadingTipsAdmin";

type Mode = "create" | "edit";

const AdminTipsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<LoadingTipItem[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tipText, setTipText] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTips = async () => {
    const res = await listLoadingTipsAdmin();
    setTips(res.tips ?? []);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await listLoadingTipsAdmin();
        if (cancelled) return;

        setTips(res.tips ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load loading tips");
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

  const filteredTips = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tips;

    return tips.filter((tip) => tip.tip.toLowerCase().includes(q));
  }, [tips, search]);

  const resetForm = () => {
    setMode("create");
    setEditingId(null);
    setTipText("");
    setError(null);
  };

  const startEdit = (tip: LoadingTipItem) => {
    setMode("edit");
    setEditingId(tip.id);
    setTipText(tip.tip);
    setNotice(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!tipText.trim()) {
      setError("Tip text is required.");
      return;
    }

    try {
      setSaving(true);

      if (mode === "create") {
        await createLoadingTip({
          tip: tipText.trim(),
        });
        setNotice("Loading tip created.");
      } else {
        if (!editingId) {
          throw new Error("Missing loading tip id.");
        }

        await updateLoadingTip(editingId, {
          tip: tipText.trim(),
        });
        setNotice("Loading tip updated.");
      }

      await loadTips();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save loading tip");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tip: LoadingTipItem) => {
    const ok = window.confirm(`Delete this loading tip?\n\n${tip.tip}`);
    if (!ok) return;

    try {
      setBusyDeleteId(tip.id);
      setError(null);
      setNotice(null);

      await deleteLoadingTip(tip.id);
      await loadTips();

      if (editingId === tip.id) {
        resetForm();
      }

      setNotice("Loading tip deleted.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete loading tip");
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (loading) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Tips</h2>
          <p className="small" style={{ margin: 0 }}>
            Loading tips…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>Tips</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage loading screen tips.
        </p>
      </div>

      <div className="admin-tips-layout">
        <form className="panel admin-tip-editor" onSubmit={handleSave}>
          <div className="admin-tip-editor__header">
            <h3 style={{ margin: 0 }}>
              {mode === "create" ? "Create Tip" : "Edit Tip"}
            </h3>

            {mode === "edit" && (
              <button
                type="button"
                className="btn btn--small"
                onClick={resetForm}
                disabled={saving}
              >
                New Tip
              </button>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="loading-tip-text">
              Tip text (the “Tip:” prefix is added automatically)
            </label>
            <textarea
              id="loading-tip-text"
              className="input"
              rows={7}
              value={tipText}
              onChange={(e) => setTipText(e.target.value)}
            />
          </div>

          <div className="admin-tip-editor__actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create Tip" : "Save Changes"}
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
        </form>

        <div className="panel admin-tip-list">
          <div className="admin-tip-list__header">
            <h3 style={{ margin: 0 }}>Existing Tips</h3>
          </div>

          <div className="admin-users-toolbar">
            <input
              type="text"
              className="input"
              placeholder="Search tips"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!filteredTips.length ? (
            <p className="small" style={{ margin: 0 }}>
              No tips found.
            </p>
          ) : (
            <div className="admin-tip-list__items">
              {filteredTips.map((tip) => (
                <article key={tip.id} className="panel admin-tip-card">
                  <div className="admin-tip-card__copy">
                    <div className="small admin-tip-card__meta">
                      #{tip.id}
                      {tip.created_at
                        ? ` · ${new Date(tip.created_at).toLocaleString()}`
                        : ""}
                    </div>

                    <p className="small admin-tip-card__body">{tip.tip}</p>
                  </div>

                  <div className="admin-tip-card__actions">
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => startEdit(tip)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => handleDelete(tip)}
                      disabled={busyDeleteId === tip.id}
                    >
                      {busyDeleteId === tip.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminTipsPanel;