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
  memberIds: string[]
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

export interface Member {
  id: string
  name: string
  role: string
  avatar: string
  emails?: string[]
  userEmail?: string // Primary email from connected Supabase user
}

export interface ClientMember {
  id: string
  userId: string | null  // supabase auth user ID, null if member has no auth account
  name: string
  role: "coach" | "member"
  roleTitle: string
  avatar: string
  email: string
}

// ============================================================
// Standard Goals (flexible goal boards)
// ============================================================

export type JournalFrequency = "daily" | "weekly" | "biweekly" | "monthly"

export interface JournalEntry {
  id: string
  journalId: string
  periodKey: string
  authorId: string
  authorName: string
  content: string
  updatedAt: string
}

export interface Journal {
  id: string
  title: string
  description?: string
  frequency: JournalFrequency
  assignedMember: string | null    // member name, null = all
  assignedMemberId: string | null  // client_members.id
  archived: boolean
  /** ISO timestamp of creation — anchors the completion strip. */
  createdAt: string | null
  entries: Record<string, JournalEntry>  // period_key → entry
}

export type GoalType = "milestone" | "periodic"
export type ValueType = "number" | "percentage"
export type GoalFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly"
export type BoardType = "standard" | "priorities"

export interface StandardGoal {
  id: string
  goalType: GoalType
  title: string
  description?: string
  targetValue: number
  valueType: ValueType
  targetDate?: string         // ISO date, milestone only
  checkInFrequency?: GoalFrequency  // milestone only
  period?: GoalFrequency      // periodic only
  owner: string | null        // member name (same pattern as KeyResult.owner)
  isPriority: boolean
  confidence: Confidence
  values: Record<string, number>  // period_key → value
}

export interface GoalBoard {
  id: string
  title: string
  boardType: BoardType
  isActive: boolean           // inverse of archived
  goals: StandardGoal[]
}

export interface Client {
  id: string
  name: string
  timezone?: string
  features: string[]           // optional features: 'okr', 'metrics', 'meetings', 'automations'
  members: Member[]
  allMembers: ClientMember[]
  years: Year[]
  quarters: Quarter[]
  boards: GoalBoard[]
  metrics: Metric[]
  journals: Journal[]
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
  role: "coach" | "member" | "super_admin"
}

export function isCoachOrAdmin(role: string): boolean {
  return role === "coach" || role === "super_admin"
}


// ============================================================
// Helper functions
// ============================================================

export function getActiveYears(client: Client): Year[] {
  return client.years.filter((y) => y.isActive)
}

export function getArchivedYears(client: Client): Year[] {
  return client.years.filter((y) => !y.isActive)
}

export function getActiveQuarters(client: Client): Quarter[] {
  return client.quarters.filter((q) => q.isActive)
}

export function getArchivedQuarters(client: Client): Quarter[] {
  return client.quarters.filter((q) => !q.isActive)
}

export function getActiveBoards(client: Client): GoalBoard[] {
  return (client.boards ?? []).filter((b) => b.isActive)
}

export function getArchivedBoards(client: Client): GoalBoard[] {
  return (client.boards ?? []).filter((b) => !b.isActive)
}

export function getActiveJournals(client: Client): Journal[] {
  return (client.journals ?? []).filter((j) => !j.archived)
}

export function getArchivedJournals(client: Client): Journal[] {
  return (client.journals ?? []).filter((j) => j.archived)
}

export function getJournalFrequencyLabel(freq: JournalFrequency): string {
  switch (freq) {
    case "daily": return "Daily"
    case "weekly": return "Weekly"
    case "biweekly": return "Biweekly"
    case "monthly": return "Monthly"
  }
}

export function hasFeature(client: Client, feature: string): boolean {
  return (client.features ?? []).includes(feature)
}

export function hasPrioritiesBoard(client: Client): boolean {
  return (client.boards ?? []).some((b) => b.boardType === "priorities" && b.isActive)
}

export type OkrPriority = { type: "okr"; quarter: Quarter; goal: QuarterlyGoal; keyResult: KeyResult }
export type StandardPriority = { type: "standard"; board: GoalBoard; goal: StandardGoal }
export type AnyPriority = OkrPriority | StandardPriority

export function getAllPriorities(client: Client): AnyPriority[] {
  const priorities: AnyPriority[] = []
  // OKR priorities
  for (const quarter of client.quarters.filter((q) => q.isActive)) {
    for (const goal of quarter.goals) {
      for (const kr of goal.keyResults) {
        if (kr.isMonthlyPriority && kr.owner) {
          priorities.push({ type: "okr", quarter, goal, keyResult: kr })
        }
      }
    }
  }
  // Standard goal priorities
  for (const board of (client.boards ?? []).filter((b) => b.isActive && b.boardType === "standard")) {
    for (const goal of board.goals) {
      if (goal.isPriority && goal.owner) {
        priorities.push({ type: "standard", board, goal })
      }
    }
  }
  return priorities
}

