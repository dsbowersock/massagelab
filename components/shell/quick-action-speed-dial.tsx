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
  LogIn,
  type LucideIcon,
  Map,
  Radio,
  Settings2,
  Timer,
  UserPlus,
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
  LogIn,
  Map,
  Radio,
  Settings2,
  Timer,
  UserPlus,
  Wind,
} satisfies Record<string, LucideIcon>

const quickActionTriggerSelector = 'button[data-quick-action-trigger="true"][aria-expanded="true"]'

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
  const dialogRef = React.useRef<HTMLDivElement | null>(null)
  const [anchorStyle, setAnchorStyle] = React.useState<React.CSSProperties | undefined>(undefined)

  React.useLayoutEffect(() => {
    if (!open) {
      setAnchorStyle(undefined)
      return undefined
    }

    const updateAnchor = () => {
      const button = returnFocusRef.current
        ?? document.querySelector<HTMLButtonElement>(quickActionTriggerSelector)
      if (!button) {
        setAnchorStyle(undefined)
        return
      }

      const rect = button.getBoundingClientRect()
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const gap = 12
      // Anchor to the live trigger position so edge controls and bottom stacking cannot drift the dial away from +.
      const menuWidth = Math.min(352, Math.max(0, viewportWidth - 24))
      const anchorX = rect.left + rect.width / 2
      const clampedX = Math.min(Math.max(anchorX, menuWidth / 2 + gap), viewportWidth - menuWidth / 2 - gap)
      const spaceAbove = rect.top
      const spaceBelow = viewportHeight - rect.bottom
      const openAbove = spaceAbove >= spaceBelow
      const availableHeight = Math.max(160, (openAbove ? spaceAbove : spaceBelow) - (gap * 2))

      setAnchorStyle({
        left: `${clampedX}px`,
        maxHeight: `${availableHeight}px`,
        ...(openAbove
          ? { bottom: `${Math.max(0, viewportHeight - rect.top + gap)}px` }
          : { top: `${Math.max(gap, rect.bottom + gap)}px` }),
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
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])
    focusable()[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onOpenChange(false)
        returnFocusRef.current?.focus()
        return
      }
      if (event.key !== "Tab") return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange, open, returnFocusRef])

  if (!open) return null

  return (
    <div
      className="ml-quick-action-layer fixed inset-0 z-[10030] bg-background/35 backdrop-blur-md"
      onClick={() => {
        returnFocusRef.current?.focus()
        onOpenChange(false)
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick actions"
        className="absolute flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col items-end gap-3 overflow-y-auto overscroll-contain"
        style={anchorStyle ?? { left: "50%", bottom: "calc(var(--ml-bottom-stack-height) + 4.75rem)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <nav aria-label="Quick create actions" className="contents">
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
        </nav>
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
