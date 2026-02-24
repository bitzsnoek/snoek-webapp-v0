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
}

export interface Company {
  id: string
  name: string
  founders: Founder[]
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

// ============================================================
// Mock Data
// ============================================================

export const mockFounders: Founder[] = [
  { id: "f1", name: "Alex Rivera", role: "CEO", avatar: "/avatars/alex-rivera.jpg" },
  { id: "f2", name: "Sam Chen", role: "CTO", avatar: "/avatars/sam-chen.jpg" },
  { id: "f3", name: "Jordan Park", role: "COO", avatar: "/avatars/jordan-park.jpg" },
]

export const mockFounders2: Founder[] = [
  { id: "f4", name: "Taylor Moore", role: "CEO", avatar: "/avatars/taylor-moore.jpg" },
  { id: "f5", name: "Jamie Lee", role: "CPO", avatar: "/avatars/casey-patel.jpg" },
]

export const mockCompanies: Company[] = [
  {
    id: "c1",
    name: "NovaTech",
    founders: mockFounders,
    years: [
      {
        id: "y1",
        year: 2025,
        isActive: true,
        goals: [
          {
            id: "yg1",
            objective: "Reach product-market fit and scale revenue to 1M ARR",
            keyResults: [
              { id: "ykr1", title: "Achieve 1M ARR by end of year", confidence: "moderately_confident" },
              { id: "ykr2", title: "Reach 500 paying customers", confidence: "confident" },
              { id: "ykr3", title: "Reduce churn to below 3% monthly", confidence: "not_confident" },
            ],
          },
          {
            id: "yg2",
            objective: "Build a world-class engineering team",
            keyResults: [
              { id: "ykr4", title: "Hire 5 senior engineers", confidence: "moderately_confident" },
              { id: "ykr5", title: "Achieve 90%+ team satisfaction score", confidence: "not_started" },
              { id: "ykr6", title: "Ship 12 major features", confidence: "confident" },
            ],
          },
          {
            id: "yg3",
            objective: "Establish brand authority in the market",
            keyResults: [
              { id: "ykr7", title: "Reach 10,000 newsletter subscribers", confidence: "confident" },
              { id: "ykr8", title: "Speak at 4 industry conferences", confidence: "done" },
              { id: "ykr9", title: "Get featured in 3 major publications", confidence: "not_started" },
            ],
          },
        ],
      },
      {
        id: "y0",
        year: 2024,
        isActive: false,
        goals: [
          {
            id: "yg0",
            objective: "Validate the product concept and secure seed funding",
            keyResults: [
              { id: "ykr0a", title: "Raise 500K in seed funding", confidence: "done" },
              { id: "ykr0b", title: "Launch MVP and get 50 beta users", confidence: "done" },
              { id: "ykr0c", title: "Conduct 100 customer interviews", confidence: "done" },
            ],
          },
        ],
      },
    ],
    quarters: [
      {
        id: "q1-2025",
        label: "Q1 2025",
        year: 2025,
        isActive: true,
        goals: [
          {
            id: "qg1",
            objective: "Accelerate sales pipeline and close enterprise deals",
            yearlyGoalId: "yg1",
            keyResults: [
              {
                id: "kr1",
                title: "Outbound sales calls",
                type: "input",
                owner: "Alex Rivera",
                isMonthlyPriority: true,
                target: 20,
                weeklyValues: { W1: 18, W2: 22, W3: 15, W4: 20, W5: 25, W6: 19, W7: 23, W8: 21, W9: 18, W10: 0, W11: 0, W12: 0 },
              },
              {
                id: "kr2",
                title: "Demos booked",
                type: "output",
                owner: "Alex Rivera",
                isMonthlyPriority: true,
                target: 40,
                weeklyValues: { W1: 3, W2: 4, W3: 2, W4: 5, W5: 3, W6: 4, W7: 3, W8: 5, W9: 4, W10: 0, W11: 0, W12: 0 },
              },
              {
                id: "kr3",
                title: "Enterprise deals closed",
                type: "output",
                owner: "Alex Rivera",
                isMonthlyPriority: true,
                target: 5,
                weeklyValues: { W1: 0, W2: 0, W3: 1, W4: 0, W5: 0, W6: 1, W7: 0, W8: 0, W9: 1, W10: 0, W11: 0, W12: 0 },
              },
            ],
          },
          {
            id: "qg2",
            objective: "Launch v2.0 of the platform",
            yearlyGoalId: "yg2",
            keyResults: [
              {
                id: "kr4",
                title: "Complete API redesign",
                type: "project",
                owner: "Sam Chen",
                isMonthlyPriority: true,
                target: 100,
                weeklyValues: { W1: 10, W2: 15, W3: 25, W4: 35, W5: 45, W6: 55, W7: 65, W8: 75, W9: 80, W10: 0, W11: 0, W12: 0 },
              },
              {
                id: "kr5",
                title: "LinkedIn posts published",
                type: "input",
                owner: "Jordan Park",
                isMonthlyPriority: true,
                target: 3,
                weeklyValues: { W1: 3, W2: 3, W3: 3, W4: 3, W5: 3, W6: 3, W7: 3, W8: 3, W9: 3, W10: 0, W11: 0, W12: 0 },
              },
              {
                id: "kr6",
                title: "Hire 2 senior engineers",
                type: "project",
                owner: "Sam Chen",
                isMonthlyPriority: false,
                target: 100,
                weeklyValues: { W1: 10, W2: 20, W3: 30, W4: 40, W5: 40, W6: 40, W7: 40, W8: 40, W9: 40, W10: 0, W11: 0, W12: 0 },
              },
            ],
          },
          {
            id: "qg3",
            objective: "Grow content marketing funnel",
            yearlyGoalId: "yg3",
            keyResults: [
              {
                id: "kr7",
                title: "Blog articles published",
                type: "input",
                owner: "Jordan Park",
                isMonthlyPriority: true,
                target: 1,
                weeklyValues: { W1: 1, W2: 1, W3: 1, W4: 1, W5: 1, W6: 1, W7: 1, W8: 1, W9: 1, W10: 0, W11: 0, W12: 0 },
              },
              {
                id: "kr8",
                title: "Newsletter subscribers gained",
                type: "output",
                owner: "Jordan Park",
                isMonthlyPriority: false,
                target: 2500,
                weeklyValues: { W1: 150, W2: 200, W3: 180, W4: 220, W5: 250, W6: 190, W7: 210, W8: 230, W9: 200, W10: 0, W11: 0, W12: 0 },
              },
            ],
          },
        ],
      },
      {
        id: "q4-2024",
        label: "Q4 2024",
        year: 2024,
        isActive: false,
        goals: [
          {
            id: "qg-old",
            objective: "Prepare launch strategy",
            yearlyGoalId: "yg0",
            keyResults: [
              {
                id: "kr-old1",
                title: "Customer interviews conducted",
                type: "input",
                owner: "Alex Rivera",
                isMonthlyPriority: false,
                target: 50,
                weeklyValues: { W1: 4, W2: 5, W3: 4, W4: 4, W5: 5, W6: 4, W7: 5, W8: 4, W9: 4, W10: 5, W11: 3, W12: 3 },
              },
            ],
          },
        ],
      },
    ],
    metrics: [
      { id: "m1", name: "Revenue YTD", description: "From accounting", category: "P&L", values: { 1: 42000, 2: 48000, 3: 55000 } },
      { id: "m2", name: "Profit YTD", description: "From accounting", category: "P&L", values: { 1: -12000, 2: -8000, 3: -3000 } },
      { id: "m3", name: "Average monthly costs", description: "Avg last 3 months", category: "P&L", values: { 1: 54000, 2: 56000, 3: 58000 } },
      { id: "m4", name: "Break even target", description: "Calculated P&L", category: "P&L", values: { 1: 60000, 2: 60000, 3: 60000 } },
      { id: "m5", name: "Accounts receivable", description: "End of month balance", category: "P&L", values: { 1: 15000, 2: 18000, 3: 22000 } },
      { id: "m6", name: "Months of cash", description: "From cashflow forecast", category: "Cashflow", values: { 1: 18, 2: 17, 3: 16 } },
      { id: "m7", name: "Cash buffer", description: "From cashflow forecast", category: "Cashflow", values: { 1: 320000, 2: 295000, 3: 270000 } },
      { id: "m8", name: "Burn rate (cash)", description: "Cash out ex. VAT (normalized)", category: "Cashflow", values: { 1: 25000, 2: 25000, 3: 25000 } },
      { id: "m9", name: "Sales deals closed", description: "EUR", category: "Sales", values: { 1: 12000, 2: 18000, 3: 22000 } },
      { id: "m10", name: "Pipeline 90%", description: "EUR", category: "Sales", values: { 1: 45000, 2: 60000, 3: 80000 } },
      { id: "m11", name: "Pipeline 50%", description: "EUR", category: "Sales", values: { 1: 120000, 2: 185000, 3: 240000 } },
      { id: "m12", name: "First meetings planned", description: "#", category: "Sales", values: { 1: 8, 2: 12, 3: 15 } },
      { id: "m13", name: "Monthly Active Users", description: "Unique users / month", category: "Product", values: { 1: 1200, 2: 1450, 3: 1680 } },
      { id: "m14", name: "User Churn Rate", description: "% monthly", category: "Product", values: { 1: 4, 2: 3, 3: 3 } },
      { id: "m15", name: "NPS Score", description: "Quarterly survey", category: "Product", values: { 1: 45, 2: 52, 3: 58 } },
    ],
  },
  {
    id: "c2",
    name: "GreenPulse",
    founders: mockFounders2,
    years: [
      {
        id: "y2",
        year: 2025,
        isActive: true,
        goals: [
          {
            id: "yg4",
            objective: "Launch B2B SaaS product and acquire first 100 customers",
            keyResults: [
              { id: "ykr10", title: "Acquire 100 paying B2B customers", confidence: "moderately_confident" },
              { id: "ykr11", title: "Achieve 50K MRR", confidence: "not_confident" },
              { id: "ykr12", title: "Launch self-serve onboarding", confidence: "confident" },
            ],
          },
        ],
      },
    ],
    quarters: [
      {
        id: "q1-2025-gp",
        label: "Q1 2025",
        year: 2025,
        isActive: true,
        goals: [
          {
            id: "qg4",
            objective: "Build outbound sales machine",
            yearlyGoalId: "yg4",
            keyResults: [
              {
                id: "kr9",
                title: "Cold emails sent",
                type: "input",
                owner: "Taylor Moore",
                isMonthlyPriority: true,
                target: 90,
                weeklyValues: { W1: 80, W2: 90, W3: 85, W4: 95, W5: 100, W6: 88, W7: 92, W8: 95, W9: 90, W10: 0, W11: 0, W12: 0 },
              },
              {
                id: "kr10",
                title: "Design self-serve onboarding flow",
                type: "project",
                owner: "Jamie Lee",
                isMonthlyPriority: true,
                target: 100,
                weeklyValues: { W1: 5, W2: 15, W3: 25, W4: 35, W5: 50, W6: 60, W7: 70, W8: 80, W9: 85, W10: 0, W11: 0, W12: 0 },
              },
            ],
          },
        ],
      },
    ],
    metrics: [
      { id: "m20", name: "Monthly Recurring Revenue", description: "From accounting", category: "P&L", values: { 1: 8000, 2: 12000, 3: 18000 } },
      { id: "m21", name: "Active Customers", description: "Paying accounts", category: "Product", values: { 1: 22, 2: 31, 3: 45 } },
      { id: "m22", name: "Burn rate (cash)", description: "Cash out ex. VAT", category: "Cashflow", values: { 1: 15000, 2: 16000, 3: 17000 } },
    ],
  },
]

export const mockCoach: Coach = {
  id: "coach1",
  name: "Morgan Webb",
  avatar: "MW",
  clientIds: ["c1", "c2"],
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


