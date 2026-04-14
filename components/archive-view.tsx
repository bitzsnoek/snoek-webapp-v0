"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { getArchivedYears, getArchivedQuarters, getArchivedBoards, getProgressPercent, getStandardGoalProgress } from "@/lib/mock-data"
import { Archive, Target, TrendingUp, CheckCircle2, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ArchiveTabId = `year-${string}` | `quarter-${string}` | `board-${string}`

export function ArchiveView() {
  const { activeClient, unarchiveTab, unarchiveBoard } = useApp()
  const archivedYears = getArchivedYears(activeClient)
  const archivedQuarters = getArchivedQuarters(activeClient)
  const archivedBoards = getArchivedBoards(activeClient)

  const allTabs: { id: ArchiveTabId; label: string }[] = [
    ...archivedYears
      .slice()
      .sort((a, b) => b.year - a.year)
      .map((y) => ({ id: `year-${y.id}` as ArchiveTabId, label: String(y.year) })),
    ...archivedQuarters
      .slice()
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year
        const qa = parseInt(a.label.replace(/Q(\d).*/, "$1"))
        const qb = parseInt(b.label.replace(/Q(\d).*/, "$1"))
        return qb - qa
      })
      .map((q) => ({
        id: `quarter-${q.id}` as ArchiveTabId,
        label: `${q.label.split(" ")[0]} '${String(q.year).slice(-2)}`,
      })),
    ...archivedBoards.map((b) => ({
      id: `board-${b.id}` as ArchiveTabId,
      label: b.title,
    })),
  ]

  const [activeTabId, setActiveTabId] = useState<ArchiveTabId | null>(
    allTabs.length > 0 ? allTabs[0].id : null
  )

  // Sync active tab if it disappears after unarchiving
  const validActiveTabId =
    activeTabId && allTabs.some((t) => t.id === activeTabId)
      ? activeTabId
      : allTabs.length > 0
      ? allTabs[0].id
      : null

  function handleUnarchive(tabId: ArchiveTabId) {
    if (tabId.startsWith("year-")) {
      unarchiveTab("year", tabId.replace("year-", ""))
    } else if (tabId.startsWith("quarter-")) {
      unarchiveTab("quarter", tabId.replace("quarter-", ""))
    } else {
      unarchiveBoard(tabId.replace("board-", ""))
    }
    // Switch to next available tab
    const remaining = allTabs.filter((t) => t.id !== tabId)
    setActiveTabId(remaining.length > 0 ? remaining[0].id : null)
  }

  const isEmpty = allTabs.length === 0

  // Derive active content
  const activeYearId = validActiveTabId?.startsWith("year-")
    ? validActiveTabId.replace("year-", "")
    : null
  const activeQuarterId = validActiveTabId?.startsWith("quarter-")
    ? validActiveTabId.replace("quarter-", "")
    : null
  const activeBoardId = validActiveTabId?.startsWith("board-")
    ? validActiveTabId.replace("board-", "")
    : null
  const activeYear = archivedYears.find((y) => y.id === activeYearId) ?? null
  const activeQuarter = archivedQuarters.find((q) => q.id === activeQuarterId) ?? null
  const activeBoard = archivedBoards.find((b) => b.id === activeBoardId) ?? null

  return (
    <div className="flex flex-col">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24">
          <Archive className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No archived items yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Archive a board from the Goals section
          </p>
        </div>
      ) : (
        <>
          {/* Tab bar matching Goals style */}
          <div className="-mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6 flex h-12 items-stretch overflow-x-auto scrollbar-none border-b border-border bg-background px-4 md:px-6">
            {allTabs.map((tab) => {
              const isActive = tab.id === validActiveTabId
              return (
                <div key={tab.id} className="group relative flex h-full shrink-0 items-stretch">
                  <button
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTabId(tab.id)}
                    className={cn(
                      "relative flex items-center gap-1 px-3 text-sm transition-colors",
                      isActive
                        ? "font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                    <span className="ml-0.5 rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                      archived
                    </span>
                    {isActive && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                    )}
                  </button>

                  {/* Unarchive button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnarchive(tab.id)
                    }}
                    title="Unarchive — move back to Goals"
                    className={cn(
                      "flex items-center self-center rounded-sm p-0.5 text-muted-foreground/40 md:opacity-0 transition-all hover:text-primary md:group-hover:opacity-100",
                      isActive && "text-muted-foreground/60"
                    )}
                    aria-label="Unarchive"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Content for active archived tab */}
          <div className="mx-auto w-full max-w-4xl">
            {activeYear && (
              <ArchivedYearContent
                year={activeYear}
                onUnarchive={() => handleUnarchive(`year-${activeYear.id}`)}
              />
            )}
            {activeQuarter && (
              <ArchivedQuarterContent
                quarter={activeQuarter}
                onUnarchive={() => handleUnarchive(`quarter-${activeQuarter.id}`)}
              />
            )}
            {activeBoard && (
              <ArchivedBoardContent
                board={activeBoard}
                onUnarchive={() => handleUnarchive(`board-${activeBoard.id}`)}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---- Archived content components ----

function ArchivedYearContent({
  year,
  onUnarchive,
}: {
  year: ReturnType<typeof getArchivedYears>[number]
  onUnarchive: () => void
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground opacity-70">{year.year}</h2>
          <p className="text-sm text-muted-foreground">Yearly goals — archived</p>
        </div>
        <button
          onClick={onUnarchive}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <RotateCcw className="h-3 w-3" />
          Unarchive
        </button>
      </div>
      <div className="flex flex-col gap-4 opacity-75">
        {year.goals.map((goal) => (
          <div
            key={goal.id}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{goal.objective}</h3>
            </div>
            <div className="ml-11 flex flex-col gap-2">
              {goal.keyResults.map((kr) => (
                <div key={kr.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  <span>{kr.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {year.goals.length === 0 && (
          <p className="text-sm text-muted-foreground">No goals in this year.</p>
        )}
      </div>
    </div>
  )
}

function ArchivedQuarterContent({
  quarter,
  onUnarchive,
}: {
  quarter: ReturnType<typeof getArchivedQuarters>[number]
  onUnarchive: () => void
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground opacity-70">{quarter.label}</h2>
          <p className="text-sm text-muted-foreground">Quarterly goals — archived</p>
        </div>
        <button
          onClick={onUnarchive}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <RotateCcw className="h-3 w-3" />
          Unarchive
        </button>
      </div>
      <div className="flex flex-col gap-5 opacity-75">
        {quarter.goals.map((goal) => (
          <div key={goal.id} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">{goal.objective}</p>
            </div>
            <div className="ml-6 flex flex-col gap-2">
              {goal.keyResults.map((kr) => {
                const progress = getProgressPercent(kr)
                return (
                  <div key={kr.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{kr.title}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "tabular-nums",
                        progress >= 75 ? "border-primary/30 text-primary" : "text-muted-foreground"
                      )}
                    >
                      {progress}%
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {quarter.goals.length === 0 && (
          <p className="text-sm text-muted-foreground">No goals in this quarter.</p>
        )}
      </div>
    </div>
  )
}

function ArchivedBoardContent({
  board,
  onUnarchive,
}: {
  board: ReturnType<typeof getArchivedBoards>[number]
  onUnarchive: () => void
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground opacity-70">{board.title}</h2>
          <p className="text-sm text-muted-foreground">Goals board — archived</p>
        </div>
        <button
          onClick={onUnarchive}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <RotateCcw className="h-3 w-3" />
          Unarchive
        </button>
      </div>
      <div className="flex flex-col gap-4 opacity-75">
        {board.goals.map((goal) => {
          const progress = getStandardGoalProgress(goal)
          return (
            <div key={goal.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "tabular-nums",
                    progress >= 75 ? "border-primary/30 text-primary" : "text-muted-foreground"
                  )}
                >
                  {progress}%
                </Badge>
              </div>
            </div>
          )
        })}
        {board.goals.length === 0 && (
          <p className="text-sm text-muted-foreground">No goals on this board.</p>
        )}
      </div>
    </div>
  )
}
