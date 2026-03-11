import React from "react";
import { Link } from "react-router-dom";
import type { BlogPost } from "../../api/blog";
import type { SwcUser } from "../../api/auth";
import { getBackendOrigin } from "../../api/auth";
import BBCodeView from "../bbcode/BBCodeView";
import { canDeleteBlog, canEditBlogPost } from "../../auth/permissions";

type Props = {
  post: BlogPost;
  isOpen: boolean;
  user: SwcUser | null;
  busyDelete: boolean;
  manageMode: boolean;
  onToggle: () => void;
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
  isOpen,
  user,
  busyDelete,
  manageMode,
  onToggle,
  onDelete,
}) => {
  const imgSrc = resolveImageUrl(post);
  const cgt = post.cgt_created?.trim() ? post.cgt_created.trim() : "CGT Unknown";

  const showEdit = manageMode && canEditBlogPost(user, post);
  const showDelete = manageMode && canDeleteBlog(user);

  return (
    <article className={"panel jen-panel" + (isOpen ? " jen-panel--open" : "")}>
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
            className={"jen-panel__toggle" + (isOpen ? " jen-panel__toggle--open" : "")}
            onClick={onToggle}
            aria-label={isOpen ? "Close post" : "Open post"}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {imgSrc && !isOpen && (
        <div className="jen-panel__thumb">
          <img src={imgSrc} alt={post.title} />
        </div>
      )}

      {isOpen && (
        <div className="jen-panel__body">
          {imgSrc && (
            <div className="jen-panel__body-image">
              <img src={imgSrc} alt={post.title} />
            </div>
          )}

          <BBCodeView value={post.body} className="jen-panel__body-text small" />
        </div>
      )}
    </article>
  );
};

export default JenPostCard;