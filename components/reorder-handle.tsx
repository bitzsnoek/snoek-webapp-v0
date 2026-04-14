"use client"

import { useState } from "react"
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Reorder handle — a grip icon that appears on hover, opens a menu with move options.
 *
 * Usage:
 *   <ReorderHandle
 *     onMoveUp={() => reorder(i, i - 1)}
 *     onMoveDown={() => reorder(i, i + 1)}
 *     isFirst={i === 0}
 *     isLast={i === items.length - 1}
 *   />
 *
 * Variants:
 *   "default" — for top-level goal cards (20×20 grip, standard padding)
 *   "compact" — for nested items like key results (16×16 grip, tighter)
 */
export function ReorderHandle({
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  variant = "default",
}: {
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  variant?: "default" | "compact"
}) {
  const [open, setOpen] = useState(false)

  // Nothing to reorder if it's the only item
  if (isFirst && isLast) return null

  const iconSize = variant === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"
  const hitArea = variant === "compact"
    ? "h-5 w-4 -ml-1"
    : "h-6 w-5 -ml-1.5"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex shrink-0 items-center justify-center rounded-sm transition-all cursor-grab",
            hitArea,
            // Desktop: invisible until parent row is hovered; visible when menu is open
            "md:opacity-0 md:group-hover/reorder:opacity-60 md:hover:!opacity-100",
            open && "!opacity-100",
            // Mobile: always faintly visible since there's no hover
            "opacity-20",
            "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Reorder"
        >
          <GripVertical className={iconSize} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" sideOffset={4} className="min-w-[130px]">
        <DropdownMenuItem
          onClick={onMoveUp}
          disabled={isFirst}
          className="gap-2 text-xs"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onMoveDown}
          disabled={isLast}
          className="gap-2 text-xs"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Move down
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
