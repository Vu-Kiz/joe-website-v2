/**
 * Btn – project-standard button component.
 *
 * Always sets an explicit background so the browser's built-in `ButtonFace`
 * colour can never bleed through. Use this instead of raw <button> elements
 * with near-transparent bg-white/[0.0x] classes.
 *
 * Variants:
 *   primary  – gold border, dark bg (default)
 *   ghost    – subtle border, transparent bg
 *   tab      – filter/nav tab; pair with active={bool} for selected state
 *
 * Sizes:
 *   md  – default (px-3 py-2 text-[13px])
 *   sm  – compact  (px-[10px] py-[6px] text-[12px])
 */

import React from "react";

export type BtnVariant = "primary" | "ghost" | "tab";
export type BtnSize = "md" | "sm";

export type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  /** Only used by the "tab" variant to toggle the active/selected style. */
  active?: boolean;
};

const BASE =
  "inline-flex w-fit max-w-full items-center justify-center gap-2 border text-center no-underline select-none cursor-pointer font-tektur leading-none font-bold uppercase tracking-[0.04em] transition-[background,border-color,color,transform] duration-150 active:translate-y-px disabled:opacity-65 disabled:cursor-not-allowed";

function variantCls(variant: BtnVariant, size: BtnSize, active?: boolean): string {
  const r = size === "md" ? "rounded-lg" : "rounded-[7px]";
  const p = size === "md" ? "px-3 py-2 text-[13px]" : "px-[10px] py-[6px] text-[12px]";

  switch (variant) {
    case "primary":
      return `${r} ${p} bg-[rgba(0,0,0,0.35)] border-[rgba(245,213,70,0.35)] text-white/[0.88] hover:bg-[rgba(245,213,70,0.12)] hover:border-[rgba(245,213,70,0.55)] hover:text-white`;

    case "ghost":
      return `${r} ${p} bg-surface border-white/[0.12] text-white/65 hover:bg-white/[0.08] hover:border-white/[0.22] hover:text-white/90`;

    case "tab":
      return active
        ? `${r} ${p} bg-[rgba(245,213,70,0.08)] border-[rgba(245,213,70,0.4)] text-[#f2c46f]`
        : `${r} ${p} bg-surface border-white/10 text-white/60 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80`;
  }
}

const Btn: React.FC<BtnProps> = ({
  variant = "primary",
  size = "md",
  active,
  className = "",
  type = "button",
  children,
  ...rest
}) => (
  <button
    // eslint-disable-next-line react/button-has-type
    type={type}
    className={`${BASE} ${variantCls(variant, size, active)} ${className}`.trim()}
    {...rest}
  >
    {children}
  </button>
);

export default Btn;
