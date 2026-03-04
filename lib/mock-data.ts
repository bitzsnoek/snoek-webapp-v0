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

export interface YearlyKeyResult {
  id: string
  title: string
  confidence: Confidence
}

export type TargetFrequency = "weekly" | "monthly" | "quarterly"

export interface KeyResult {
  id: string
  title: string
  type: KeyResultType
  owner: string | null  // null = unassigned / inactive
  isMonthlyPriority: boolean
  target: number
  targetFrequency: TargetFrequency
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
}

export interface CompanyMember {
  id: string
  name: string
  role: "coach" | "founder"
  roleTitle: string
  avatar: string
  email: string
}

export interface Company {
  id: string
  name: string
  founders: Founder[]
  members: CompanyMember[]
  years: Year[]
  quarters: Quarter[]
  metrics: Metric[]
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

/** Returns the weekly target equivalent based on frequency.
 *  weekly = target as-is, monthly = target / ~4.33, quarterly = target / 13 */
export function getWeeklyTarget(kr: KeyResult): number {
  const freq = kr.targetFrequency ?? "quarterly"
  if (freq === "weekly") return kr.target
  if (freq === "monthly") return kr.target / 4.33
  return kr.target / 13 // quarterly
}

/** Returns the quarterly total target based on frequency.
 *  weekly = target * 13, monthly = target * 3, quarterly = target as-is */
export function getQuarterlyTarget(kr: KeyResult): number {
  const freq = kr.targetFrequency ?? "quarterly"
  if (freq === "weekly") return kr.target * 13
  if (freq === "monthly") return kr.target * 3
  return kr.target // quarterly
}

/** Returns a human-readable label for the target, e.g. "50 / week" */
export function getTargetLabel(kr: KeyResult): string {
  const freq = kr.targetFrequency ?? "quarterly"
  if (freq === "weekly") return `${kr.target} / week`
  if (freq === "monthly") return `${kr.target} / month`
  return `${kr.target} / quarter`
}

/** For input KRs: returns { met, total } for weeks that have a value entered.
 *  Compares each weekly value against the weekly equivalent target. */
export function getWeeksOnTarget(kr: KeyResult): { met: number; total: number } {
  const weeklyTarget = getWeeklyTarget(kr)
  const entries = Object.values(kr.weeklyValues).filter((v) => v > 0)
  const met = entries.filter((v) => v >= weeklyTarget).length
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
  const quarterlyTarget = getQuarterlyTarget(kr)
  return quarterlyTarget > 0 ? Math.round((sum / quarterlyTarget) * 100) : 0
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


