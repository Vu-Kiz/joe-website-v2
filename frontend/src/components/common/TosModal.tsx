import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { acceptTos, apiFetch, apiLogout } from "../../api/core/auth";
import BBCodeView from "../bbcode/BBCodeView";
import { BTN } from "../../utils/ui";

type TosContent = {
  version: number;
  content: string;
  published_at: string | null;
};

type Props = {
  readOnly?: boolean;
  onAccepted?: () => void;
  onClose?: () => void;
};

const TosModal: React.FC<Props> = ({ readOnly = false, onAccepted, onClose }) => {
  const [tos, setTos] = useState<TosContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingContent(true);
        setContentError(null);
        const json = await apiFetch<{ ok: boolean; tos: TosContent | null }>("/tos/current");
        if (cancelled) return;
        if (json?.tos) {
          setTos(json.tos);
        } else {
          setContentError("No active Terms of Service found.");
        }
      } catch {
        if (!cancelled) setContentError("Failed to load Terms of Service.");
      } finally {
        if (!cancelled) setLoadingContent(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (readOnly) {
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [readOnly, onClose]);

  const handleAccept = async () => {
    try {
      setAccepting(true);
      setActionError(null);
      await acceptTos();
      onAccepted?.();
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to accept TOS. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      setDeclining(true);
      await apiLogout();
      window.location.href = "/home";
    } catch {
      window.location.href = "/home";
    }
  };

  const modal = (
    <div className="fixed inset-0 z-2000 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={readOnly ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="panel relative z-2001 flex flex-col gap-4 mx-4 w-full max-w-2xl"
        style={{ maxHeight: "min(90vh, 700px)" }}
      >
        <div className="flex flex-col gap-1 shrink-0">
          <h2 className="h2" style={{ margin: 0 }}>Terms of Service</h2>
          {tos && (
            <p className="small muted" style={{ margin: 0 }}>
              Version {tos.version}
              {tos.published_at ? ` · Published ${new Date(tos.published_at).toLocaleDateString()}` : ""}
            </p>
          )}
        </div>

        <div
          className="overflow-y-auto flex-1 pr-1"
          style={{ minHeight: 0 }}
        >
          {loadingContent && (
            <p className="small" style={{ margin: 0 }}>Loading Terms of Service…</p>
          )}
          {contentError && (
            <div className="flex flex-col gap-3">
              <p className="small" style={{ color: "salmon", margin: 0 }}>{contentError}</p>
              <button
                type="button"
                className={BTN}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}
          {!loadingContent && !contentError && tos && (
            <BBCodeView value={tos.content} className="small" />
          )}
        </div>

        {actionError && (
          <p className="small" style={{ color: "salmon", margin: 0 }}>{actionError}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 border-t border-white/10">
          {readOnly ? (
            <button type="button" className={BTN} onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                className={BTN}
                onClick={handleAccept}
                disabled={accepting || declining || loadingContent || !!contentError}
              >
                {accepting ? "Accepting…" : "I Accept"}
              </button>
              <button
                type="button"
                className={BTN + " all"}
                onClick={handleDecline}
                disabled={accepting || declining}
              >
                {declining ? "Logging out…" : "Decline & Log Out"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default TosModal;
