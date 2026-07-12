"use client"

import * as React from "react"
import { Bell, Grid2X2, List, Rows3, SlidersHorizontal } from "lucide-react"

import { AppSurface } from "@/components/ui/app-surface"
import { SegmentedToggleGroup } from "@/components/ui/segmented-toggle-group"
import { Switch } from "@/components/ui/switch"
import { Toggle } from "@/components/ui/toggle"
import { ToggleControl } from "@/components/ui/toggle-control"

const viewOptions = [
  { value: "list", label: "List view", icon: <List aria-hidden="true" /> },
  { value: "grid", label: "Grid view", icon: <Grid2X2 aria-hidden="true" /> },
  { value: "rows", label: "Compact rows", icon: <Rows3 aria-hidden="true" /> },
]

const calendarOptions = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
]

export function ToggleGallery() {
  const [generalSetting, setGeneralSetting] = React.useState(true)
  const [quietSetting, setQuietSetting] = React.useState(true)
  const [calendarSetting, setCalendarSetting] = React.useState(true)
  const [roomySetting, setRoomySetting] = React.useState(true)
  const [compactSetting, setCompactSetting] = React.useState(true)
  const [denseSetting, setDenseSetting] = React.useState(true)
  const [favoritePressed, setFavoritePressed] = React.useState(true)
  const [filterPressed, setFilterPressed] = React.useState(false)
  const [view, setView] = React.useState("grid")
  const [calendarView, setCalendarView] = React.useState("week")

  return (
    <section className="space-y-4" aria-labelledby="toggle-gallery-heading">
      <div>
        <h2 id="toggle-gallery-heading" className="text-2xl font-semibold">
          Toggle, switch, and segmented controls
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Review the shared binary, standalone, grouped, and density-aware treatments before they roll into route surfaces.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppSurface
          title="Physical switches"
          description="The same raised thumb and inset track can use a surface-appropriate palette color."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid justify-items-start gap-2 text-sm font-medium">
              <p>Orange</p>
              <Switch checked={generalSetting} onCheckedChange={setGeneralSetting} aria-label="Orange switch example" />
            </div>
            <div className="grid justify-items-start gap-2 text-sm font-medium">
              <p>Blue compact</p>
              <Switch
                checked={quietSetting}
                onCheckedChange={setQuietSetting}
                size="compact"
                tone="blue"
                aria-label="Blue compact switch example"
              />
            </div>
            <div className="grid justify-items-start gap-2 text-sm font-medium">
              <p>Leaf dense</p>
              <Switch
                checked={calendarSetting}
                onCheckedChange={setCalendarSetting}
                size="dense"
                tone="leaf"
                aria-label="Leaf dense switch example"
              />
            </div>
          </div>
        </AppSurface>

        <AppSurface
          title="Standalone toggles"
          description="Use these for independent modes and tools that need a visible selected state."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Toggle tone="alert" pressed={favoritePressed} onPressedChange={setFavoritePressed}>
              <Bell aria-hidden="true" />
              Alerts
            </Toggle>
            <Toggle variant="outline" pressed={filterPressed} onPressedChange={setFilterPressed}>
              <SlidersHorizontal aria-hidden="true" />
              Filters
            </Toggle>
            <Toggle variant="ghost" aria-label="Quiet utility toggle">
              Quiet utility
            </Toggle>
            <Toggle disabled>Disabled</Toggle>
          </div>
        </AppSurface>
      </div>

      <AppSurface
        title="Labeled toggle rows"
        description="Roomy, compact, and dense forms keep the same control grammar without forcing one row height everywhere."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <ToggleControl
            label="Roomy setting"
            description="For account settings and focused setup panels."
            checked={roomySetting}
            onCheckedChange={setRoomySetting}
          />
          <ToggleControl
            label="Compact setting"
            description="For repeated settings groups."
            checked={compactSetting}
            onCheckedChange={setCompactSetting}
            density="compact"
            tone="blue"
          />
          <ToggleControl
            label="Dense workspace setting"
            checked={denseSetting}
            onCheckedChange={setDenseSetting}
            density="dense"
            tone="leaf"
          />
        </div>
      </AppSurface>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppSurface
          title="Icon segmented control"
          description="Icon-only choices retain tooltips, labels, and keyboard selection."
        >
          <SegmentedToggleGroup
            label="Layout view"
            value={view}
            options={viewOptions}
            onValueChange={setView}
            iconOnly
          />
        </AppSurface>

        <AppSurface
          title="Text segmented control"
          description="Short option sets stay obviously selectable without reading as primary actions."
        >
          <SegmentedToggleGroup
            label="Calendar view"
            value={calendarView}
            options={calendarOptions}
            onValueChange={setCalendarView}
          />
        </AppSurface>
      </div>
    </section>
  )
}
