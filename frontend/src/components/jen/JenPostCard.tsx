import React, { useRef } from "react";
import { Link } from "react-router-dom";
import type { BlogPost } from "../../api/content/blog";
import type { SwcUser } from "../../api/core/auth";
import { getBackendOrigin } from "../../api/core/auth";
import { canDeleteBlog, canEditBlogPost } from "../../auth/permissions";
import HamburgerToggle from "../common/HamburgerToggle";
import { BTN, BTN_SM, BTN_GHOST, BTN_GHOST_SM } from "../../utils/ui";

type Props = {
  post: BlogPost;
  isOverlayOpen: boolean;
  dimmed: boolean;
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
  dimmed,
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
    if (isOverlayOpen) { onCloseOverlay(); return; }
    if (cardRef.current) onOpenFromCard(post, cardRef.current);
  };

  return (
    <article
      ref={cardRef}
      data-post-id={post.id}
      className={[
        "panel flex flex-col gap-[0.45rem] relative transition-opacity duration-200",
        dimmed ? "opacity-45" : "opacity-100",
        isOverlayOpen ? "z-[2]" : "",
      ].filter(Boolean).join(" ")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-[0.15rem] min-w-0">
          <h2 className="m-0 text-[0.95rem] font-semibold text-[#F6A300]">{post.title}</h2>
          <div className="small opacity-80 text-[0.8rem] font-asimovian">
            <span>{post.author_handle ?? "Unknown"}</span>
            {" · "}
            <span>{cgt}</span>
          </div>
        </div>

        <div className="flex items-center gap-[0.4rem] shrink-0">
          {showEdit && (
            <Link className={BTN_SM} to={`/jen?edit=${post.id}&manage=1`} onClick={(e) => e.stopPropagation()}>
              Edit
            </Link>
          )}
          {showDelete && (
            <button type="button" className={BTN_SM} disabled={busyDelete} onClick={(e) => { e.stopPropagation(); onDelete(post); }}>
              {busyDelete ? "Deleting…" : "Delete"}
            </button>
          )}
          <HamburgerToggle open={isOverlayOpen} onClick={handleHamburgerClick} ariaLabel={isOverlayOpen ? "Close post" : "Open post"} />
        </div>
      </header>

      {imgSrc && (
        <div className="mt-[0.35rem]">
          <img src={imgSrc} alt={post.title} className="block w-full h-full object-contain rounded-[4px]" />
        </div>
      )}
    </article>
  );
};

export default JenPostCard;
