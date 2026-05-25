import React, { useEffect, useMemo, useState } from "react";
import {
  listLoadingTipsAdmin,
  createLoadingTip,
  updateLoadingTip,
  deleteLoadingTip,
  type LoadingTipItem,
} from "../../api/admin/loadingTipsAdmin";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM, INPUT} from "../../utils/ui";

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
      <section className="panel flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="h2" style={{ margin: 0 }}>Tips</h2>
          <p className="small" style={{ margin: 0 }}>
            Loading tips…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="h2" style={{ margin: 0 }}>Tips</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage loading screen tips.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="panel flex flex-col gap-4" onSubmit={handleSave}>
          <div className="flex flex-col gap-1.5">
            <h3 className="h3" style={{ margin: 0 }}>
              {mode === "create" ? "Create Tip" : "Edit Tip"}
            </h3>

            {mode === "edit" && (
              <button
                type="button"
                className={BTN_SM + " all"}
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
              className={INPUT}
              rows={7}
              value={tipText}
              onChange={(e) => setTipText(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={BTN} disabled={saving}>
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

        <div className="panel flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="h3" style={{ margin: 0 }}>Existing Tips</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              className={INPUT}
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
            <div className="flex flex-col gap-3">
              {filteredTips.map((tip) => (
                <article key={tip.id} className="panel flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="small">
                      #{tip.id}
                      {tip.created_at
                        ? ` · ${new Date(tip.created_at).toLocaleString()}`
                        : ""}
                    </div>

                    <p className="small m-0">{tip.tip}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={BTN_SM + " all"}
                      onClick={() => startEdit(tip)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className={BTN_SM + " all"}
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