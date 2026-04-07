// ============================================================
// Types
// ============================================================

export type KeyResultType = "input" | "output" | "project"

export type Confidence =
  | "not_started"
  | "confident"
  | "moderately_confident"
  | "not_confident"
  | "done"
  | "discontinued"

export interface Meeting {
  id: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  attendeeEmails: string[]
  founderIds: string[]
  hasDocuments: boolean
  documentCount?: number
  transcriptCount?: number
  notesCount?: number
  otherCount?: number
  status: "scheduled" | "deleted_in_calendar" | "rescheduled"
}

export interface MeetingDocument {
  id: string
  meetingId: string
  title: string
  content: string
  documentType: "transcript" | "notes" | "other"
  createdAt: Date
}

export interface YearlyKeyResult {
  id: string
  title: string
  confidence: Confidence
}

export interface KeyResult {
  id: string
  title: string
  type: KeyResultType
  owner: string | null  // null = unassigned / inactive
  isMonthlyPriority: boolean
  target: number
  weeklyValues: Record<string, number> // e.g. { "W1": 5, "W2": 10, ... }
}

export interface QuarterlyGoal {
  id: string
  objective: string
  yearlyGoalId: string
  keyResults: KeyResult[]
}

export interface Quarter {
  id: string
  label: string
  year: number
  isActive: boolean
  goals: QuarterlyGoal[]
}

export interface YearlyGoal {
  id: string
  objective: string
  keyResults: YearlyKeyResult[]
}

export interface Year {
  id: string
  year: number
  isActive: boolean
  goals: YearlyGoal[]
}

export interface Metric {
  id: string
  name: string
  description: string
  category: string
  values: Record<number, number> // month number (1-12) -> value
}

export interface Founder {
  id: string
  name: string
  role: string
  avatar: string
  emails?: string[]
  userEmail?: string // Primary email from connected Supabase user
}

export interface CompanyMember {
  id: string
  name: string
  role: "coach" | "founder"
  roleTitle: string
  avatar: string
  email: string
}

// ============================================================
// Custom Goals Types
// ============================================================

export type CustomGoalType = "number" | "percentage" | "currency" | "boolean" | "text"
export type CustomGoalBoardCadence = "weekly" | "monthly"

