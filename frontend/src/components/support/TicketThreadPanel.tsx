import React, { useState } from "react";
import { BTN, INPUT } from "../../utils/ui";
import { replyToTicket, type SupportTicket } from "../../api/support/supportTickets";
import TicketStatusBadge from "./TicketStatusBadge";

type Props = {
  ticket: SupportTicket;
  onUpdated: (ticket: SupportTicket) => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TicketThreadPanel: React.FC<Props> = ({ ticket, onUpdated }) => {
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReply(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await replyToTicket(ticket.id, reply.trim());
      setReply("");
      onUpdated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-[0.75rem] opacity-50 m-0 mb-1">Ticket #{ticket.id} · {ticket.tool_key}</p>
        <h3 className="text-[1rem] font-semibold m-0 mb-2">{ticket.title}</h3>
        <div className="flex gap-2 flex-wrap">
          <TicketStatusBadge status={ticket.status} />
          <TicketStatusBadge severity={ticket.severity} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3">
        {ticket.messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-[12px] px-4 py-3 border ${
              msg.is_admin
                ? "border-[rgba(245,213,70,0.2)] bg-[rgba(245,213,70,0.05)]"
                : "border-white/[0.08] bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[0.75rem] font-semibold opacity-80">
                {msg.is_admin ? "Staff" : (msg.user?.swc_handle ?? "You")}
              </span>
              {msg.is_admin && (
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[#f2c46f] bg-[rgba(245,213,70,0.12)] border border-[rgba(245,213,70,0.3)] rounded px-[5px] py-[1px]">
                  Staff
                </span>
              )}
              <span className="text-[0.72rem] opacity-40 ml-auto">{formatDate(msg.created_at)}</span>
            </div>
            <p className="text-[0.85rem] opacity-80 m-0 leading-[1.6] whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
      </div>

      {/* Reply */}
      {ticket.status !== "resolved" && (
        <form onSubmit={handleReply} className="flex flex-col gap-3">
          <textarea
            className={INPUT + " resize-none h-[100px]"}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add a reply…"
            maxLength={5000}
          />
          {error && <p className="text-[0.85rem] text-[salmon] m-0">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" className={BTN} disabled={submitting || !reply.trim()}>
              {submitting ? "Sending…" : "Send Reply"}
            </button>
          </div>
        </form>
      )}

      {ticket.status === "resolved" && (
        <p className="text-[0.82rem] opacity-50 text-center">This ticket has been resolved.</p>
      )}
    </div>
  );
};

export default TicketThreadPanel;
