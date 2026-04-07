"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { getBoardDisplayLabel, getBoardCheckinColumns, getCustomGoalProgress } from "@/lib/mock-data"
import type { CustomGoalBoard, CustomGoal, CustomGoalType } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Plus, MoreHorizontal, Pencil, Trash2, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CustomGoalsProps {
  board: CustomGoalBoard
}

export function CustomGoals({ board }: CustomGoalsProps) {
  const { addCustomGoal, updateCustomGoal, deleteCustomGoal, updateCustomGoalCheckin } = useApp()
  
  // Dialog states
  const [showAddGoalDialog, setShowAddGoalDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<CustomGoal | null>(null)
  
  // Goal form state
  const [goalTitle, setGoalTitle] = useState("")
  const [goalType, setGoalType] = useState<CustomGoalType>("number")
  const [goalTarget, setGoalTarget] = useState("")
  const [goalDescription, setGoalDescription] = useState("")
  
  const checkinColumns = getBoardCheckinColumns(board)
  
  async function handleAddGoal() {
    if (!goalTitle.trim()) return
    
    const target = goalType === "boolean" || goalType === "text" 
      ? null 
      : parseFloat(goalTarget) || null
    
    await addCustomGoal(
      board.id,
      goalTitle.trim(),
      goalType,
      target,
      goalDescription.trim() || null
    )
    
    closeGoalDialog()
  }
  
  function handleEditGoal(goal: CustomGoal) {
    setEditingGoal(goal)
    setGoalTitle(goal.title)
    setGoalType(goal.type)
    setGoalTarget(goal.target?.toString() ?? "")
    setGoalDescription(goal.description ?? "")
  }
  
  async function handleSaveEditGoal() {
    if (!editingGoal || !goalTitle.trim()) return
    
    const target = goalType === "boolean" || goalType === "text"
      ? null
      : parseFloat(goalTarget) || null
    
    updateCustomGoal(board.id, editingGoal.id, {
      title: goalTitle.trim(),
      type: goalType,
      target,
      description: goalDescription.trim() || null,
    })
    
    closeGoalDialog()
  }
  
  function closeGoalDialog() {
    setShowAddGoalDialog(false)
    setEditingGoal(null)
    setGoalTitle("")
    setGoalType("number")
    setGoalTarget("")
    setGoalDescription("")
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{board.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {board.boardType === "milestone" ? `${board.startDate} to ${board.endDate}` : getBoardDisplayLabel(board)} - {board.boardType === "weekly" ? "Weekly goals" : board.boardType === "monthly" ? "Monthly goals" : "Milestone goals"}
          </p>
        </div>
        <Button onClick={() => setShowAddGoalDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Goal
        </Button>
      </div>
      
      {/* Goals list with check-in grid */}
      {board.goals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Target className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-sm font-medium text-foreground">No goals yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first goal to start tracking progress
          </p>
          <Button onClick={() => setShowAddGoalDialog(true)} variant="outline" size="sm" className="mt-4">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {board.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              checkinColumns={checkinColumns}
              onEdit={() => handleEditGoal(goal)}
              onDelete={() => deleteCustomGoal(board.id, goal.id)}
              onUpdateCheckin={(checkinDate, value, textValue) => 
                updateCustomGoalCheckin(board.id, goal.id, checkinDate, value, textValue)
              }
            />
          ))}
        </div>
      )}
      
      {/* Add Goal Dialog */}
      <GoalFormDialog
        open={showAddGoalDialog}
        onOpenChange={(open) => !open && closeGoalDialog()}
        title="Add Goal"
        description="Add a new goal to track on this board"
        goalTitle={goalTitle}
        setGoalTitle={setGoalTitle}
        goalType={goalType}
        setGoalType={setGoalType}
        goalTarget={goalTarget}
        setGoalTarget={setGoalTarget}
        goalDescription={goalDescription}
        setGoalDescription={setGoalDescription}
        onSubmit={handleAddGoal}
        submitLabel="Add Goal"
      />
      
      {/* Edit Goal Dialog */}
      <GoalFormDialog
        open={!!editingGoal}
        onOpenChange={(open) => !open && closeGoalDialog()}
        title="Edit Goal"
        description="Update the goal details"
        goalTitle={goalTitle}
        setGoalTitle={setGoalTitle}
        goalType={goalType}
        setGoalType={setGoalType}
        goalTarget={goalTarget}
        setGoalTarget={setGoalTarget}
        goalDescription={goalDescription}
        setGoalDescription={setGoalDescription}
        onSubmit={handleSaveEditGoal}
        submitLabel="Save Changes"
      />
    </div>
  )
}

