import React, { useEffect } from "react";
import { BTN, BTN_GHOST } from "../../utils/ui";

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  eyebrow?: string;
};

const MarketConfirmDialog: React.FC<Props> = ({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  eyebrow = "Confirmation",
}) => {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-4 w-full max-w-[460px] p-4 rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,28,34,0.98),rgba(19,20,25,0.98))] shadow-[0_20px_44px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 justify-between">
          <div>
            <p className="m-0 mb-1 text-white/50 text-[0.72rem] font-bold tracking-[0.08em] uppercase">{eyebrow}</p>
            <h3 className="m-0 text-[1.1rem] leading-[1.2]">{title}</h3>
          </div>
          <button className={BTN_GHOST + " shrink-0"} type="button" onClick={onClose}>Close</button>
        </div>
        <div className="text-white/80">
          <p className="small" style={{ margin: 0 }}>{message}</p>
        </div>
        <div className="flex gap-[0.6rem] justify-end max-sm:flex-col">
          <button className={BTN_GHOST + " min-w-[8.5rem] max-sm:w-full"} type="button" onClick={onClose}>Cancel</button>
          <button className={BTN + " min-w-[8.5rem] max-sm:w-full"} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default MarketConfirmDialog;
