import React, { useEffect, useMemo, useState } from "react";
import {
  createAdminMemberChangelog,
  deleteAdminMemberChangelog,
  exportAdminMemberChangelog,
  generateAdminMemberChangelogFromReadme,
  getAdminMemberChangelog,
  importAdminMemberChangelog,
  type AdminMemberChangelogEntry,
  type UpsertMemberChangelogPayload,
  updateAdminMemberChangelog,
} from "../../api/adminMemberChangelog";
import DatePicker from "../common/DatePicker";

type EditorState = {
  version: string;
  title: string;
  details: string;
  tools: string[];
  audiences: string[];
  releasedAt: string;
  isActive: boolean;
};

const DEFAULT_EDITOR: EditorState = {
  version: "",
  title: "",
  details: "",
  tools: ["Members Tools"],
  audiences: ["all"],
  releasedAt: "",
  isActive: true,
};

const TOOL_OPTIONS = [
  "Members Tools",
  "Astrogation",
  "Hyper Planner",
  "Entity Stats",
  "Targeting Heatmap",
  "Combat Calculator",
  "Wrecking Helper",
  "JEN",
  "DroidBrain",
  "Payments",
  "Jobs",
  "Galactic Archive",
  "Admin",
];

const AUDIENCE_OPTIONS = [
  "all",
  "members",
  "payments",
  "droidbrain",
  "jenEditor",
  "combatCalc",
  "wreckingHelper",
  "asteroidIntel",
  "admin",
  "sysadmin",
];

function isoToDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateValueToPayload(value: string): string | null {
  if (!value.trim()) return null;
  return value;
}

function toPayload(editor: EditorState): UpsertMemberChangelogPayload {
  return {
    version: editor.version.trim(),
    title: editor.title.trim(),
    details: editor.details.trim(),
    tools: editor.tools.map((value) => value.trim()).filter(Boolean),
    audiences: editor.audiences.map((value) => value.trim()).filter(Boolean),
    released_at: dateValueToPayload(editor.releasedAt),
    is_active: editor.isActive,
  };
}

const AdminMemberChangelogPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AdminMemberChangelogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState>(DEFAULT_EDITOR);
  const [saving, setSaving] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [readmeMarkdown, setReadmeMarkdown] = useState("");
  const [importReplaceExisting, setImportReplaceExisting] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [selectedTool, setSelectedTool] = useState(TOOL_OPTIONS[0]);
  const [customTool, setCustomTool] = useState("");
  const [selectedAudience, setSelectedAudience] = useState(AUDIENCE_OPTIONS[0]);
  const [customAudience, setCustomAudience] = useState("");
  const [exportVersion, setExportVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadEntries = async () => {
    const data = await getAdminMemberChangelog();
    setEntries(data);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdminMemberChangelog();
        if (cancelled) return;
        setEntries(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load changelog entries.");
          setEntries([]);
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
    return entries.filter((entry) =>
      `${entry.version} ${entry.title} ${entry.details} ${entry.tools.join(" ")} ${entry.audiences.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [entries, search]);

  const knownVersions = useMemo(() => {
    const values = Array.from(new Set(entries.map((entry) => entry.version).filter(Boolean)));
    return values.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
  }, [entries]);

  useEffect(() => {
    if (!exportVersion.trim() && knownVersions.length) {
      setExportVersion(knownVersions[0]);
    }
  }, [knownVersions, exportVersion]);

  const resetEditor = () => {
    setEditingId(null);
    setEditor(DEFAULT_EDITOR);
    setSelectedVersion("");
    setSelectedTool(TOOL_OPTIONS[0]);
    setCustomTool("");
    setSelectedAudience(AUDIENCE_OPTIONS[0]);
    setCustomAudience("");
    setError(null);
  };

  const startEdit = (entry: AdminMemberChangelogEntry) => {
    setEditingId(entry.id);
    setEditor({
      version: entry.version,
      title: entry.title,
      details: entry.details,
      tools: entry.tools?.length ? entry.tools : ["Members Tools"],
      audiences: entry.audiences?.length ? entry.audiences : ["all"],
      releasedAt: isoToDatetimeLocal(entry.released_at),
      isActive: entry.is_active,
    });
    setSelectedVersion(entry.version);
    setSelectedTool(TOOL_OPTIONS[0]);
    setCustomTool("");
    setSelectedAudience(AUDIENCE_OPTIONS[0]);
    setCustomAudience("");
    setError(null);
    setNotice(null);
  };

  const addUniqueValue = (values: string[], value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return values;
    if (values.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return values;
    return [...values, trimmed];
  };

  const removeValue = (values: string[], value: string) =>
    values.filter((item) => item.toLowerCase() !== value.toLowerCase());

  const onAddTool = (value: string) => {
    setEditor((current) => ({ ...current, tools: addUniqueValue(current.tools, value) }));
  };

  const onAddAudience = (value: string) => {
    setEditor((current) => ({ ...current, audiences: addUniqueValue(current.audiences, value) }));
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const payload = toPayload(editor);
    if (!payload.version || !payload.title || !payload.details) {
      setError("Version, title, and details are required.");
      return;
    }
    if (!payload.tools.length) {
      setError("Add at least one tool label.");
      return;
    }
    if (!payload.audiences.length) {
      setError("Add at least one audience key.");
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await updateAdminMemberChangelog(editingId, payload);
        setNotice("Changelog entry updated.");
      } else {
        await createAdminMemberChangelog(payload);
        setNotice("Changelog entry created.");
      }
      await loadEntries();
      resetEditor();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save changelog entry.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (entry: AdminMemberChangelogEntry) => {
    const okay = window.confirm(`Delete changelog entry?\n\nv${entry.version} · ${entry.title}`);
    if (!okay) return;

    try {
      setBusyDeleteId(entry.id);
      setError(null);
      setNotice(null);
      await deleteAdminMemberChangelog(entry.id);
      await loadEntries();
      if (editingId === entry.id) {
        resetEditor();
      }
      setNotice("Changelog entry deleted.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete changelog entry.");
    } finally {
      setBusyDeleteId(null);
    }
  };

  const onGenerateFromReadme = async () => {
    const prompt = replaceExisting
      ? "This will replace all existing entries with parsed README entries. Continue?"
      : "Generate or update changelog entries from README now?";
    const okay = window.confirm(prompt);
    if (!okay) return;

    try {
      setGenerating(true);
      setError(null);
      setNotice(null);
      const response = await generateAdminMemberChangelogFromReadme(replaceExisting, readmeMarkdown);
      await loadEntries();
      setNotice(
        `README generation complete (${response.source ?? "unknown source"}). Parsed: ${response.total}, created: ${response.created}, updated: ${response.updated}.`,
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate changelog from README.");
    } finally {
      setGenerating(false);
    }
  };

  const onExportSnapshot = async (version?: string) => {
    const requestedVersion = version?.trim() ?? "";

    if (version !== undefined && !requestedVersion) {
      setError("Pick or enter a version first, then export that version.");
      return;
    }

    try {
      setExporting(true);
      setError(null);
      setNotice(null);

      const payload = await exportAdminMemberChangelog(requestedVersion || undefined);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
      const exportScope = payload.version ? `v${payload.version}` : "all";
      link.href = url;
      link.download = `member-changelog-${exportScope}-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotice(
        `Exported ${payload.count} changelog entr${payload.count === 1 ? "y" : "ies"} to JSON (${payload.version ? `v${payload.version}` : "all versions"}).`
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to export changelog snapshot.");
    } finally {
      setExporting(false);
    }
  };

  const onImportSnapshot = async () => {
    const trimmed = importJson.trim();
    if (!trimmed) {
      setError("Paste exported changelog JSON first.");
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setNotice(null);

      const parsed = JSON.parse(trimmed);
      const sourceEntries = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.entries)
          ? parsed.entries
          : null;

      if (!sourceEntries || !sourceEntries.length) {
        throw new Error("No changelog entries were found in the pasted JSON.");
      }

      const payloadEntries: UpsertMemberChangelogPayload[] = sourceEntries.map((entry: any) => ({
        version: String(entry?.version ?? "").trim(),
        title: String(entry?.title ?? "").trim(),
        details: String(entry?.details ?? "").trim(),
        tools: Array.isArray(entry?.tools) ? entry.tools.map((value: unknown) => String(value).trim()).filter(Boolean) : [],
        audiences: Array.isArray(entry?.audiences) ? entry.audiences.map((value: unknown) => String(value).trim()).filter(Boolean) : ["all"],
        sort_order: Number.isFinite(Number(entry?.sort_order)) ? Number(entry.sort_order) : undefined,
        released_at: entry?.released_at ? String(entry.released_at) : null,
        is_active: typeof entry?.is_active === "boolean" ? entry.is_active : true,
      }));

      const response = await importAdminMemberChangelog(payloadEntries, importReplaceExisting);
      await loadEntries();
      setNotice(
        `Import complete. Parsed: ${response.total}, created: ${response.created}, updated: ${response.updated}.`
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to import changelog JSON.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>Member Change Log</h2>
        <p className="small" style={{ margin: 0 }}>
          Backend-driven entries. Add manually or generate from README sections.
        </p>
      </div>

      <div className="admin-tips-layout">
        <form className="panel admin-tip-editor" onSubmit={onSave}>
          <div className="admin-tip-editor__header" style={{ alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{editingId ? "Edit Entry" : "Create Entry"}</h3>
            {editingId ? (
              <button type="button" className="btn btn--small" onClick={resetEditor} disabled={saving}>
                New Entry
              </button>
            ) : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="admin-changelog-version">Version</label>
            <div className="admin-member-changelog__picker-row">
              <select
                id="admin-changelog-version-select"
                className="input"
                value={selectedVersion}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedVersion(value);
                  if (value) {
                    setEditor((current) => ({ ...current, version: value }));
                  }
                }}
              >
                <option value="">Select existing version</option>
                {knownVersions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
            <input
              id="admin-changelog-version"
              className="input"
              value={editor.version}
              onChange={(event) => setEditor((current) => ({ ...current, version: event.target.value }))}
              placeholder="2.0.5"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="admin-changelog-title">Title</label>
            <input
              id="admin-changelog-title"
              className="input"
              value={editor.title}
              onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
              placeholder="Targeting Heatmap polish and extension bridge fixes"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="admin-changelog-details">Details</label>
            <textarea
              id="admin-changelog-details"
              className="input"
              rows={5}
              value={editor.details}
              onChange={(event) => setEditor((current) => ({ ...current, details: event.target.value }))}
              placeholder="Short user-facing summary of the change."
            />
          </div>

          <div className="field">
            <label className="field__label">Tools</label>
            <div className="admin-member-changelog__picker-row">
              <select
                className="input"
                value={selectedTool}
                onChange={(event) => setSelectedTool(event.target.value)}
              >
                {TOOL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--small" onClick={() => onAddTool(selectedTool)}>
                Add
              </button>
            </div>
            <div className="admin-member-changelog__picker-row">
              <input
                className="input"
                value={customTool}
                onChange={(event) => setCustomTool(event.target.value)}
                placeholder="Custom tool label"
              />
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  onAddTool(customTool);
                  setCustomTool("");
                }}
              >
                Add Custom
              </button>
            </div>
            <div className="admin-member-changelog__chip-list">
              {editor.tools.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  className="admin-member-changelog__chip"
                  onClick={() => setEditor((current) => ({ ...current, tools: removeValue(current.tools, tool) }))}
                  title="Remove tool"
                >
                  {tool} ×
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field__label">Audiences</label>
            <div className="admin-member-changelog__picker-row">
              <select
                className="input"
                value={selectedAudience}
                onChange={(event) => setSelectedAudience(event.target.value)}
              >
                {AUDIENCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--small" onClick={() => onAddAudience(selectedAudience)}>
                Add
              </button>
            </div>
            <div className="admin-member-changelog__picker-row">
              <input
                className="input"
                value={customAudience}
                onChange={(event) => setCustomAudience(event.target.value)}
                placeholder="Custom audience key"
              />
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  onAddAudience(customAudience);
                  setCustomAudience("");
                }}
              >
                Add Custom
              </button>
            </div>
            <div className="admin-member-changelog__chip-list">
              {editor.audiences.map((audience) => (
                <button
                  key={audience}
                  type="button"
                  className="admin-member-changelog__chip"
                  onClick={() => setEditor((current) => ({ ...current, audiences: removeValue(current.audiences, audience) }))}
                  title="Remove audience"
                >
                  {audience} ×
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <div className="field">
              <label className="field__label" htmlFor="admin-changelog-release-at">Version Release Date (optional)</label>
              <DatePicker
                id="admin-changelog-release-at"
                value={editor.releasedAt}
                onChange={(value) => setEditor((current) => ({ ...current, releasedAt: value }))}
                placeholder="Choose release date"
              />
              <p className="small" style={{ margin: "0.4rem 0 0", opacity: 0.8 }}>
                Saved at version level. Updating this date applies it to all entries in the same version.
              </p>
            </div>
          </div>

          <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={editor.isActive}
              onChange={(event) => setEditor((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active entry
          </label>

          <div className="admin-tip-editor__actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save Entry" : "Create Entry"}
            </button>
          </div>

          <div className="panel" style={{ display: "grid", gap: "0.7rem" }}>
            <h3 style={{ margin: 0 }}>Generate from README</h3>
            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              Optional: paste root README content here. If blank, server filesystem README is used.
            </p>
            <textarea
              className="input"
              rows={7}
              value={readmeMarkdown}
              onChange={(event) => setReadmeMarkdown(event.target.value)}
              placeholder={"Paste README markdown here to force parsing from this text.\nUseful when backend container cannot access repo-root README."}
            />
            <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(event) => setReplaceExisting(event.target.checked)}
              />
              Replace existing entries before import
            </label>
            <button type="button" className="btn btn--small" onClick={onGenerateFromReadme} disabled={generating}>
              {generating ? "Generating…" : "Generate Entries from README"}
            </button>
          </div>

          <div className="panel" style={{ display: "grid", gap: "0.7rem" }}>
            <h3 style={{ margin: 0 }}>Export / Import JSON</h3>
            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              Export all changelog entries or only one version from dev, then paste/import on prod.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button type="button" className="btn btn--small" onClick={() => onExportSnapshot()} disabled={exporting}>
                {exporting ? "Exporting…" : "Export All Versions"}
              </button>
              <button type="button" className="btn btn--small" onClick={() => onExportSnapshot(exportVersion)} disabled={exporting}>
                {exporting ? "Exporting…" : "Export Selected Version"}
              </button>
            </div>
            <div className="admin-member-changelog__picker-row">
              <select
                className="input"
                value={knownVersions.includes(exportVersion) ? exportVersion : ""}
                onChange={(event) => setExportVersion(event.target.value)}
              >
                <option value="">Select existing version</option>
                {knownVersions.map((version) => (
                  <option key={`export-version-${version}`} value={version}>
                    {version}
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={exportVersion}
                onChange={(event) => setExportVersion(event.target.value)}
                placeholder="2.0.6"
              />
            </div>
            <p className="small" style={{ margin: 0, opacity: 0.75 }}>
              Selected version for filtered export: <strong>{exportVersion.trim() || "none"}</strong>
            </p>
            <textarea
              className="input"
              rows={7}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder='Paste exported JSON here (supports {"entries":[...]} or raw entry array).'
            />
            <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={importReplaceExisting}
                onChange={(event) => setImportReplaceExisting(event.target.checked)}
              />
              Replace existing entries before import
            </label>
            <button type="button" className="btn btn--small" onClick={onImportSnapshot} disabled={importing}>
              {importing ? "Importing…" : "Import Changelog JSON"}
            </button>
          </div>

          {notice ? <p className="small" style={{ color: "#9fda9f", margin: 0 }}>{notice}</p> : null}
          {error ? <p className="small" style={{ color: "salmon", margin: 0 }}>{error}</p> : null}
        </form>

        <div className="panel admin-tip-list">
          <div className="admin-tip-list__header">
            <h3 style={{ margin: 0 }}>Entries</h3>
            <p className="small" style={{ margin: 0, opacity: 0.8 }}>
              {filteredEntries.length} shown
            </p>
          </div>

          <div className="admin-users-toolbar">
            <input
              type="text"
              className="input"
              placeholder="Search by version, title, detail, tool, or audience"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? <p className="small" style={{ margin: 0 }}>Loading entries…</p> : null}
          {!loading && !filteredEntries.length ? (
            <p className="small" style={{ margin: 0 }}>No entries found.</p>
          ) : null}

          {!loading && filteredEntries.length ? (
            <div className="admin-tip-list__items">
              {filteredEntries.map((entry) => (
                <article key={entry.id} className="panel admin-tip-card admin-member-changelog__entry-card">
                  <div className="admin-tip-card__copy admin-member-changelog__entry-copy" style={{ gap: "0.35rem" }}>
                    <div className="admin-member-changelog__entry-head">
                      <strong className="admin-member-changelog__entry-title">{entry.title}</strong>
                      <div className="admin-member-changelog__meta-badges">
                        <span className="admin-member-changelog__meta-badge">v{entry.version}</span>
                        <span className="admin-member-changelog__meta-badge">#{entry.id}</span>
                        <span className={`admin-member-changelog__meta-badge ${entry.is_active ? "is-active" : "is-inactive"}`}>
                          {entry.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <p className="small admin-tip-card__body admin-member-changelog__entry-details">{entry.details}</p>

                    <div className="admin-member-changelog__entry-groups">
                      <div className="admin-member-changelog__entry-group">
                        <span className="admin-member-changelog__entry-group-label">Tools</span>
                        <div className="admin-member-changelog__entry-chip-list">
                          {entry.tools.length ? entry.tools.map((tool) => (
                            <span key={`${entry.id}-tool-${tool}`} className="admin-member-changelog__entry-chip">{tool}</span>
                          )) : <span className="admin-member-changelog__entry-chip is-muted">None</span>}
                        </div>
                      </div>

                      <div className="admin-member-changelog__entry-group">
                        <span className="admin-member-changelog__entry-group-label">Audience</span>
                        <div className="admin-member-changelog__entry-chip-list">
                          {entry.audiences.length ? entry.audiences.map((audience) => (
                            <span key={`${entry.id}-audience-${audience}`} className="admin-member-changelog__entry-chip">{audience}</span>
                          )) : <span className="admin-member-changelog__entry-chip is-muted">None</span>}
                        </div>
                      </div>
                    </div>

                    <p className="small admin-member-changelog__entry-footer">
                      Released: {entry.released_at ? new Date(entry.released_at).toLocaleDateString() : "Not set"} · Sort: {entry.sort_order}
                    </p>
                  </div>
                  <div className="admin-tip-card__actions">
                    <button type="button" className="btn btn--small" onClick={() => startEdit(entry)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => onDelete(entry)}
                      disabled={busyDeleteId === entry.id}
                    >
                      {busyDeleteId === entry.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default AdminMemberChangelogPanel;
