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

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Theme"
      className={cn(
        "group relative isolate inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/80 p-1 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.05),0_1px_8px_hsl(var(--background)/0.24)] backdrop-blur",
        className,
      )}
      {...props}
    >
      <ToggleGroup
        type="single"
        value={settings.themeMode}
        onValueChange={(value) => {
          if (value) {
            setTheme(value as ThemeMode)
          }
        }}
        aria-label={`Theme: ${settings.themeMode === "system" ? `system (${resolvedTheme})` : settings.themeMode}`}
        className="gap-1"
      >
        {themes.map(({ value, icon: Icon, label, shortLabel }) => {
          const isActive = mounted && settings.themeMode === value
          const isSelected = settings.themeMode === value

          return (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              title={label}
              aria-pressed={isActive}
              data-state={isActive ? "on" : "off"}
              onPointerDown={rememberTransitionOrigin}
              className={cn(
                "relative size-8 min-w-0 rounded-full p-0 text-muted-foreground transition-[background-color,color,box-shadow,transform] hover:bg-transparent hover:text-foreground active:translate-y-px data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.14),0_1px_8px_hsl(var(--brand-orange-glow)/0.34)]",
                !isSelected && "max-sm:hidden max-sm:group-focus-within:inline-flex max-sm:group-hover:inline-flex",
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
