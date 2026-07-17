import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function ReviewStateGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>
}

export function ReviewState({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-28 content-start gap-3 rounded-md border border-border/70 bg-background/55 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        {note ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p> : null}
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
