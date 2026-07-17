"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  CalendarCog,
  CalendarDays,
  Clock,
  ListChecks,
  Music2,
  PanelLeft,
  PanelRight,
  Plus,
  Settings2,
} from "lucide-react"
import { useCalendarOperatorToolbarSlot } from "@/components/calendar/calendar-operator-toolbar-context"
import { useResolvedTheme, useSettings } from "@/components/providers/settings-provider"
import type { SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { useSidebarCalendarContext } from "@/components/sidebar/sidebar-calendar-provider"
import { ThemeSwitcherMultiButton } from "@/components/theme-switcher-multi-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { QuickActionSpeedDial } from "@/components/shell/quick-action-speed-dial"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { isNavigationRouteActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const routeIcons = {
  CalendarCog,
  CalendarDays,
  Clock,
  ListChecks,
  Plus,
  Settings2,
}

type CalendarAction = {
  id: string
  href: string
  label: string
  icon: string
}

type TopbarBreadcrumb = {
  label: string
  href?: string
}

const segmentLabels: Record<string, string> = {
  about: "About",
  account: "Account",
  admin: "Admin",
  anatomime: "Anatomime",
  anatomy: "Anatomy",
  appointment: "Appointment",
  availability: "Availability",
  book: "Booking",
  booking: "Booking",
  browse: "Browse",
  calendar: "Calendar",
  chimer: "Chimer",
  class: "Class",
  clock: "Clock",
  corrections: "Corrections",
  derrick: "Derrick",
  "forgot-password": "Forgot password",
  intake: "Intake",
  journal: "Journal",
  login: "Login",
  music: "Music",
  new: "Create",
  notes: "Notes",
  personal: "Personal event",
  pricing: "Pricing",
  register: "Create account",
  reminder: "Reminder",
  requests: "Requests",
  roadmap: "Roadmap",
  rom: "ROM",
  security: "Security",
  services: "Services",
  settings: "Settings",
  soap: "SOAP",
  support: "User Support",
  "verify-email": "Verify email",
}