export interface CustomGoalCheckin {
  id: string
  goalId: string
  periodIndex: number // 1-13 for weekly, 1-4 for monthly (weeks in month)
  value: number | null
  textValue: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CustomGoal {
  id: string
  boardId: string
  title: string
  description: string | null
  type: CustomGoalType
  target: number | null
  currentValue: number | null
  position: number
  checkins: Record<number, { value: number | null; textValue: string | null }> // periodIndex -> checkin data
}

export interface CustomGoalBoard {
  id: string
  companyId: string
  name: string
  cadence: CustomGoalBoardCadence
  year: number
  periodNumber: number // week 1-52 or month 1-12
  isActive: boolean
  goals: CustomGoal[]
  createdAt: Date
}

export interface Company {
  id: string
  name: string
  timezone?: string
  customGoalsEnabled?: boolean
  founders: Founder[]
  members: CompanyMember[]
  years: Year[]
  quarters: Quarter[]
  metrics: Metric[]
  customGoalBoards?: CustomGoalBoard[]
}

export interface Coach {
  id: string
  name: string
  avatar: string
  clientIds: string[]
}

export interface CurrentUser {
  id: string
  name: string
  email: string
  avatar: string
  role: "coach" | "founder"
}



// ============================================================
// Helper functions
// ============================================================

export function getActiveYears(company: Company): Year[] {
  return company.years.filter((y) => y.isActive)
}

export function getArchivedYears(company: Company): Year[] {
  return company.years.filter((y) => !y.isActive)
}

export function getActiveQuarters(company: Company): Quarter[] {
  return company.quarters.filter((q) => q.isActive)
}

export function getArchivedQuarters(company: Company): Quarter[] {
  return company.quarters.filter((q) => !q.isActive)
}

export function getMonthlyPriorities(company: Company): { quarter: Quarter; goal: QuarterlyGoal; keyResult: KeyResult }[] {
  const priorities: { quarter: Quarter; goal: QuarterlyGoal; keyResult: KeyResult }[] = []
  for (const quarter of company.quarters.filter((q) => q.isActive)) {
    for (const goal of quarter.goals) {
      for (const kr of goal.keyResults) {
        if (kr.isMonthlyPriority && kr.owner) {
          priorities.push({ quarter, goal, keyResult: kr })
        }
      }
    }
  }
  return priorities
}

/** For input KRs: returns { met, total } for weeks that have a value entered. */
export function getWeeksOnTarget(kr: KeyResult): { met: number; total: number } {
  const entries = Object.values(kr.weeklyValues).filter((v) => v > 0)
  const met = entries.filter((v) => v >= kr.target).length
  return { met, total: entries.length }
}

export function sumWeeklyValues(kr: KeyResult): number {
  return Object.values(kr.weeklyValues).reduce((sum, v) => sum + v, 0)
}

export function getProgressPercent(kr: KeyResult): number {
  if (kr.type === "project") {
    const values = Object.values(kr.weeklyValues)
    return values.length > 0 ? Math.max(...values) : 0
  }
  const sum = sumWeeklyValues(kr)
  return kr.target > 0 ? Math.round((sum / kr.target) * 100) : 0
}

/** Returns the current week key (e.g. "W10") within the active quarter. */
export function getCurrentWeekKey(): string {
  const now = new Date()
  const year = now.getFullYear()

  // Quarter start months: Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
  const month = now.getMonth() // 0-indexed
  const quarterStartMonth = Math.floor(month / 3) * 3
  const quarterStart = new Date(year, quarterStartMonth, 1)

  const diffMs = now.getTime() - quarterStart.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const weekNum = Math.min(Math.floor(diffDays / 7) + 1, 13)

  return `W${weekNum}`
}

// ============================================================
// Custom Goals Helper Functions
// ============================================================

/** Get ISO week number (1-52) for a date */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** Get check-in columns for a board based on type and date range */
export function getBoardCheckinColumns(board: CustomGoalBoard): { key: string; label: string }[] {
  const start = new Date(board.startDate)
  const end = new Date(board.endDate)
  
  if (board.boardType === "weekly") {
    // Single week: 7 days (Mon-Sun)
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return days.map((day, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      return { key: date.toISOString().split("T")[0], label: day }
    })
  } else if (board.boardType === "monthly") {
    // Month: 4-5 weeks
    const weeks: { key: string; label: string }[] = []
    let weekNum = 1
    const current = new Date(start)
    while (current <= end) {
      weeks.push({ key: current.toISOString().split("T")[0], label: `W${weekNum}` })
      current.setDate(current.getDate() + 7)
      weekNum++
    }
    return weeks
  } else {
    // Milestone: flexible columns based on duration
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (daysDiff <= 14) {
      // 2 weeks or less: show individual days
      const columns: { key: string; label: string }[] = []
      const current = new Date(start)
      while (current <= end) {
        const dayLabel = current.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        columns.push({ key: current.toISOString().split("T")[0], label: dayLabel })
        current.setDate(current.getDate() + 1)
      }
      return columns
    } else {
      // Longer: show weeks
      const weeks: { key: string; label: string }[] = []
      let weekNum = 1
      const current = new Date(start)
      while (current <= end) {
        weeks.push({ key: current.toISOString().split("T")[0], label: `W${weekNum}` })
        current.setDate(current.getDate() + 7)
        weekNum++
      }
      return weeks
    }
  }
}

/** Get board display label */
export function getBoardDisplayLabel(board: CustomGoalBoard): string {
  const start = new Date(board.startDate)
  const year = start.getFullYear()
  const yearShort = String(year).slice(-2)
  
  if (board.boardType === "weekly") {
    const weekNum = getISOWeekNumber(start)
    return `W${weekNum} '${yearShort}`
  } else if (board.boardType === "monthly") {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${monthNames[start.getMonth()]} '${yearShort}`
  } else {
    // Milestone: use the board name
    return board.name
  }
}

/** Calculate progress for a custom goal */
export function getCustomGoalProgress(goal: CustomGoal): number {
  if (goal.type === "boolean") {
    return goal.currentValue === 1 ? 100 : 0
  }
  if (goal.target && goal.target > 0 && goal.currentValue !== null) {
    return Math.min(Math.round((goal.currentValue / goal.target) * 100), 100)
  }
  return 0
}

/** Get week start date (Monday) for a given date */
export function getWeekStartDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

/** Get week end date (Sunday) for a given date */
export function getWeekEndDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? 0 : 7)
  d.setDate(diff)
  return d.toISOString().split("T")[0]
}

/** Get month start date for a given date */
export function getMonthStartDate(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0]
}

/** Get month end date for a given date */
export function getMonthEndDate(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0]
}


