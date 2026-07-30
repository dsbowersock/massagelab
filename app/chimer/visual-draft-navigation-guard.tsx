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
  /** Preserves a guarded link's history behavior after the draft dialog resolves. */
  replace: boolean
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
 * resolution. Eligible same-origin anchors and native `beforeunload` remain
 * guarded in every browser. A custom same-document Back/Forward dialog requires
 * a stable Navigation API or router history index; without one, direction cannot
 * be restored safely, so this guard deliberately does not install `popstate`,
 * stamp/push/replace history, or risk corrupting Forward history and Next state.
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
        replace: anchor.dataset.visualDraftNavigationMode === "replace",
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
        replace: false,
        restoreFocusTarget: getConnectedVisualFocusTarget(document.activeElement),
      })
    }

    return installVisualDraftNavigationListeners({
      documentTarget: document,
      windowTarget: window,
      onClick: handleClick as EventListener,
      onBeforeUnload: handleBeforeUnload as EventListener,
      // Without a stable index, popstate exposes neither direction nor a
      // cancellable transition. Anchors and beforeunload stay guarded.
      onPopState: guardedHistoryIndex !== null
        ? handlePopState as EventListener
        : null,
    })
  }, [dirty, onNavigateAttempt])

  return null
}
