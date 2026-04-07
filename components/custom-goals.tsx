"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/lib/store"
import { getCurrentPeriodInfo, getBoardDisplayLabel, getBoardPeriodLabels, getCustomGoalProgress } from "@/lib/mock-data"
import type { CustomGoalBoard, CustomGoal, CustomGoalType, CustomGoalBoardCadence } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Plus, Calendar, ChevronRight, MoreHorizontal, Pencil, Trash2, Target } from "lucide-react"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function CustomGoals() {
  const { activeCompany, addCustomGoalBoard, deleteCustomGoalBoard, addCustomGoal, updateCustomGoal, deleteCustomGoal, updateCustomGoalCheckin } = useApp()
  
  const [cadenceFilter, setCadenceFilter] = useState<"all" | "weekly" | "monthly">("all")
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  
  // Dialog states
  const [showAddBoardDialog, setShowAddBoardDialog] = useState(false)
  const [showAddGoalDialog, setShowAddGoalDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<{ boardId: string; goal: CustomGoal } | null>(null)
  
  // New board form state
  const [newBoardName, setNewBoardName] = useState("")
  const [newBoardCadence, setNewBoardCadence] = useState<CustomGoalBoardCadence>("weekly")
  
  // New goal form state
  const [newGoalTitle, setNewGoalTitle] = useState("")
  const [newGoalType, setNewGoalType] = useState<CustomGoalType>("number")
  const [newGoalTarget, setNewGoalTarget] = useState("")
  const [newGoalDescription, setNewGoalDescription] = useState("")
  
  const boards = activeCompany.customGoalBoards ?? []
  const currentPeriod = getCurrentPeriodInfo()
  
  // Filter boards by cadence
  const filteredBoards = useMemo(() => {
    let filtered = boards
    if (cadenceFilter === "weekly") {
      filtered = boards.filter((b) => b.cadence === "weekly")
    } else if (cadenceFilter === "monthly") {
      filtered = boards.filter((b) => b.cadence === "monthly")
    }
    return filtered.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year
      return b.periodNumber - a.periodNumber
    })
  }, [boards, cadenceFilter])
  
  // Find or auto-create current period boards
  const currentWeeklyBoard = boards.find(
    (b) => b.cadence === "weekly" && b.year === currentPeriod.year && b.periodNumber === currentPeriod.weekNumber
  )
  const currentMonthlyBoard = boards.find(
    (b) => b.cadence === "monthly" && b.year === currentPeriod.year && b.periodNumber === currentPeriod.monthNumber
  )
  
  const selectedBoard = selectedBoardId ? boards.find((b) => b.id === selectedBoardId) : null
  
  async function handleAddBoard() {
    if (!newBoardName.trim()) return
    
    const periodNumber = newBoardCadence === "weekly" ? currentPeriod.weekNumber : currentPeriod.monthNumber
    const id = await addCustomGoalBoard(newBoardName.trim(), newBoardCadence, currentPeriod.year, periodNumber)
    
    setShowAddBoardDialog(false)
    setNewBoardName("")
    setNewBoardCadence("weekly")
    
    if (id) {
      setSelectedBoardId(id)
    }
  }
  
  async function handleAddGoal() {
    if (!selectedBoardId || !newGoalTitle.trim()) return
    
    const target = newGoalType === "boolean" || newGoalType === "text" 
      ? null 
      : parseFloat(newGoalTarget) || null
    
    await addCustomGoal(
      selectedBoardId,
      newGoalTitle.trim(),
      newGoalType,
      target,
      newGoalDescription.trim() || null
    )
    
    setShowAddGoalDialog(false)
    setNewGoalTitle("")
    setNewGoalType("number")
    setNewGoalTarget("")
    setNewGoalDescription("")
  }
  
  function handleEditGoal(boardId: string, goal: CustomGoal) {
    setEditingGoal({ boardId, goal })
    setNewGoalTitle(goal.title)
    setNewGoalType(goal.type)
    setNewGoalTarget(goal.target?.toString() ?? "")
    setNewGoalDescription(goal.description ?? "")
  }
  
  async function handleSaveEditGoal() {
    if (!editingGoal || !newGoalTitle.trim()) return
    
    const target = newGoalType === "boolean" || newGoalType === "text"
      ? null
      : parseFloat(newGoalTarget) || null
    
    updateCustomGoal(editingGoal.boardId, editingGoal.goal.id, {
      title: newGoalTitle.trim(),
      type: newGoalType,
      target,
      description: newGoalDescription.trim() || null,
    })
    
    setEditingGoal(null)
    setNewGoalTitle("")
    setNewGoalType("number")
    setNewGoalTarget("")
    setNewGoalDescription("")
  }
  
  // If a board is selected, show the board detail view
  if (selectedBoard) {
    return (
      <BoardDetailView
        board={selectedBoard}
        onBack={() => setSelectedBoardId(null)}
        onAddGoal={() => setShowAddGoalDialog(true)}
        onEditGoal={(goal) => handleEditGoal(selectedBoard.id, goal)}
        onDeleteGoal={(goalId) => deleteCustomGoal(selectedBoard.id, goalId)}
        onUpdateCheckin={(goalId, periodIndex, value, textValue) => 
          updateCustomGoalCheckin(selectedBoard.id, goalId, periodIndex, value, textValue)
        }
      />
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Custom Goals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track recurring goals on a weekly or monthly basis
          </p>
        </div>
        <Button onClick={() => setShowAddBoardDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Board
        </Button>
      </div>
      
      {/* Cadence filter */}
      <Tabs value={cadenceFilter} onValueChange={(v) => setCadenceFilter(v as typeof cadenceFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Current period boards */}
      {(cadenceFilter === "all" || cadenceFilter === "weekly") && !currentWeeklyBoard && (
        <QuickCreateCard
          cadence="weekly"
          periodLabel={`Week ${currentPeriod.weekNumber}, ${currentPeriod.year}`}
          onCreate={async () => {
            const id = await addCustomGoalBoard(
              `Week ${currentPeriod.weekNumber}`,
              "weekly",
              currentPeriod.year,
              currentPeriod.weekNumber
            )
            if (id) setSelectedBoardId(id)
          }}
        />
      )}
      
      {(cadenceFilter === "all" || cadenceFilter === "monthly") && !currentMonthlyBoard && (
        <QuickCreateCard
          cadence="monthly"
          periodLabel={new Date(currentPeriod.year, currentPeriod.monthNumber - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          onCreate={async () => {
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
            const id = await addCustomGoalBoard(
              monthNames[currentPeriod.monthNumber - 1],
              "monthly",
              currentPeriod.year,
              currentPeriod.monthNumber
            )
            if (id) setSelectedBoardId(id)
          }}
        />
      )}
      
      {/* Board list */}
      {filteredBoards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Target className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-sm font-medium text-foreground">No boards yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first board to start tracking custom goals
          </p>
          <Button onClick={() => setShowAddBoardDialog(true)} variant="outline" size="sm" className="mt-4">
            <Plus className="h-4 w-4 mr-1.5" />
            Create Board
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBoards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onClick={() => setSelectedBoardId(board.id)}
              onDelete={() => deleteCustomGoalBoard(board.id)}
            />
          ))}
        </div>
      )}
      
      {/* Add Board Dialog */}
      <Dialog open={showAddBoardDialog} onOpenChange={setShowAddBoardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
            <DialogDescription>
              Create a board to track goals for a specific time period
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="board-name">Board Name</Label>
              <Input
                id="board-name"
                placeholder="e.g., Week 15, April Goals"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddBoard()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Cadence</Label>
              <Select value={newBoardCadence} onValueChange={(v) => setNewBoardCadence(v as CustomGoalBoardCadence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly (13 check-ins)</SelectItem>
                  <SelectItem value="monthly">Monthly (4 check-ins)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {newBoardCadence === "weekly" 
                  ? "Weekly boards have 13 check-in slots (like quarterly key results)"
                  : "Monthly boards have 4 check-in slots (one per week)"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBoardDialog(false)}>Cancel</Button>
            <Button onClick={handleAddBoard} disabled={!newBoardName.trim()}>Create Board</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Goal Dialog */}
      <GoalFormDialog
        open={showAddGoalDialog}
        onOpenChange={setShowAddGoalDialog}
        title="Add Goal"
        description="Add a new goal to track on this board"
        goalTitle={newGoalTitle}
        setGoalTitle={setNewGoalTitle}
        goalType={newGoalType}
        setGoalType={setNewGoalType}
        goalTarget={newGoalTarget}
        setGoalTarget={setNewGoalTarget}
        goalDescription={newGoalDescription}
        setGoalDescription={setNewGoalDescription}
        onSubmit={handleAddGoal}
        submitLabel="Add Goal"
      />
      
      {/* Edit Goal Dialog */}
      <GoalFormDialog
        open={!!editingGoal}
        onOpenChange={(open) => !open && setEditingGoal(null)}
        title="Edit Goal"
        description="Update the goal details"
        goalTitle={newGoalTitle}
        setGoalTitle={setNewGoalTitle}
        goalType={newGoalType}
        setGoalType={setNewGoalType}
        goalTarget={newGoalTarget}
        setGoalTarget={setNewGoalTarget}
        goalDescription={newGoalDescription}
        setGoalDescription={setNewGoalDescription}
        onSubmit={handleSaveEditGoal}
        submitLabel="Save Changes"
      />
    </div>
  )
}

// Quick create card for current period
function QuickCreateCard({ 
  cadence, 
  periodLabel, 
  onCreate 
}: { 
  cadence: CustomGoalBoardCadence
  periodLabel: string
  onCreate: () => void 
}) {
  return (
    <button
      onClick={onCreate}
      className="flex w-full items-center gap-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Calendar className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Start tracking {periodLabel}</p>
        <p className="text-xs text-muted-foreground">
          Click to create a {cadence} board for the current period
        </p>
      </div>
      <Plus className="h-5 w-5 text-primary" />
    </button>
  )
}

// Board card in the list view
function BoardCard({ 
  board, 
  onClick,
  onDelete,
}: { 
  board: CustomGoalBoard
  onClick: () => void 
  onDelete: () => void
}) {
  const goalCount = board.goals.length
  const completedGoals = board.goals.filter((g) => getCustomGoalProgress(g) >= 100).length
  
  return (
    <div
      className="group relative flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            board.cadence === "weekly" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
          )}>
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">{board.name}</h3>
            <p className="text-xs text-muted-foreground capitalize">{board.cadence}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Board
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{getBoardDisplayLabel(board)}</span>
        <span>{completedGoals}/{goalCount} goals</span>
      </div>
      
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </div>
  )
}

