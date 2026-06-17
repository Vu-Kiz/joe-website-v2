import React, { useEffect, useState } from "react";
import {
  listTosDocuments,
  createTosDocument,
  updateTosDocument,
  publishTosDocument,
  deleteTosDocument,
  type TosDocumentItem,
} from "../../api/admin/tosAdmin";
import { BTN, BTN_SM } from "../../utils/ui";
import BBCodeEditor from "../bbcode/BBCodeEditor";

type Mode = "create" | "edit";

const AdminTosPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<TosDocumentItem[]>([]);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDocuments = async () => {
    const res = await listTosDocuments();
    setDocuments(res.documents ?? []);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await listTosDocuments();
        if (cancelled) return;
        setDocuments(res.documents ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load TOS documents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const resetForm = () => {
    setMode("create");
    setEditingId(null);
    setContent("");
    setError(null);
  };

  const startEdit = (doc: TosDocumentItem) => {
    setMode("edit");
    setEditingId(doc.id);
    setContent(doc.content);
    setNotice(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!content.trim()) {
      setError("Content is required.");
      return;
    }

    try {
      setSaving(true);

      if (mode === "create") {
        await createTosDocument(content.trim());
        setNotice("Draft created.");
      } else {
        if (!editingId) throw new Error("Missing document id.");
        await updateTosDocument(editingId, content.trim());
        setNotice("Draft updated.");
      }

      await loadDocuments();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save TOS document.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (doc: TosDocumentItem) => {
    const ok = window.confirm(
      `Publish TOS v${doc.version}?\n\nAll logged-in users will be required to accept the new Terms of Service before continuing.`
    );
    if (!ok) return;

    try {
      setBusyId(doc.id);
      setError(null);
      setNotice(null);
      await publishTosDocument(doc.id);
      await loadDocuments();
      setNotice(`TOS v${doc.version} published. All users must now re-accept.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to publish TOS document.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc: TosDocumentItem) => {
    const ok = window.confirm(`Delete TOS draft v${doc.version}?`);
    if (!ok) return;

    try {
      setBusyId(doc.id);
      setError(null);
      setNotice(null);
      await deleteTosDocument(doc.id);
      await loadDocuments();
      if (editingId === doc.id) resetForm();
      setNotice(`Draft v${doc.version} deleted.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete TOS document.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <section className="panel flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="h2" style={{ margin: 0 }}>Terms of Service</h2>
          <p className="small" style={{ margin: 0 }}>Loading…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="h2" style={{ margin: 0 }}>Terms of Service</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage versioned Terms of Service. Publishing a new version requires all users to re-accept.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="panel flex flex-col gap-4" onSubmit={handleSave}>
          <div className="flex flex-col gap-1.5">
            <h3 className="h3" style={{ margin: 0 }}>
              {mode === "create" ? "New Draft" : `Edit Draft v${documents.find(d => d.id === editingId)?.version ?? "?"}`}
            </h3>
            {mode === "edit" && (
              <button type="button" className={BTN_SM + " all"} onClick={resetForm} disabled={saving}>
                New Draft
              </button>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="tos-content">Content</label>
            <BBCodeEditor value={content} onChange={setContent} toolbarMode="full" />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={BTN} disabled={saving}>
              {saving ? "Saving…" : mode === "create" ? "Create Draft" : "Save Changes"}
            </button>
          </div>

          {notice && (
            <p className="small" style={{ color: "#9fda9f", margin: 0 }}>{notice}</p>
          )}
          {error && (
            <p className="small" style={{ color: "salmon", margin: 0 }}>{error}</p>
          )}
        </form>

        <div className="panel flex flex-col gap-4">
          <h3 className="h3" style={{ margin: 0 }}>Version History</h3>

          {documents.length === 0 ? (
            <p className="small" style={{ margin: 0 }}>No TOS documents yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {documents.map((doc) => (
                <article key={doc.id} className="panel flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="small font-bold">v{doc.version}</span>
                    {doc.is_active && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ background: "hsl(145, 70%, 50%, 0.18)", color: "hsl(145, 80%, 70%)", border: "1px solid hsl(145, 70%, 50%, 0.4)" }}
                      >
                        Active
                      </span>
                    )}
                    {doc.published_at && (
                      <span className="small muted">
                        Published {new Date(doc.published_at).toLocaleDateString()}
                      </span>
                    )}
                    {!doc.published_at && (
                      <span className="small muted">Draft</span>
                    )}
                  </div>

                  <p className="small" style={{ margin: 0, opacity: 0.7, whiteSpace: "pre-wrap", maxHeight: "4rem", overflow: "hidden" }}>
                    {doc.content.slice(0, 160)}{doc.content.length > 160 ? "…" : ""}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {!doc.is_active && (
                      <button
                        type="button"
                        className={BTN_SM + " all"}
                        onClick={() => startEdit(doc)}
                        disabled={busyId === doc.id}
                      >
                        Edit
                      </button>
                    )}
                    {!doc.is_active && (
                      <button
                        type="button"
                        className={BTN_SM}
                        onClick={() => handlePublish(doc)}
                        disabled={busyId === doc.id}
                      >
                        {busyId === doc.id ? "Publishing…" : "Publish"}
                      </button>
                    )}
                    {!doc.is_active && (
                      <button
                        type="button"
                        className={BTN_SM + " all"}
                        onClick={() => handleDelete(doc)}
                        disabled={busyId === doc.id}
                      >
                        {busyId === doc.id ? "Deleting…" : "Delete"}
                      </button>
                    )}
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

export default AdminTosPanel;
