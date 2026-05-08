"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Nav } from "@/components/sidebar/nav"
import { useSettings } from "@/components/providers/settings-provider"

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(true)
  const [isPortrait, setIsPortrait] = React.useState(false)
  const { settings } = useSettings()

  React.useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.matchMedia("(orientation: portrait)").matches)
    }

    checkOrientation()
    const mediaQuery = window.matchMedia("(orientation: portrait)")
    mediaQuery.addEventListener("change", checkOrientation)
    return () => mediaQuery.removeEventListener("change", checkOrientation)
  }, [])

  const position = settings.sidebarBehavior === "fixed"
    ? settings.sidebarPosition
    : isPortrait
      ? settings.sidebarNarrowPosition
      : settings.sidebarPosition

  const isHorizontal = position === "top" || position === "bottom"

  const sidebarClasses = cn(
    "fixed bg-black/95 duration-300 z-[100] border-neutral-800 transition-all",
    {
      "h-[100dvh] max-h-[100dvh] pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)]": !isHorizontal,
      "w-[calc(var(--ml-nav-collapsed-size)+env(safe-area-inset-left,0px))] pl-[env(safe-area-inset-left,0px)]": position === "left" && isCollapsed,
      "w-[calc(var(--ml-nav-expanded-size)+env(safe-area-inset-left,0px))] pl-[env(safe-area-inset-left,0px)]": position === "left" && !isCollapsed,
      "w-[calc(var(--ml-nav-collapsed-size)+env(safe-area-inset-right,0px))] pr-[env(safe-area-inset-right,0px)]": position === "right" && isCollapsed,
      "w-[calc(var(--ml-nav-expanded-size)+env(safe-area-inset-right,0px))] pr-[env(safe-area-inset-right,0px)]": position === "right" && !isCollapsed,
      "left-0 border-r": position === "left",
      "right-0 border-l": position === "right",
      "w-full pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]": isHorizontal,
      "h-[calc(var(--ml-nav-collapsed-size)+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]": position === "top" && isCollapsed,
      "h-[calc(var(--ml-nav-expanded-size)+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]": position === "top" && !isCollapsed,
      "h-[calc(var(--ml-nav-collapsed-size)+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]": position === "bottom" && isCollapsed,
      "h-[calc(var(--ml-nav-expanded-size)+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]": position === "bottom" && !isCollapsed,
      "top-0 border-b": position === "top",
      "bottom-0 border-t": position === "bottom",
    },
  )

  const logoContainerClasses = cn(
    "flex items-center h-16 shrink-0",
    isHorizontal && isCollapsed ? "px-3" : "px-2",
    !isHorizontal && "justify-center",
  )

  const logoClasses = cn(
    "flex items-center rounded-md bg-[#ff7043] cursor-pointer transition-colors hover:bg-[#f4511e]",
    {
      "justify-center w-12 h-12": isCollapsed,
      "justify-start px-4 w-full h-12": !isCollapsed,
    },
  )

  const contentClasses = cn("flex h-full", {
    "flex-col": !isCollapsed || !isHorizontal,
    "flex-row items-center": isHorizontal && isCollapsed,
  })

  const navContainerClasses = cn("flex overflow-x-hidden overflow-y-auto w-full", {
    "flex-col py-2": !isCollapsed || !isHorizontal,
    "flex-row items-center px-2": isHorizontal && isCollapsed,
  })

  return (
    <aside className={sidebarClasses}>
      <div className={contentClasses}>
        <div className={logoContainerClasses}>
          <button className={logoClasses} onClick={() => setIsCollapsed((current) => !current)} aria-label="Toggle navigation">
            {isCollapsed ? (
              <span className="text-lg text-white">
                <strong>M</strong>L
              </span>
            ) : (
              <span className="text-xl font-bold text-white">MassageLab</span>
            )}
          </button>
        </div>
        <div className={navContainerClasses}>
          <Nav isCollapsed={isCollapsed} position={position} />
        </div>
      </div>
    </aside>
  )
}