// Board detail view with goals and check-in grid
function BoardDetailView({
  board,
  onBack,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onUpdateCheckin,
}: {
  board: CustomGoalBoard
  onBack: () => void
  onAddGoal: () => void
  onEditGoal: (goal: CustomGoal) => void
  onDeleteGoal: (goalId: string) => void
  onUpdateCheckin: (goalId: string, periodIndex: number, value: number | null, textValue: string | null) => void
}) {
  const periodLabels = getBoardPeriodLabels(board.cadence)
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{board.name}</h1>
          <p className="text-sm text-muted-foreground">{getBoardDisplayLabel(board)}</p>
        </div>
        <Button onClick={onAddGoal} size="sm">
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
          <Button onClick={onAddGoal} variant="outline" size="sm" className="mt-4">
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
              periodLabels={periodLabels}
              onEdit={() => onEditGoal(goal)}
              onDelete={() => onDeleteGoal(goal.id)}
              onUpdateCheckin={(periodIndex, value, textValue) => 
                onUpdateCheckin(goal.id, periodIndex, value, textValue)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Goal card with inline check-in grid
function GoalCard({
  goal,
  periodLabels,
  onEdit,
  onDelete,
  onUpdateCheckin,
}: {
  goal: CustomGoal
  periodLabels: string[]
  onEdit: () => void
  onDelete: () => void
  onUpdateCheckin: (periodIndex: number, value: number | null, textValue: string | null) => void
}) {
  const progress = getCustomGoalProgress(goal)
  
  function formatValue(value: number | null, type: CustomGoalType): string {
    if (value === null || value === undefined) return ""
    if (type === "boolean") return value === 1 ? "Yes" : "No"
    if (type === "percentage") return `${value}%`
    if (type === "currency") return `$${value.toLocaleString()}`
    return value.toString()
  }
  
  function handleCellChange(periodIndex: number, inputValue: string) {
    let numValue: number | null = null
    
    if (goal.type === "boolean") {
      numValue = inputValue.toLowerCase() === "yes" || inputValue === "1" ? 1 : 0
    } else if (goal.type === "text") {
      onUpdateCheckin(periodIndex, null, inputValue)
      return
    } else {
      const parsed = parseFloat(inputValue.replace(/[$%,]/g, ""))
      numValue = isNaN(parsed) ? null : parsed
    }
    
    onUpdateCheckin(periodIndex, numValue, null)
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
          {periodLabels.map((label, index) => {
            const periodIndex = index + 1
            const checkin = goal.checkins[periodIndex]
            const displayValue = goal.type === "text" 
              ? (checkin?.textValue ?? "")
              : formatValue(checkin?.value ?? null, goal.type)
            
            return (
              <div key={periodIndex} className="flex flex-col border-r border-border last:border-r-0">
                <div className="px-2 py-1 text-center text-xs font-medium text-muted-foreground bg-muted/30">
                  {label}
                </div>
                <div className="p-1">
                  <input
                    type={goal.type === "text" ? "text" : "text"}
                    value={displayValue}
                    onChange={(e) => handleCellChange(periodIndex, e.target.value)}
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
