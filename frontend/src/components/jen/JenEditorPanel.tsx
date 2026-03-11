import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, getBackendOrigin } from "../../api/auth";
import { createBlog, updateBlog, type BlogPost } from "../../api/blog";
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

      const res = await apiFetch<UploadResponse>("/upload?type=blog", {
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
              onClick={onCancel}
              disabled={saving || uploading}
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="jen-poster__row">
          <label className="small" htmlFor="editor-title">
            Title
          </label>
          <input
            id="editor-title"
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
          />
        </div>

        <div className="jen-poster__row">
          <label className="small">Body (BBCode)</label>
          <BBCodeEditor value={body} onChange={setBody} rows={14} />
        </div>

        <div className="jen-poster__row">
          <label className="small">Image (optional)</label>

          <div className="jen-poster__file-controls">
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