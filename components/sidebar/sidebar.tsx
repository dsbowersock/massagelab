"use client"

import * as React from "react"
import Image from "next/image"
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
  const navSize = isCollapsed ? "var(--ml-nav-collapsed-size)" : "var(--ml-nav-expanded-size)"
  const sidebarStyle: React.CSSProperties = {
    width: isHorizontal
      ? "100%"
      : `calc(${navSize} + env(safe-area-inset-${position}, 0px))`,
    height: isHorizontal
      ? `calc(${navSize} + env(safe-area-inset-${position}, 0px))`
      : undefined,
    paddingTop: position === "top" || !isHorizontal ? "env(safe-area-inset-top, 0px)" : undefined,
    paddingRight: position === "right" || isHorizontal ? "env(safe-area-inset-right, 0px)" : undefined,
    paddingBottom: position === "bottom" || !isHorizontal ? "env(safe-area-inset-bottom, 0px)" : undefined,
    paddingLeft: position === "left" || isHorizontal ? "env(safe-area-inset-left, 0px)" : undefined,
  }

  const sidebarClasses = cn(
    "fixed bg-black/95 duration-300 z-[100] border-neutral-800 transition-all",
    {
      "h-[100dvh] max-h-[100dvh] pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)]": !isHorizontal,
      "left-0 border-r": position === "left",
      "right-0 border-l": position === "right",
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
    "flex items-center overflow-hidden rounded-md border border-white/10 bg-neutral-950/40 shadow-inner shadow-black/50 cursor-pointer transition-colors hover:bg-neutral-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7043]/70",
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
    <aside className={sidebarClasses} style={sidebarStyle}>
      <div className={contentClasses}>
        <div className={logoContainerClasses}>
          <button className={logoClasses} onClick={() => setIsCollapsed((current) => !current)} aria-label="Toggle MassageLab navigation">
            {isCollapsed ? (
              <span className="flex h-10 w-10 items-center justify-center">
                <Image
                  src="/brand/massagelab-mark-square-tight.png"
                  alt=""
                  width={40}
                  height={40}
                  className="h-9 w-9 object-contain"
                  data-testid="sidebar-brand-mark"
                  unoptimized
                  priority
                />
              </span>
            ) : (
              <span className="flex min-w-0 items-center">
                <Image
                  src="/brand/massagelab-wordmark-uppercase-tight.png"
                  alt=""
                  width={180}
                  height={54}
                  className="h-9 w-auto max-w-[10.75rem] object-contain"
                  data-testid="sidebar-brand-wordmark"
                  unoptimized
                  priority
                />
              </span>
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