/** Returns the current period key for a given frequency. */
export function getCurrentPeriodKey(frequency: GoalFrequency): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const day = now.getDate()

  switch (frequency) {
    case "daily":
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    case "weekly": {
      // ISO week number
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`
    }
    case "biweekly": {
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      const biweekNum = Math.ceil(weekNum / 2)
      return `${d.getUTCFullYear()}-BW${String(biweekNum).padStart(2, "0")}`
    }
    case "monthly":
      return `${year}-${String(month + 1).padStart(2, "0")}`
    case "quarterly": {
      const q = Math.floor(month / 3) + 1
      return `${year}-Q${q}`
    }
    case "yearly":
      return `${year}`
  }
}

/** Returns a human-readable label for a period key */
export function getPeriodLabel(frequency: GoalFrequency): string {
  switch (frequency) {
    case "daily": return "Today"
    case "weekly": return "This week"
    case "biweekly": return "This 2-week period"
    case "monthly": return "This month"
    case "quarterly": return "This quarter"
    case "yearly": return "This year"
  }
}

/** Format a period key for display as a short column header */
export function formatPeriodKey(key: string, frequency: GoalFrequency): string {
  switch (frequency) {
    case "daily": {
      // "2026-04-11" → "Apr 11"
      const [, m, d] = key.split("-")
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
      return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
    }
    case "weekly":
      // "2026-W15" → "W15"
      return key.split("-")[1] ?? key
    case "biweekly":
      // "2026-BW08" → "BW8"
      return `BW${parseInt((key.split("-")[1] ?? "0").replace("BW", ""), 10)}`
    case "monthly": {
      // "2026-04" → "Apr"
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
      return months[parseInt(key.split("-")[1] ?? "1", 10) - 1] ?? key
    }
    case "quarterly":
      // "2026-Q2" → "Q2"
      return key.split("-")[1] ?? key
    case "yearly":
      return key
  }
}

/**
 * Generate a series of period keys around the current period.
 * Returns `count` keys: past periods + current + some future.
 * Includes any existing data keys that fall outside the generated range.
 */
export function getPeriodSeries(frequency: GoalFrequency, existingKeys: string[], count?: number): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  let allKeys: string[] = []

  switch (frequency) {
    case "daily": {
      // Show last 14 days + 7 ahead
      const total = count ?? 21
      const pastDays = Math.floor(total * 0.67)
      for (let i = -pastDays; i < total - pastDays; i++) {
        const d = new Date(year, month, day + i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        allKeys.push(key)
      }
      break
    }
    case "weekly": {
      // Show 13 weeks like OKR (quarter)
      const total = count ?? 13
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const currentWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      const currentYear = d.getUTCFullYear()
      // Show quarter containing current week
      const qStart = Math.floor((currentWeek - 1) / 13) * 13 + 1
      for (let w = qStart; w < qStart + total; w++) {
        allKeys.push(`${currentYear}-W${String(w).padStart(2, "0")}`)
      }
      break
    }
    case "biweekly": {
      const total = count ?? 13
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      const currentBW = Math.ceil(weekNum / 2)
      const currentYear = d.getUTCFullYear()
      const past = Math.floor(total * 0.5)
      for (let i = -past; i < total - past; i++) {
        const bw = currentBW + i
        if (bw >= 1 && bw <= 27) {
          allKeys.push(`${currentYear}-BW${String(bw).padStart(2, "0")}`)
        }
      }
      break
    }
    case "monthly": {
      // Show 12 months of current year
      const total = count ?? 12
      for (let m = 0; m < total; m++) {
        allKeys.push(`${year}-${String(m + 1).padStart(2, "0")}`)
      }
      break
    }
    case "quarterly": {
      // Show 4 quarters current year + up to 2 previous
      for (let q = 1; q <= 4; q++) {
        allKeys.push(`${year}-Q${q}`)
      }
      break
    }
    case "yearly": {
      // Show last 3 years + current
      for (let y = year - 3; y <= year; y++) {
        allKeys.push(`${y}`)
      }
      break
    }
  }

  // Merge in any existing data keys that fall outside our range
  const keySet = new Set(allKeys)
  for (const k of existingKeys) {
    if (!keySet.has(k)) {
      allKeys.push(k)
    }
  }

  // Sort chronologically
  allKeys.sort()

  return allKeys
}

/**
 * Builds the sequence of period keys for a journal's completion strip.
 *
 * Window: one period before `createdAt` up through max(currentPeriod, createdAt + 1).
 * This gives a brand-new journal a 3-pill starting state (−1, creation, +1) and
 * extends forward as time passes. Capped to the last `maxCount` entries (rolling
 * window once the strip grows beyond `maxCount`).
 */
export function getJournalPeriodSeries(
  frequency: JournalFrequency,
  createdAt: string | null | undefined,
  maxCount = 520,
  filledKeys?: Iterable<string>,
): string[] {
  const current = getCurrentPeriodKey(frequency as GoalFrequency)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stepForward = (d: Date) => {
    switch (frequency) {
      case "daily": d.setDate(d.getDate() + 1); break
      case "weekly": d.setDate(d.getDate() + 7); break
      case "biweekly": d.setDate(d.getDate() + 14); break
      case "monthly": d.setMonth(d.getMonth() + 1); break
    }
  }
  const stepBackward = (d: Date) => {
    switch (frequency) {
      case "daily": d.setDate(d.getDate() - 1); break
      case "weekly": d.setDate(d.getDate() - 7); break
      case "biweekly": d.setDate(d.getDate() - 14); break
      case "monthly": d.setMonth(d.getMonth() - 1); break
    }
  }

  const anchor = createdAt ? new Date(createdAt) : new Date(today)
  anchor.setHours(0, 0, 0, 0)

  // Start one period before the anchor (creation period).
  const startCursor = new Date(anchor)
  stepBackward(startCursor)

  // Extend backward to include any filled periods that precede the anchor window.
  if (filledKeys) {
    const filledSet = new Set(filledKeys)
    for (let i = 0; i < 1000; i++) {
      const k = getCurrentPeriodKeyForDate(startCursor, frequency)
      const hasEarlier = Array.from(filledSet).some((fk) => fk < k)
      if (!hasEarlier) break
      stepBackward(startCursor)
    }
  }

  // End at max(currentPeriod, anchor + 1 period).
  const anchorPlus1 = new Date(anchor)
  stepForward(anchorPlus1)
  const endCursor = anchorPlus1.getTime() > today.getTime() ? anchorPlus1 : new Date(today)
  // Always extend at least to current period.
  if (endCursor.getTime() < today.getTime()) endCursor.setTime(today.getTime())

  const keys: string[] = []
  const cursor = new Date(startCursor)
  for (let i = 0; i < 1000; i++) {
    const k = getCurrentPeriodKeyForDate(cursor, frequency)
    if (keys[keys.length - 1] !== k) keys.push(k)
    if (cursor.getTime() >= endCursor.getTime() && k !== current) {
      // We've passed the end cursor but make sure current is included
      if (!keys.includes(current)) keys.push(current)
      break
    }
    if (cursor.getTime() >= endCursor.getTime()) break
    stepForward(cursor)
  }

  if (keys.length === 0) keys.push(current)

  return keys.length > maxCount ? keys.slice(keys.length - maxCount) : keys
}

/** Compute the period key for an arbitrary date (not just "now"). */
function getCurrentPeriodKeyForDate(date: Date, frequency: JournalFrequency): string {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  switch (frequency) {
    case "daily":
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    case "weekly": {
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`
    }
    case "biweekly": {
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      const biweekNum = Math.ceil(weekNum / 2)
      return `${d.getUTCFullYear()}-BW${String(biweekNum).padStart(2, "0")}`
    }
    case "monthly":
      return `${year}-${String(month + 1).padStart(2, "0")}`
  }
}