function labelSegment(segment: string, previousSegment?: string) {
  if (previousSegment === "services" && segment !== "new") return "Service"
  if (previousSegment === "book") return "Practice"

  return segmentLabels[segment] ?? segment
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function routeBreadcrumbs(pathname: string): TopbarBreadcrumb[] {
  const path = pathname.split(/[?#]/)[0] || "/"

  if (path === "/") {
    return [{ label: "Home" }]
  }

  if (path === "/pricing") {
    return [{ label: "About", href: "/about" }, { label: "Pricing" }]
  }

  if (path === "/roadmap") {
    return [{ label: "About", href: "/about" }, { label: "Roadmap" }]
  }

  if (path === "/support") {
    return [{ label: "Account", href: "/account" }, { label: "User Support" }]
  }

  if (path === "/login" || path === "/register" || path === "/forgot-password" || path === "/reset-password" || path === "/verify-email") {
    return [
      { label: "Account", href: "/account" },
      { label: labelSegment(path.slice(1)) },
    ]
  }

  const segments = path.split("/").filter(Boolean)
  const crumbs: TopbarBreadcrumb[] = []

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const href = `/${segments.slice(0, index + 1).join("/")}`
    const previousSegment = segments[index - 1]
    const isLast = index === segments.length - 1

    crumbs.push({
      label: labelSegment(segment, previousSegment),
      href: isLast ? undefined : href,
    })
  }

  return crumbs
}

function compactCount(count: number) {
  if (count > 99) {
    return "99+"
  }

  return String(count)
}

function formatCalendarDateParam(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseCalendarDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return date
}

function CalendarDrawerButton({
  calendarActions,
  user,
  side,
}: {
  calendarActions: CalendarAction[]
  user: SidebarUser
  side: "left" | "right"
}) {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const { calendarContext } = useSidebarCalendarContext()
  const pendingAppointmentRequestCount = calendarContext.pendingAppointmentRequestCount ?? 0
  const openWaitlistEntryCount = calendarContext.openWaitlistEntryCount ?? 0
  const hasActionableRequests = pendingAppointmentRequestCount > 0 || openWaitlistEntryCount > 0

  const updateOpen = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen || pathname !== "/calendar") return

    const nextDate = parseCalendarDateParam(new URLSearchParams(window.location.search).get("date"))
    if (nextDate) {
      setSelectedDate(nextDate)
    }
  }, [pathname])

  const selectCalendarDate = useCallback((date: Date | undefined) => {
    setSelectedDate(date)

    if (!date) return

    const params = new URLSearchParams(pathname === "/calendar" ? window.location.search : "")
    params.set("date", formatCalendarDateParam(date))
    router.push(`/calendar?${params.toString()}`)
    setOpen(false)
  }, [pathname, router])

  return (
    <Sheet open={open} onOpenChange={updateOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ctaBlue"
            size="icon"
            className="relative h-10 w-10 shrink-0"
            aria-label="Open calendar"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => updateOpen(true)}
          >
            <CalendarDays data-icon="inline-start" />
            {hasActionableRequests && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--background))]"
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Calendar</TooltipContent>
      </Tooltip>
      <SheetContent
        side={side}
        data-sidebar-floating="true"
        className="w-[min(19rem,calc(100vw-1rem))] overflow-y-auto p-0 sm:max-w-[19rem]"
      >
        <div className="flex min-h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <SheetHeader className="min-w-0 space-y-1 text-left">
              <SheetTitle className="truncate text-base">
                {calendarContext.practice?.name ?? "Calendar"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {user ? "Scheduling shortcuts and request status" : "Sign in to manage scheduling"}
              </SheetDescription>
            </SheetHeader>
            {hasActionableRequests && (
              <div className="flex shrink-0 items-center gap-1 pt-1">
                {pendingAppointmentRequestCount > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    R {compactCount(pendingAppointmentRequestCount)}
                  </Badge>
                )}
                {openWaitlistEntryCount > 0 && (
                  <Badge variant="outline" className="bg-background/70 px-1.5 py-0 text-[10px]">
                    W {compactCount(openWaitlistEntryCount)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {!user ? (
            <div className="rounded-md border border-border/70 bg-card/70 p-3 text-sm text-muted-foreground">
              <p>Calendar shortcuts and request counts are available after sign in.</p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={selectCalendarDate}
                className="mx-auto w-full rounded-md border border-border/70 bg-background/70 p-2 text-sm [--cell-size:1.65rem]"
              />

              <div className="grid gap-1">
                {calendarActions.map((action) => {
                  const Icon = routeIcons[action.icon as keyof typeof routeIcons] ?? CalendarDays
                  const active = action.href === "/calendar"
                    ? pathname === "/calendar"
                    : isNavigationRouteActive(pathname, action.href)

                  return (
                    <Button
                      key={action.id}
                      asChild
                      size="sm"
                      variant={active ? "secondary" : "ghost"}
                      className="h-9 justify-start text-sm"
                    >
                      <Link href={action.href} onClick={() => setOpen(false)}>
                        <Icon data-icon="inline-start" />
                        {action.label}
                        {action.id === "calendar-requests" && hasActionableRequests && (
                          <span className="ml-auto flex items-center gap-1">
                            {pendingAppointmentRequestCount > 0 && (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                R {compactCount(pendingAppointmentRequestCount)}
                              </Badge>
                            )}
                            {openWaitlistEntryCount > 0 && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                W {compactCount(openWaitlistEntryCount)}
                              </Badge>
                            )}
                          </span>
                        )}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function CalendarOperatorTopBar({
  calendarActions,
  user,
}: {
  calendarActions: CalendarAction[]
  user: SidebarUser
}) {
  const pathname = usePathname() ?? "/"
  const { settings } = useSettings()
  const resolvedTheme = useResolvedTheme()
  const { renderMode, state, toggleSidebar } = useSidebar()
  const headerRef = useRef<HTMLElement | null>(null)
  const primaryRowRef = useRef<HTMLDivElement | null>(null)
  const leadingControlsRef = useRef<HTMLDivElement | null>(null)
  const primaryToolbarMeasureRef = useRef<HTMLDivElement | null>(null)
  const secondaryToolbarRef = useRef<HTMLDivElement | null>(null)
  const actionClusterRef = useRef<HTMLDivElement | null>(null)
  const quickActionButtonRef = useRef<HTMLButtonElement | null>(null)
  const [controlsOverflowing, setControlsOverflowing] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const toolbarSlot = useCalendarOperatorToolbarSlot()
  const hasToolbarSlot = Boolean(toolbarSlot)
  const sidebarIsRight = settings.sidebarPosition === "right"
  const appBarIsBottom = settings.appBarPosition === "bottom"
  const SidebarToggleIcon = sidebarIsRight ? PanelRight : PanelLeft
  const breadcrumbs = routeBreadcrumbs(pathname)
  const pageLabel = breadcrumbs.map((breadcrumb) => breadcrumb.label).join(" / ")

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
    const restoreWidth = leadingWidth + actionsWidth + toolbarContentWidth + 32

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

  const sidebarControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={resolvedTheme === "dark" ? "glow" : "default"}
          size="icon"
          data-sidebar-control="true"
          onClick={toggleSidebar}
          aria-label={renderMode === "drawer" ? "Open navigation" : state === "expanded" ? "Dock navigation" : "Expand navigation"}
          className="ml-shell-compact-control shrink-0"
        >
          <SidebarToggleIcon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{renderMode === "drawer" ? "Open navigation" : "Toggle navigation"}</TooltipContent>
    </Tooltip>
  )

  const calendarControl = (
    <CalendarDrawerButton calendarActions={calendarActions} user={user} side={sidebarIsRight ? "left" : "right"} />
  )
  const musicControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ctaBlue"
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          <Link href="/music" aria-label="Open music">
            <Music2 data-icon="inline-start" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Music</TooltipContent>
    </Tooltip>
  )
  const clockControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ctaBlue"
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          <Link href="/clock" aria-label="Open clock">
            <Clock data-icon="inline-start" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Clock</TooltipContent>
    </Tooltip>
  )
  const quickActionControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={quickActionButtonRef}
          type="button"
          variant="default"
          size="icon"
          className="h-10 w-10 shrink-0"
          data-quick-action-trigger="true"
          aria-label="Open quick actions"
          aria-expanded={quickActionsOpen}
          onClick={() => setQuickActionsOpen((current) => !current)}
        >
          <Plus data-icon="inline-start" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Quick actions</TooltipContent>
    </Tooltip>
  )
  const oppositeControls = (
    <div className="flex shrink-0 items-center gap-1 min-[361px]:gap-2">
      {sidebarIsRight ? <ThemeSwitcherMultiButton /> : null}
      {quickActionControl}
      {musicControl}
      {clockControl}
      {calendarControl}
      {!sidebarIsRight ? <ThemeSwitcherMultiButton /> : null}
    </div>
  )

  const leadingControl = sidebarIsRight ? oppositeControls : sidebarControl
  const trailingControl = sidebarIsRight ? sidebarControl : oppositeControls

  const secondaryToolbar = controlsOverflowing && hasToolbarSlot ? (
    <div
      className={cn(
        "ml-calendar-medial-toolbar bg-background/95 px-3 py-2 backdrop-blur sm:px-4",
        appBarIsBottom ? "border-b border-border/60" : "border-t border-border/60",
      )}
    >
      <div ref={secondaryToolbarRef} className="flex min-w-0 items-center">
        {toolbarSlot}
      </div>
    </div>
  ) : null

  return (
    <TooltipProvider delayDuration={150}>
      <QuickActionSpeedDial
        isSignedIn={Boolean(user)}
        onboarding={user?.quickActionOnboarding}
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        returnFocusRef={quickActionButtonRef}
      />
      <header
        ref={headerRef}
        className={cn(
          "ml-app-topbar relative z-30 hidden bg-background/95 shadow-sm backdrop-blur md:block",
          appBarIsBottom ? "border-t border-border/70" : "border-b border-border/70",
        )}
      >
        <div ref={primaryRowRef} className="flex min-h-14 items-center gap-2 px-3 sm:px-4">
          <div ref={leadingControlsRef} className="flex shrink-0 items-center">
            {leadingControl}
          </div>

          <span className="sr-only">{pageLabel}</span>

          <div className="flex min-w-0 flex-1 items-center">
            <div ref={primaryToolbarMeasureRef} className="flex min-w-0 flex-1 items-center overflow-hidden">
              {controlsOverflowing ? null : toolbarSlot}
            </div>
          </div>

          <div ref={actionClusterRef} className="flex shrink-0 items-center">
            {trailingControl}
          </div>
        </div>
        {secondaryToolbar}
      </header>
    </TooltipProvider>
  )
}
