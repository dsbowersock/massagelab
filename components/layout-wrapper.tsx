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
    <div className={cn(
      "relative isolate min-h-[100dvh] max-h-screen w-full overflow-auto bg-[#050505] transition-all duration-300",
      // Add padding based on sidebar position
      position === "left" && "pl-16",
      position === "right" && "pr-16",
      position === "top" && "pt-16",
      position === "bottom" && "pb-16",
    )}>
      {!routeOwnsBackground && (
        <>
          <MovingBackground
            className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
            testId="app-moving-background"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-br from-slate-950/75 via-neutral-950/80 to-stone-950/75"
          />
        </>
      )}
      <div className={cn(
        "relative z-10 w-full h-full overflow-auto",
        // Only apply max-width and margin constraints for vertical sidebars
        (position === "left" || position === "right") && "max-w-screen-2xl mx-auto"
      )}>
        {children}
      </div>
    </div>
  )
}

