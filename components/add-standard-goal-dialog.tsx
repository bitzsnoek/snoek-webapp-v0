"use client"

import { useState, useEffect } from "react"
import type { GoalType, ValueType, GoalFrequency, Confidence, StandardGoal } from "@/lib/mock-data"
import { useApp } from "@/lib/store"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Milestone, RotateCcw } from "lucide-react"

const FREQUENCIES: { value: GoalFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
]

export function AddStandardGoalDialog({
  open,
  onOpenChange,
  boardId,
  editGoal,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  editGoal?: StandardGoal | null
}) {
  const { addStandardGoal, updateStandardGoal, activeClient } = useApp()
  const isEditing = !!editGoal

  const [goalType, setGoalType] = useState<GoalType>("milestone")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [valueType, setValueType] = useState<ValueType>("number")
  const [targetDate, setTargetDate] = useState("")
  const [checkInFrequency, setCheckInFrequency] = useState<GoalFrequency>("weekly")
  const [period, setPeriod] = useState<GoalFrequency>("weekly")
  const [owner, setOwner] = useState<string>("unassigned")
  const [isPriority, setIsPriority] = useState(false)
  const [saving, setSaving] = useState(false)

  // Pre-fill form when editing
  useEffect(() => {
    if (editGoal && open) {
      setGoalType(editGoal.goalType)
      setTitle(editGoal.title)
      setDescription(editGoal.description ?? "")
      setTargetValue(String(editGoal.targetValue))
      setValueType(editGoal.valueType)
      setTargetDate(editGoal.targetDate ?? "")
      setCheckInFrequency(editGoal.checkInFrequency ?? "weekly")
      setPeriod(editGoal.period ?? "weekly")
      setOwner(editGoal.owner ?? "unassigned")
      setIsPriority(editGoal.isPriority)
    }
  }, [editGoal, open])

  const allMembers = activeClient.allMembers ?? []
  const allNames = [...new Set([
    ...allMembers.map((m) => m.name),
    ...activeClient.members.map((f) => f.name),
  ])]

  function resetForm() {
    setGoalType("milestone")
    setTitle("")
    setDescription("")
    setTargetValue("")
    setValueType("number")
    setTargetDate("")
    setCheckInFrequency("weekly")
    setPeriod("weekly")
    setOwner("unassigned")
    setIsPriority(false)
  }

  async function handleSubmit() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const goalData = {
        goalType,
        title: title.trim(),
        description: description.trim() || undefined,
        targetValue: parseFloat(targetValue) || 0,
        valueType,
        targetDate: goalType === "milestone" && targetDate ? targetDate : undefined,
        checkInFrequency: goalType === "milestone" ? checkInFrequency : undefined,
        period: goalType === "periodic" ? period : undefined,
        owner: owner === "unassigned" ? null : owner,
        isPriority,
      }

      if (isEditing && editGoal) {
        updateStandardGoal(boardId, editGoal.id, goalData)
      } else {
        await addStandardGoal(boardId, {
          ...goalData,
          confidence: "not_started" as Confidence,
        })
      }
      resetForm()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Goal" : "Add Goal"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this goal's settings." : "Create a new goal for this board."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Goal type selector */}
          <div className="flex flex-col gap-2">
            <Label>Goal type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGoalType("milestone")}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  goalType === "milestone"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30"
                )}
              >
                <Milestone className="h-4 w-4" />
                Milestone
              </button>
              <button
                onClick={() => setGoalType("periodic")}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  goalType === "periodic"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30"
                )}
              >
                <RotateCcw className="h-4 w-4" />
                Periodic
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              placeholder={goalType === "milestone" ? "e.g. Launch MVP" : "e.g. Weekly sales calls"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-desc">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="goal-desc"
              placeholder="Brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Target value + value type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-target">Target value</Label>
              <Input
                id="goal-target"
                type="number"
                step="any"
                placeholder="100"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Value type</Label>
              <Select value={valueType} onValueChange={(v) => setValueType(v as ValueType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Milestone-specific fields */}
          {goalType === "milestone" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="goal-date">
                  Target date <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Check-in frequency</Label>
                <Select value={checkInFrequency} onValueChange={(v) => setCheckInFrequency(v as GoalFrequency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Periodic-specific fields */}
          {goalType === "periodic" && (
            <div className="flex flex-col gap-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as GoalFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Owner */}
          <div className="flex flex-col gap-2">
            <Label>Owner</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {allNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">Set as priority</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || saving}>
            {saving ? (isEditing ? "Saving..." : "Adding...") : (isEditing ? "Save Changes" : "Add Goal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
