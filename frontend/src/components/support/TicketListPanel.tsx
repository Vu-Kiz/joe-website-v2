import React, { useEffect, useState } from "react";
import { getMyTickets, type SupportTicket } from "../../api/support/supportTickets";
import { BTN_SM } from "../../utils/ui";
import TicketStatusBadge from "./TicketStatusBadge";
import TicketThreadPanel from "./TicketThreadPanel";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type Props = {
  onClose: () => void;
};

const TicketListPanel: React.FC<Props> = ({ onClose }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyTickets();
      setTickets(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function handleUpdated(updated: SupportTicket) {
    setSelected(updated);
    setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1d22] border border-white/[0.12] rounded-[14px] p-8 max-w-[600px] w-full max-h-[80vh] flex flex-col gap-5 overflow-hidden">
        <div className="flex items-center gap-3">
          {selected && (
            <button className={BTN_SM} onClick={() => setSelected(null)} type="button">
              ← Back
            </button>
          )}
          <h3 className="text-[1.1rem] font-semibold m-0 flex-1">
            {selected ? selected.title : "My Tickets"}
          </h3>
          <button className={BTN_SM} onClick={onClose} type="button">✕</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {selected ? (
            <TicketThreadPanel
              ticket={selected}
              onUpdated={handleUpdated}
            />
          ) : loading ? (
            <p className="text-[0.85rem] opacity-50 text-center">Loading…</p>
          ) : error ? (
            <p className="text-[0.85rem] text-[salmon]">{error}</p>
          ) : tickets.length === 0 ? (
            <p className="text-[0.85rem] opacity-50 text-center">No tickets yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelected(ticket)}
                  className="w-full text-left border border-white/[0.08] rounded-[12px] px-4 py-3 bg-surface hover:border-white/20 hover:bg-white/[0.05] transition-colors duration-100 font-tektur"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-[0.88rem] font-semibold text-[#f2c46f]">{ticket.title}</span>
                    <span className="text-[0.72rem] text-white/40 shrink-0">{formatDate(ticket.created_at)}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-[0.75rem] text-white/50">{ticket.tool_key}</span>
                    <TicketStatusBadge status={ticket.status} />
                    <TicketStatusBadge severity={ticket.severity} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketListPanel;
