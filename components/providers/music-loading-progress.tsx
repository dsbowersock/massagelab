"use client"

import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function MusicLoadingProgress({
  compact = false,
  progress,
  startedAt,
}: {
  compact?: boolean
  progress: number | null
  startedAt: number | null
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt) {
      return undefined
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(intervalId)
  }, [startedAt])

  if (!startedAt && progress === null) {
    return null
  }

  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
  const progressPercent = Math.min(100, Math.max(6, Math.round((progress ?? 0.08) * 100)))
  const label = elapsedSeconds >= 12
    ? `Still preparing (${elapsedSeconds}s)`
    : "Preparing station..."

  return (
    <div className={cn("space-y-1.5", compact && "min-w-36")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-primary" />
        <span>{label}</span>
      </div>
      <Progress
        aria-label="Station loading progress"
        value={progressPercent}
        className={cn("h-2 bg-muted", progress === null && "animate-pulse")}
      />
    </div>
  )
}
