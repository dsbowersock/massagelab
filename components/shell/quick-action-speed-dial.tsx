"use client"

import * as React from "react"
import Link from "next/link"
import {
  BookOpen,
  Brain,
  CalendarDays,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  type LucideIcon,
  Map,
  Radio,
  Settings2,
  Timer,
  Wind,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { resolveQuickActionGroups } from "@/lib/quick-actions"

const quickActionIcons = {
  BookOpen,
  Brain,
  CalendarDays,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  Map,
  Radio,
  Settings2,
  Timer,
  Wind,
} satisfies Record<string, LucideIcon>

export function QuickActionSpeedDial({
  isSignedIn = false,
  onboarding,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  isSignedIn?: boolean
  onboarding?: { primaryRole?: unknown; useCases?: unknown; quickActions?: unknown }
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: React.RefObject<HTMLButtonElement | null>
}) {
  const groups = resolveQuickActionGroups({ signedIn: isSignedIn, onboarding })
  const [anchorStyle, setAnchorStyle] = React.useState<React.CSSProperties | undefined>(undefined)

  React.useLayoutEffect(() => {
    if (!open) {
      setAnchorStyle(undefined)
      return undefined
    }

    const updateAnchor = () => {
      const button = returnFocusRef.current
      if (!button) {
        setAnchorStyle(undefined)
        return
      }

      const rect = button.getBoundingClientRect()
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      // Anchor to the live trigger position so edge controls and bottom stacking cannot drift the dial away from +.
      const menuWidth = Math.min(352, Math.max(0, viewportWidth - 24))
      const anchorX = rect.left + rect.width / 2
      const clampedX = Math.min(Math.max(anchorX, menuWidth / 2 + 12), viewportWidth - menuWidth / 2 - 12)

      setAnchorStyle({
        left: `${clampedX}px`,
        bottom: `${Math.max(0, viewportHeight - rect.top + 12)}px`,
      })
    }

    updateAnchor()
    window.addEventListener("resize", updateAnchor)
    window.addEventListener("scroll", updateAnchor, true)
    window.visualViewport?.addEventListener("resize", updateAnchor)
    window.visualViewport?.addEventListener("scroll", updateAnchor)

    return () => {
      window.removeEventListener("resize", updateAnchor)
      window.removeEventListener("scroll", updateAnchor, true)
      window.visualViewport?.removeEventListener("resize", updateAnchor)
      window.visualViewport?.removeEventListener("scroll", updateAnchor)
    }
  }, [open, returnFocusRef])

  React.useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onOpenChange(false)
        returnFocusRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange, open, returnFocusRef])

  if (!open) return null

  return (
    <div
      className="ml-quick-action-layer fixed inset-0 z-[10030] bg-background/35 backdrop-blur-md"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="navigation"
        aria-label="Quick create actions"
        className="absolute flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col items-end gap-3"
        style={anchorStyle ?? { left: "50%", bottom: "calc(var(--ml-bottom-stack-height) + 4.75rem)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {groups.map((group) => (
          <section key={group.id} className="flex w-full flex-col items-end gap-2">
            <p className="mr-16 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur">
              {group.label}
            </p>
            {group.actions.map((action) => {
              const Icon = quickActionIcons[action.icon as keyof typeof quickActionIcons] ?? Settings2

              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className="group flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => onOpenChange(false)}
                >
                  <span className="max-w-[14rem] rounded-full border border-border/80 bg-background/95 px-3 py-2 text-right text-sm font-medium shadow-xl backdrop-blur transition group-hover:border-primary/60 group-hover:bg-accent">
                    {action.label}
                  </span>
                  <span className="flex size-12 items-center justify-center rounded-full border border-border/80 bg-card text-primary shadow-xl shadow-black/30 transition group-hover:border-primary/70 group-hover:bg-primary/15">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                </Link>
              )
            })}
          </section>
        ))}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-12 rounded-full shadow-xl"
          aria-label="Close quick actions"
          onClick={() => {
            onOpenChange(false)
            returnFocusRef.current?.focus()
          }}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
