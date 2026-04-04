import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, getBackendOrigin } from "../../api/auth";
import { createBlog, spellcheckBlog, updateBlog, type BlogPost, type JenSpellcheckResult, type SpellcheckMatch } from "../../api/blog";
import BBCodeEditor from "../bbcode/BBCodeEditor";
import BBCodeView from "../bbcode/BBCodeView";

type UploadResponse = {
  ok: boolean;
  type: string;
  path: string;
  url: string;
};

type Props = {
  mode: "create" | "edit";
  post?: BlogPost | null;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
};

const resolveEditorImageUrl = (imageUrl: string | null, imagePath: string | null): string | null => {
  const origin = getBackendOrigin();

  if (imageUrl && imageUrl.trim() !== "") {
    const u = imageUrl.trim();

    if (/^https?:\/\//i.test(u)) return u;

    if (origin) return `${origin}${u.startsWith("/") ? "" : "/"}${u}`;
    return u;
  }

  if (imagePath && imagePath.trim() !== "") {
    const clean = imagePath.replace(/^\/+/, "");
    if (origin) return `${origin}/storage/${clean}`;
    return `/storage/${clean}`;
  }

  return null;
};

const describeMatchSnippet = (match: SpellcheckMatch): string | null => {
  if (!match.context_text) {
    return null;
  }

  if (
    typeof match.context_offset === "number" &&
    typeof match.context_length === "number" &&
    match.context_length > 0
  ) {
    const snippet = match.context_text.slice(match.context_offset, match.context_offset + match.context_length).trim();
    if (snippet) {
      return snippet;
    }
  }

  return match.context_text.trim() || null;
};

const BlogEditorPanel: React.FC<Props> = ({
  mode,
  post = null,
  onCancel,
  onSaved,
}) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spellchecking, setSpellchecking] = useState(false);
  const [spellcheckResult, setSpellcheckResult] = useState<JenSpellcheckResult | null>(null);
  const [spellcheckMessage, setSpellcheckMessage] = useState<string | null>(null);
  const [spellcheckTone, setSpellcheckTone] = useState<"ok" | "warn" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && post) {
      setTitle(post.title ?? "");
      setBody(post.body ?? "");
      setImagePath(post.image_path ?? null);
      setImageUrl(post.image_url ?? null);
    } else {
      setTitle("");
      setBody("");
      setImagePath(null);
      setImageUrl(null);
    }

    setImageFile(null);
    setError(null);
    setSpellcheckResult(null);
    setSpellcheckMessage(null);
    setSpellcheckTone(null);
    setUploading(false);
    setSaving(false);
  }, [mode, post]);

  const previewImageUrl = useMemo(() => {
    return resolveEditorImageUrl(imageUrl, imagePath);
  }, [imageUrl, imagePath]);

  const previewCgt = useMemo(() => {
    if (mode === "edit" && post?.cgt_created?.trim()) {
      return post.cgt_created.trim();
    }

    return "CGT Preview";
  }, [mode, post]);

  const previewAuthor = useMemo(() => {
    if (mode === "edit" && post?.author_handle?.trim()) {
      return post.author_handle.trim();
    }

    return "You";
  }, [mode, post]);

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

      const res = await apiFetch<UploadResponse>("/upload?type=jen", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      setImagePath(res.path);
      setImageUrl(res.url);
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!body.trim()) {
      setError("Body is required.");
      return;
    }

    try {
      setSaving(true);

      if (mode === "create") {
        await createBlog({
          title: title.trim(),
          body,
          image_path: imagePath,
          image_url: imageUrl,
        });
      } else {
        if (!post?.id) {
          throw new Error("Missing post id for edit.");
        }

        await updateBlog(post.id, {
          title: title.trim(),
          body,
          image_path: imagePath,
          image_url: imageUrl,
        });
      }

      await onSaved();
    } catch (e: any) {
      if (String(e?.message || "").includes("403")) {
        setError("You do not have permission to do that.");
      } else {
        setError(e?.message ?? "Failed to save post");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSpellcheck = async () => {
    await runSpellcheck(title, body);
  };

  const runSpellcheck = async (nextTitle: string, nextBody: string) => {
    try {
      setSpellchecking(true);
      setError(null);

      const response = await spellcheckBlog({
        title: nextTitle,
        body: nextBody,
        language: "en-US",
      });

      setSpellcheckResult(response.data);
      setSpellcheckMessage(
        response.data.total_count > 0
          ? `${response.data.total_count} possible issue${response.data.total_count === 1 ? "" : "s"} found.`
          : "No spelling issues found."
      );
      setSpellcheckTone(response.data.total_count > 0 ? "warn" : "ok");
      requestAnimationFrame(() => {
        const target = document.getElementById("jen-spellcheck-results");
        target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (e: any) {
      setError(e?.message ?? "Spellcheck failed.");
    } finally {
      setSpellchecking(false);
    }
  };

  const applySuggestion = (section: "title" | "body", match: SpellcheckMatch, suggestion: string) => {
    if (!suggestion.trim()) {
      return;
    }

    if (section === "title") {
      if (typeof match.offset !== "number" || typeof match.length !== "number") {
        return;
      }

      const nextTitle = title.slice(0, match.offset) + suggestion + title.slice(match.offset + match.length);
      setTitle(nextTitle);
      void runSpellcheck(nextTitle, body);
      return;
    }

    if (typeof match.raw_offset !== "number" || typeof match.raw_length !== "number") {
      return;
    }

    const nextBody = body.slice(0, match.raw_offset) + suggestion + body.slice(match.raw_offset + match.raw_length);
    setBody(nextBody);
    void runSpellcheck(title, nextBody);
  };

  return (
    <div className="jen-editor-layout">
      <form className="panel jen-poster" onSubmit={handleSubmit}>
        <div className="jen-header-row">
          <h2 style={{ margin: 0 }}>
            {mode === "create" ? "Create JEN Post" : "Edit JEN Post"}
          </h2>

          <div className="status-panel__actions">
            <button
              type="button"
              className="btn btn--small"
              onClick={handleSpellcheck}
              disabled={spellchecking || saving || uploading}
            >
              {spellchecking ? "Checking…" : "Check Spelling"}
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={onCancel}
              disabled={saving || uploading}
            >
              Cancel
            </button>
          </div>
        </div>
        {spellcheckMessage ? (
          <p
            className="small"
            style={{ color: spellcheckTone === "ok" ? "#7CFFB2" : "#FFD166", marginTop: "-0.35rem" }}
          >
            {spellcheckMessage}
          </p>
        ) : null}

        <div className="jen-poster__row">
          <label className="small" htmlFor="editor-title">
            Title
          </label>
          <input
            id="editor-title"
            type="text"
            className="input"
            value={title}
            spellCheck
            lang="en"
            autoCorrect="on"
            autoCapitalize="sentences"
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
          />
        </div>

        <div className="jen-poster__row">
          <label className="small">Body (BBCode)</label>
          <BBCodeEditor value={body} onChange={setBody} rows={14} spellCheck lang="en" />
        </div>

        <div className="jen-poster__row">
          <label className="small">Image (optional)</label>

          <div className="jen-poster__file-controls">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
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
            <div className="jen-poster__thumb small">
              <div>Current image:</div>
              <img
                src={previewImageUrl}
                alt="Editor preview"
                style={{ maxWidth: "180px", marginTop: "0.5rem" }}
              />
            </div>
          )}
        </div>

        <div className="jen-poster__actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving
              ? mode === "create"
                ? "Posting…"
                : "Saving…"
              : mode === "create"
              ? "Create Post"
              : "Save Changes"}
          </button>
        </div>

        {error && (
          <p className="small" style={{ color: "salmon" }}>
            {error}
          </p>
        )}

        {spellcheckResult ? (
          <section id="jen-spellcheck-results" className="panel" style={{ padding: "0.85rem" }}>
            <div className="jen-header-row">
              <strong>Spellcheck Results</strong>
              <span className={`admin-badge admin-badge--soft${spellcheckResult.total_count > 0 ? " admin-badge--warn" : ""}`}>
                {spellcheckResult.total_count > 0
                  ? `${spellcheckResult.total_count} issue${spellcheckResult.total_count === 1 ? "" : "s"} found`
                  : "No issues found"}
              </span>
            </div>

            <div className="jen-spellcheck__section">
              <div className="jen-header-row">
                <strong className="small">Title</strong>
                <span className={`admin-badge admin-badge--soft${spellcheckResult.title_matches.length > 0 ? " admin-badge--warn" : ""}`}>
                  {spellcheckResult.title_matches.length} issue{spellcheckResult.title_matches.length === 1 ? "" : "s"}
                </span>
              </div>
              {spellcheckResult.title_matches.length > 0 ? (
                <div className="jen-spellcheck__list">
                  {spellcheckResult.title_matches.map((match, index) => (
                    <div key={`title-${index}`} className="jen-spellcheck__item small">
                      <div className="jen-spellcheck__headline"><strong>{match.short_message ?? match.message}</strong></div>
                      {describeMatchSnippet(match) ? <div className="jen-spellcheck__context">Problem: {describeMatchSnippet(match)}</div> : null}
                      {match.replacements.length > 0 ? (
                        <div className="jen-spellcheck__suggestions">
                          {match.replacements.map((replacement) => (
                            <button
                              key={`title-${index}-${replacement}`}
                              type="button"
                              className="btn btn--tiny jen-spellcheck__replace-btn"
                              onClick={() => applySuggestion("title", match, replacement)}
                            >
                              {replacement}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small" style={{ marginTop: "0.5rem" }}>No title issues.</p>
              )}
            </div>

            <div className="jen-spellcheck__section">
              <div className="jen-header-row">
                <strong className="small">Body</strong>
                <span className={`admin-badge admin-badge--soft${spellcheckResult.body_matches.length > 0 ? " admin-badge--warn" : ""}`}>
                  {spellcheckResult.body_matches.length} issue{spellcheckResult.body_matches.length === 1 ? "" : "s"}
                </span>
              </div>
              {spellcheckResult.body_matches.length > 0 ? (
                <div className="jen-spellcheck__list">
                  {spellcheckResult.body_matches.map((match, index) => (
                    <div key={`body-${index}`} className="jen-spellcheck__item small">
                      <div className="jen-spellcheck__headline"><strong>{match.short_message ?? match.message}</strong></div>
                      {describeMatchSnippet(match) ? <div className="jen-spellcheck__context">Problem: {describeMatchSnippet(match)}</div> : null}
                      {match.replacements.length > 0 ? (
                        <div className="jen-spellcheck__suggestions">
                          {match.replacements.map((replacement) => (
                            <button
                              key={`body-${index}-${replacement}`}
                              type="button"
                              className="btn btn--tiny jen-spellcheck__replace-btn"
                              onClick={() => applySuggestion("body", match, replacement)}
                            >
                              {replacement}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small" style={{ marginTop: "0.5rem" }}>No body issues.</p>
              )}
            </div>
          </section>
        ) : null}
      </form>

      <aside className="panel jen-editor-preview">
        <div className="jen-editor-preview__label small">Live Preview</div>

        <article className="panel jen-panel jen-panel--open">
          <header className="jen-panel__header">
            <div className="jen-panel__title-block">
              <h2 className="jen-panel__title">{title.trim() || "Untitled Post"}</h2>

              <div className="jen-panel__meta small">
                <span>{previewAuthor}</span>
                {" · "}
                <span>{previewCgt}</span>
              </div>
            </div>
          </header>

          <div className="jen-panel__body">
            {previewImageUrl && (
              <div className="jen-panel__body-image">
                <img src={previewImageUrl} alt={title || "Preview image"} />
              </div>
            )}

            <BBCodeView
              value={body || "[i]Start writing your JEN post...[/i]"}
              className="jen-panel__body-text small"
            />
          </div>
        </article>
      </aside>
    </div>
  );
};

export default BlogEditorPanel;
