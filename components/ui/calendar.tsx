"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.InputHTMLAttributes<HTMLInputElement>

const Calendar = React.forwardRef<HTMLInputElement, CalendarProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="date"
    className={cn(
      "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
))
Calendar.displayName = "Calendar"

export { Calendar }
