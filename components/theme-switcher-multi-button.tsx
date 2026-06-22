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

const compactThemeCollapseDelayMs = 5_000
// Keep compact options temporarily expanded so touch and keyboard users can choose a theme without leaving the bar permanently wide.

export function ThemeSwitcherMultiButton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { settings, updateSettings } = useSettings()
  const [mounted, setMounted] = useState(false)
  const [compactExpanded, setCompactExpanded] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedThemeMode>("dark")
  const collapseTimeoutRef = useRef<number | null>(null)
  const suppressCompactActivationRef = useRef(false)
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

  useEffect(() => {
    // A pending compact-collapse timer should not fire after this shared top-bar control unmounts.
    return () => {
      if (collapseTimeoutRef.current) {
        window.clearTimeout(collapseTimeoutRef.current)
      }
    }
  }, [])

  function clearCompactCollapseTimer() {
    // Cancel stale collapse work before rescheduling or forcing a manual close.
    if (!collapseTimeoutRef.current) return

    window.clearTimeout(collapseTimeoutRef.current)
    collapseTimeoutRef.current = null
  }

  function scheduleCompactCollapse() {
    // Auto-close expanded compact options after a short idle window on narrow screens.
    clearCompactCollapseTimer()
    collapseTimeoutRef.current = window.setTimeout(() => {
      setCompactExpanded(false)
      collapseTimeoutRef.current = null
    }, compactThemeCollapseDelayMs)
  }

  function expandCompactThemePicker() {
    // Revealing hidden compact options also starts the idle countdown back to the single active icon.
    setCompactExpanded(true)
    scheduleCompactCollapse()
  }

  function collapseCompactThemePicker() {
    // Manual collapse is used after selection or when focus leaves the whole switcher group.
    clearCompactCollapseTimer()
    setCompactExpanded(false)
  }

  function shouldOpenCompactPickerOnly(isSelected: boolean) {
    if (!isSelected || compactExpanded) {
      return false
    }

    const inactiveOption = rootRef.current?.querySelector<HTMLElement>("[data-theme-selected='false']")

    return inactiveOption ? window.getComputedStyle(inactiveOption).display === "none" : false
  }

  function suppressCompactActivation() {
    suppressCompactActivationRef.current = true
    window.setTimeout(() => {
      suppressCompactActivationRef.current = false
    }, 500)
  }

  function stopSuppressedCompactActivation(event: React.SyntheticEvent<HTMLElement>) {
    if (!suppressCompactActivationRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }

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
      onFocusCapture={expandCompactThemePicker}
      onPointerMoveCapture={() => {
        if (compactExpanded) {
          scheduleCompactCollapse()
        }
      }}
      onKeyDownCapture={() => {
        if (compactExpanded) {
          scheduleCompactCollapse()
        }
      }}
      onBlurCapture={(event) => {
        // Moving between theme buttons should keep the compact picker open.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          collapseCompactThemePicker()
        }
      }}
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
          if (suppressCompactActivationRef.current) {
            return
          }

          if (value) {
            setTheme(value as ThemeMode)
            collapseCompactThemePicker()
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
              data-theme-selected={isSelected ? "true" : "false"}
              aria-label={label}
              title={label}
              aria-pressed={isActive}
              data-state={isActive ? "on" : "off"}
              onPointerDownCapture={(event) => {
                rememberTransitionOrigin(event)
                if (shouldOpenCompactPickerOnly(isSelected)) {
                  // Opening hidden compact options changes button positions; cancel this tap so it cannot land on another theme.
                  suppressCompactActivation()
                  event.preventDefault()
                  event.stopPropagation()
                  expandCompactThemePicker()
                  return
                }
                // Pointer users need the compact choices visible before the toggle group settles selection.
                expandCompactThemePicker()
              }}
              onPointerUpCapture={stopSuppressedCompactActivation}
              onClickCapture={(event) => {
                stopSuppressedCompactActivation(event)
                suppressCompactActivationRef.current = false
              }}
              className={cn(
                "relative size-8 min-w-0 rounded-full p-0 text-muted-foreground transition-[background-color,color,box-shadow,transform] hover:bg-transparent hover:text-foreground active:translate-y-px data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.14),0_1px_8px_hsl(var(--brand-orange-glow)/0.34)]",
                !isSelected && !compactExpanded && "max-md:hidden",
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
