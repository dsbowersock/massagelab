"use client"

import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import Image from "next/image"
import Link from "next/link"
import { LogIn } from "lucide-react"
import { CalendarOperatorTopBar } from "@/components/calendar/calendar-operator-top-bar"
import { CalendarOperatorToolbarProvider } from "@/components/calendar/calendar-operator-toolbar-context"
import { MovingBackground } from "@/components/moving-background"
import { useSettings } from "@/components/providers/settings-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSidebar } from "@/components/ui/sidebar"
import type { SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

function initials(name: string, email: string) {
  const source = name || email

  if (!source) {
    return "ML"
  }

  const parts = source
    .replace(/@.*/, "")
    .split(/\s+|[._-]+/)
    .filter(Boolean)

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ML"
}

function PortraitSidebarBar({ user }: { user: SidebarUser }) {
  const { settings } = useSettings()
  const { renderMode, toggleSidebar } = useSidebar()
  const alignsRight = settings.sidebarPosition === "right"
  const alignsBottom = settings.sidebarTriggerPosition === "bottom"

  if (renderMode !== "drawer") {
    return null
  }

  const userName = user?.name || "Account"
  const userEmail = user?.email || ""
  const accountControl = user ? (
    <Link
      href="/account"
      aria-label="Account"
      title="Account"
      className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-border/70 bg-background/90 px-1 text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Avatar className="h-8 w-8">
        {user.image && <AvatarImage src={user.image} alt={userName} />}
        <AvatarFallback>{initials(userName, userEmail)}</AvatarFallback>
      </Avatar>
    </Link>
  ) : (
    <Link
      href="/login"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <LogIn className="h-4 w-4" />
      <span>Sign in</span>
    </Link>
  )

  const logoTrigger = (
    <button
      type="button"
      aria-label="Open sidebar"
      title="Open sidebar"
      onClick={toggleSidebar}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/90 text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Image
        src="/brand/massagelab-mark-square-tight.png"
        alt=""
        width={32}
        height={32}
        className="object-contain"
        sizes="32px"
      />
    </button>
  )

  return (
    <div
      className={cn(
        "ml-portrait-sidebar-bar fixed inset-x-0 z-30 flex items-center justify-between border-border/70 bg-background/90 px-3 py-2 shadow-lg backdrop-blur",
        alignsBottom
          ? "bottom-0 border-t pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
          : "top-0 border-b pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]",
      )}
    >
      {alignsRight ? (
        <>
          {accountControl}
          {logoTrigger}
        </>
      ) : (
        <>
          {logoTrigger}
          {accountControl}
        </>
      )}
    </div>
  )
}

function RouteWordmark({ visible, wordmarkRef }: { visible: boolean; wordmarkRef: RefObject<HTMLAnchorElement | null> }) {
  if (!visible) {
    return null
  }

  return (
    <Link
      href="/"
      aria-label="MassageLab home"
      ref={wordmarkRef}
      className="ml-route-wordmark fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.7rem)] z-20 rounded-sm px-2 py-1"
    >
      <Image
        src="/brand/massagelab-wordmark-uppercase-tight.png"
        alt="MassageLab"
        width={180}
        height={54}
        className="h-8 w-auto object-contain drop-shadow-[0_0_20px_hsl(var(--brand-orange-glow)/0.18)]"
        data-testid="route-brand-wordmark"
        style={{ viewTransitionName: "massagelab-wordmark" }}
        sizes="180px"
      />
    </Link>
  )
}

export function LayoutWrapper({ children, user }: { children: ReactNode; user: SidebarUser }) {
  const pathname = usePathname() ?? ""
  const { settings } = useSettings()
  const { renderMode } = useSidebar()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const wordmarkRef = useRef<HTMLAnchorElement | null>(null)
  const isHomePage = pathname === "/"
  const isCalendarOperatorRoute = pathname === "/calendar" || pathname.startsWith("/calendar/")
  const isCalendarWorkspaceRoute = pathname === "/calendar"
  const isPublicBookingRoute = pathname.startsWith("/book/")
  const showRouteWordmark = !isHomePage && !isCalendarOperatorRoute
  const routeOwnsBackground = pathname.startsWith("/chimer") || pathname.startsWith("/anatomime")
  const hasPortraitBar = renderMode === "drawer" && !isCalendarOperatorRoute
  const portraitBarAtBottom = settings.sidebarTriggerPosition === "bottom"

  useEffect(() => {
    if (!showRouteWordmark) {
      return
    }

    const scrollElement = scrollRef.current
    const contentElement = contentRef.current
    const wordmarkElement = wordmarkRef.current

    if (!scrollElement || !contentElement || !wordmarkElement) {
      return
    }

    let animationFrame = 0

    const getFirstPageElement = () => {
      for (const child of Array.from(contentElement.children)) {
        if (child instanceof HTMLElement) {
          return child
        }
      }

      return contentElement
    }

    const updateWordmarkVisibility = () => {
      animationFrame = 0

      const scrollRect = scrollElement.getBoundingClientRect()
      const firstPageElement = getFirstPageElement()
      const firstPageElementTop = firstPageElement.getBoundingClientRect().top - scrollRect.top + scrollElement.scrollTop
      const fadeDistance = Math.max(24, firstPageElementTop * 0.85)
      const progress = Math.min(Math.max(scrollElement.scrollTop / fadeDistance, 0), 1)
      const opacity = Math.max(0, 1 - progress)

      wordmarkElement.style.setProperty("--ml-route-wordmark-scroll-opacity", opacity.toFixed(3))
      wordmarkElement.style.setProperty("--ml-route-wordmark-scroll-y", `${(-0.35 * progress).toFixed(3)}rem`)

      if (progress >= 1) {
        wordmarkElement.style.pointerEvents = "none"
        wordmarkElement.setAttribute("aria-hidden", "true")
        wordmarkElement.setAttribute("tabindex", "-1")
        return
      }

      wordmarkElement.style.pointerEvents = ""
      wordmarkElement.removeAttribute("aria-hidden")
      wordmarkElement.removeAttribute("tabindex")
    }

    const scheduleWordmarkUpdate = () => {
      if (animationFrame) {
        return
      }

      animationFrame = window.requestAnimationFrame(updateWordmarkVisibility)
    }

    scheduleWordmarkUpdate()
    scrollElement.addEventListener("scroll", scheduleWordmarkUpdate, { passive: true })
    window.addEventListener("resize", scheduleWordmarkUpdate)

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleWordmarkUpdate)
      : null
    const firstPageElement = getFirstPageElement()

    resizeObserver?.observe(contentElement)
    if (firstPageElement !== contentElement) {
      resizeObserver?.observe(firstPageElement)
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      scrollElement.removeEventListener("scroll", scheduleWordmarkUpdate)
      window.removeEventListener("resize", scheduleWordmarkUpdate)
      resizeObserver?.disconnect()
    }
  }, [pathname, showRouteWordmark])

  const shell = (
    <div className="ml-app-shell relative isolate flex h-full w-full flex-col overflow-hidden bg-background">
      {!routeOwnsBackground && (
        <>
          <MovingBackground
            className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen"
            testId="app-moving-background"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[1] bg-background/80"
          />
        </>
      )}
      {isCalendarOperatorRoute ? <CalendarOperatorTopBar user={user} /> : <PortraitSidebarBar user={user} />}
      <RouteWordmark visible={showRouteWordmark} wordmarkRef={wordmarkRef} />
      <div
        ref={scrollRef}
        className={cn(
          "ml-app-scroll relative z-10 min-h-0 w-full flex-1 overscroll-contain",
          isCalendarWorkspaceRoute ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        <div
          ref={contentRef}
          className={cn(
            "ml-app-content mx-auto w-full",
            isCalendarOperatorRoute || isPublicBookingRoute ? "max-w-none" : "max-w-screen-2xl",
            isCalendarWorkspaceRoute && "h-full min-h-0 pb-0",
            hasPortraitBar && portraitBarAtBottom && "pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]",
            hasPortraitBar && !portraitBarAtBottom
              ? "pt-[calc(env(safe-area-inset-top,0px)+4.5rem)]"
              : showRouteWordmark && "pt-[calc(env(safe-area-inset-top,0px)+3.75rem)]",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )

  return isCalendarOperatorRoute ? (
    <CalendarOperatorToolbarProvider>{shell}</CalendarOperatorToolbarProvider>
  ) : shell
}

