"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, Clock, Home, Menu, Music2, Plus } from "lucide-react"
import { ThemeSwitcherMultiButton } from "@/components/theme-switcher-multi-button"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSidebar } from "@/components/ui/sidebar"
import { useSettings } from "@/components/providers/settings-provider"
import { resolveMainBarItemOrder } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import { QuickActionSpeedDial } from "./quick-action-speed-dial"

type MainBarRenderItem = {
  id: string
  node: React.ReactNode
}

export function MobileMainBar() {
  const { settings } = useSettings()
  const { toggleSidebar } = useSidebar()
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false)
  const quickCreateButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const order = resolveMainBarItemOrder(settings)
  const itemById = new Map<string, MainBarRenderItem>([
    ["home", {
      id: "home",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button" aria-label="Home">
          <Link href="/">
            <Home aria-hidden="true" />
            <span>Home</span>
          </Link>
        </Button>
      ),
    }],
    ["music", {
      id: "music",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button">
          <Link href="/music" aria-label="Open music">
            <Music2 aria-hidden="true" />
            <span>Music</span>
          </Link>
        </Button>
      ),
    }],
    ["clock", {
      id: "clock",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button">
          <Link href="/clock" aria-label="Open clock">
            <Clock aria-hidden="true" />
            <span>Clock</span>
          </Link>
        </Button>
      ),
    }],
    ["quick-create", {
      id: "quick-create",
      node: (
        <Button
          ref={quickCreateButtonRef}
          type="button"
          variant="secondary"
          className={cn("ml-main-bar-plus size-12 rounded-full shadow-lg", quickActionsOpen && "bg-primary text-primary-foreground")}
          aria-label="Open quick actions"
          aria-expanded={quickActionsOpen}
          onClick={() => setQuickActionsOpen((current) => !current)}
        >
          <Plus aria-hidden="true" />
        </Button>
      ),
    }],
    ["theme", {
      id: "theme",
      node: <ThemeSwitcherMultiButton />,
    }],
    ["calendar", {
      id: "calendar",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button">
          <Link href="/calendar" aria-label="Open calendar">
            <CalendarDays aria-hidden="true" />
            <span>Calendar</span>
          </Link>
        </Button>
      ),
    }],
    ["more", {
      id: "more",
      node: (
        <Button type="button" variant="ghost" className="ml-main-bar-button" aria-label="Open navigation" onClick={toggleSidebar}>
          <Menu aria-hidden="true" />
          <span>More</span>
        </Button>
      ),
    }],
  ])

  return (
    <TooltipProvider delayDuration={150}>
      <QuickActionSpeedDial open={quickActionsOpen} onOpenChange={setQuickActionsOpen} returnFocusRef={quickCreateButtonRef} />
      <nav
        aria-label="MassageLab main navigation"
        className="ml-mobile-main-bar fixed inset-x-0 bottom-0 z-[10025] border-t border-border/80 bg-background/95 px-2 pb-[max(var(--ml-safe-bottom),0.35rem)] pt-1.5 shadow-2xl shadow-black/35 backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-7 items-center gap-1">
          {order.map((itemId) => {
            const item = itemById.get(itemId)
            return item ? <div key={item.id} className="flex justify-center">{item.node}</div> : null
          })}
        </div>
      </nav>
    </TooltipProvider>
  )
}
