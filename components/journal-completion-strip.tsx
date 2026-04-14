"use client"

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
  const series = getJournalPeriodSeries(frequency, createdAt, 12)

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex gap-1 flex-wrap", className)}>
        {series.map((key) => {
          const isFilled = filledKeys.has(key)
          const isCurrent = key === currentKey

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded-sm transition-colors",
                    isFilled
                      ? "bg-primary"
                      : isCurrent
                        ? "ring-1 ring-primary bg-muted"
                        : "bg-muted"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>{formatPeriodKey(key, frequency as GoalFrequency)}</p>
                <p className="text-muted-foreground">
                  {isFilled ? "Completed" : isCurrent ? "Current period" : "Missing"}
                </p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
