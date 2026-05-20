"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarCog, CalendarDays, Clock, ListChecks, LogIn, Plus, Settings2 } from "lucide-react"
import { useCalendarOperatorToolbarSlot } from "@/components/calendar/calendar-operator-toolbar-context"
import type { SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const ROUTE_ACTIONS = [
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/calendar/new", label: "New", icon: Plus },
  { href: "/calendar/availability", label: "Availability", icon: Clock },
  { href: "/calendar/services", label: "Services", icon: Settings2 },
  { href: "/calendar/booking", label: "Booking", icon: CalendarCog },
  { href: "/calendar/requests", label: "Requests", icon: ListChecks },
] as const

function initials(name: string, email: string) {
  const source = name || email
  if (!source) return "ML"

  return source
    .replace(/@.*/, "")
    .split(/\s+|[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ML"
}

function routeTitle(pathname: string) {
  if (pathname.startsWith("/calendar/availability")) return "Availability"
  if (pathname.startsWith("/calendar/services")) return "Services"
  if (pathname.startsWith("/calendar/booking")) return "Booking"
  if (pathname.startsWith("/calendar/requests")) return "Requests"
  if (pathname.startsWith("/calendar/new")) return "Create"
  return "Calendar"
}

export function CalendarOperatorTopBar({ user }: { user: SidebarUser }) {
  const pathname = usePathname() ?? "/calendar"
  const { renderMode, toggleSidebar } = useSidebar()
  const headerRef = useRef<HTMLElement | null>(null)
  const primaryRowRef = useRef<HTMLDivElement | null>(null)
  const leadingControlsRef = useRef<HTMLDivElement | null>(null)
  const primaryToolbarMeasureRef = useRef<HTMLDivElement | null>(null)
  const secondaryToolbarRef = useRef<HTMLDivElement | null>(null)
  const actionClusterRef = useRef<HTMLDivElement | null>(null)
  const [controlsOverflowing, setControlsOverflowing] = useState(false)
  const userName = user?.name || "Account"
  const userEmail = user?.email || ""
  const showNavigationToggle = renderMode === "drawer"
  const toolbarSlot = useCalendarOperatorToolbarSlot()
  const hasToolbarSlot = Boolean(toolbarSlot)

  const updateToolbarPlacement = useCallback(() => {
    const primaryRow = primaryRowRef.current
    const primaryToolbar = primaryToolbarMeasureRef.current

    if (!primaryRow || !primaryToolbar || !hasToolbarSlot) {
      setControlsOverflowing(false)
      return
    }

    const leadingWidth = leadingControlsRef.current?.getBoundingClientRect().width ?? 0
    const actionsWidth = actionClusterRef.current?.getBoundingClientRect().width ?? 0
    const secondaryToolbarWidth = secondaryToolbarRef.current?.scrollWidth ?? 0
    const toolbarContentWidth = controlsOverflowing
      ? secondaryToolbarWidth
      : primaryToolbar.scrollWidth
    const rowWidth = primaryRow.clientWidth
    const primaryToolbarFits = primaryToolbar.scrollWidth <= primaryToolbar.clientWidth + 4
    const restoreWidth = leadingWidth + actionsWidth + toolbarContentWidth + 44

    setControlsOverflowing((current) => {
      if (current) {
        if (toolbarContentWidth <= 0) return true
        return restoreWidth > rowWidth
      }

      return !primaryToolbarFits
    })
  }, [controlsOverflowing, hasToolbarSlot])

  useEffect(() => {
    updateToolbarPlacement()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateToolbarPlacement)
      return () => window.removeEventListener("resize", updateToolbarPlacement)
    }

    const resizeObserver = new ResizeObserver(updateToolbarPlacement)
    const targets = [
      headerRef.current,
      primaryRowRef.current,
      primaryToolbarMeasureRef.current,
      secondaryToolbarRef.current,
      actionClusterRef.current,
      leadingControlsRef.current,
    ]

    for (const target of targets) {
      if (target) resizeObserver.observe(target)
    }

    window.addEventListener("resize", updateToolbarPlacement)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateToolbarPlacement)
    }
  }, [updateToolbarPlacement, toolbarSlot])

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(updateToolbarPlacement)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [updateToolbarPlacement, pathname, toolbarSlot])

  const accountControl = user ? (
    <Button asChild variant="outline" size="icon" className="shrink-0 rounded-full">
      <Link href="/account" aria-label="Account" title="Account">
        <Avatar className="size-8">
          {user.image && <AvatarImage src={user.image} alt={userName} />}
          <AvatarFallback>{initials(userName, userEmail)}</AvatarFallback>
        </Avatar>
      </Link>
    </Button>
  ) : (
    <Button asChild variant="outline" size="sm" className="shrink-0">
      <Link href="/login">
        <LogIn data-icon="inline-start" />
        Sign in
      </Link>
    </Button>
  )

  const routeActions = (
    <TooltipProvider delayDuration={150}>
      <nav className="flex shrink-0 items-center gap-1" aria-label="Calendar navigation">
        {ROUTE_ACTIONS.map((action) => {
          const active = action.href === "/calendar"
            ? pathname === "/calendar"
            : pathname.startsWith(action.href)
          const Icon = action.icon

          return (
            <Tooltip key={action.href}>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  size="icon"
                  variant={active ? "secondary" : "ghost"}
                  className={cn("h-11 w-11 shrink-0", active && "text-foreground")}
                >
                  <Link href={action.href} aria-label={action.label}>
                    <Icon data-icon="inline-start" />
                    <span className="sr-only">{action.label}</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )

  const secondaryToolbar = controlsOverflowing && hasToolbarSlot ? (
    <div className="ml-calendar-medial-toolbar border-t border-border/60 bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
      <div ref={secondaryToolbarRef} className="flex min-w-0 items-center">
        {toolbarSlot}
      </div>
    </div>
  ) : null

  return (
    <header ref={headerRef} className="relative z-30 border-b border-border/70 bg-background/95 shadow-sm backdrop-blur">
      <div ref={primaryRowRef} className="flex min-h-16 items-center gap-2 px-3 sm:px-4">
        <div ref={leadingControlsRef} className="flex shrink-0 items-center">
          {showNavigationToggle ? (
            <Button type="button" variant="outline" size="icon" onClick={toggleSidebar} aria-label="Open navigation">
              <Image
                src="/brand/massagelab-mark-square-tight.png"
                alt=""
                width={28}
                height={28}
                className="object-contain"
                sizes="28px"
              />
            </Button>
          ) : null}
        </div>

        <span className="sr-only">{routeTitle(pathname)} practice scheduling</span>

        <div ref={primaryToolbarMeasureRef} className="flex min-w-0 flex-1 items-center overflow-hidden">
          {controlsOverflowing ? null : toolbarSlot}
        </div>

        <div ref={actionClusterRef} className="flex shrink-0 items-center gap-2">
          {routeActions}
          {accountControl}
        </div>
      </div>
      {secondaryToolbar}
    </header>
  )
}
