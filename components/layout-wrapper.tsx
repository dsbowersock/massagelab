"use client"

import { useSettings } from "@/components/providers/settings-provider"
import { MovingBackground } from "@/components/moving-background"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const pathname = usePathname() ?? ""
  const [position, setPosition] = useState<"left" | "right" | "top" | "bottom">(settings.sidebarPosition)
  const routeOwnsBackground = pathname.startsWith("/chimer") || pathname.startsWith("/anatomime")
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
  
    const updatePosition = () => {
      const isPortrait = window.matchMedia("(orientation: portrait)").matches
      const newPosition = settings.sidebarBehavior === "fixed" 
        ? settings.sidebarPosition 
        : isPortrait 
          ? settings.sidebarNarrowPosition 
          : settings.sidebarPosition
      setPosition(newPosition)
    }

    updatePosition()
    const mediaQuery = window.matchMedia("(orientation: portrait)")
    mediaQuery.addEventListener("change", updatePosition)

    return () => mediaQuery.removeEventListener("change", updatePosition)
  }, [settings.sidebarBehavior, settings.sidebarPosition, settings.sidebarNarrowPosition])

  return (
    <div
      className="ml-app-shell relative isolate h-full w-full overflow-hidden bg-[#050505] transition-[padding] duration-300"
      data-nav-position={position}
    >
      {!routeOwnsBackground && (
        <>
          <MovingBackground
            className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen"
            testId="app-moving-background"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-br from-slate-950/75 via-neutral-950/80 to-stone-950/75"
          />
        </>
      )}
      <div className={cn(
        "ml-app-scroll relative z-10 h-full min-h-0 w-full overflow-y-auto overscroll-contain",
        // Only apply max-width and margin constraints for vertical sidebars
        (position === "left" || position === "right") && "max-w-screen-2xl mx-auto"
      )}>
        {children}
      </div>
    </div>
  )
}

