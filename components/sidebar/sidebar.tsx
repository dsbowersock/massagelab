"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Nav } from "@/components/sidebar/nav"
import { useSettings } from "@/components/providers/settings-provider"
import { UserNav } from "./user-nav"

const scrollbarStyles = {
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': {
    display: 'none'
  }
} as const

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(true)
  const [isPortrait, setIsPortrait] = React.useState(false)
  const { settings } = useSettings()

  // Check orientation on mount and when window resizes
  React.useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.matchMedia("(orientation: portrait)").matches)
    }

    checkOrientation()
    const mediaQuery = window.matchMedia("(orientation: portrait)")
    mediaQuery.addListener(checkOrientation)
    return () => mediaQuery.removeListener(checkOrientation)
  }, [])

  const getSidebarPosition = () => {
    if (settings.sidebarBehavior === "fixed") {
      return settings.sidebarPosition
    }
    return isPortrait ? settings.sidebarNarrowPosition : settings.sidebarPosition
  }

  const position = getSidebarPosition()

  const sidebarClasses = cn(
    "fixed bg-black/95 duration-300 z-[100] border-neutral-800 transition-all",
    {
      "h-[100dvh] max-h-screen": position === "left" || position === "right",
      "w-16": (position === "left" || position === "right") && isCollapsed,
      "w-60": (position === "left" || position === "right") && !isCollapsed,
      "left-0 border-r": position === "left",
      "right-0 border-l": position === "right",
      "w-full": position === "top" || position === "bottom",
      "h-16": (position === "top" || position === "bottom") && isCollapsed,
      "h-60": (position === "top" || position === "bottom") && !isCollapsed,
      "top-0 border-b": position === "top",
      "bottom-0 border-t": position === "bottom",
    }
  )

  const logoContainerClasses = cn(
    "flex items-center h-16 shrink-0",
    (position === "top" || position === "bottom") && isCollapsed ? "px-3" : "px-2",
    (position === "left" || position === "right") && "justify-center"
  )

  const logoClasses = cn(
    "flex items-center rounded-lg bg-[#ff7043] cursor-pointer transition-colors hover:bg-[#f4511e]",
    {
      "justify-center w-12 h-12": isCollapsed,
      "justify-start px-4 w-full h-12": !isCollapsed,
    }
  )

  const contentClasses = cn(
    "flex h-full",
    {
      "flex-col": !isCollapsed || (position !== "top" && position !== "bottom"),
      "flex-row items-center": (position === "top" || position === "bottom") && isCollapsed,
    }
  )

  const navContainerClasses = cn(
    "flex overflow-x-hidden overflow-y-auto scrollbar-none w-full",
    {
      "flex-col py-2": !isCollapsed || (position !== "top" && position !== "bottom"),
      "flex-row items-center px-2": (position === "top" || position === "bottom") && isCollapsed,
    }
  )

  return (
    <aside className={sidebarClasses}>
      <div className={contentClasses}>
        <div className={logoContainerClasses}>
          <div
            className={logoClasses}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <span className="text-lg text-white">
                <strong>M</strong>L
              </span>
            ) : (
              <span className="text-xl font-bold text-white">MassageLab</span>
            )}
          </div>
        </div>
        <div className={navContainerClasses}>
          <Nav isCollapsed={isCollapsed} position={position} />
          <UserNav isCollapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  )
}

