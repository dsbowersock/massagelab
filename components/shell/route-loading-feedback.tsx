"use client"

import { useEffect, useState, type ReactElement } from "react"
import { Loader } from "@/components/ui/loader"

export type RouteLoadingFeedbackProps = {
  label?: string
  loaderDelayMs?: number
}

/**
 * Keeps route-segment loading feedback inside Next's loading boundary so the
 * persistent application shell and its long-lived providers never remount.
 */
export function RouteLoadingFeedback({
  label = "Loading page",
  loaderDelayMs = 180,
}: RouteLoadingFeedbackProps): ReactElement {
  const [showLoader, setShowLoader] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowLoader(true), loaderDelayMs)
    return () => window.clearTimeout(timeout)
  }, [loaderDelayMs])

  return (
    <div
      aria-busy="true"
      data-route-progress="pending"
      className="pointer-events-none fixed inset-x-0 top-0 z-[10030] h-[3px] overflow-visible bg-primary/35 motion-reduce:animate-none"
    >
      <div aria-hidden="true" className="h-full w-2/5 animate-pulse bg-primary motion-reduce:animate-none" />
      {showLoader ? (
        <Loader
          data-route-loader="shell-safe"
          label={label}
          size={16}
          className="fixed left-1/2 top-20 -translate-x-1/2 text-primary"
        />
      ) : null}
    </div>
  )
}
