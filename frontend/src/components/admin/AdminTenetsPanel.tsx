import React, { useEffect, useMemo, useState } from "react";
import {
  listTenetsOfSalvageAdmin,
  createTenetOfSalvage,
  updateTenetOfSalvage,
  deleteTenetOfSalvage,
  type TenetOfSalvageItem,
} from "../../api/tenetsOfSalvageAdmin";
import BBCodeEditor from "../bbcode/BBCodeEditor";
import BBCodeView from "../bbcode/BBCodeView";

type Mode = "create" | "edit";

const AdminTenetsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TenetOfSalvageItem[]>([]);
  const [search, setSearch] = useState("");

  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [bodyBbcode, setBodyBbcode] = useState("");
  const [weight, setWeight] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadItems = async () => {
    const res = await listTenetsOfSalvageAdmin();
    setItems(res.items ?? []);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await listTenetsOfSalvageAdmin();
        if (cancelled) return;

        setItems(res.items ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load Tenets of Salvage");
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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.body_bbcode.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const resetForm = () => {
    setMode("create");
    setEditingId(null);
    setTitle("");
    setBodyBbcode("");
    setWeight(0);
    setIsActive(true);
    setError(null);
  };

  const startEdit = (item: TenetOfSalvageItem) => {
    setMode("edit");
    setEditingId(item.id);
    setTitle(item.title);
    setBodyBbcode(item.body_bbcode);
    setWeight(item.weight);
    setIsActive(item.is_active);
    setNotice(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!bodyBbcode.trim()) {
      setError("Body is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        title: title.trim(),
        body_bbcode: bodyBbcode,
        weight: Number.isFinite(weight) ? weight : 0,
        is_active: isActive,
      };

      if (mode === "create") {
        await createTenetOfSalvage(payload);
        setNotice("Tenet created.");
      } else {
        if (!editingId) {
          throw new Error("Missing tenet id.");
        }

        await updateTenetOfSalvage(editingId, payload);
        setNotice("Tenet updated.");
      }

      await loadItems();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save tenet");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: TenetOfSalvageItem) => {
    const ok = window.confirm(`Delete "${item.title}"?`);
    if (!ok) return;

    try {
      setBusyDeleteId(item.id);
      setError(null);
      setNotice(null);

      await deleteTenetOfSalvage(item.id);
      await loadItems();

      if (editingId === item.id) {
        resetForm();
      }

      setNotice("Tenet deleted.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete tenet");
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (loading) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Tenets</h2>
          <p className="small" style={{ margin: 0 }}>
            Loading Tenets of Salvage…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>Tenets of Salvage</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage Tenets of Salvage entries with BBCode and weight ordering.
        </p>
      </div>

      <div className="admin-eotm-layout">
        <form className="panel admin-eotm-editor" onSubmit={handleSave}>
          <div className="admin-eotm-editor__header">
            <h3 style={{ margin: 0 }}>
              {mode === "create" ? "Create Tenet" : "Edit Tenet"}
            </h3>

            {mode === "edit" && (
              <button
                type="button"
                className="btn btn--small"
                onClick={resetForm}
                disabled={saving}
              >
                New Tenet
              </button>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="tenet-title">
              Title
            </label>
            <input
              id="tenet-title"
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="tenet-weight">
              Weight
            </label>
            <input
              id="tenet-weight"
              className="input"
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value) || 0)}
            />
          </div>

          <label className="admin-users-perm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Active</span>
          </label>

          <div className="field">
            <label className="field__label">Body (BBCode)</label>
            <BBCodeEditor value={bodyBbcode} onChange={setBodyBbcode} toolbarMode="basic" />
          </div>

          <div className="admin-tip-editor__actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create Tenet" : "Save Changes"}
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
            <h3 style={{ margin: 0 }}>Existing Tenets</h3>
          </div>

          <div className="admin-users-toolbar">
            <input
              type="text"
              className="input"
              placeholder="Search tenets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!filteredItems.length ? (
            <p className="small" style={{ margin: 0 }}>
              No tenets found.
            </p>
          ) : (
            <div className="admin-tip-list__items">
              {filteredItems.map((item) => (
                <article key={item.id} className="panel admin-tip-card">
                  <div className="admin-tip-card__copy">
                    <div className="small admin-tip-card__meta">
                      #{item.id}
                      {" · "}weight {item.weight}
                      {" · "}{item.is_active ? "active" : "inactive"}
                      {item.updated_at
                        ? ` · ${new Date(item.updated_at).toLocaleString()}`
                        : item.created_at
                        ? ` · ${new Date(item.created_at).toLocaleString()}`
                        : ""}
                    </div>

                    <h4 style={{ margin: "0.35rem 0 0.5rem" }}>{item.title}</h4>

                    <BBCodeView value={item.body_bbcode} className="small" />
                  </div>

                  <div className="admin-tip-card__actions">
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => handleDelete(item)}
                      disabled={busyDeleteId === item.id}
                    >
                      {busyDeleteId === item.id ? "Deleting…" : "Delete"}
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

export default AdminTenetsPanel;