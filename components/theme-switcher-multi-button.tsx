"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { MoonIcon, SunIcon } from "lucide-react"
import {
  applyThemeClass,
  resolveThemeMode,
  type ThemeMode,
  useResolvedTheme,
  useSettings,
} from "@/components/providers/settings-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ThemeViewTransition
}

type ThemeViewTransition = {
  finished: Promise<void>
}

type TransitionOrigin = {
  x: number
  y: number
}

const themes: Array<{
  value: Exclude<ThemeMode, "system">
  icon: typeof SunIcon
  shortLabel: string
}> = [
  { value: "light", icon: SunIcon, shortLabel: "Light" },
  { value: "dark", icon: MoonIcon, shortLabel: "Dark" },
]

// Multiple shell layouts can mount theme controls concurrently, so only the
// instance that started the newest transition may clear document-level state.
let activeThemeTransitionOwner: symbol | null = null

export function ThemeSwitcherMultiButton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { settings, updateSettings } = useSettings()
  const [mounted, setMounted] = useState(false)
  const resolvedTheme = useResolvedTheme()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const transitionOriginRef = useRef<TransitionOrigin | null>(null)
  const fallbackTransitionTimeoutRef = useRef<number | null>(null)
  const activeTransitionRef = useRef<ThemeViewTransition | null>(null)
  const transitionOwnerRef = useRef(Symbol("theme-switcher-transition-owner"))

  const cleanupTransitionState = useCallback(() => {
    if (activeThemeTransitionOwner !== transitionOwnerRef.current) return

    document.documentElement.removeAttribute("data-theme-transition")
    document.documentElement.removeAttribute("data-theme-transition-fallback")
    document.documentElement.removeAttribute("data-theme-resolved-target")
    document.documentElement.style.removeProperty("--ml-theme-transition-x")
    document.documentElement.style.removeProperty("--ml-theme-transition-y")
    document.documentElement.style.removeProperty("--ml-theme-transition-fallback-color")
    activeThemeTransitionOwner = null
    transitionOriginRef.current = null
  }, [])

  useEffect(() => {
    setMounted(true)

    return () => {
      let managesTransition = false

      if (fallbackTransitionTimeoutRef.current !== null) {
        window.clearTimeout(fallbackTransitionTimeoutRef.current)
        fallbackTransitionTimeoutRef.current = null
        managesTransition = true
      }

      if (activeTransitionRef.current !== null) {
        activeTransitionRef.current = null
        managesTransition = true
      }

      if (managesTransition) {
        cleanupTransitionState()
      }
    }
  }, [cleanupTransitionState])

  function rememberTransitionOrigin(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect()

    transitionOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  function getTransitionOrigin() {
    if (transitionOriginRef.current) {
      return transitionOriginRef.current
    }

    const rect = rootRef.current?.getBoundingClientRect()

    return {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth,
      y: rect ? rect.top + rect.height / 2 : 0,
    }
  }

  function setTheme(themeMode: ThemeMode) {
    if (themeMode === settings.themeMode) {
      return
    }

    const transitionDocument = document as ViewTransitionDocument
    const nextResolvedTheme = resolveThemeMode(themeMode)

    const updateTheme = () => {
      updateSettings({ themeMode })
      applyThemeClass(themeMode)
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      updateTheme()
      return
    }

    const origin = getTransitionOrigin()
    const root = document.documentElement

    activeThemeTransitionOwner = transitionOwnerRef.current
    root.style.setProperty("--ml-theme-transition-x", `${origin.x}px`)
    root.style.setProperty("--ml-theme-transition-y", `${origin.y}px`)
    root.setAttribute("data-theme-resolved-target", nextResolvedTheme)

    if (typeof transitionDocument.startViewTransition !== "function") {
      const currentBackground = window
        .getComputedStyle(root)
        .getPropertyValue("--background")
        .trim()

      root.style.setProperty(
        "--ml-theme-transition-fallback-color",
        currentBackground ? `hsl(${currentBackground})` : "Canvas",
      )
      root.setAttribute("data-theme-transition-fallback", "toggle-light")
      flushSync(updateTheme)

      if (fallbackTransitionTimeoutRef.current !== null) {
        window.clearTimeout(fallbackTransitionTimeoutRef.current)
      }

      fallbackTransitionTimeoutRef.current = window.setTimeout(() => {
        fallbackTransitionTimeoutRef.current = null
        cleanupTransitionState()
      }, 680)
      return
    }

    root.setAttribute("data-theme-transition", "toggle-light")

    const transition = transitionDocument.startViewTransition(() => {
      flushSync(updateTheme)
    })
    activeTransitionRef.current = transition

    void transition.finished
      .catch(() => undefined)
      .finally(() => {
        if (activeTransitionRef.current === transition) {
          activeTransitionRef.current = null
          cleanupTransitionState()
        }
      })
  }

  const currentTheme = themes.find((theme) => theme.value === resolvedTheme) ?? themes[1]
  const CurrentThemeIcon = currentTheme.icon
  const nextToggledTheme: ThemeMode = resolvedTheme === "dark" ? "light" : "dark"
  const nextThemeLabel = nextToggledTheme === "dark" ? "dark" : "light"

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Theme"
      className={cn(
        "ml-theme-switcher group relative isolate inline-flex shrink-0 items-center",
        className,
      )}
      {...props}
    >
      <Button
        data-theme-value={currentTheme.value}
        data-theme-selected={mounted ? "true" : "false"}
        type="button"
        variant={resolvedTheme === "dark" ? "glow" : "default"}
        size="icon"
        aria-label={`Use ${nextThemeLabel} theme`}
        title={`Use ${nextThemeLabel} theme`}
        data-state="on"
        onPointerDown={rememberTransitionOrigin}
        onClick={() => setTheme(nextToggledTheme)}
        className={cn(
          "ml-shell-compact-control ml-shell-theme-button ml-theme-toggle-button ml-button-press-motion ml-button-tactile relative min-w-0 rounded-full p-0",
          resolvedTheme === "light" && "ml-button-default",
          resolvedTheme === "dark" && "ml-button-glow",
          "ml-shell-theme-button-active",
          !mounted && "pointer-events-none animate-pulse bg-muted/70",
        )}
      >
        <CurrentThemeIcon aria-hidden="true" data-icon="inline-start" />
        <span className="sr-only">{currentTheme.shortLabel}</span>
      </Button>
    </div>
  )
}
