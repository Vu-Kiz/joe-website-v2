import React, { useEffect, useMemo, useState } from "react";
import type { BlogPost } from "../../api/content/blog";
import { getBackendOrigin } from "../../api/core/auth";
import BBCodeView from "../bbcode/BBCodeView";
import HamburgerToggle from "../common/HamburgerToggle";

type Rect = { top: number; left: number; width: number; height: number };

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
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  const currentRect = closing || !entered ? sourceRect : targetRect;
  const isOpen = entered && !closing;

  const handleClose = () => {
    setClosing(true);
    setEntered(false);
    window.setTimeout(onClose, 280);
  };

  return (
    <div className={["fixed inset-0 z-[1000]", isOpen ? "pointer-events-auto" : "pointer-events-none"].join(" ")}>
      {/* Backdrop */}
      <button
        type="button"
        className={[
          "absolute inset-0 border-0 p-0 m-0 bg-black/45 cursor-pointer transition-opacity duration-[280ms]",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        aria-label="Close post"
        onClick={handleClose}
      />

      {/* Panel */}
      <article
        className="panel fixed m-0 overflow-hidden flex flex-col z-[1001] shadow-[0_18px_42px_rgba(0,0,0,0.42)] transition-[top,left,width,height,box-shadow] duration-[280ms] ease-in-out"
        style={{
          top: `${currentRect.top}px`,
          left: `${currentRect.left}px`,
          width: `${currentRect.width}px`,
          height: `${currentRect.height}px`,
          transform: "translateZ(0)",
        }}
      >
        <header className="flex items-start justify-between gap-2 pb-2 border-b border-white/20">
          <div className="flex flex-col gap-[0.35rem] min-w-0">
            <h2 className="m-0 text-[1.5rem] leading-[1.15] font-semibold text-[#F6A300]">{post.title}</h2>
            <div className="small font-asimovian text-[0.95rem]">
              <span>{post.author_handle ?? "Unknown"}</span>
              {" · "}
              <span>{cgt}</span>
            </div>
          </div>
          <HamburgerToggle open={true} onClick={handleClose} ariaLabel="Close post" />
        </header>

        <div className="overflow-auto mt-3 pr-1">
          {imgSrc && (
            <div className="mb-4">
              <img src={imgSrc} alt={post.title} className="block w-full max-h-[420px] object-contain rounded-[4px]" />
            </div>
          )}
          <BBCodeView value={post.body} className="small text-[0.98rem] leading-[1.65]" />
        </div>
      </article>
    </div>
  );
};

export default JenExpandedOverlay;
