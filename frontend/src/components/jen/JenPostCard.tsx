import React, { useRef } from "react";
import { Link } from "react-router-dom";
import type { BlogPost } from "../../api/blog";
import type { SwcUser } from "../../api/auth";
import { getBackendOrigin } from "../../api/auth";
import { canDeleteBlog, canEditBlogPost } from "../../auth/permissions";

type Props = {
  post: BlogPost;
  isOverlayOpen: boolean;
  user: SwcUser | null;
  busyDelete: boolean;
  manageMode: boolean;
  onOpenFromCard: (post: BlogPost, element: HTMLElement) => void;
  onCloseOverlay: () => void;
  onDelete: (post: BlogPost) => void;
};

const resolveImageUrl = (post: BlogPost): string | null => {
  const origin = getBackendOrigin();

  if (post.image_url && post.image_url.trim() !== "") {
    const u = post.image_url.trim();

    if (/^https?:\/\//i.test(u)) return u;

    if (origin) return `${origin}${u.startsWith("/") ? "" : "/"}${u}`;
    return u;
  }

  if (post.image_path && post.image_path.trim() !== "") {
    const clean = post.image_path.replace(/^\/+/, "");
    if (origin) return `${origin}/storage/${clean}`;
    return `/storage/${clean}`;
  }

  return null;
};

const JenPostCard: React.FC<Props> = ({
  post,
  isOverlayOpen,
  user,
  busyDelete,
  manageMode,
  onOpenFromCard,
  onCloseOverlay,
  onDelete,
}) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const imgSrc = resolveImageUrl(post);
  const cgt = post.cgt_created?.trim() ? post.cgt_created.trim() : "CGT Unknown";

  const showEdit = manageMode && canEditBlogPost(user, post);
  const showDelete = manageMode && canDeleteBlog(user);

  const handleHamburgerClick = () => {
    if (isOverlayOpen) {
      onCloseOverlay();
      return;
    }

    if (cardRef.current) {
      onOpenFromCard(post, cardRef.current);
    }
  };

  return (
    <article
      ref={cardRef}
      data-post-id={post.id}
      className={"panel jen-panel" + (isOverlayOpen ? " jen-panel--active" : "")}
    >
      <header className="jen-panel__header">
        <div className="jen-panel__title-block">
          <h2 className="jen-panel__title">{post.title}</h2>

          <div className="jen-panel__meta small">
            <span>{post.author_handle ?? "Unknown"}</span>
            {" · "}
            <span>{cgt}</span>
          </div>
        </div>

        <div className="jen-panel__actions">
          {showEdit && (
            <Link
              className="btn btn--tiny"
              to={`/jen?edit=${post.id}&manage=1`}
              onClick={(e) => e.stopPropagation()}
            >
              Edit
            </Link>
          )}

          {showDelete && (
            <button
              type="button"
              className="btn btn--tiny"
              disabled={busyDelete}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(post);
              }}
            >
              {busyDelete ? "Deleting…" : "Delete"}
            </button>
          )}

          <button
            type="button"
            className="jen-panel__toggle"
            onClick={handleHamburgerClick}
            aria-label={isOverlayOpen ? "Close post" : "Open post"}
            aria-expanded={isOverlayOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {imgSrc && (
        <div className="jen-panel__thumb">
          <img src={imgSrc} alt={post.title} />
        </div>
      )}
    </article>
  );
};

export default JenPostCard;