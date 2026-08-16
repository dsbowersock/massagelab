"use client"

import { useEffect, useState } from "react"

type CollisionPadding = number | Partial<Record<"top" | "right" | "bottom" | "left", number>>

/**
 * Preserves caller-owned collision padding while adding the CSS-owned player
 * exclusion to the physical right edge.
 */
export function withPlayerViewportCollisionPadding(
  collisionPadding: CollisionPadding | undefined,
  rightInset: number,
): CollisionPadding {
  if (collisionPadding === undefined) {
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

/** Reads the CSS-owned player exclusion inset for Radix collision padding. */
export function usePlayerViewportInsets() {
  const [right, setRight] = useState(0)

  useEffect(() => {
    const update = () => {
      const serializedValue = getComputedStyle(document.body)
        .getPropertyValue("--ml-player-right-safe")
      let value = Number.parseFloat(serializedValue)
      if (!Number.isFinite(value)) {
        // Computed custom properties retain calc()/clamp() tokens. A temporary
        // layout probe resolves that CSS-owned expression to physical pixels.
        const probe = document.createElement("div")
        probe.style.cssText = "position:fixed;visibility:hidden;width:var(--ml-player-right-safe);"
        document.body.appendChild(probe)
        value = probe.getBoundingClientRect().width
        probe.remove()
      }
      setRight(Number.isFinite(value) ? value : 0)
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    window.addEventListener("resize", update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])

  return { right }
}
