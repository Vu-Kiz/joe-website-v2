import React, { useState } from "react";
import { BTN, BTN_GHOST_SM, INPUT } from "../../utils/ui";
import {
  createTicket,
  SEVERITY_LABELS,
  type TicketSeverity,
  type SupportTicket,
} from "../../api/support/supportTickets";

const SEVERITIES: TicketSeverity[] = ["tool_breaking", "major_bug", "minor_bug", "visual_ui"];

type Props = {
  toolKey: string;
  toolLabel: string;
  onClose: () => void;
  onSuccess: (ticket: SupportTicket) => void;
};

const TicketCreateModal: React.FC<Props> = ({ toolKey, toolLabel, onClose, onSuccess }) => {
  const [severity, setSeverity] = useState<TicketSeverity>("minor_bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createTicket({ tool_key: toolKey, title: title.trim(), severity, description: description.trim() });
      onSuccess(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1d22] border border-white/[0.12] rounded-[14px] p-8 max-w-[500px] w-full flex flex-col gap-5">
        <div>
          <p className="text-[0.75rem] tracking-[0.1em] uppercase opacity-50 m-0 mb-1">{toolLabel}</p>
          <h3 className="text-[1.1rem] font-semibold m-0">Report a Bug</h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Severity */}
          <div className="flex flex-col gap-2">
            <label className="text-[0.8rem] opacity-60 uppercase tracking-[0.08em]">Severity</label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`text-left px-3 py-2 rounded-[10px] border text-[0.82rem] transition-colors duration-100 ${
                    severity === s
                      ? "border-[rgba(245,213,70,0.5)] bg-[rgba(245,213,70,0.08)] text-[#f2c46f]"
                      : "border-white/10 bg-transparent text-white/70 hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  {SEVERITY_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <label className="text-[0.8rem] opacity-60 uppercase tracking-[0.08em]">Title</label>
            <input
              className={INPUT}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short description of the bug"
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-[0.8rem] opacity-60 uppercase tracking-[0.08em]">Description</label>
            <textarea
              className={INPUT + " resize-none h-[120px]"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? What did you expect to happen?"
              maxLength={5000}
              required
            />
          </div>

          {error && <p className="text-[0.85rem] text-[salmon] m-0">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" className={BTN_GHOST_SM} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={BTN} disabled={submitting || !title.trim() || !description.trim()}>
              {submitting ? "Submitting…" : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketCreateModal;
