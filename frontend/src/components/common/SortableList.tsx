import React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent, DragOverEvent, UniqueIdentifier } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToHorizontalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

type Props = {
  ids: UniqueIdentifier[];
  onReorder: (activeId: UniqueIdentifier, overId: UniqueIdentifier) => void;
  direction?: "vertical" | "horizontal";
  restrictAxis?: boolean;
  children: React.ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
};

const SortableList: React.FC<Props> = ({
  ids,
  onReorder,
  direction = "vertical",
  restrictAxis = true,
  children,
  onDragStart,
  onDragOver,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const modifiers = restrictAxis
    ? [direction === "vertical" ? restrictToVerticalAxis : restrictToHorizontalAxis, restrictToParentElement]
    : [];

  const strategy = direction === "vertical" ? verticalListSortingStrategy : horizontalListSortingStrategy;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id, over.id);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={modifiers}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={strategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

export default SortableList;
