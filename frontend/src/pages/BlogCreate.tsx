import React, { useState } from "react";
import { uploadImage } from "../api/upload";
import { createBlog } from "../api/blog";

const BlogCreate: React.FC = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async () => {
    setMsg(null);
    setSaving(true);

    try {
      let image_path: string | null = null;
      let image_url: string | null = null;

      if (file) {
        const up = await uploadImage(file, "blog"); // ✅ expandable: just change type
        image_path = up.path;
        image_url = up.url;
      }

      await createBlog({ title, body, image_path, image_url });
      setMsg("Posted!");
      setTitle("");
      setBody("");
      setFile(null);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h2>Create Blog Post</h2>

      {msg && <p className="small">{msg}</p>}

      <div style={{ display: "grid", gap: 10 }}>
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="input"
          placeholder="Body"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button className="btn" onClick={onSubmit} disabled={saving}>
          {saving ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
};

export default BlogCreate;
