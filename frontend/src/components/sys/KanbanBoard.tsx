import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import SortableItem from "../common/SortableItem";
import KanbanCardItem from "./KanbanCardItem";
import Overlay from "../common/Overlay";
import { BTN, BTN_SM, BTN_GHOST_SM, INPUT, SELECT_INPUT } from "../../utils/ui";
import {
  type KanbanCard,
  type KanbanCardUser,
  type KanbanColumn,
  type KanbanPriority,
  PRIORITY_LABELS,
  getKanbanBoard,
  getKanbanAssignees,
  createColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  createCard,
  reorderCards,
  updateCard,
} from "../../api/sys/kanban";

const PRIORITIES: KanbanPriority[] = ["none", "low", "medium", "high", "urgent"];

function cardDndId(cardId: number) { return `card-${cardId}`; }
function columnDndId(colId: number) { return `col-${colId}`; }
function parseCardId(id: UniqueIdentifier) { return Number(String(id).replace("card-", "")); }
function parseColumnId(id: UniqueIdentifier) { return Number(String(id).replace("col-", "")); }
function isCardId(id: UniqueIdentifier) { return String(id).startsWith("card-"); }
function isColumnId(id: UniqueIdentifier) { return String(id).startsWith("col-"); }

const KanbanBoard: React.FC = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sysadmins, setSysadmins] = useState<KanbanCardUser[]>([]);

  // Column management
  const [collapsedColumns, setCollapsedColumns] = useState<Set<number>>(new Set());
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [columnSaving, setColumnSaving] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState("");

  // Add card
  const [addingCardToColumn, setAddingCardToColumn] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardPriority, setNewCardPriority] = useState<KanbanPriority>("none");
  const [newCardAssignee, setNewCardAssignee] = useState("");
  const [cardSaving, setCardSaving] = useState(false);

  // Drag state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const activeCard = useMemo(() => {
    if (!activeId || !isCardId(activeId)) return null;
    const id = parseCardId(activeId);
    for (const col of columns) {
      const card = col.cards.find((c) => c.id === id);
      if (card) return card;
    }
    return null;
  }, [activeId, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    Promise.all([
      getKanbanBoard(),
      getKanbanAssignees(),
    ]).then(([board, assignees]) => {
      setColumns(board.data);
      setSysadmins(assignees.data ?? []);
    }).catch(() => {
      setError("Failed to load board.");
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  // --- Column CRUD ---

  async function handleAddColumn() {
    if (!newColumnTitle.trim()) return;
    setColumnSaving(true);
    try {
      const res = await createColumn(newColumnTitle.trim());
      setColumns((prev) => [...prev, { ...res.data, cards: [] }]);
      setNewColumnTitle("");
      setAddingColumn(false);
    } catch {
      setError("Failed to add column.");
    } finally {
      setColumnSaving(false);
    }
  }

  async function handleRenameColumn() {
    if (!editingColumn || !editColumnTitle.trim()) return;
    setColumnSaving(true);
    try {
      const res = await updateColumn(editingColumn.id, editColumnTitle.trim());
      setColumns((prev) => prev.map((c) => c.id === editingColumn.id ? { ...c, title: res.data.title } : c));
      setEditingColumn(null);
    } catch {
      setError("Failed to rename column.");
    } finally {
      setColumnSaving(false);
    }
  }

  async function handleDeleteColumn(col: KanbanColumn) {
    if (!confirm(`Delete column "${col.title}" and all its cards?`)) return;
    try {
      await deleteColumn(col.id);
      setColumns((prev) => prev.filter((c) => c.id !== col.id));
    } catch {
      setError("Failed to delete column.");
    }
  }

  // --- Card CRUD ---

  async function handleAddCard(columnId: number) {
    if (!newCardTitle.trim()) return;
    setCardSaving(true);
    try {
      const res = await createCard({
        column_id: columnId,
        title: newCardTitle.trim(),
        priority: newCardPriority,
        assigned_to: newCardAssignee ? Number(newCardAssignee) : null,
      });
      const newCard = {
        ...res.data,
        assignee: sysadmins.find((s) => s.id === res.data.assigned_to) ?? null,
      };
      setColumns((prev) => prev.map((c) =>
        c.id === columnId ? { ...c, cards: [...c.cards, newCard] } : c
      ));
      setNewCardTitle("");
      setNewCardPriority("none");
      setNewCardAssignee("");
      setAddingCardToColumn(null);
    } catch {
      setError("Failed to add card.");
    } finally {
      setCardSaving(false);
    }
  }

  function handleCardUpdated(updated: KanbanCard) {
    setColumns((prev) => prev.map((col) => ({
      ...col,
      cards: col.cards.map((c) => c.id === updated.id ? { ...updated, assignee: sysadmins.find((s) => s.id === updated.assigned_to) ?? null } : c),
    })));
  }

  function handleCardDeleted(cardId: number) {
    setColumns((prev) => prev.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => c.id !== cardId),
    })));
  }

  // --- Drag handlers ---

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (isCardId(active.id) && isCardId(over.id)) {
      const activeCardId = parseCardId(active.id);
      const overCardId = parseCardId(over.id);

      const activeColIdx = columns.findIndex((c) => c.cards.some((card) => card.id === activeCardId));
      const overColIdx = columns.findIndex((c) => c.cards.some((card) => card.id === overCardId));

      if (activeColIdx === -1 || overColIdx === -1) return;

      if (activeColIdx !== overColIdx) {
        // Move card to a different column optimistically
        setColumns((prev) => {
          const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
          const card = next[activeColIdx].cards.find((c) => c.id === activeCardId)!;
          next[activeColIdx].cards = next[activeColIdx].cards.filter((c) => c.id !== activeCardId);
          const overIdx = next[overColIdx].cards.findIndex((c) => c.id === overCardId);
          next[overColIdx].cards.splice(overIdx, 0, { ...card, column_id: next[overColIdx].id });
          return next;
        });
      }
    }

    // Card dragged over an empty column
    if (isCardId(active.id) && isColumnId(over.id)) {
      const activeCardId = parseCardId(active.id);
      const overColId = parseColumnId(over.id);
      const activeColIdx = columns.findIndex((c) => c.cards.some((card) => card.id === activeCardId));
      const overColIdx = columns.findIndex((c) => c.id === overColId);

      if (activeColIdx === -1 || overColIdx === -1 || activeColIdx === overColIdx) return;

      setColumns((prev) => {
        const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
        const card = next[activeColIdx].cards.find((c) => c.id === activeCardId)!;
        next[activeColIdx].cards = next[activeColIdx].cards.filter((c) => c.id !== activeCardId);
        next[overColIdx].cards.push({ ...card, column_id: next[overColIdx].id });
        return next;
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    // Column reorder
    if (isColumnId(active.id) && isColumnId(over.id) && active.id !== over.id) {
      const oldIdx = columns.findIndex((c) => columnDndId(c.id) === active.id);
      const newIdx = columns.findIndex((c) => columnDndId(c.id) === over.id);
      const reordered = arrayMove(columns, oldIdx, newIdx);
      setColumns(reordered);
      await reorderColumns(reordered.map((c) => c.id)).catch(() => setError("Failed to save column order."));
      return;
    }

    // Card reorder within same column (or final drop after cross-column)
    if (isCardId(active.id)) {
      const activeCardId = parseCardId(active.id);
      const col = columns.find((c) => c.cards.some((card) => card.id === activeCardId));
      if (!col) return;

      if (isCardId(over.id)) {
        const overCardId = parseCardId(over.id);
        const oldIdx = col.cards.findIndex((c) => c.id === activeCardId);
        const newIdx = col.cards.findIndex((c) => c.id === overCardId);

        if (oldIdx !== newIdx && oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(col.cards, oldIdx, newIdx);
          setColumns((prev) => prev.map((c) => c.id === col.id ? { ...c, cards: reordered } : c));
        }
      }

      // Persist final position + column_id for all cards in the landing column
      const card = col.cards.find((c) => c.id === activeCardId);
      if (card) {
        await Promise.all([
          reorderCards(col.id, col.cards.map((c) => c.id)),
          card.column_id !== col.id ? updateCard(activeCardId, { column_id: col.id }) : Promise.resolve(),
        ]).catch(() => setError("Failed to save card position."));
      }
    }
  }

  const columnIds = useMemo(() => columns.map((c) => columnDndId(c.id)), [columns]);

  if (loading) return <p className="small opacity-60">Loading board…</p>;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="small m-0" style={{ color: "#ff9f9f" }}>{error}</p>
      )}

      <div className="flex items-center gap-[0.55rem] flex-wrap">
        <button className={BTN} type="button" onClick={() => { setAddingColumn(true); setNewColumnTitle(""); }}>
          + Add Column
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToWindowEdges]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-3 items-start">
            {columns.map((col) => {
              const cardIds = col.cards.map((c) => cardDndId(c.id));

              return (
                <SortableItem key={col.id} id={columnDndId(col.id)}>
                  {({ isDragging: colDragging, handleProps: colHandleProps }) => (
                    <div
                      className={[
                        "flex flex-col gap-[0.55rem] w-[280px] shrink-0 rounded-[18px] border border-white/[0.06] bg-[rgba(255,255,255,0.03)] backdrop-blur-sm p-[0.85rem] shadow-[0_4px_24px_rgba(0,0,0,0.18)]",
                        colDragging ? "opacity-40" : "",
                      ].join(" ")}
                    >
                      {/* Column header */}
                      <div className="flex items-center gap-[0.4rem] group/header pb-[0.4rem] border-b border-white/[0.06]">
                        <span
                          {...colHandleProps}
                          className="text-white/20 cursor-grab active:cursor-grabbing select-none shrink-0 hover:text-white/50 transition-colors leading-none text-[0.9rem] opacity-0 group-hover/header:opacity-100"
                          title="Drag to reorder column"
                        >
                          ⋮⋮
                        </span>
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-[0.8rem] font-tektur font-bold uppercase tracking-[0.08em] text-white/55 truncate text-left hover:text-white/90 transition-colors bg-transparent border-0 p-0 cursor-pointer"
                          onClick={() => setCollapsedColumns((prev) => {
                            const next = new Set(prev);
                            next.has(col.id) ? next.delete(col.id) : next.add(col.id);
                            return next;
                          })}
                          title={collapsedColumns.has(col.id) ? "Expand column" : "Collapse column"}
                        >
                          {collapsedColumns.has(col.id) ? "▶ " : "▼ "}{col.title}
                        </button>
                        <span className="text-[0.68rem] font-tektur text-white/30 shrink-0">{col.cards.length}</span>
                        <button
                          type="button"
                          className="text-white/25 hover:text-white/70 transition-colors bg-transparent border-0 p-[0.2rem] cursor-pointer opacity-0 group-hover/header:opacity-100 shrink-0 font-tektur"
                          onClick={() => { setEditingColumn(col); setEditColumnTitle(col.title); }}
                          title="Rename column"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="text-white/20 hover:text-[#f87171] transition-colors bg-transparent border-0 p-[0.2rem] cursor-pointer opacity-0 group-hover/header:opacity-100 shrink-0 font-tektur"
                          onClick={() => handleDeleteColumn(col)}
                          title="Delete column"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Cards */}
                      {!collapsedColumns.has(col.id) && <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-[0.45rem] min-h-[40px]">
                          {col.cards.map((card) => (
                            <SortableItem key={card.id} id={cardDndId(card.id)}>
                              {({ isDragging, handleProps }) => (
                                <KanbanCardItem
                                  card={card}
                                  isDragging={isDragging}
                                  handleProps={handleProps}
                                  sysadmins={sysadmins}
                                  onUpdated={handleCardUpdated}
                                  onDeleted={handleCardDeleted}
                                />
                              )}
                            </SortableItem>
                          ))}
                        </div>
                      </SortableContext>}

                      {/* Add card */}
                      {!collapsedColumns.has(col.id) && (addingCardToColumn === col.id ? (
                        <div className="flex flex-col gap-[0.45rem] mt-1">
                          <input
                            className={INPUT + " text-[0.82rem] !min-h-[36px]"}
                            placeholder="Card title"
                            value={newCardTitle}
                            onChange={(e) => setNewCardTitle(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddCard(col.id); if (e.key === "Escape") setAddingCardToColumn(null); }}
                            autoFocus
                          />
                          <div className="flex gap-[0.4rem]">
                            <select
                              className={SELECT_INPUT + " flex-1"}
                              value={newCardPriority}
                              onChange={(e) => setNewCardPriority(e.target.value as KanbanPriority)}
                            >
                              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                            </select>
                            <select
                              className={SELECT_INPUT + " flex-1"}
                              value={newCardAssignee}
                              onChange={(e) => setNewCardAssignee(e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {sysadmins.map((u) => <option key={u.id} value={u.id}>{u.swc_handle ?? `User #${u.id}`}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-[0.4rem]">
                            <button className={BTN_SM + " flex-1"} type="button" onClick={() => handleAddCard(col.id)} disabled={cardSaving || !newCardTitle.trim()}>
                              {cardSaving ? "Adding…" : "Add"}
                            </button>
                            <button className={BTN_GHOST_SM} type="button" onClick={() => setAddingCardToColumn(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className={BTN_GHOST_SM + " w-full justify-start mt-1"}
                          type="button"
                          onClick={() => { setAddingCardToColumn(col.id); setNewCardTitle(""); setNewCardPriority("none"); setNewCardAssignee(""); }}
                        >
                          + Add card
                        </button>
                      ))}
                    </div>

                  )}
                </SortableItem>
              );
            })}

            {columns.length === 0 && (
              <p className="small opacity-50 mt-2">No columns yet. Add one to get started.</p>
            )}
          </div>
        </SortableContext>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay>
          {activeCard && (
            <div className="rounded-[10px] border border-white/20 bg-[rgba(0,0,0,0.7)] p-[0.6rem_0.75rem] text-[0.82rem] font-medium text-white/90 shadow-xl w-[264px]">
              {activeCard.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add column overlay */}
      {addingColumn && (
        <Overlay title="Add Column" onClose={() => setAddingColumn(false)} maxWidth={400} maxHeight={260}>
          <div className="flex flex-col gap-[0.8rem]">
            <label className="flex flex-col gap-[0.35rem]">
              <span className="small opacity-75">Column title</span>
              <input
                className={INPUT}
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); }}
                autoFocus
              />
            </label>
            <div className="flex gap-[0.5rem]">
              <button className={BTN} type="button" onClick={handleAddColumn} disabled={columnSaving || !newColumnTitle.trim()}>
                {columnSaving ? "Adding…" : "Add Column"}
              </button>
              <button className={BTN} type="button" onClick={() => setAddingColumn(false)}>Cancel</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Rename column overlay */}
      {editingColumn && (
        <Overlay title="Rename Column" onClose={() => setEditingColumn(null)} maxWidth={400} maxHeight={260}>
          <div className="flex flex-col gap-[0.8rem]">
            <label className="flex flex-col gap-[0.35rem]">
              <span className="small opacity-75">Column title</span>
              <input
                className={INPUT}
                value={editColumnTitle}
                onChange={(e) => setEditColumnTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameColumn(); }}
                autoFocus
              />
            </label>
            <div className="flex gap-[0.5rem]">
              <button className={BTN} type="button" onClick={handleRenameColumn} disabled={columnSaving || !editColumnTitle.trim()}>
                {columnSaving ? "Saving…" : "Save"}
              </button>
              <button className={BTN} type="button" onClick={() => setEditingColumn(null)}>Cancel</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
};

export default KanbanBoard;
