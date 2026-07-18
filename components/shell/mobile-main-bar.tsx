"use client"

import * as React from "react"
import { CalendarDays, Clock, Menu, Music2, Plus } from "lucide-react"
import { ThemeSwitcherMultiButton } from "@/components/theme-switcher-multi-button"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSidebar } from "@/components/ui/sidebar"
import { useResolvedTheme, useSettings } from "@/components/providers/settings-provider"
import type { SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { resolveMainBarLayout } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import { AppBarBrandLink } from "./app-bar-brand-link"
import { AppToolLink } from "./app-tool-link"
import { QuickActionSpeedDial } from "./quick-action-speed-dial"

type MainBarRenderItem = {
  id: string
  node: React.ReactNode
}

export function MobileMainBar({ user }: { user: SidebarUser }) {
  const { settings } = useSettings()
  const resolvedTheme = useResolvedTheme()
  const { isMobile, openMobile, state, toggleSidebar } = useSidebar()
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false)
  const quickCreateButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const layout = resolveMainBarLayout(settings)
  const sidebarOpen = isMobile ? openMobile : state === "expanded"
  const quickCreateControl = (
    <Button
      ref={quickCreateButtonRef}
      type="button"
      variant="default"
      size="icon"
      className={cn("ml-main-bar-plus rounded-full", quickActionsOpen && "ml-main-bar-plus-open")}
      data-quick-action-trigger="true"
      aria-label="Open quick actions"
      aria-expanded={quickActionsOpen}
      onClick={() => setQuickActionsOpen((current) => !current)}
    >
      <Plus aria-hidden="true" />
    </Button>
  )
  const drawerControl = (
    <Button
      type="button"
      variant={resolvedTheme === "dark" ? "glow" : "default"}
      size="icon"
      className="ml-main-bar-button rounded-full"
      data-sidebar-control="true"
      aria-expanded={sidebarOpen}
      aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
      onClick={toggleSidebar}
    >
      <Menu aria-hidden="true" data-icon="menu" />
      <span>More</span>
    </Button>
  )
  const itemById = new Map<string, MainBarRenderItem>([
    ["brand", { id: "brand", node: <AppBarBrandLink /> }],
    ["music", {
      id: "music",
      node: (
        <AppToolLink
          href="/music"
          label="Open music"
          icon={Music2}
          showLabel
          className="ml-main-bar-button"
        />
      ),
    }],
    ["clock", {
      id: "clock",
      node: (
        <AppToolLink
          href="/clock"
          label="Open clock"
          icon={Clock}
          showLabel
          className="ml-main-bar-button"
        />
      ),
    }],
    ["quick-create", { id: "quick-create", node: quickCreateControl }],
    ["theme", {
      id: "theme",
      node: <ThemeSwitcherMultiButton />,
    }],
    ["calendar", {
      id: "calendar",
      node: (
        <AppToolLink
          href="/calendar"
          label="Open calendar"
          icon={CalendarDays}
          showLabel
          className="ml-main-bar-button"
        />
      ),
    }],
    ["more", { id: "more", node: drawerControl }],
  ])
  const edgeCluster = (
    <div className="ml-main-bar-drawer-brand" data-drawer-edge={layout.drawerEdge}>
      {layout.edgeItemIds.map((id) => <React.Fragment key={id}>{itemById.get(id)?.node}</React.Fragment>)}
    </div>
  )

  return (
    <TooltipProvider delayDuration={150}>
      <QuickActionSpeedDial
        isSignedIn={Boolean(user)}
        onboarding={user?.quickActionOnboarding}
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        returnFocusRef={quickCreateButtonRef}
      />
      <nav
        aria-label="MassageLab main navigation"
        data-sidebar-position={settings.sidebarPosition}
        data-app-bar-position={settings.appBarPosition}
        className={cn(
          "ml-mobile-main-bar fixed inset-x-0 z-[10025] bg-background/95 px-1.5 shadow-2xl shadow-black/35 backdrop-blur md:hidden",
          settings.appBarPosition === "top"
            ? "top-0 border-b border-border/80 pb-0 pt-[var(--ml-safe-top)]"
            : "bottom-0 border-t border-border/80 pb-[var(--ml-safe-bottom)] pt-0",
        )}
      >
        <div className="ml-main-bar-layout" data-drawer-edge={layout.drawerEdge}>
          {layout.drawerEdge === "left" ? edgeCluster : null}
          <div className="ml-main-bar-tools">
            {layout.toolItemIds.map((id) => <React.Fragment key={id}>{itemById.get(id)?.node}</React.Fragment>)}
          </div>
          {layout.drawerEdge === "right" ? edgeCluster : null}
        </div>
      </nav>
    </TooltipProvider>
  )
}