/** Get progress percentage for a standard goal */
export function getStandardGoalProgress(goal: StandardGoal): number {
  if (goal.goalType === "milestone") {
    // Sum all values for cumulative progress
    const total = Object.values(goal.values).reduce((sum, v) => sum + v, 0)
    return goal.targetValue > 0 ? Math.round((total / goal.targetValue) * 100) : 0
  }
  // Periodic: show current period progress
  const freq = goal.period
  if (!freq) return 0
  const key = getCurrentPeriodKey(freq)
  const currentValue = goal.values[key] ?? 0
  return goal.targetValue > 0 ? Math.round((currentValue / goal.targetValue) * 100) : 0
}

export function getMonthlyPriorities(client: Client): { quarter: Quarter; goal: QuarterlyGoal; keyResult: KeyResult }[] {
  const priorities: { quarter: Quarter; goal: QuarterlyGoal; keyResult: KeyResult }[] = []
  for (const quarter of client.quarters.filter((q) => q.isActive)) {
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

/** Returns the ISO 8601 week number (1-53) for the given date. */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Returns the ISO week numbers for the N weeks starting at the first day of
 * the given quarter. Used to display calendar-year week labels (W14..W26 for
 * Q2) on quarterly OKR boards, while the underlying storage stays keyed by
 * quarter-relative week 1..13.
 */
export function getQuarterISOWeeks(year: number, quarter: 1 | 2 | 3 | 4, count = 13): number[] {
  const quarterStart = new Date(year, (quarter - 1) * 3, 1)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(quarterStart)
    d.setDate(d.getDate() + i * 7)
    return getISOWeek(d)
  })
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


