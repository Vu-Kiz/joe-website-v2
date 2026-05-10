import React, { useEffect } from "react";

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
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="market-confirm-overlay" onClick={onClose}>
      <div className="market-confirm-overlay__card" onClick={(e) => e.stopPropagation()}>
        <div className="market-confirm-overlay__header">
          <div>
            <p className="market-confirm-overlay__eyebrow">{eyebrow}</p>
            <h3 className="market-confirm-overlay__title">{title}</h3>
          </div>
          <button
            className="btn btn--ghost market-confirm-overlay__close"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="market-confirm-overlay__body">
          <p className="small" style={{ margin: 0 }}>{message}</p>
        </div>
        <div className="market-confirm-overlay__actions">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketConfirmDialog;
