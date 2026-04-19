"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { getCurrentPeriodKey, getJournalPeriodSeries, formatPeriodKey, type JournalFrequency, type GoalFrequency } from "@/lib/mock-data"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CompletionStripProps {
  frequency: JournalFrequency
  filledKeys: Set<string>
  createdAt: string | null
  className?: string
}

export function CompletionStrip({ frequency, filledKeys, createdAt, className }: CompletionStripProps) {
  const currentKey = getCurrentPeriodKey(frequency as GoalFrequency)
  const series = getJournalPeriodSeries(frequency, createdAt, undefined, filledKeys)
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Center the current-period pill on mount / when series changes.
    const container = scrollRef.current
    const target = currentRef.current
    if (!container || !target) return
    const offset = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2
    container.scrollLeft = Math.max(0, offset)
  }, [series.length, currentKey])

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "relative",
          // Fade masks at the edges to signal horizontal overflow.
          "[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]",
          className,
        )}
      >
        <div
          ref={scrollRef}
          className="flex gap-1 overflow-x-auto scroll-smooth px-6 pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {series.map((key) => {
            const isFilled = filledKeys.has(key)
            const isCurrent = key === currentKey
            const label = formatPeriodKey(key, frequency as GoalFrequency)

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div
                    ref={isCurrent ? currentRef : undefined}
                    className={cn(
                      "inline-flex h-6 min-w-[2.25rem] shrink-0 items-center justify-center rounded px-1.5 text-[11px] font-medium leading-none transition-colors",
                      isFilled
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {label}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{label}</p>
                  <p className="text-muted-foreground">
                    {isFilled ? "Completed" : isCurrent ? "Current period" : "Missing"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
