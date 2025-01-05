"use client"

import { useSettings } from "@/components/providers/settings-provider"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const [position, setPosition] = useState<"left" | "right" | "top" | "bottom">(settings.sidebarPosition)
  
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
    mediaQuery.addListener(updatePosition)

    return () => mediaQuery.removeListener(updatePosition)
  }, [settings.sidebarBehavior, settings.sidebarPosition, settings.sidebarNarrowPosition])

  return (
    <div className={cn(
      "min-h-[100dvh] max-h-screen w-full overflow-auto transition-all duration-300",
      // Add padding based on sidebar position
      position === "left" && "pl-16",
      position === "right" && "pr-16",
      position === "top" && "pt-16",
      position === "bottom" && "pb-16",
    )}>
      <div className={cn(
        "w-full h-full overflow-auto",
        // Only apply max-width and margin constraints for vertical sidebars
        (position === "left" || position === "right") && "max-w-screen-2xl mx-auto"
      )}>
        {children}
      </div>
    </div>
  )
}

