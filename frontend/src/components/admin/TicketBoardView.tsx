import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BTN, BTN_SM, BTN_GHOST_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import Overlay from "../common/Overlay";
import TicketStatusBadge from "../support/TicketStatusBadge";
import {
  adminGetTickets,
  adminUpdateTicketStatus,
  adminReplyToTicket,
  type SupportTicket,
  type TicketStatus,
  STATUS_LABELS,
} from "../../api/support/supportTickets";
import { getKanbanBoard, promoteTicketToCard, type KanbanColumn } from "../../api/sys/kanban";

// ---------------------------------------------------------------------------

const COLUMNS: Array<{ key: TicketStatus; label: string }> = [
  { key: "open",        label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved",    label: "Resolved" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Draggable ticket card
// ---------------------------------------------------------------------------

type CardProps = {
  ticket: SupportTicket;
  onClick: () => void;
  isDragOverlay?: boolean;
};

const TicketCard: React.FC<CardProps & { id: UniqueIdentifier }> = ({ id, ticket, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "group rounded-[14px] border bg-[rgba(255,255,255,0.04)] border-white/[0.07] p-[0.65rem_0.8rem]",
        "flex flex-col gap-[0.35rem] cursor-pointer select-none",
        "transition-[border-color,box-shadow,background] duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
        isDragging
          ? "opacity-40"
          : "hover:bg-[rgba(255,255,255,0.06)] hover:border-white/[0.13] hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)]",
      ].join(" ")}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span
          {...attributes}
          {...listeners}
          className="mt-[2px] text-white/25 cursor-grab active:cursor-grabbing shrink-0 hover:text-white/50 transition-colors leading-none text-[1rem]"
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </span>
        <span className="text-[0.82rem] font-semibold leading-snug flex-1">{ticket.title}</span>
        <span className="text-[0.68rem] opacity-35 shrink-0">#{ticket.id}</span>
      </div>
      <div className="flex items-center gap-[0.4rem] flex-wrap pl-[1.4rem]">
        <TicketStatusBadge severity={ticket.severity} />
        <span className="text-[0.68rem] opacity-40">{ticket.tool_key}</span>
        <span className="text-[0.68rem] opacity-30 ml-auto">{formatDate(ticket.created_at)}</span>
      </div>
    </div>
  );
};

const TicketCardOverlay: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => (
  <div className="rounded-[14px] border bg-[rgba(255,255,255,0.08)] border-white/[0.18] p-[0.65rem_0.8rem] flex flex-col gap-[0.35rem] shadow-[0_8px_24px_rgba(0,0,0,0.4)] cursor-grabbing">
    <div className="flex items-start gap-2">
      <span className="mt-[2px] text-white/40 leading-none text-[1rem]">⋮⋮</span>
      <span className="text-[0.82rem] font-semibold leading-snug flex-1">{ticket.title}</span>
      <span className="text-[0.68rem] opacity-35 shrink-0">#{ticket.id}</span>
    </div>
    <div className="flex items-center gap-[0.4rem] flex-wrap pl-[1.4rem]">
      <TicketStatusBadge severity={ticket.severity} />
      <span className="text-[0.68rem] opacity-40">{ticket.tool_key}</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Droppable column
// ---------------------------------------------------------------------------

type ColumnProps = {
  col: { key: TicketStatus; label: string };
  tickets: SupportTicket[];
  onOpenTicket: (t: SupportTicket) => void;
};

const TicketColumn: React.FC<ColumnProps> = ({ col, tickets, onOpenTicket }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col.key}` });

  const ids = tickets.map((t) => `ticket-${t.id}` as UniqueIdentifier);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[0.78rem] uppercase tracking-[0.1em] font-semibold opacity-60">{col.label}</span>
        <span className="text-[0.68rem] bg-white/8 rounded-full px-[0.5rem] py-px opacity-50">{tickets.length}</span>
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={[
            "flex flex-col gap-2 rounded-[18px] border p-3 min-h-[120px] transition-colors duration-150",
            isOver
              ? "border-white/20 bg-[rgba(255,255,255,0.05)]"
              : "border-white/[0.06] bg-[rgba(255,255,255,0.02)]",
          ].join(" ")}
        >
          {tickets.length === 0 && (
            <p className="text-[0.72rem] opacity-25 text-center py-4 m-0">No tickets</p>
          )}
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              id={`ticket-${t.id}`}
              ticket={t}
              onClick={() => onOpenTicket(t)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main board
// ---------------------------------------------------------------------------

type Props = {
  onTicketsChanged: () => void;
};

const TicketBoardView: React.FC<Props> = ({ onTicketsChanged }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // Detail overlay
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Push to board
  const [columns, setBoardColumns] = useState<KanbanColumn[]>([]);
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
      const res = await adminGetTickets();
      setTickets(res.data);
    } catch {
      setError("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function getTicketFromDragId(id: UniqueIdentifier): SupportTicket | undefined {
    const numId = Number(String(id).replace("ticket-", ""));
    return tickets.find((t) => t.id === numId);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const overId = String(over.id);
    const targetStatus = overId.startsWith("col-")
      ? (overId.replace("col-", "") as TicketStatus)
      : (() => {
          const targetTicket = getTicketFromDragId(over.id);
          return targetTicket?.status ?? null;
        })();

    if (!targetStatus) return;

    const ticket = getTicketFromDragId(active.id);
    if (!ticket || ticket.status === targetStatus) return;

    // Optimistic update
    setTickets((prev) => prev.map((t) => t.id === ticket.id ? { ...t, status: targetStatus } : t));
    if (selected?.id === ticket.id) setSelected((s) => s ? { ...s, status: targetStatus } : s);

    try {
      const res = await adminUpdateTicketStatus(ticket.id, targetStatus);
      setTickets((prev) => prev.map((t) => t.id === res.data.id ? res.data : t));
      onTicketsChanged();
    } catch {
      // Revert on failure
      setTickets((prev) => prev.map((t) => t.id === ticket.id ? { ...t, status: ticket.status } : t));
    }
  }

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
      onTicketsChanged();
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
        setBoardColumns(res.data);
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

  function openTicket(ticket: SupportTicket) {
    setSelected(ticket);
    setReply("");
    setReplyError(null);
    setShowPush(false);
    setPushSuccess(false);
    setPushError(null);
  }

  const activeTicket = activeId ? getTicketFromDragId(activeId) : null;

  if (loading) return <p className="small opacity-50">Loading…</p>;
  if (error) return <p className="small text-[salmon]">{error}</p>;

  const grouped = Object.fromEntries(
    COLUMNS.map((col) => [col.key, tickets.filter((t) => t.status === col.key)])
  ) as Record<TicketStatus, SupportTicket[]>;

  return (
    <>
      <div className="flex justify-end mb-2">
        <button className={BTN_GHOST_SM} type="button" onClick={load}>Refresh</button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
          {COLUMNS.map((col) => (
            <TicketColumn
              key={col.key}
              col={col}
              tickets={grouped[col.key]}
              onOpenTicket={openTicket}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTicket && <TicketCardOverlay ticket={activeTicket} />}
        </DragOverlay>
      </DndContext>

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
    </>
  );
};

export default TicketBoardView;
