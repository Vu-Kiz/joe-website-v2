import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { listBlog, deleteBlog, type BlogPost } from "../api/content/blog";
import { fetchAuthMe, type SwcUser } from "../api/core/auth";

import JenHeader from "../components/jen/JenHeader";
import JenPostGrid from "../components/jen/JenPostGrid";
import JenEditorShell from "../components/jen/JenEditorShell";
import JenExpandedOverlay from "../components/jen/JenExpandedOverlay";

import JENBanner from "../assets/jen/JENBanner1.png";

import {
  canManageBlog,
  canDeleteBlog,
  canEditBlogPost,
} from "../auth/permissions";

type OverlayRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

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

  const [overlayPost, setOverlayPost] = useState<BlogPost | null>(null);
  const [overlaySourceRect, setOverlaySourceRect] = useState<OverlayRect | null>(null);

  const [user, setUser] = useState<SwcUser | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);

  const autoOpenedPostIdRef = useRef<number | null>(null);

  const refreshPosts = async () => {
    const blog = await listBlog();
    const list = blog.posts ?? [];
    setPosts(list);

    if (!list.length) {
      setOverlayPost(null);
      setOverlaySourceRect(null);
      return;
    }

    if (overlayPost) {
      const refreshedOverlayPost = list.find((p) => p.id === overlayPost.id) ?? null;
      setOverlayPost(refreshedOverlayPost);
      if (!refreshedOverlayPost) {
        setOverlaySourceRect(null);
      }
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
        setOverlayPost(null);
        setOverlaySourceRect(null);
        autoOpenedPostIdRef.current = null;
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
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!requestedPostId || !Number.isFinite(requestedPostId)) return;
    if (!posts.length) return;
    if (overlayPost?.id === requestedPostId) return;
    if (autoOpenedPostIdRef.current === requestedPostId) return;

    const requestedPost = posts.find((p) => p.id === requestedPostId);
    if (!requestedPost) return;

    const card = document.querySelector<HTMLElement>(`[data-post-id="${requestedPostId}"]`);
    if (!card) return;

    autoOpenedPostIdRef.current = requestedPostId;

    card.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const timer = window.setTimeout(() => {
      const rect = card.getBoundingClientRect();

      setOverlayPost(requestedPost);
      setOverlaySourceRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("post");

      const nextQuery = nextParams.toString();
      navigate(
        {
          pathname: "/jen",
          search: nextQuery ? `?${nextQuery}` : "",
        },
        { replace: true }
      );
    }, 650);

    return () => window.clearTimeout(timer);
  }, [loading, requestedPostId, posts, overlayPost, navigate, searchParams]);

  const handleOpenFromCard = (post: BlogPost, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();

    setOverlayPost(post);
    setOverlaySourceRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  };

  const handleCloseOverlay = () => {
    setOverlayPost(null);
    setOverlaySourceRect(null);
  };

  const handleDelete = async (post: BlogPost) => {
    if (!canDeleteBlog(user)) return;

    const ok = window.confirm(`Delete "${post.title}"? This cannot be undone.`);
    if (!ok) return;

    try {
      setBusyDeleteId(post.id);
      await deleteBlog(post.id);
      await refreshPosts();

      if (overlayPost?.id === post.id) {
        setOverlayPost(null);
        setOverlaySourceRect(null);
      }
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

  const banner = (
    <img
      src={JENBanner}
      alt="Jawa Entertainment Network"
      className="block w-full max-w-[800px] h-auto mx-auto mb-4"
    />
  );

  if (loading) {
    return (
      <div className="site-scale">
        <div className="app app--one">
          <main className="board flex flex-col gap-4">
            {banner}
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
          <main className="board flex flex-col gap-4">
            {banner}
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
        <main className="board flex flex-col gap-4">
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
            <>
              {banner}
              <p className="small">No JEN posts yet. Soon™.</p>
            </>
          ) : (
            <>
              {banner}

              <JenPostGrid
                posts={posts}
                overlayOpenId={overlayPost?.id ?? null}
                user={user}
                busyDeleteId={busyDeleteId}
                manageMode={manageMode}
                onOpenFromCard={handleOpenFromCard}
                onCloseOverlay={handleCloseOverlay}
                onDelete={handleDelete}
              />

              {overlayPost && overlaySourceRect && (
                <JenExpandedOverlay
                  post={overlayPost}
                  sourceRect={overlaySourceRect}
                  onClose={handleCloseOverlay}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default JenPage;