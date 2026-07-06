"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { CalendarOperatorTopBar } from "@/components/calendar/calendar-operator-top-bar"
import { CalendarOperatorToolbarProvider } from "@/components/calendar/calendar-operator-toolbar-context"
import { MovingBackground } from "@/components/moving-background"
import { MusicMiniPlayer } from "@/components/providers/music-mini-player"
import { useSettings } from "@/components/providers/settings-provider"
import { MobileMainBar } from "@/components/shell/mobile-main-bar"
import type { SidebarNavigation, SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { getMusicPlayerPlacement } from "@/lib/app-shell"
import { cn } from "@/lib/utils"

export function LayoutWrapper({
  children,
  navigation,
  user,
}: {
  children: ReactNode
  navigation: SidebarNavigation
  user: SidebarUser
}) {
  const pathname = usePathname() ?? ""
  const { settings } = useSettings()
  const isCalendarOperatorRoute = pathname === "/calendar" || pathname.startsWith("/calendar/")
  const isCalendarWorkspaceRoute = pathname === "/calendar"
  const isPublicBookingRoute = pathname.startsWith("/book/")
  const isChimerRoute = pathname.startsWith("/chimer") || pathname.startsWith("/clock")
  const routeOwnsBackground = isChimerRoute
    || pathname.startsWith("/anatomime")
  // Active Chimer and Clock views hide global bars with body classes; clear stale classes after route changes.
  useEffect(() => {
    if (!isChimerRoute) {
      document.body.classList.remove("chimer-running", "chimer-alerting")
    }
  }, [isChimerRoute])

  // Chimer and Clock setup still need bottom controls; active states hide them by body class.
  const routeShowsMobileMainBar = !routeOwnsBackground
    || isChimerRoute
  const appBarIsBottom = settings.appBarPosition === "bottom"
  const musicPlayerPlacement = getMusicPlayerPlacement(settings)
  const appBar = <CalendarOperatorTopBar user={user} calendarActions={navigation.calendarSidebarActions} />

  const shell = (
    <div
      className="ml-app-shell relative isolate flex h-full w-full flex-col overflow-hidden bg-background"
      data-app-bar-position={settings.appBarPosition}
      data-main-bar-visible={routeShowsMobileMainBar ? "true" : "false"}
    >
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
      {!appBarIsBottom && appBar}
      <div
        className={cn(
          "ml-app-scroll relative z-10 min-h-0 w-full flex-1 overscroll-contain",
          isCalendarWorkspaceRoute ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        <div
          className={cn(
            "ml-app-content mx-auto w-full",
            isCalendarOperatorRoute || isPublicBookingRoute ? "max-w-none" : "max-w-screen-2xl",
            isCalendarWorkspaceRoute && "h-full min-h-0 pb-0",
          )}
        >
          {children}
        </div>
      </div>
      {appBarIsBottom && appBar}
      {routeShowsMobileMainBar && <MobileMainBar user={user} />}
      <MusicMiniPlayer placement={musicPlayerPlacement} />
    </div>
  )

  return isCalendarOperatorRoute ? (
    <CalendarOperatorToolbarProvider>{shell}</CalendarOperatorToolbarProvider>
  ) : shell
}
