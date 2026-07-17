"use client"

import * as React from "react"
import { Clock3, Grid2X2, List, Sparkles, Timer } from "lucide-react"

import { AppSurface } from "@/components/ui/app-surface"
import { SegmentedToggleGroup } from "@/components/ui/segmented-toggle-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGallery } from "./toggle-gallery"
import { ReviewState, ReviewStateGrid } from "./review-state-grid"

const layoutOptions = [
  { value: "list", label: "List", icon: <List aria-hidden="true" /> },
  { value: "grid", label: "Grid", icon: <Grid2X2 aria-hidden="true" /> },
  { value: "timer", label: "Timer", icon: <Timer aria-hidden="true" /> },
] as const

const compactOptions = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const

const disabledOptions = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back", disabled: true },
] as const

const setupOptions = [
  { value: "clock", label: "Clock", icon: <Clock3 aria-hidden="true" /> },
  { value: "visual", label: "Visual", icon: <Sparkles aria-hidden="true" /> },
] as const

const anatomimeOptions = [
  { value: "teams", label: "Teams" },
  { value: "regions", label: "Regions" },
  { value: "terms", label: "Terms" },
] as const

export function ChoiceGallery() {
  const [layout, setLayout] = React.useState("grid")
  const [compactValue, setCompactValue] = React.useState("week")
  const [setupValue, setSetupValue] = React.useState("clock")
  const [anatomimeValue, setAnatomimeValue] = React.useState("teams")
  const [disabledValue, setDisabledValue] = React.useState("front")
  const [hoverDemo, setHoverDemo] = React.useState("day")
  const [pressedDemo, setPressedDemo] = React.useState("week")
  const [focusDemo, setFocusDemo] = React.useState("month")

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="choice-family-heading">
        <div>
          <h2 id="choice-family-heading" className="text-2xl font-semibold">Segmented controls, tabs, and pill choices</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Exclusive choices use shared selection mechanics while tone and density communicate route intent.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AppSurface title="Default inset" description="Text and icon choices share one sliding selected face.">
            <SegmentedToggleGroup
              label="Layout"
              value={layout}
              options={layoutOptions}
              onValueChange={setLayout}
            />
          </AppSurface>

          <AppSurface title="Compact" description="Dense workspace choices retain the same keyboard model.">
            <SegmentedToggleGroup
              label="Calendar period"
              value={compactValue}
              options={compactOptions}
              size="sm"
              onValueChange={setCompactValue}
            />
          </AppSurface>

          <AppSurface title="Icon-only" description="Tooltips provide visible names while aria labels remain available.">
            <SegmentedToggleGroup
              label="Icon layout"
              value={layout}
              options={layoutOptions}
              iconOnly
              onValueChange={setLayout}
            />
          </AppSurface>

          <AppSurface title="Disabled choice" description="A disabled option remains visibly unavailable without changing group geometry.">
            <SegmentedToggleGroup
              label="Body view"
              value={disabledValue}
              options={disabledOptions}
              onValueChange={setDisabledValue}
            />
          </AppSurface>

          <AppSurface title="Chimer setup tone" description="Attention selected state is a shared choice option, not local button CSS.">
            <SegmentedToggleGroup
              label="Chimer setup area"
              value={setupValue}
              options={setupOptions}
              activeTone="attention"
              activeRing
              onValueChange={setSetupValue}
            />
          </AppSurface>

          <AppSurface title="Anatomime representative tone" description="Purpose-specific labels retain the shared selected-state contract.">
            <SegmentedToggleGroup
              label="Anatomime setup"
              value={anatomimeValue}
              options={anatomimeOptions}
              onValueChange={setAnatomimeValue}
            />
          </AppSurface>
        </div>
      </section>

      <AppSurface title="Shared tab treatments" description="List and trigger variants own inset construction, compact density, and selected tone.">
        <div className="grid gap-5 lg:grid-cols-3">
          <Tabs defaultValue="base">
            <TabsList variant="inset">
              <TabsTrigger value="base">Base</TabsTrigger>
              <TabsTrigger value="selected">Selected</TabsTrigger>
              <TabsTrigger value="disabled" disabled>Disabled</TabsTrigger>
            </TabsList>
            <TabsContent value="base" className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
              Default tab content
            </TabsContent>
            <TabsContent value="selected" className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
              Selected tab content
            </TabsContent>
          </Tabs>

          <Tabs defaultValue="compact">
            <TabsList variant="inset" density="compact" tone="setup">
              <TabsTrigger value="compact" density="compact" tone="setup">Setup</TabsTrigger>
              <TabsTrigger value="visual" density="compact" tone="setup">Visual</TabsTrigger>
            </TabsList>
            <TabsContent value="compact" className="text-sm text-muted-foreground">Compact setup tab</TabsContent>
            <TabsContent value="visual" className="text-sm text-muted-foreground">Compact visual tab</TabsContent>
          </Tabs>

          <Tabs defaultValue="attention">
            <TabsList variant="inset" tone="attention">
              <TabsTrigger value="attention" tone="attention">Attention</TabsTrigger>
              <TabsTrigger value="quiet" tone="attention">Quiet</TabsTrigger>
            </TabsList>
            <TabsContent value="attention" className="text-sm text-muted-foreground">Attention-selected tab</TabsContent>
            <TabsContent value="quiet" className="text-sm text-muted-foreground">Quiet tab</TabsContent>
          </Tabs>
        </div>
      </AppSurface>

      <AppSurface title="Choice interaction states" description="Exercise real hover, press, focus, disabled, and selected behavior.">
        <ReviewStateGrid>
          <ReviewState label="Hover" note="Hover an inactive option; its blue inset preview should be obvious.">
            <SegmentedToggleGroup
              label="Hover state example"
              value={hoverDemo}
              options={compactOptions}
              size="sm"
              onValueChange={setHoverDemo}
            />
          </ReviewState>
          <ReviewState label="Pressed" note="Press and hold an inactive option to see it compress into the track.">
            <SegmentedToggleGroup
              label="Pressed state example"
              value={pressedDemo}
              options={compactOptions}
              size="sm"
              onValueChange={setPressedDemo}
            />
          </ReviewState>
          <ReviewState label="Focus visible" note="Tab into this group and use arrow keys; focus stays boxed inside the option.">
            <SegmentedToggleGroup
              label="Focus state example"
              value={focusDemo}
              options={compactOptions}
              size="sm"
              onValueChange={setFocusDemo}
            />
          </ReviewState>
        </ReviewStateGrid>
      </AppSurface>

      <ToggleGallery />
    </div>
  )
}
