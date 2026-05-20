import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function CalendarOperatorShell({
  children,
  className,
  flush = false,
  width = "wide",
}: {
  children: ReactNode
  className?: string
  flush?: boolean
  width?: "standard" | "wide" | "full"
}) {
  return (
    <div className={cn("bg-transparent", flush ? "flex h-full min-h-0 p-0" : "min-h-screen px-3 py-3 sm:px-4 lg:px-6")}>
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-3",
          flush && "h-full min-h-0 flex-1 gap-0",
          width === "standard" && "max-w-5xl",
          width === "wide" && "max-w-7xl",
          width === "full" && "max-w-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
