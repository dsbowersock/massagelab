"use client"

import { useEffect, useRef } from "react"
import { useLinkStatus } from "next/link"
import { Loader } from "@/components/ui/loader"

/**
 * Reads the nearest Next Link's local pending state and mirrors it to that
 * anchor for CSS and browser-QA assertions without intercepting navigation.
 */
export function LinkPendingIndicator() {
  const { pending } = useLinkStatus()
  const indicatorRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const link = indicatorRef.current?.closest("a")
    if (!link) return undefined

    if (pending) {
      link.setAttribute("data-navigation-pending", "true")
    } else {
      link.removeAttribute("data-navigation-pending")
    }

    return () => link.removeAttribute("data-navigation-pending")
  }, [pending])

  return (
    <span ref={indicatorRef} className="absolute inset-0 flex items-center justify-center">
      {pending ? <Loader aria-hidden="true" size={16} /> : null}
    </span>
  )
}
