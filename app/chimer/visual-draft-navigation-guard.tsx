"use client"

import { useEffect, useRef } from "react"

import {
  classifyVisualDraftAnchorNavigation,
  getConnectedVisualFocusTarget,
  getObservableVisualHistoryIndex,
  getVisualDraftHistoryTransition,
  installVisualDraftNavigationListeners,
} from "@/lib/visual-draft-navigation"

export interface VisualDraftNavigationIntent {
  href: string
  historyDelta: number | null
  restoreFocusTarget: HTMLElement | null
}

interface VisualDraftNavigationGuardProps {
  dirty: boolean
  blocked: boolean
  onNavigateAttempt: (intent: VisualDraftNavigationIntent) => void
}

type NavigationWindow = Window & {
  navigation?: {
    currentEntry?: {
      index?: number
    }
  }
}

function observableHistoryIndex() {
  const navigationIndex = (window as NavigationWindow).navigation?.currentEntry?.index
  const historyStateIndex = typeof window.history.state?.idx === "number"
    ? window.history.state.idx
    : null
  return getObservableVisualHistoryIndex({ navigationIndex, historyStateIndex })
}

/**
 * Guards document-level app navigation without taking ownership of draft
 * resolution. History interception is enabled only when the browser or router
 * already exposes stable entry indexes; it never stamps or replaces Next state.
 */
export function VisualDraftNavigationGuard({
  dirty,
  blocked,
  onNavigateAttempt,
}: VisualDraftNavigationGuardProps) {
  const blockedRef = useRef(blocked)
  const restoringHistoryRef = useRef(false)

  useEffect(() => {
    blockedRef.current = blocked
  }, [blocked])

  useEffect(() => {
    if (!dirty) {
      restoringHistoryRef.current = false
      return
    }

    const guardedHistoryIndex = observableHistoryIndex()
    const handleClick = (event: MouseEvent) => {
      const target = event.target
      const anchor = target instanceof Element
        ? target.closest<HTMLAnchorElement>("a[href]")
        : null
      if (!anchor) {
        return
      }
      const navigation = classifyVisualDraftAnchorNavigation({
        href: anchor.href,
        currentHref: window.location.href,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        defaultPrevented: event.defaultPrevented,
        target: anchor.target || "_self",
        download: anchor.hasAttribute("download"),
      })
      if (!navigation) {
        return
      }

      event.preventDefault()
      onNavigateAttempt({
        href: navigation.href,
        historyDelta: null,
        restoreFocusTarget: getConnectedVisualFocusTarget(anchor),
      })
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    const handlePopState = () => {
      const targetIndex = observableHistoryIndex()
      const transition = getVisualDraftHistoryTransition({
        currentIndex: guardedHistoryIndex,
        targetIndex,
        restoring: restoringHistoryRef.current,
        blocked: blockedRef.current,
      })
      restoringHistoryRef.current = transition.restoring
      if (transition.restoreDelta !== 0) {
        window.history.go(transition.restoreDelta)
      }
      if (!transition.notify || transition.historyDelta === null) {
        return
      }
      const target = new URL(window.location.href)
      onNavigateAttempt({
        href: `${target.pathname}${target.search}${target.hash}`,
        historyDelta: transition.historyDelta,
        restoreFocusTarget: getConnectedVisualFocusTarget(document.activeElement),
      })
    }

    return installVisualDraftNavigationListeners({
      documentTarget: document,
      windowTarget: window,
      onClick: handleClick as EventListener,
      onBeforeUnload: handleBeforeUnload as EventListener,
      onPopState: guardedHistoryIndex !== null
        ? handlePopState as EventListener
        : null,
    })
  }, [dirty, onNavigateAttempt])

  return null
}
