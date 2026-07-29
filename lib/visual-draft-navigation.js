function finiteIndex(value) {
  return Number.isInteger(value) && value >= 0 ? value : null
}

/**
 * Returns an eligible same-origin app destination without consulting the DOM.
 * Callers supply `download` from `anchor.hasAttribute("download")`, so a bare
 * download attribute is excluded just like one with a filename.
 *
 * @param {{
 *   href?: string,
 *   currentHref?: string,
 *   button?: number,
 *   metaKey?: boolean,
 *   ctrlKey?: boolean,
 *   altKey?: boolean,
 *   shiftKey?: boolean,
 *   defaultPrevented?: boolean,
 *   target?: string,
 *   download?: boolean,
 * }} input
 */
export function classifyVisualDraftAnchorNavigation({
  href,
  currentHref,
  button = 0,
  metaKey = false,
  ctrlKey = false,
  altKey = false,
  shiftKey = false,
  defaultPrevented = false,
  target = "_self",
  download = false,
} = {}) {
  if (
    defaultPrevented
    || button !== 0
    || metaKey
    || ctrlKey
    || altKey
    || shiftKey
    || download
    || target !== "_self"
    || typeof href !== "string"
    || typeof currentHref !== "string"
  ) {
    return null
  }
  let destination
  let current
  try {
    destination = new URL(href, currentHref)
    current = new URL(currentHref)
  } catch {
    return null
  }
  if (destination.origin !== current.origin || destination.href === current.href) {
    return null
  }
  const hashOnly = destination.pathname === current.pathname
    && destination.search === current.search
    && destination.hash !== current.hash
  return hashOnly
    ? null
    : { href: `${destination.pathname}${destination.search}${destination.hash}` }
}

/**
 * Captures only a still-connected focusable target. The target is captured by
 * the intent creator, before Radix moves focus into the decision dialog.
 */
export function getConnectedVisualFocusTarget(target) {
  return target
    && target.isConnected === true
    && typeof target.focus === "function"
    ? target
    : null
}

/**
 * Resolves one observable history move. The browser is restored with
 * `history.go(restoreDelta)`; the original `historyDelta` is retained by the
 * pending intent and resumed once after Apply or Discard. No history entry or
 * Next-owned state is created, replaced, or truncated.
 *
 * @param {{
 *   currentIndex?: number | null,
 *   targetIndex?: number | null,
 *   restoring?: boolean,
 *   blocked?: boolean,
 * }} input
 */
export function getVisualDraftHistoryTransition({
  currentIndex,
  targetIndex,
  restoring = false,
  blocked = false,
} = {}) {
  const current = finiteIndex(currentIndex)
  const target = finiteIndex(targetIndex)
  if (current === null || target === null || current === target) {
    return {
      restoring: false,
      restoreDelta: 0,
      historyDelta: null,
      notify: false,
    }
  }
  return {
    restoring: true,
    restoreDelta: current - target,
    historyDelta: restoring || blocked ? null : target - current,
    notify: !restoring && !blocked,
  }
}

/**
 * Reads a navigation index only when the host already exposes one. This helper
 * deliberately does not stamp or replace Next.js history state.
 *
 * @param {{
 *   navigationIndex?: number | null,
 *   historyStateIndex?: number | null,
 * }} input
 */
export function getObservableVisualHistoryIndex({
  navigationIndex,
  historyStateIndex,
} = {}) {
  return finiteIndex(navigationIndex) ?? finiteIndex(historyStateIndex)
}

/**
 * Installs the dirty-only listeners as one idempotently disposable group.
 * Dependency injection keeps add/remove symmetry executable without a browser.
 *
 * @param {{
 *   documentTarget: Pick<Document, "addEventListener" | "removeEventListener">,
 *   windowTarget: Pick<Window, "addEventListener" | "removeEventListener">,
 *   onClick: EventListener,
 *   onBeforeUnload: EventListener,
 *   onPopState?: EventListener | null,
 * }} input
 */
export function installVisualDraftNavigationListeners({
  documentTarget,
  windowTarget,
  onClick,
  onBeforeUnload,
  onPopState = null,
}) {
  let active = true
  documentTarget.addEventListener("click", onClick, true)
  windowTarget.addEventListener("beforeunload", onBeforeUnload)
  if (onPopState) {
    windowTarget.addEventListener("popstate", onPopState)
  }
  return () => {
    if (!active) return
    active = false
    documentTarget.removeEventListener("click", onClick, true)
    windowTarget.removeEventListener("beforeunload", onBeforeUnload)
    if (onPopState) {
      windowTarget.removeEventListener("popstate", onPopState)
    }
  }
}
