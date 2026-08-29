"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import { cn } from "@/lib/utils"

export type AsyncActionButtonProps =
  Omit<React.ComponentProps<typeof Button>, "children" | "aria-busy"> & {
    pending: boolean
    idleLabel: string
    pendingLabel: string
    icon?: React.ReactNode
  }

/** Keeps one stable button footprint while exposing only the active label. */
export function AsyncActionButton({
  pending,
  idleLabel,
  pendingLabel,
  icon,
  className,
  disabled = false,
  ...buttonProps
}: AsyncActionButtonProps) {
  return (
    <>
      <Button
        {...buttonProps}
        className={cn("inline-flex", className)}
        disabled={pending || disabled}
        aria-busy={pending}
      >
        <span className="grid place-items-center">
          <span
            aria-hidden={pending}
            className={cn("col-start-1 row-start-1 inline-flex items-center gap-2", pending && "invisible")}
          >
            {icon}
            {idleLabel}
          </span>
          <span
            aria-hidden={!pending}
            className={cn("col-start-1 row-start-1 inline-flex items-center gap-2", !pending && "invisible")}
          >
            <Loader size={18} color="currentColor" aria-hidden="true" />
            {pendingLabel}
          </span>
        </span>
      </Button>
      {pending ? (
        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {pendingLabel}
        </span>
      ) : null}
    </>
  )
}
