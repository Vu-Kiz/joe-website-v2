import React, { useEffect, useState } from "react";
import { listBlog, type BlogPost } from "../api/blog";

import "../styles/main.sass";

const JenPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await listBlog(); // ✅ new API
        if (!cancelled) {
          setPosts(data.posts ?? []);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load JEN posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board">
          <h1 style={{ marginTop: 0 }}>Jawa Entertainment Network</h1>

          {loading && <p className="small">Loading JEN posts…</p>}
          {error && (
            <p className="small" style={{ color: "salmon" }}>
              {error}
            </p>
          )}

          {!loading && !error && posts.length === 0 && (
            <p className="small">No posts yet.</p>
          )}

          {!loading &&
            !error &&
            posts.map((p) => (
              <article key={p.id} className="panel" style={{ marginBottom: 14 }}>
                {p.image_url ? (
                  <div className="panel-banner">
                    <img src={p.image_url} alt={p.title} />
                  </div>
                ) : null}

                <h2 style={{ margin: "6px 0 4px" }}>{p.title}</h2>

                <div className="small" style={{ opacity: 0.85, marginBottom: 8 }}>
                  <span>By {p.author_handle}</span>
                  {" · "}
                  <span>{new Date(p.created_at).toLocaleString()}</span>
                  {p.cgt_created ? <>{" · "}CGT {p.cgt_created}</> : null}
                </div>

                <div className="small" style={{ whiteSpace: "pre-wrap" }}>
                  {p.body}
                </div>
              </article>
            ))}
        </main>
      </div>
    </div>
  );
};

export default JenPage;
