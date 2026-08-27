"use client"

import type { CSSProperties, ReactNode } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Keeps every drag activator on the visible handle so row sliders and actions
 * retain their ordinary pointer, touch, and keyboard behavior.
 */
export function SortableLayerRow({
  active,
  children,
  id,
  onNodeChange,
  sourceName,
  state,
}: {
  active: boolean
  children(reorderHandle: ReactNode): ReactNode
  id: string
  onNodeChange(node: HTMLLIElement | null): void
  sourceName: string
  state: string
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
  }
  const reorderHandle = (
    <Button
      ref={setActivatorNodeRef}
      type="button"
      size="icon"
      variant="outline"
      className="ml-atmoshaper-layer-drag-handle"
      aria-label={`Reorder ${sourceName}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">Reorder</span>
    </Button>
  )

  return (
    <li
      ref={(node) => {
        setNodeRef(node)
        onNodeChange(node)
      }}
      className="ml-atmoshaper-layer-row rounded-lg border bg-card p-3 text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[active-layer=true]:border-primary/60"
      aria-current={active ? "true" : undefined}
      data-active-layer={active ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      data-layer-id={id}
      data-layer-state={state}
      style={style}
      tabIndex={-1}
    >
      {children(reorderHandle)}
    </li>
  )
}
