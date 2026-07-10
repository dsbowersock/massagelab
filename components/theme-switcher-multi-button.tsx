"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { MoonIcon, SunIcon } from "lucide-react"
import {
  applyThemeClass,
  resolveThemeMode,
  type ResolvedThemeMode,
  type ThemeMode,
  useSettings,
} from "@/components/providers/settings-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>
  }
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

export function ThemeSwitcherMultiButton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { settings, updateSettings } = useSettings()
  const [mounted, setMounted] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedThemeMode>("dark")
  const rootRef = useRef<HTMLDivElement | null>(null)
  const transitionOriginRef = useRef<TransitionOrigin | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const updateResolvedTheme = () => setResolvedTheme(resolveThemeMode(settings.themeMode))

    updateResolvedTheme()

    if (settings.themeMode !== "system") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    mediaQuery.addEventListener("change", updateResolvedTheme)

    return () => {
      mediaQuery.removeEventListener("change", updateResolvedTheme)
    }
  }, [settings.themeMode])

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
      setResolvedTheme(nextResolvedTheme)
    }

    if (
      typeof transitionDocument.startViewTransition !== "function"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      updateTheme()
      return
    }

    const origin = getTransitionOrigin()

    document.documentElement.style.setProperty("--ml-theme-transition-x", `${origin.x}px`)
    document.documentElement.style.setProperty("--ml-theme-transition-y", `${origin.y}px`)
    document.documentElement.setAttribute("data-theme-transition", "toggle-light")
    document.documentElement.setAttribute("data-theme-resolved-target", nextResolvedTheme)

    const transition = transitionDocument.startViewTransition(() => {
      flushSync(updateTheme)
    })

    void transition.finished.finally(() => {
      document.documentElement.removeAttribute("data-theme-transition")
      document.documentElement.removeAttribute("data-theme-resolved-target")
      document.documentElement.style.removeProperty("--ml-theme-transition-x")
      document.documentElement.style.removeProperty("--ml-theme-transition-y")
      transitionOriginRef.current = null
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
        variant={resolvedTheme === "light" ? "default" : "outline"}
        size="icon"
        aria-label={`Use ${nextThemeLabel} theme`}
        title={`Use ${nextThemeLabel} theme`}
        aria-pressed={mounted}
        data-state="on"
        onPointerDown={rememberTransitionOrigin}
        onClick={() => setTheme(nextToggledTheme)}
        className={cn(
          "ml-shell-theme-button ml-theme-toggle-button ml-button-press-motion ml-button-tactile relative size-8 min-w-0 rounded-full p-0",
          resolvedTheme === "light" && "ml-button-default",
          resolvedTheme === "dark" && "ml-button-outline",
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
