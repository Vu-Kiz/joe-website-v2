import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import HamburgerToggle from "./HamburgerToggle";

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  sourceRect?: Rect;
  maxWidth?: number;
  maxHeight?: number;
};

const getTargetRect = (maxWidth: number, maxHeight: number): Rect => {
  const width = Math.min(window.innerWidth - 32, maxWidth);
  const height = Math.min(window.innerHeight - 32, maxHeight);
  return {
    width,
    height,
    left: Math.round((window.innerWidth - width) / 2),
    top: Math.round((window.innerHeight - height) / 2),
  };
};

const Overlay: React.FC<Props> = ({ title, onClose, children, sourceRect, maxWidth = 980, maxHeight = 760 }) => {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect>(() => getTargetRect(maxWidth, maxHeight));

  useEffect(() => {
    const onResize = () => setTargetRect(getTargetRect(maxWidth, maxHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maxWidth, maxHeight]);

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

  const isOpen = entered && !closing;

  const handleClose = () => {
    setClosing(true);
    setEntered(false);
    window.setTimeout(onClose, 280);
  };

  const fallbackRect: Rect = {
    top: Math.round((window.innerHeight - 40) / 2),
    left: Math.round((window.innerWidth - 40) / 2),
    width: 40,
    height: 40,
  };

  const currentRect = isOpen ? targetRect : (sourceRect ?? fallbackRect);

  return createPortal(
    <div className={["fixed inset-0 z-1000", isOpen ? "pointer-events-auto" : "pointer-events-none"].join(" ")}>
      {/* Backdrop */}
      <button
        type="button"
        className={[
          "absolute inset-0 border-0 p-0 m-0 bg-black/45 cursor-pointer transition-opacity duration-280",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        aria-label="Close"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="panel fixed m-0 overflow-hidden flex flex-col z-1001 shadow-[0_18px_42px_rgba(0,0,0,0.42)] transition-[top,left,width,height,box-shadow] duration-280 ease-in-out"
        style={{
          top: `${currentRect.top}px`,
          left: `${currentRect.left}px`,
          width: `${currentRect.width}px`,
          height: `${currentRect.height}px`,
          transform: "translateZ(0)",
        }}
      >
        {title !== undefined && (
          <header className="flex items-start justify-between gap-2 pb-2 border-b border-white/20 shrink-0">
            <div className="min-w-0">
              {typeof title === "string"
                ? <h2 className="m-0 text-[1.5rem] leading-[1.15] font-semibold text-[#F6A300]">{title}</h2>
                : title}
            </div>
            <HamburgerToggle open={true} onClick={handleClose} ariaLabel="Close" />
          </header>
        )}
        {title === undefined && (
          <div className="absolute top-2 right-2 z-10">
            <HamburgerToggle open={true} onClick={handleClose} ariaLabel="Close" />
          </div>
        )}

        <div className="overflow-auto mt-3 pr-1 flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Overlay;
