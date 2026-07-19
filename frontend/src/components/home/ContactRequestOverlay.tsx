import React, { useEffect, useMemo, useState } from "react";
import { submitContactRequest } from "../../api/content/contactRequests";
import { BTN, BTN_GHOST } from "../../utils/ui";

const OVERLAY_CLS = "fixed inset-0 z-[1200] flex items-center justify-center p-4";
const BACKDROP_CLS = "absolute inset-0 border-0 bg-[rgba(0,0,0,0.72)] cursor-pointer font-tektur";
const PANEL_CLS = "relative z-[1] w-[min(720px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-auto";
const HEADER_CLS = "flex items-start justify-between gap-4 mb-4";
const FORM_CLS = "flex flex-col gap-4";
const FIELD_CLS = "flex flex-col gap-[0.45rem]";
const FIELD_LABEL_CLS = "font-['Tektur',sans-serif] tracking-[0.04em] uppercase text-[0.82rem]";
const FIELD_INPUT_CLS = "w-full min-h-[42px] p-[0.8rem_0.9rem] rounded-[12px] border border-[rgba(245,213,70,0.22)] bg-[rgba(0,0,0,0.28)] text-inherit resize-y font-tektur";
const ACTIONS_CLS = "flex justify-start";

type Props = {
  requestType: "contact" | "diplomacy";
  onClose: () => void;
};

const ContactRequestOverlay: React.FC<Props> = ({ requestType, onClose }) => {
  const title = requestType === "diplomacy" ? "Request Diplomacy" : "Contact Grand Commodore Kolo Seph";
  const intro = requestType === "diplomacy"
    ? "Send your diplomatic request to JOE staff through the Discord bot inbox."
    : "Send a contact request to Grand Commodore Kolo Seph through the website contact queue.";

  const [discordName, setDiscordName] = useState("");
  const [starWarsHandle, setStarWarsHandle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "error">("ok");

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const submitLabel = useMemo(() => {
    return requestType === "diplomacy" ? "Send Diplomacy Request" : "Send Contact Request";
  }, [requestType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setBusy(true);
      const response = await submitContactRequest({
        request_type: requestType,
        discord_name: discordName,
        star_wars_handle: starWarsHandle,
        message,
      });

      setFeedback(response.message ?? "Request sent.");
      setTone("ok");
      setDiscordName("");
      setStarWarsHandle("");
      setMessage("");
    } catch (e: any) {
      setFeedback(e?.message ?? "Failed to send the request.");
      setTone("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={OVERLAY_CLS}>
      <button
        type="button"
        className={BACKDROP_CLS}
        onClick={onClose}
        aria-label="Close contact request form"
      />

      <section className={`panel ${PANEL_CLS}`}>
        <div className={HEADER_CLS}>
          <div>
            <h2 className="h2">{title}</h2>
            <p className="small">{intro}</p>
          </div>

          <button type="button" className={BTN_GHOST} onClick={onClose}>
            Close
          </button>
        </div>

        <form className={FORM_CLS} onSubmit={handleSubmit}>
          <label className={FIELD_CLS}>
            <span className={FIELD_LABEL_CLS}>Discord Name</span>
            <input
              className={FIELD_INPUT_CLS}
              type="text"
              value={discordName}
              onChange={(event) => setDiscordName(event.target.value)}
              maxLength={120}
              required
            />
          </label>

          <label className={FIELD_CLS}>
            <span className={FIELD_LABEL_CLS}>Star Wars Handle</span>
            <input
              className={FIELD_INPUT_CLS}
              type="text"
              value={starWarsHandle}
              onChange={(event) => setStarWarsHandle(event.target.value)}
              maxLength={120}
              required
            />
          </label>

          <label className={FIELD_CLS}>
            <span className={FIELD_LABEL_CLS}>Message</span>
            <textarea
              className={FIELD_INPUT_CLS}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={5000}
              rows={8}
              required
            />
          </label>

          <div className={ACTIONS_CLS}>
            <button type="submit" className={BTN} disabled={busy}>
              {busy ? "Sending…" : submitLabel}
            </button>
          </div>

          {feedback && (
            <p
              className="small"
              style={{ color: tone === "error" ? "salmon" : undefined }}
            >
              {feedback}
            </p>
          )}
        </form>
      </section>
    </div>
  );
};

export default ContactRequestOverlay;
