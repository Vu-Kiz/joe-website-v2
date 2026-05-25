import React from "react";

type HamburgerToggleProps = {
  open?: boolean;
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  decorative?: boolean;
};

const baseCls = "w-[26px] h-[22px] inline-flex flex-col justify-center items-stretch gap-[3px] bg-transparent border-none p-0 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60";

const barBase = "h-[2px] rounded-sm bg-white origin-center transition-[transform,opacity] duration-150 ease-in-out";

const HamburgerToggle: React.FC<HamburgerToggleProps> = ({
  open = false,
  onClick,
  ariaLabel,
  className = "",
  disabled = false,
  decorative = false,
}) => {
  const rootCls = [baseCls, className].filter(Boolean).join(" ");

  const bars = (
    <>
      <span className={`${barBase} ${open ? "translate-y-[5px] rotate-45" : ""}`} />
      <span className={`${barBase} ${open ? "opacity-0" : ""}`} />
      <span className={`${barBase} ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
    </>
  );

  if (decorative) {
    return <span className={rootCls} aria-hidden="true">{bars}</span>;
  }

  return (
    <button
      type="button"
      className={rootCls}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      disabled={disabled}
    >
      {bars}
    </button>
  );
};

export default HamburgerToggle;
