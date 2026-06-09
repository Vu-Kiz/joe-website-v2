import React, { useState } from "react";
import Overlay from "../common/Overlay";
import DatePicker from "../common/DatePicker";
import { BTN, BTN_SM, BTN_GHOST_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import {
  type KanbanCard,
  type KanbanCardUser,
  type KanbanPriority,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  updateCard,
  deleteCard,
} from "../../api/sys/kanban";

type Props = {
  card: KanbanCard;
  isDragging: boolean;
  handleProps: React.HTMLAttributes<HTMLElement>;
  sysadmins: KanbanCardUser[];
  onUpdated: (card: KanbanCard) => void;
  onDeleted: (cardId: number) => void;
};

const PRIORITIES: KanbanPriority[] = ["none", "low", "medium", "high", "urgent"];

const KanbanCardItem: React.FC<Props> = ({ card, isDragging, handleProps, sysadmins, onUpdated, onDeleted }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [priority, setPriority] = useState<KanbanPriority>(card.priority);
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [assignedTo, setAssignedTo] = useState<string>(card.assigned_to ? String(card.assigned_to) : "");

  function openEdit() {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setPriority(card.priority);
    setDueDate(card.due_date ?? "");
    setAssignedTo(card.assigned_to ? String(card.assigned_to) : "");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateCard(card.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        assigned_to: assignedTo ? Number(assignedTo) : null,
      });
      onUpdated(res.data);
      setEditing(false);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete card "${card.title}"?`)) return;
    setDeleting(true);
    try {
      await deleteCard(card.id);
      onDeleted(card.id);
      setEditing(false);
    } catch {
      setError("Failed to delete.");
      setDeleting(false);
    }
  }

  const priorityColor = PRIORITY_COLORS[card.priority];
  const hasDue = Boolean(card.due_date);
  const isOverdue = hasDue && new Date(card.due_date!) < new Date();

  return (
    <>
      <div
        className={[
          "group rounded-[14px] border bg-[rgba(255,255,255,0.04)] border-white/[0.07] p-[0.65rem_0.8rem] flex flex-col gap-[0.35rem] overflow-hidden",
          "transition-[border-color,box-shadow,background] duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
          isDragging ? "opacity-40 shadow-xl" : "hover:bg-[rgba(255,255,255,0.06)] hover:border-white/[0.13] hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)]",
        ].join(" ")}
      >
        {/* Priority bar */}
        {card.priority !== "none" && (
          <div
            className="h-[3px] mb-[0.3rem] -mx-[0.8rem] -mt-[0.65rem] rounded-t-[14px]"
            style={{ backgroundColor: priorityColor }}
          />
        )}

        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <span
            {...handleProps}
            className="mt-[2px] text-white/25 cursor-grab active:cursor-grabbing select-none shrink-0 hover:text-white/50 transition-colors leading-none text-[1rem]"
            title="Drag to reorder"
          >
            ⋮⋮
          </span>

          <button
            type="button"
            className={BTN_SM + " flex-1 justify-start text-left normal-case tracking-normal font-normal font-tektur"}
            onClick={openEdit}
          >
            {card.title}
          </button>
        </div>

        <div className="flex items-center gap-[0.5rem] flex-wrap pl-[1.4rem]">
          {card.priority !== "none" && (
            <span className="text-[0.68rem] font-semibold px-[0.45rem] py-[0.15rem] rounded-full" style={{ color: priorityColor, backgroundColor: `${priorityColor}18` }}>
              {PRIORITY_LABELS[card.priority]}
            </span>
          )}
          {hasDue && (
            <span className={`text-[0.7rem] ${isOverdue ? "text-[#f87171]" : "text-white/45"}`}>
              {isOverdue ? "⚠ " : ""}{card.due_date}
            </span>
          )}
          {card.assignee && (
            <span className="text-[0.7rem] text-white/40 ml-auto">
              {card.assignee.swc_handle ?? `User #${card.assigned_to}`}
            </span>
          )}
          {card.ticket && (
            <span className="text-[0.68rem] text-[rgba(246,163,0,0.55)]">#{card.ticket.id}</span>
          )}
        </div>
      </div>

      {editing && (
        <Overlay title={`Edit Card`} onClose={() => setEditing(false)} maxWidth={680} maxHeight={760}>
          <div className="flex flex-col gap-[0.8rem]">
            {card.ticket && (
              <p className="small m-0 text-[rgba(246,163,0,0.7)]">
                Linked to ticket #{card.ticket.id}: {card.ticket.title}
              </p>
            )}

            <label className="flex flex-col gap-[0.35rem]">
              <span className="small opacity-75">Title</span>
              <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <div className="grid grid-cols-[1fr_1fr] gap-[0.7rem] max-[500px]:grid-cols-1">
              <label className="flex flex-col gap-[0.35rem]">
                <span className="small opacity-75">Priority</span>
                <select className={SELECT_INPUT} value={priority} onChange={(e) => setPriority(e.target.value as KanbanPriority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-[0.35rem]">
                <span className="small opacity-75">Due date</span>
                <DatePicker value={dueDate} onChange={setDueDate} placeholder="No due date" />
              </label>
            </div>

            <label className="flex flex-col gap-[0.35rem]">
              <span className="small opacity-75">Assigned to</span>
              <select className={SELECT_INPUT} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">— Unassigned —</option>
                {sysadmins.map((u) => (
                  <option key={u.id} value={u.id}>{u.swc_handle ?? `User #${u.id}`}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-[0.35rem]">
              <span className="small opacity-75">Description</span>
              <textarea
                className={INPUT + " min-h-[100px] resize-y"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {error && <p className="small m-0" style={{ color: "#ff9f9f" }}>{error}</p>}

            <div className="flex gap-[0.5rem] flex-wrap">
              <button className={BTN} type="button" onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className={BTN} type="button" onClick={() => setEditing(false)}>Cancel</button>
              <button
                className={BTN_GHOST_SM + " ml-auto hover:!border-[rgba(248,113,113,0.35)] hover:!text-[#f87171]"}
                type="button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
};

export default KanbanCardItem;