// Goal card with inline check-in grid
function GoalCard({
  goal,
  checkinColumns,
  onEdit,
  onDelete,
  onUpdateCheckin,
}: {
  goal: CustomGoal
  checkinColumns: { key: string; label: string }[]
  onEdit: () => void
  onDelete: () => void
  onUpdateCheckin: (checkinDate: string, value: number | null, textValue: string | null) => void
}) {
  const progress = getCustomGoalProgress(goal)
  
  function formatValue(value: number | null, type: CustomGoalType): string {
    if (value === null || value === undefined) return ""
    if (type === "boolean") return value === 1 ? "Yes" : "No"
    if (type === "percentage") return `${value}%`
    if (type === "currency") return `$${value.toLocaleString()}`
    return value.toString()
  }
  
  function handleCellChange(checkinDate: string, inputValue: string) {
    let numValue: number | null = null
    
    if (goal.type === "boolean") {
      numValue = inputValue.toLowerCase() === "yes" || inputValue === "1" ? 1 : 0
    } else if (goal.type === "text") {
      onUpdateCheckin(checkinDate, null, inputValue)
      return
    } else {
      const parsed = parseFloat(inputValue.replace(/[$%,]/g, ""))
      numValue = isNaN(parsed) ? null : parsed
    }
    
    onUpdateCheckin(checkinDate, numValue, null)
  }
  
  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Goal header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">{goal.title}</h3>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              goal.type === "number" && "bg-blue-500/10 text-blue-600",
              goal.type === "percentage" && "bg-green-500/10 text-green-600",
              goal.type === "currency" && "bg-amber-500/10 text-amber-600",
              goal.type === "boolean" && "bg-purple-500/10 text-purple-600",
              goal.type === "text" && "bg-slate-500/10 text-slate-600",
            )}>
              {goal.type}
            </span>
          </div>
          {goal.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{goal.description}</p>
          )}
          {goal.target !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Target: {formatValue(goal.target, goal.type)} | Current: {formatValue(goal.currentValue, goal.type)} ({progress}%)
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Goal
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Check-in grid */}
      <div className="border-t border-border overflow-x-auto">
        <div className="flex min-w-max">
          {checkinColumns.map((col) => {
            const checkin = goal.checkins[col.key]
            const displayValue = goal.type === "text" 
              ? (checkin?.textValue ?? "")
              : formatValue(checkin?.value ?? null, goal.type)
            
            return (
              <div key={col.key} className="flex flex-col border-r border-border last:border-r-0">
                <div className="px-2 py-1 text-center text-xs font-medium text-muted-foreground bg-muted/30">
                  {col.label}
                </div>
                <div className="p-1">
                  <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => handleCellChange(col.key, e.target.value)}
                    placeholder={goal.type === "boolean" ? "Yes/No" : "-"}
                    className={cn(
                      "w-16 rounded border-0 bg-transparent px-2 py-1.5 text-center text-sm focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary",
                      goal.type === "text" && "w-24"
                    )}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Reusable goal form dialog
function GoalFormDialog({
  open,
  onOpenChange,
  title,
  description,
  goalTitle,
  setGoalTitle,
  goalType,
  setGoalType,
  goalTarget,
  setGoalTarget,
  goalDescription,
  setGoalDescription,
  onSubmit,
  submitLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  goalTitle: string
  setGoalTitle: (v: string) => void
  goalType: CustomGoalType
  setGoalType: (v: CustomGoalType) => void
  goalTarget: string
  setGoalTarget: (v: string) => void
  goalDescription: string
  setGoalDescription: (v: string) => void
  onSubmit: () => void
  submitLabel: string
}) {
  const showTarget = goalType !== "boolean" && goalType !== "text"
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Goal Title</Label>
            <Input
              id="goal-title"
              placeholder="e.g., Complete 5 customer calls"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={goalType} onValueChange={(v) => setGoalType(v as CustomGoalType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="currency">Currency ($)</SelectItem>
                <SelectItem value="boolean">Yes/No</SelectItem>
                <SelectItem value="text">Text/Journal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showTarget && (
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target (optional)</Label>
              <Input
                id="goal-target"
                type="number"
                placeholder="e.g., 100"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="goal-description">Description (optional)</Label>
            <Input
              id="goal-description"
              placeholder="Brief description of this goal"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!goalTitle.trim()}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
