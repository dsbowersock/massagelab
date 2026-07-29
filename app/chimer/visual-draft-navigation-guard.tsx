"use client"

import { useEffect, useRef } from "react"

interface VisualDraftNavigationGuardProps {
  dirty: boolean
  onNavigateAttempt: (href: string) => void
}

function isModifiedPrimaryClick(event: MouseEvent) {
  return event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.altKey
    || event.shiftKey
}

/**
 * Guards document-level app navigation without taking ownership of draft
 * resolution. Downloads, external destinations, modified clicks, hash-only
 * moves, and non-self targets retain their native browser behavior.
 */
export function VisualDraftNavigationGuard({
  dirty,
  onNavigateAttempt,
}: VisualDraftNavigationGuardProps) {
  const currentUrlRef = useRef("")

  useEffect(() => {
    if (!dirty) {
      currentUrlRef.current = window.location.href
      return
    }

    currentUrlRef.current ||= window.location.href

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedPrimaryClick(event)) {
        return
      }
      const target = event.target
      const anchor = target instanceof Element
        ? target.closest<HTMLAnchorElement>("a[href]")
        : null
      if (!anchor || anchor.download) {
        return
      }
      const anchorTarget = anchor.target || "_self"
      if (anchorTarget !== "_self") {
        return
      }

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) {
        return
      }
      const current = new URL(window.location.href)
      const hashOnly = url.pathname === current.pathname
        && url.search === current.search
        && url.hash !== current.hash
      if (hashOnly || url.href === current.href) {
        return
      }

      event.preventDefault()
      onNavigateAttempt(`${url.pathname}${url.search}${url.hash}`)
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    const handlePopState = () => {
      const targetHref = window.location.href
      const previousHref = currentUrlRef.current
      if (targetHref === previousHref) {
        return
      }
      window.history.pushState(window.history.state, "", previousHref)
      const target = new URL(targetHref)
      onNavigateAttempt(`${target.pathname}${target.search}${target.hash}`)
    }

    document.addEventListener("click", handleClick, true)
    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("popstate", handlePopState)
    return () => {
      document.removeEventListener("click", handleClick, true)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [dirty, onNavigateAttempt])

  return null
}
