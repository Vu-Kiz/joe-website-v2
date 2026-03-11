import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, getBackendOrigin } from "../../api/auth";
import {
  listEotmAdmin,
  createEotm,
  updateEotm,
  deleteEotm,
  type EotmEntry,
} from "../../api/eotm";
import BBCodeEditor from "../bbcode/BBCodeEditor";
import BBCodeView from "../bbcode/BBCodeView";

type UploadResponse = {
  ok: boolean;
  type: string;
  path: string;
  url: string;
};

type Mode = "create" | "edit";

const resolveImageUrl = (imageUrl: string | null): string | null => {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  const origin = getBackendOrigin();
  return origin ? `${origin}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}` : imageUrl;
};

const AdminEotmPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<EotmEntry[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadEntries = async () => {
    const res = await listEotmAdmin();
    setEntries(res.entries ?? []);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await listEotmAdmin();
        if (cancelled) return;

        setEntries(res.entries ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load EoTM entries");
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

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;

    return entries.filter((entry) => {
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.reason.toLowerCase().includes(q)
      );
    });
  }, [entries, search]);

  const previewImageUrl = useMemo(() => resolveImageUrl(imageUrl), [imageUrl]);

  const resetForm = () => {
    setMode("create");
    setEditingId(null);
    setName("");
    setReason("");
    setImageFile(null);
    setImagePath(null);
    setImageUrl(null);
    setError(null);
  };

  const startEdit = (entry: EotmEntry) => {
    setMode("edit");
    setEditingId(entry.id);
    setName(entry.name);
    setReason(entry.reason);
    setImageFile(null);
    setImagePath(entry.image_path ?? null);
    setImageUrl(entry.image_url ?? null);
    setNotice(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!imageFile) {
      setError("Choose an image first.");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", imageFile);

      const res = await apiFetch<UploadResponse>("/upload?type=employee", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      setImagePath(res.path);
      setImageUrl(res.url);
      setNotice("Image uploaded.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }

    try {
      setSaving(true);

      if (mode === "create") {
        await createEotm({
          name: name.trim(),
          reason,
          image_path: imagePath,
          image_url: imageUrl,
        });
        setNotice("EoTM entry created.");
      } else {
        if (!editingId) {
          throw new Error("Missing EoTM id.");
        }

        await updateEotm(editingId, {
          name: name.trim(),
          reason,
          image_path: imagePath,
          image_url: imageUrl,
        });
        setNotice("EoTM entry updated.");
      }

      await loadEntries();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save EoTM entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: EotmEntry) => {
    const ok = window.confirm(`Delete "${entry.name}" from EoTM?`);
    if (!ok) return;

    try {
      setBusyDeleteId(entry.id);
      setError(null);
      setNotice(null);

      await deleteEotm(entry.id);
      await loadEntries();

      if (editingId === entry.id) {
        resetForm();
      }

      setNotice("EoTM entry deleted.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete EoTM entry");
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (loading) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>EoTM</h2>
          <p className="small" style={{ margin: 0 }}>Loading EoTM entries…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>EoTM</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage Employee of the Month entries inline.
        </p>
      </div>

      <div className="admin-eotm-layout">
        <form className="panel admin-eotm-editor" onSubmit={handleSave}>
          <div className="admin-eotm-editor__header">
            <h3 style={{ margin: 0 }}>
              {mode === "create" ? "Create Entry" : "Edit Entry"}
            </h3>

            {mode === "edit" && (
              <button
                type="button"
                className="btn btn--small"
                onClick={resetForm}
                disabled={saving || uploading}
              >
                New Entry
              </button>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="eotm-name">
              Name
            </label>
            <input
              id="eotm-name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="field">
            <label className="field__label">Reason</label>
            <BBCodeEditor
              value={reason}
              onChange={setReason}
              rows={8}
              toolbarMode="basic"
            />
          </div>

          <div className="field">
            <label className="field__label">Image</label>

            <div className="admin-eotm-editor__upload-row">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />

              <button
                type="button"
                className="btn btn--small"
                onClick={handleUpload}
                disabled={!imageFile || uploading}
              >
                {uploading ? "Uploading…" : "Upload image"}
              </button>

              {(imagePath || imageUrl) && (
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => {
                    setImageFile(null);
                    setImagePath(null);
                    setImageUrl(null);
                  }}
                >
                  Remove image
                </button>
              )}
            </div>

            {previewImageUrl && (
              <div className="admin-eotm-editor__preview">
                <img src={previewImageUrl} alt="EoTM preview" />
              </div>
            )}
          </div>

          <div className="admin-eotm-editor__actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create Entry" : "Save Changes"}
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

        <div className="panel admin-eotm-list">
          <div className="admin-eotm-list__header">
            <h3 style={{ margin: 0 }}>Existing Entries</h3>
          </div>

          <div className="admin-users-toolbar">
            <input
              type="text"
              className="input"
              placeholder="Search EoTM"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!filteredEntries.length ? (
            <p className="small" style={{ margin: 0 }}>
              No EoTM entries found.
            </p>
          ) : (
            <div className="admin-eotm-list__items">
              {filteredEntries.map((entry, index) => {
                const imageSrc = resolveImageUrl(entry.image_url);

                return (
                  <article key={entry.id} className="panel admin-eotm-card">
                    <div className="admin-eotm-card__media">
                      {imageSrc ? (
                        <img src={imageSrc} alt={entry.name} />
                      ) : (
                        <div className="admin-eotm-card__media-fallback">
                          {entry.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="admin-eotm-card__copy">
                      <div className="admin-eotm-card__topline">
                        <h4 className="admin-eotm-card__title">{entry.name}</h4>
                        {index === 0 && <span className="admin-badge">Current</span>}
                      </div>

                      <div className="small admin-eotm-card__meta">
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleString()
                          : "Unknown date"}
                      </div>

                      <div className="admin-eotm-card__body">
                        <BBCodeView value={entry.reason} className="small" />
                      </div>
                    </div>

                    <div className="admin-eotm-card__actions">
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => startEdit(entry)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => handleDelete(entry)}
                        disabled={busyDeleteId === entry.id}
                      >
                        {busyDeleteId === entry.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminEotmPanel;