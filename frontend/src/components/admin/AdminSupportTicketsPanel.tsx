import React, { useCallback, useEffect, useRef, useState } from "react";
import { BTN, BTN_SM, BTN_GHOST_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import Btn from "../common/Btn";
import Overlay from "../common/Overlay";
import {
  adminGetTickets,
  adminGetTicketSettings,
  adminUpdateTicketSettings,
  adminReplyToTicket,
  adminUpdateTicketStatus,
  type SupportTicket,
  type TicketStatus,
  type TicketRecipient,
  STATUS_LABELS,
} from "../../api/support/supportTickets";
import TicketStatusBadge from "../support/TicketStatusBadge";
import { getKanbanBoard, promoteTicketToCard, type KanbanColumn } from "../../api/sys/kanban";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_FILTERS: Array<{ value: TicketStatus | "all"; label: string }> = [
  { value: "all",         label: "All" },
  { value: "open",        label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",    label: "Resolved" },
];

// ---------------------------------------------------------------------------
// Settings section
// ---------------------------------------------------------------------------

type SettingsSectionProps = {
  recipient: TicketRecipient | null;
  candidates: TicketRecipient[];
  onSaved: () => void;
};

const SettingsSection: React.FC<SettingsSectionProps> = ({ recipient, candidates, onSaved }) => {
  const [selectedId, setSelectedId] = useState<string>(recipient ? String(recipient.id) : "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      await adminUpdateTicketSettings(selectedId !== "" ? Number(selectedId) : null);
      setFeedback("Saved.");
      onSaved();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const displayName = (r: TicketRecipient) => {
    const name = r.swc_handle ?? r.discord_global_name ?? r.discord_username ?? `User #${r.id}`;
    const role = r.is_sysadmin ? "Sysadmin" : r.is_admin ? "Admin" : null;
    return role ? `${name} [${role}]` : name;
  };

  return (
    <div className="border border-white/8 rounded-xl bg-white/2 px-5 py-4 flex flex-col gap-3">
      <p className="text-[0.8rem] uppercase tracking-[0.08em] opacity-50 m-0 font-semibold">Discord PM Recipient</p>
      <p className="text-[0.8rem] opacity-60 m-0">
        This user receives a Discord PM when a new ticket is submitted or a user replies.
        Set this to the developer / support lead, not the faction leader.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className={INPUT + " max-w-70"}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">— None —</option>
          {candidates.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {displayName(c)}
            </option>
          ))}
        </select>
        <button type="button" className={BTN} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {feedback && (
          <span className={`text-[0.8rem] ${feedback === "Saved." ? "text-[#8ef0a0]" : "text-[salmon]"}`}>
            {feedback}
          </span>
        )}
      </div>
      {recipient && (
        <p className="text-[0.78rem] opacity-50 m-0">
          Currently: {displayName(recipient)}
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

const AdminSupportTicketsPanel: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<TicketRecipient | null>(null);
  const [candidates, setCandidates] = useState<TicketRecipient[]>([]);

  // Push to board
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [showPush, setShowPush] = useState(false);
  const [pushColumnId, setPushColumnId] = useState<string>("");
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState(false);
  const columnsLoaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketsRes, settingsRes] = await Promise.all([
        adminGetTickets(statusFilter !== "all" ? { status: statusFilter } : undefined),
        adminGetTicketSettings(),
      ]);
      setTickets(ticketsRes.data);
      setRecipient(settingsRes.data.recipient);
      setCandidates(settingsRes.data.candidate_recipients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function handleReply(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setSubmitting(true);
    setReplyError(null);
    try {
      const res = await adminReplyToTicket(selected.id, reply.trim());
      setReply("");
      setSelected(res.data);
      setTickets((prev) => prev.map((t) => t.id === res.data.id ? res.data : t));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (!selected) return;
    try {
      const res = await adminUpdateTicketStatus(selected.id, status);
      setSelected(res.data);
      setTickets((prev) => prev.map((t) => t.id === res.data.id ? res.data : t));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to update status.");
    }
  }

  async function openPushToBoard() {
    setPushError(null);
    setPushSuccess(false);
    setShowPush(true);
    if (!columnsLoaded.current) {
      try {
        const res = await getKanbanBoard();
        setColumns(res.data);
        if (res.data.length > 0) setPushColumnId(String(res.data[0].id));
        columnsLoaded.current = true;
      } catch {
        setPushError("Failed to load columns.");
      }
    }
  }

  async function handlePushToBoard() {
    if (!selected || !pushColumnId) return;
    setPushing(true);
    setPushError(null);
    try {
      await promoteTicketToCard(selected.id, Number(pushColumnId));
      setPushSuccess(true);
      setShowPush(false);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Failed to push to board.");
    } finally {
      setPushing(false);
    }
  }

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="h2 m-0 flex-1">
          Support Tickets
          {openCount > 0 && (
            <span className="ml-2 text-[0.75rem] bg-[rgba(245,213,70,0.15)] border border-[rgba(245,213,70,0.3)] text-[#f2c46f] rounded-full px-2 py-px">
              {openCount} open
            </span>
          )}
        </h2>
        <button className={BTN_GHOST_SM} type="button" onClick={load}>Refresh</button>
      </div>

      {/* Recipient settings */}
      <SettingsSection
        recipient={recipient}
        candidates={candidates}
        onSaved={load}
      />

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Btn
            key={f.value}
            variant="tab"
            size="sm"
            active={statusFilter === f.value}
            onClick={() => { setStatusFilter(f.value); setSelected(null); }}
          >
            {f.label}
          </Btn>
        ))}
      </div>

      {loading && <p className="small opacity-50">Loading…</p>}
      {error && <p className="small text-[salmon]">{error}</p>}

      {!loading && !error && (
        <div className="flex flex-col gap-2">
          {tickets.length === 0 && <p className="small opacity-50">No tickets.</p>}
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => { setSelected(ticket); setReply(""); setReplyError(null); setShowPush(false); setPushSuccess(false); setPushError(null); }}
              className="w-full text-left rounded-xl border px-4 py-3 transition-colors duration-100 border-white/8 bg-surface hover:border-white/20 hover:bg-white/[0.05] font-tektur"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[0.85rem] font-semibold leading-snug">{ticket.title}</span>
                <span className="text-[0.7rem] opacity-40 shrink-0">#{ticket.id}</span>
              </div>
              <p className="text-[0.75rem] opacity-50 m-0 mb-2">{ticket.tool_key}</p>
              <div className="flex gap-2 flex-wrap">
                <TicketStatusBadge status={ticket.status} />
                <TicketStatusBadge severity={ticket.severity} />
              </div>
              <p className="text-[0.7rem] opacity-40 m-0 mt-1">
                {ticket.user?.swc_handle ?? "Unknown"} · {formatDate(ticket.created_at)}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Ticket detail overlay */}
      {selected && (
        <Overlay
          title={
            <div>
              <p className="text-[0.72rem] opacity-50 m-0 mb-[0.2rem]">#{selected.id} · {selected.tool_key}</p>
              <h2 className="m-0 text-[1.3rem] leading-[1.15] font-semibold text-[#F6A300]">{selected.title}</h2>
            </div>
          }
          onClose={() => setSelected(null)}
          maxWidth={760}
          maxHeight={820}
        >
          <div className="flex flex-col gap-4">
            {/* Badges + controls */}
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap flex-1">
                <TicketStatusBadge status={selected.status} />
                <TicketStatusBadge severity={selected.severity} />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2 flex-wrap justify-end">
                  {(["open", "in_progress", "resolved"] as TicketStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={selected.status === s}
                      onClick={() => void handleStatusChange(s)}
                      className={BTN_SM + (selected.status === s ? " opacity-40 cursor-not-allowed" : "")}
                    >
                      → {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                {pushSuccess ? (
                  <span className="text-[0.78rem] text-[#8ef0a0]">Pushed to board ✓</span>
                ) : (
                  <button type="button" className={BTN_GHOST_SM} onClick={() => void openPushToBoard()}>
                    Push to Board
                  </button>
                )}
                {showPush && (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <select
                      className={SELECT_INPUT + " text-[0.8rem]"}
                      value={pushColumnId}
                      onChange={(e) => setPushColumnId(e.target.value)}
                    >
                      {columns.length === 0 && <option value="">Loading…</option>}
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <button type="button" className={BTN_SM} onClick={() => void handlePushToBoard()} disabled={pushing || !pushColumnId}>
                      {pushing ? "Pushing…" : "Confirm"}
                    </button>
                    <button type="button" className={BTN_GHOST_SM} onClick={() => setShowPush(false)}>Cancel</button>
                  </div>
                )}
                {pushError && <p className="text-[0.8rem] text-[salmon] m-0">{pushError}</p>}
              </div>
            </div>

            {/* Messages */}
            <div className="flex flex-col gap-3">
              {selected.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl px-4 py-3 border ${
                    msg.is_admin
                      ? "border-[rgba(245,213,70,0.2)] bg-[rgba(245,213,70,0.05)]"
                      : "border-white/8 bg-white/3"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[0.75rem] font-semibold opacity-80">
                      {msg.is_admin ? "Staff" : (msg.user?.swc_handle ?? "Subscriber")}
                    </span>
                    {msg.is_admin && (
                      <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[#f2c46f] bg-[rgba(245,213,70,0.12)] border border-[rgba(245,213,70,0.3)] rounded px-1.25 py-px">
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
            <form onSubmit={handleReply} className="flex flex-col gap-3">
              <textarea
                className={INPUT + " resize-none h-25"}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply to this ticket…"
                maxLength={5000}
              />
              {replyError && <p className="text-[0.85rem] text-[salmon] m-0">{replyError}</p>}
              <div className="flex justify-end">
                <button type="submit" className={BTN} disabled={submitting || !reply.trim()}>
                  {submitting ? "Sending…" : "Send Reply"}
                </button>
              </div>
            </form>
          </div>
        </Overlay>
      )}
    </div>
  );
};

export default AdminSupportTicketsPanel;
