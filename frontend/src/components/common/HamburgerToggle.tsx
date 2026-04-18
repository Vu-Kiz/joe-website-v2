import React from "react";

type HamburgerToggleProps = {
  open?: boolean;
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  decorative?: boolean;
};

const HamburgerToggle: React.FC<HamburgerToggleProps> = ({
  open = false,
  onClick,
  ariaLabel,
  className = "",
  disabled = false,
  decorative = false,
}) => {
  const classes = `hamburger-toggle${open ? " is-open" : ""}${className ? ` ${className}` : ""}`;

  if (decorative) {
    return (
      <span className={classes} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      disabled={disabled}
    >
      <span />
      <span />
      <span />
    </button>
  );
};

export default HamburgerToggle;
