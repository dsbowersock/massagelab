"use client"

import * as React from "react"
import { Palette, SlidersHorizontal, Volume2 } from "lucide-react"

import { AppSurface } from "@/components/ui/app-surface"
import { ColorPickerSwatch, ColorSlider, GlobalColorPicker } from "@/components/chimer-controls"
import { RangeControl } from "@/components/ui/range-control"
import { Slider } from "@/components/ui/slider"
import type { GlobalColorValues } from "@/components/chimer-controls/GlobalColorPicker"

const sliderColorTreatments = [
  {
    name: "Default copper",
    className: "",
    value: 58,
    description: "Default treatment for general physical settings.",
  },
  {
    name: "Orange",
    className: "ml-slider-fill-orange",
    value: 48,
    description: "Warmer action-adjacent controls.",
  },
  {
    name: "Blue",
    className: "ml-slider-fill-blue",
    value: 70,
    description: "Atmosphere, music, and blue/purple surfaces.",
  },
  {
    name: "Leaf",
    className: "ml-slider-fill-leaf",
    value: 42,
    description: "Calendar and green operational controls.",
  },
  {
    name: "CTA purple",
    className: "ml-slider-fill-cta",
    value: 64,
    description: "Rare high-emphasis tuning controls.",
  },
  {
    name: "Danger",
    className: "ml-slider-fill-danger",
    value: 36,
    description: "Destructive or warning-adjacent thresholds.",
  },
]

export function SliderGallery() {
  const [volume, setVolume] = React.useState(70)
  const [labeledValue, setLabeledValue] = React.useState(58)
  const [routeRangeValue, setRouteRangeValue] = React.useState(45)
  const [hue, setHue] = React.useState(24)
  const [colorSliderHue, setColorSliderHue] = React.useState(237)
  const [swatchColor, setSwatchColor] = React.useState("#ff7a1a")
  const [pickerColors, setPickerColors] = React.useState<GlobalColorValues>({
    primary: "#ff7a1a",
    secondary: "#b66a38",
    accent: "#3f7ee8",
    background: "#151515",
    foreground: "#f8f5f0",
    ctaStart: "#b719ff",
    ctaEnd: "#7a31d9",
  })

  return (
    <section className="space-y-4" aria-labelledby="range-heading">
      <div>
        <h2 id="range-heading" className="text-2xl font-semibold">Range and slider controls</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These are the default slider forms, their color treatments, and the route-owned controls that still need separate review.
        </p>
      </div>
      <div className="grid gap-4">
        <AppSurface title="Default sliders" description="Use the raw slider when nearby UI already supplies the name or value; use RangeControl when the control must show both.">
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-medium text-muted-foreground">
              <span>Unlabeled slider</span>
              <span className="flex items-center gap-3">
                <Volume2 aria-hidden="true" className="size-5 shrink-0 text-brand-orange" />
                <Slider
                  aria-label="Example volume"
                  value={[volume]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([nextValue]) => setVolume(nextValue ?? volume)}
                />
              </span>
            </label>
            <RangeControl
              label="Sweep speed"
              value={labeledValue}
              min={0}
              max={100}
              unit="%"
              onValueChange={setLabeledValue}
            />
          </div>
        </AppSurface>

        <AppSurface title="Slider color treatments" description="The left pill color can change by surface while the thumb, spacing, and track geometry stay consistent.">
          <div className="grid gap-4 md:grid-cols-2">
            {sliderColorTreatments.map((item) => (
              <RangeControl
                key={item.name}
                label={item.name}
                defaultValue={item.value}
                min={0}
                max={100}
                unit="%"
                className={item.className}
                description={item.description}
              />
            ))}
          </div>
        </AppSurface>

        <AppSurface title="Route-owned controls" description="These stay separate for now because their behavior, density, or color semantics are specific to the route that owns them.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <SlidersHorizontal aria-hidden="true" className="size-4 text-brand-orange" />
                Chimer dense background row
              </div>
              <label className="grid gap-2 rounded-md border border-border/60 bg-background/30 p-3 md:grid-cols-[minmax(0,12rem)_minmax(10rem,1fr)] md:items-center">
                <span className="flex min-w-0 items-baseline justify-between gap-3 text-sm font-semibold text-foreground md:block">
                  <span>Background speed</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground md:ml-2">({routeRangeValue}%)</span>
                </span>
                <Slider
                  aria-label="Route-owned Chimer background speed"
                  className="ml-slider-compact ml-slider-fill-orange"
                  value={[routeRangeValue]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([nextValue]) => setRouteRangeValue(nextValue ?? routeRangeValue)}
                />
              </label>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Palette aria-hidden="true" className="size-4 text-brand-orange" />
                Color picker hue slider
              </div>
              <label className="grid gap-2 rounded-md border border-border/60 bg-background/30 p-3">
                <span className="flex min-w-0 items-baseline justify-between gap-3 text-sm font-semibold text-foreground">
                  <span>Hue</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{hue}°</span>
                </span>
                <Slider
                  aria-label="Route-owned color picker hue"
                  className="ml-slider-hue"
                  value={[hue]}
                  min={0}
                  max={360}
                  step={1}
                  style={{ "--ml-slider-hue-color": `hsl(${hue} 100% 50%)` }}
                  onValueChange={([nextValue]) => setHue(nextValue ?? hue)}
                />
              </label>
            </div>
          </div>
        </AppSurface>

        <AppSurface title="Color control examples" description="Live examples of the shared color slider wrapper and the reusable color picker used by route-owned visual controls.">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(18rem,1.15fr)]">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Palette aria-hidden="true" className="size-4 text-brand-orange" />
                  ColorSlider via RangeControl
                </div>
                <ColorSlider
                  label="Lamp hue"
                  channel="hue"
                  value={colorSliderHue}
                  min={0}
                  max={360}
                  step={1}
                  unit="°"
                  description="This is the ColorSlider wrapper after moving onto the shared split-pill range treatment."
                  valueFormatter={(value) => `${Math.round(value)}°`}
                  onChange={setColorSliderHue}
                />
              </div>

              <div className="grid gap-2 rounded-md border border-border/60 bg-background/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">Color picker swatch</span>
                  <span className="font-mono text-xs text-muted-foreground">{swatchColor}</span>
                </div>
                <ColorPickerSwatch
                  label="Dev swatch color"
                  value={swatchColor}
                  fallback="#ff7a1a"
                  onChange={setSwatchColor}
                />
              </div>
            </div>

            <GlobalColorPicker
              title="Color picker"
              description="This is the full shared picker surface, including swatches and the updated hue slider inside the popover."
              value={pickerColors}
              onChange={setPickerColors}
            />
          </div>
        </AppSurface>
      </div>
    </section>
  )
}
