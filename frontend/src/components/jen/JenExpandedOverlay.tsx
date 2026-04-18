import React, { useEffect, useMemo, useState } from "react";
import type { BlogPost } from "../../api/blog";
import { getBackendOrigin } from "../../api/auth";
import BBCodeView from "../bbcode/BBCodeView";
import HamburgerToggle from "../common/HamburgerToggle";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type Props = {
  post: BlogPost;
  sourceRect: Rect;
  onClose: () => void;
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

const getTargetRect = (): Rect => {
  const width = Math.min(window.innerWidth - 32, 980);
  const height = Math.min(window.innerHeight - 32, 760);

  return {
    width,
    height,
    left: Math.round((window.innerWidth - width) / 2),
    top: Math.round((window.innerHeight - height) / 2),
  };
};

const JenExpandedOverlay: React.FC<Props> = ({ post, sourceRect, onClose }) => {
  const imgSrc = useMemo(() => resolveImageUrl(post), [post]);
  const cgt = post.cgt_created?.trim() ? post.cgt_created.trim() : "CGT Unknown";

  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect>(() => getTargetRect());

  useEffect(() => {
    const onResize = () => setTargetRect(getTargetRect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  const currentRect = closing || !entered ? sourceRect : targetRect;

  const handleClose = () => {
    setClosing(true);
    setEntered(false);
    window.setTimeout(() => {
      onClose();
    }, 280);
  };

  return (
    <div className={"jen-overlay" + (entered && !closing ? " is-open" : "")}>
      <button
        type="button"
        className="jen-overlay__backdrop"
        aria-label="Close post"
        onClick={handleClose}
      />

      <article
        className="panel jen-overlay__panel"
        style={{
          top: `${currentRect.top}px`,
          left: `${currentRect.left}px`,
          width: `${currentRect.width}px`,
          height: `${currentRect.height}px`,
        }}
      >
        <header className="jen-overlay__header">
          <div className="jen-overlay__title-block">
            <h2 className="jen-panel__title">{post.title}</h2>
            <div className="jen-panel__meta small">
              <span>{post.author_handle ?? "Unknown"}</span>
              {" · "}
              <span>{cgt}</span>
            </div>
          </div>

          <HamburgerToggle
            open={true}
            onClick={handleClose}
            ariaLabel="Close post"
          />
        </header>

        <div className="jen-overlay__body">
          {imgSrc && (
            <div className="jen-panel__body-image">
              <img src={imgSrc} alt={post.title} />
            </div>
          )}

          <BBCodeView value={post.body} className="jen-panel__body-text small" />
        </div>
      </article>
    </div>
  );
};

export default JenExpandedOverlay;
