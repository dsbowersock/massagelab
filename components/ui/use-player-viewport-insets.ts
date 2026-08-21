"use client"

import { useSyncExternalStore } from "react"

type CollisionPadding = number | Partial<Record<"top" | "right" | "bottom" | "left", number>>

/**
 * Preserves caller-owned collision padding while adding the CSS-owned player
 * exclusion to the physical right edge.
 */
export function withPlayerViewportCollisionPadding(
  collisionPadding: CollisionPadding | undefined,
  rightInset: number,
): CollisionPadding | undefined {
  if (collisionPadding === undefined) {
    if (rightInset === 0) return undefined

    return { top: 8, right: rightInset + 8, bottom: 8, left: 8 }
  }

  if (typeof collisionPadding === "number") {
    return {
      top: collisionPadding,
      right: collisionPadding + rightInset,
      bottom: collisionPadding,
      left: collisionPadding,
    }
  }

  return {
    ...collisionPadding,
    right: (collisionPadding.right ?? 0) + rightInset,
  }
}

type InsetListener = () => void

const insetListeners = new Set<InsetListener>()
let cachedRightInset = 0
let insetObserver: MutationObserver | null = null

function readRightInset() {
  const serializedValue = getComputedStyle(document.body)
    .getPropertyValue("--ml-player-right-safe")
    .trim()
  let value = /^-?(?:\d+|\d*\.\d+)px$/i.test(serializedValue)
    ? Number.parseFloat(serializedValue)
    : Number.NaN
  if (!Number.isFinite(value)) {
    // Computed custom properties retain calc()/clamp() tokens. A temporary
    // layout probe resolves that CSS-owned expression to physical pixels.
    const probe = document.createElement("div")
    probe.style.cssText = "position:fixed;visibility:hidden;width:var(--ml-player-right-safe);"
    document.body.appendChild(probe)
    value = probe.getBoundingClientRect().width
    probe.remove()
  }
  return Number.isFinite(value) ? value : 0
}

function updateRightInset() {
  const nextRight = readRightInset()
  if (nextRight === cachedRightInset) return
  cachedRightInset = nextRight
  for (const listener of insetListeners) listener()
}

function subscribeToRightInset(listener: InsetListener) {
  insetListeners.add(listener)
  if (insetListeners.size === 1) {
    // The first consumer owns the shared observers and initializes the cache
    // before overlays read it for collision padding.
    insetObserver = new MutationObserver(updateRightInset)
    insetObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    window.addEventListener("resize", updateRightInset)
    updateRightInset()
  }
  return () => {
    insetListeners.delete(listener)
    if (insetListeners.size === 0) {
      // The last consumer releases the global observers so this shared helper
      // does not retain document or window listeners while overlays are idle.
      insetObserver?.disconnect()
      insetObserver = null
      window.removeEventListener("resize", updateRightInset)
    }
  }
}

/** Reads the shared CSS-owned player exclusion inset for Radix collision padding. */
export function usePlayerViewportInsets() {
  const right = useSyncExternalStore(
    subscribeToRightInset,
    () => cachedRightInset,
    () => 0,
  )
  return { right }
}
