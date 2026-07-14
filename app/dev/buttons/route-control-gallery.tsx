"use client"

import * as React from "react"
import { BookOpen, ChevronDown, GraduationCap, Layers3, ShieldCheck, UsersRound } from "lucide-react"

import runningStyles from "@/app/chimer/running-timer.module.css"
import { StyledToggleControl } from "@/components/chimer-controls/StyledToggleControl"
import { AppSurface } from "@/components/ui/app-surface"
import { RangeControl } from "@/components/ui/range-control"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const routeTabCopy = {
  clock: "Clock controls",
  visual: "Visual controls",
  backgrounds: "Background controls",
} as const

const backgroundFilterOptions = [
  { value: "all", label: "All" },
  { value: "static", label: "Static" },
  { value: "animated", label: "Animated" },
  { value: "interactive", label: "Interactive" },
  { value: "shader", label: "Shader" },
  { value: "image", label: "Image" },
] as const

/** Mirrors the approved production choice and route-navigation treatments. */
export function RouteControlGallery() {
  const [activeTab, setActiveTab] = React.useState<keyof typeof routeTabCopy>("clock")
  const [timeFormat, setTimeFormat] = React.useState<"12h" | "24h">("12h")
  const [backgroundFilter, setBackgroundFilter] = React.useState<(typeof backgroundFilterOptions)[number]["value"]>("all")
  const [clockFont, setClockFont] = React.useState("digital")
  const [clockStrokeEnabled, setClockStrokeEnabled] = React.useState(true)
  const [clockStrokeWidth, setClockStrokeWidth] = React.useState(1.25)
  const [drawerExpanded, setDrawerExpanded] = React.useState(true)

  return (
    <section className="space-y-4" aria-labelledby="route-control-heading">
      <div>
        <h2 id="route-control-heading" className="text-2xl font-semibold">
          Tabs, pill choices, and drawer navigation
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          These examples mirror the approved production treatments used by Chimer and the app drawer.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppSurface title="Chimer tabs" description="The Clock settings panel uses this three-view navigation.">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as keyof typeof routeTabCopy)}>
            <TabsList data-active-tab={activeTab} className={cn(runningStyles.settingsTabList, "ml-chimer-tabs")}>
              <TabsTrigger value="clock" className={cn(runningStyles.settingsTabTrigger, "ml-chimer-tab")}>Clock</TabsTrigger>
              <TabsTrigger value="visual" className={cn(runningStyles.settingsTabTrigger, "ml-chimer-tab")}>Visual</TabsTrigger>
              <TabsTrigger value="backgrounds" className={cn(runningStyles.settingsTabTrigger, "ml-chimer-tab")}>Backgrounds</TabsTrigger>
            </TabsList>
            {Object.entries(routeTabCopy).map(([value, copy]) => (
              <TabsContent
                key={value}
                value={value}
                className={cn(runningStyles.settingsTabContent, "rounded-md border border-border/60 bg-background/30 p-3 text-sm text-muted-foreground")}
              >
                {copy}
              </TabsContent>
            ))}
          </Tabs>
        </AppSurface>

        <AppSurface title="Time-format choice" description="Clock mode uses this exclusive two-value choice.">
          <div className="grid max-w-sm gap-2 rounded-lg border border-border/60 bg-background/30 p-3">
            <span className="text-sm font-semibold text-foreground">Time format</span>
            <div
              className={cn(runningStyles.formatToggle, "ml-time-format-choice")}
              role="group"
              aria-label="Time format example"
              data-active-format={timeFormat}
            >
              {(["12h", "24h"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  className={cn(
                    runningStyles.formatOption,
                    runningStyles.tactileButton,
                    "ml-time-format-option",
                    timeFormat === format && runningStyles.formatOptionActive,
                  )}
                  aria-pressed={timeFormat === format}
                  onClick={() => setTimeFormat(format)}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        </AppSurface>

        <AppSurface title="Background filters" description="The Clock background picker uses this scrollable filter treatment.">
          <div className={runningStyles.backgroundCategoryRow} role="group" aria-label="Background visual filters example">
            {backgroundFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  runningStyles.backgroundCategoryButton,
                  runningStyles.tactileButton,
                  backgroundFilter === option.value && runningStyles.backgroundCategoryButtonActive,
                )}
                aria-pressed={backgroundFilter === option.value}
                onClick={() => setBackgroundFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </AppSurface>

        <AppSurface title="Select field" description="Dropdowns use the same inset control surface as other route-owned choices.">
          <label className={cn(runningStyles.clockCompactField, "max-w-sm")}>
            <span>Clock font</span>
            <select value={clockFont} onChange={(event) => setClockFont(event.target.value)}>
              <option value="digital">Digital</option>
              <option value="mono">Mono</option>
              <option value="sans">Sans Serif</option>
            </select>
          </label>
        </AppSurface>

        <AppSurface title="Clock container surfaces" description="Grouped Clock controls use flat inset containers without a top-to-bottom surface gradient.">
          <div className={runningStyles.controlGroup}>
            <StyledToggleControl
              label="Clock stroke"
              checked={clockStrokeEnabled}
              valueLabel={clockStrokeEnabled ? "On" : "Off"}
              className={runningStyles.controlGroupToggle}
              onCheckedChange={setClockStrokeEnabled}
            />
            {clockStrokeEnabled ? (
              <div className={runningStyles.controlGroupBody}>
                <div className={runningStyles.clockControlGrid}>
                  <div className={runningStyles.colorRow}>
                    <span>Stroke color</span>
                    <span className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-foreground">
                      #FFFFFF
                    </span>
                  </div>
                  <RangeControl
                    label="Stroke width"
                    value={clockStrokeWidth}
                    min={0}
                    max={3}
                    step={0.25}
                    displayValue={`${clockStrokeWidth.toFixed(2)}px`}
                    onValueChange={setClockStrokeWidth}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </AppSurface>

        <AppSurface
          title="Anatomime route controls"
          description="Game setup keeps these route-owned inputs, choices, and action controls."
          className="lg:col-span-2"
        >
          <div className="grid gap-4">
            <label className="grid max-w-md gap-2 text-sm font-semibold text-foreground">
              Team name
              <input className="anatomime-input" value="Team 1" readOnly aria-label="Anatomime team name example" />
            </label>

            <div className="grid gap-3 sm:grid-cols-3" aria-label="Anatomime team count examples">
              {[2, 3, 4].map((teamCount) => (
                <button
                  key={teamCount}
                  type="button"
                  className="anatomime-choice-button"
                  data-selected={teamCount === 2 ? "true" : undefined}
                  aria-pressed={teamCount === 2}
                >
                  {teamCount}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" className="anatomime-region-button" data-selected="true" aria-pressed="true">
                <GraduationCap className="size-5 shrink-0" aria-hidden="true" />
                <span>
                  Massage anatomy
                  <small>Foundational classroom prompt set.</small>
                </span>
              </button>
              <button type="button" className="anatomime-term-card">
                <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
                <span>
                  Reviewed study adapter
                  <small>Uses the same source set as flashcards.</small>
                </span>
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" className="anatomime-primary-button">
                <UsersRound className="size-4" aria-hidden="true" />
                Start game
              </button>
              <button type="button" className="anatomime-secondary-button">
                Preview round
              </button>
              <button type="button" className="anatomime-danger-button">
                Reset
              </button>
            </div>
          </div>
        </AppSurface>

        <AppSurface
          title="Side drawer navigation"
          description="This sample mirrors the production section, nested route, and active-route states."
          className="lg:col-span-2"
        >
          <div className="max-w-md rounded-lg border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
            <button
              type="button"
              className="flex h-12 w-full items-center gap-3 rounded-lg bg-sidebar-accent px-3 text-left text-sm font-semibold text-sidebar-foreground hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-expanded={drawerExpanded}
              onClick={() => setDrawerExpanded((current) => !current)}
            >
              <BookOpen className="size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Education</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", !drawerExpanded && "-rotate-90")} aria-hidden="true" />
            </button>
            {drawerExpanded ? (
              <div className="ml-4 mt-1 grid gap-1 border-l border-sidebar-border/70 pl-2">
                <button
                  type="button"
                  className="flex h-10 min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <BookOpen className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Flashcards</span>
                </button>
                <button
                  type="button"
                  className="ml-sidebar-route flex h-10 min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  data-active="true"
                  aria-current="page"
                >
                  <Layers3 className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Decks</span>
                </button>
              </div>
            ) : null}
          </div>
        </AppSurface>
      </div>
    </section>
  )
}
