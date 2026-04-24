"use client"

import { useState } from "react"
import type { GoalBoard, StandardGoal, Confidence } from "@/lib/mock-data"
import { isCoachOrAdmin } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import { StandardGoalCard } from "./standard-goal-card"
import { AddStandardGoalDialog } from "./add-standard-goal-dialog"
import { Target, Plus, Pencil, Check, X, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function StandardGoalsBoard({ board }: { board: GoalBoard }) {
  const { currentUser, updateGoalBoard, reorderStandardGoals } = useApp()
  const isCoach = isCoachOrAdmin(currentUser.role)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(board.title)

  function handleSaveTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== board.title) {
      updateGoalBoard(board.id, trimmed)
    }
    setEditingTitle(false)
  }

  function handleMoveGoal(fromIndex: number, direction: "up" | "down") {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= board.goals.length) return
    reorderStandardGoals(board.id, fromIndex, toIndex)
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Board header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          {editingTitle && isCoach ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle()
                  if (e.key === "Escape") {
                    setTitleDraft(board.title)
                    setEditingTitle(false)
                  }
                }}
                autoFocus
                className="h-8 w-48"
              />
              <button onClick={handleSaveTitle} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => { setTitleDraft(board.title); setEditingTitle(false) }} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{board.title}</h2>
              {isCoach && (
                <button
                  onClick={() => { setTitleDraft(board.title); setEditingTitle(true) }}
                  className="rounded-md p-1 text-faint-foreground hover:text-muted-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {isCoach && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Goal
          </Button>
        )}
      </div>

      {/* Goals list */}
      {board.goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Target className="mb-3 h-10 w-10 text-faint-foreground" />
          <p className="text-sm text-muted-foreground">No goals yet</p>
          {isCoach && (
            <p className="mt-1 text-xs text-muted-foreground">
              Click &quot;Add Goal&quot; to create your first goal on this board.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {board.goals.map((goal, index) => (
            <StandardGoalCard
              key={goal.id}
              goal={goal}
              boardId={board.id}
              index={index}
              totalGoals={board.goals.length}
              onMoveUp={() => handleMoveGoal(index, "up")}
              onMoveDown={() => handleMoveGoal(index, "down")}
            />
          ))}
        </div>
      )}

      {/* Add goal dialog */}
      <AddStandardGoalDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        boardId={board.id}
      />
    </div>
  )
}
