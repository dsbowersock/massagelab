"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { CalendarOperatorTopBar } from "@/components/calendar/calendar-operator-top-bar"
import { CalendarOperatorToolbarProvider } from "@/components/calendar/calendar-operator-toolbar-context"
import { MovingBackground } from "@/components/moving-background"
import type { SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { cn } from "@/lib/utils"

export function LayoutWrapper({ children, user }: { children: ReactNode; user: SidebarUser }) {
  const pathname = usePathname() ?? ""
  const isCalendarOperatorRoute = pathname === "/calendar" || pathname.startsWith("/calendar/")
  const isCalendarWorkspaceRoute = pathname === "/calendar"
  const isPublicBookingRoute = pathname.startsWith("/book/")
  const routeOwnsBackground = pathname.startsWith("/chimer") || pathname.startsWith("/anatomime")

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
      <CalendarOperatorTopBar user={user} />
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
    </div>
  )

  return isCalendarOperatorRoute ? (
    <CalendarOperatorToolbarProvider>{shell}</CalendarOperatorToolbarProvider>
  ) : shell
}
