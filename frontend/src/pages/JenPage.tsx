import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { listBlog, deleteBlog, type BlogPost } from "../api/blog";
import { fetchAuthMe, type SwcUser } from "../api/auth";

import JenHeader from "../components/jen/JenHeader";
import JenPostGrid from "../components/jen/JenPostGrid";
import JenEditorShell from "../components/jen/JenEditorShell";

import {
  canManageBlog,
  canDeleteBlog,
  canEditBlogPost,
} from "../auth/permissions";

import "../styles/main.sass";
import "../styles/_jen.sass";

const JenPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedPostId = Number(searchParams.get("post"));
  const requestedEditId = Number(searchParams.get("edit"));
  const requestedCreate = searchParams.get("create") === "1";
  const manageMode = searchParams.get("manage") === "1";

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const [user, setUser] = useState<SwcUser | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);

  const refreshPosts = async () => {
    const blog = await listBlog();
    const list = blog.posts ?? [];
    setPosts(list);

    if (list.length > 0) {
      const requested =
        Number.isFinite(requestedPostId) && requestedPostId > 0
          ? list.find((p) => p.id === requestedPostId)
          : null;

      setOpenId((current) => {
        if (requested) return requested.id;
        if (current != null && list.some((p) => p.id === current)) return current;
        return list[0].id;
      });
    } else {
      setOpenId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [meRes, blogRes] = await Promise.all([
          fetchAuthMe().catch(() => ({ ok: true, user: null } as any)),
          listBlog(),
        ]);

        if (cancelled) return;

        const currentUser = meRes?.user ?? null;
        const list = blogRes.posts ?? [];

        setUser(currentUser);
        setPosts(list);
        setError(null);

        if (list.length > 0) {
          const requested =
            Number.isFinite(requestedPostId) && requestedPostId > 0
              ? list.find((p) => p.id === requestedPostId)
              : null;

          setOpenId(requested ? requested.id : list[0].id);
        } else {
          setOpenId(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load JEN posts");
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
  }, [requestedPostId]);

  const togglePanel = (id: number) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const handleDelete = async (post: BlogPost) => {
    if (!canDeleteBlog(user)) return;

    const ok = window.confirm(`Delete "${post.title}"? This cannot be undone.`);
    if (!ok) return;

    try {
      setBusyDeleteId(post.id);
      await deleteBlog(post.id);
      await refreshPosts();

      setOpenId((current) => (current === post.id ? null : current));
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete post");
    } finally {
      setBusyDeleteId(null);
    }
  };

  const showCreate = canManageBlog(user);

  const editingPost = useMemo(() => {
    if (!requestedEditId || !Number.isFinite(requestedEditId)) return null;
    return posts.find((p) => p.id === requestedEditId) ?? null;
  }, [posts, requestedEditId]);

  const isCreateMode = showCreate && manageMode && requestedCreate;
  const isEditMode =
    manageMode &&
    !!editingPost &&
    !!user &&
    canEditBlogPost(user, editingPost);

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board jen-board">
            <h1>Jawa Entertainment Network</h1>
            <p className="small">Loading JEN posts…</p>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board jen-board">
            <h1>Jawa Entertainment Network</h1>
            <p className="small" style={{ color: "salmon" }}>
              {error}
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="site-scale">
      <div className="app app--one">
        <main className="board jen-board">
          <JenHeader canCreate={showCreate} manageMode={manageMode} />

          {isCreateMode || isEditMode ? (
            <JenEditorShell
              mode={isCreateMode ? "create" : "edit"}
              post={isEditMode ? editingPost : null}
              onCancel={() => navigate("/jen")}
              onSaved={async () => {
                await refreshPosts();
                navigate("/jen");
              }}
            />
          ) : !posts.length ? (
            <p className="small">No JEN posts yet. Soon™.</p>
          ) : (
            <JenPostGrid
              posts={posts}
              openId={openId}
              user={user}
              busyDeleteId={busyDeleteId}
              manageMode={manageMode}
              onToggle={togglePanel}
              onDelete={handleDelete}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default JenPage;