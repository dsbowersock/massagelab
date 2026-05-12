import * as React from "react"
import { getSidebarRenderMode } from "@/lib/sidebar-layout"

export type SidebarRenderMode = "drawer" | "compact-rail" | "desktop"

function readSidebarRenderMode(): SidebarRenderMode {
  if (typeof window === "undefined") {
    return "desktop"
  }

  return getSidebarRenderMode({
    width: window.innerWidth,
    height: window.innerHeight,
  }) as SidebarRenderMode
}

export function useSidebarRenderMode() {
  const [renderMode, setRenderMode] = React.useState<SidebarRenderMode>("desktop")

  React.useEffect(() => {
    const onChange = () => {
      setRenderMode(readSidebarRenderMode())
    }

    onChange()
    window.addEventListener("resize", onChange)
    window.addEventListener("orientationchange", onChange)
    return () => {
      window.removeEventListener("resize", onChange)
      window.removeEventListener("orientationchange", onChange)
    }
  }, [])

  return renderMode
}

export function useIsMobile() {
  return useSidebarRenderMode() === "drawer"
}
