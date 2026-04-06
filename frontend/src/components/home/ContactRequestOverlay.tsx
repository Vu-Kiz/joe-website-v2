import React, { useEffect, useMemo, useState } from "react";
import { submitContactRequest } from "../../api/contactRequests";
import styles from "../../styles/home.module.sass";

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
    <div className={styles.contactOverlay}>
      <button
        type="button"
        className={styles.contactOverlayBackdrop}
        onClick={onClose}
        aria-label="Close contact request form"
      />

      <section className={`panel ${styles.contactOverlayPanel}`}>
        <div className={styles.contactOverlayHeader}>
          <div>
            <h2>{title}</h2>
            <p className="small">{intro}</p>
          </div>

          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <form className={styles.contactForm} onSubmit={handleSubmit}>
          <label className={styles.contactField}>
            <span>Discord Name</span>
            <input
              type="text"
              value={discordName}
              onChange={(event) => setDiscordName(event.target.value)}
              maxLength={120}
              required
            />
          </label>

          <label className={styles.contactField}>
            <span>Star Wars Handle</span>
            <input
              type="text"
              value={starWarsHandle}
              onChange={(event) => setStarWarsHandle(event.target.value)}
              maxLength={120}
              required
            />
          </label>

          <label className={styles.contactField}>
            <span>Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={5000}
              rows={8}
              required
            />
          </label>

          <div className={styles.contactFormActions}>
            <button type="submit" className="btn" disabled={busy}>
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
