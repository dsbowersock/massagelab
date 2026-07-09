"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import {
  applyThemeClass,
  resolveThemeMode,
  type ResolvedThemeMode,
  type ThemeMode,
  useSettings,
} from "@/components/providers/settings-provider"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  value: ThemeMode
  icon: typeof SunIcon
  label: string
  shortLabel: string
}> = [
  { value: "system", icon: MonitorIcon, label: "Use system theme", shortLabel: "System" },
  { value: "light", icon: SunIcon, label: "Use light theme", shortLabel: "Light" },
  { value: "dark", icon: MoonIcon, label: "Use dark theme", shortLabel: "Dark" },
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

  const nextToggledTheme: ThemeMode = resolvedTheme === "dark" ? "light" : "dark"
  const MobileThemeIcon = resolvedTheme === "dark" ? MoonIcon : SunIcon

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Theme"
      className={cn(
        "ml-theme-switcher group relative isolate inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/80 p-1 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.05),0_1px_8px_hsl(var(--background)/0.24)] backdrop-blur",
        className,
      )}
      {...props}
    >
      <Button
        type="button"
        variant={resolvedTheme === "light" ? "default" : "outline"}
        size="icon"
        aria-label={resolvedTheme === "dark" ? "Use light theme" : "Use dark theme"}
        aria-pressed={resolvedTheme === "dark"}
        className="ml-shell-theme-button ml-theme-toggle-button md:hidden"
        onPointerDown={rememberTransitionOrigin}
        onClick={() => setTheme(nextToggledTheme)}
      >
        <MobileThemeIcon aria-hidden="true" data-icon="inline-start" />
        <span className="sr-only">{resolvedTheme === "dark" ? "Dark" : "Light"}</span>
      </Button>
      <ToggleGroup
        type="single"
        value={settings.themeMode}
        onValueChange={(value) => {
          if (value) {
            setTheme(value as ThemeMode)
          }
        }}
        aria-label={`Theme: ${settings.themeMode === "system" ? `system (${resolvedTheme})` : settings.themeMode}`}
        className="hidden gap-1 md:flex"
      >
        {themes.map(({ value, icon: Icon, label, shortLabel }) => {
          const isActive = mounted && settings.themeMode === value
          const isSelected = settings.themeMode === value

          return (
            <ToggleGroupItem
              key={value}
              value={value}
              data-theme-value={value}
              data-theme-selected={isSelected ? "true" : "false"}
              aria-label={label}
              title={label}
              aria-pressed={isActive}
              data-state={isActive ? "on" : "off"}
              onPointerDownCapture={rememberTransitionOrigin}
              className={cn(
                "ml-shell-theme-button ml-button-press-motion ml-button-tactile relative size-8 min-w-0 rounded-full p-0",
                value === "light" && "ml-button-default",
                value === "dark" && "ml-button-outline",
                value === "system" && "ml-button-secondary",
                isActive && "ml-shell-theme-button-active",
                !mounted && "pointer-events-none animate-pulse bg-muted/70",
              )}
            >
              <Icon aria-hidden="true" data-icon="inline-start" />
              <span className="sr-only">{shortLabel}</span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}
