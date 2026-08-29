"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLinkStatus } from "next/link"
import { RouteLoadingFeedback } from "@/components/shell/route-loading-feedback"
import { Loader } from "@/components/ui/loader"

/**
 * Reads the nearest Next Link's local pending state and mirrors it to that
 * anchor for CSS and browser-QA assertions without intercepting navigation.
 */
export function LinkPendingIndicator() {
  const { pending } = useLinkStatus()
  const indicatorRef = useRef<HTMLSpanElement | null>(null)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalHost(document.body)
  }, [])

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
    <>
      <span ref={indicatorRef} className="absolute inset-0 flex items-center justify-center">
        {pending ? <Loader aria-hidden="true" size={16} /> : null}
      </span>
      {pending && portalHost
        ? createPortal(<RouteLoadingFeedback owner="link" />, portalHost)
        : null}
    </>
  )
}
