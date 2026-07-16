"use client"

import * as React from "react"
import { Filter, Palette, Search } from "lucide-react"

import { ColorPickerInput, ColorPickerSwatch } from "@/components/chimer-controls"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SelectField } from "@/components/ui/select-field"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SliderGallery } from "./slider-gallery"
import { ReviewState, ReviewStateGrid } from "./review-state-grid"

const savedColors = ["#ff5119", "#4AAAAA", "#b719ff", "#4671dc", "#56a15f"]

export function FieldGallery() {
  const [radixValue, setRadixValue] = React.useState("standard")
  const [routeValue, setRouteValue] = React.useState("setup")
  const [pickerColor, setPickerColor] = React.useState("#ff5119")
  const [adminEnabled, setAdminEnabled] = React.useState(true)

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="field-family-heading">
        <div>
          <h2 id="field-family-heading" className="text-2xl font-semibold">Text inputs and textareas</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Density, inset construction, route tone, and validation status are shared field options rather than copied route classes.
          </p>
        </div>

        <AppSurface title="Input matrix" description="Each example keeps native input semantics and the same focus-visible policy.">
          <ReviewStateGrid>
            <ReviewState label="Base">
              <Input aria-label="Base input" name="review-base-input" placeholder="Default field" />
            </ReviewState>
            <ReviewState label="Focus visible" note="Tab into the field to inspect the ring.">
              <Input aria-label="Focus input" name="review-focus-input" defaultValue="Keyboard focus" />
            </ReviewState>
            <ReviewState label="Disabled">
              <Input aria-label="Disabled input" name="review-disabled-input" value="Unavailable" disabled readOnly />
            </ReviewState>
            <ReviewState label="Error">
              <Input aria-label="Error input" name="review-error-input" status="error" value="Invalid value" readOnly />
            </ReviewState>
            <ReviewState label="Compact">
              <Input aria-label="Compact input" name="review-compact-input" density="compact" surface="inset" placeholder="Compact inset" />
            </ReviewState>
            <ReviewState label="Anatomime tone">
              <Input aria-label="Anatomime input" name="review-anatomime-input" tone="anatomime" surface="cutout" value="Team 1" readOnly />
            </ReviewState>
          </ReviewStateGrid>
        </AppSurface>

        <div className="grid gap-4 lg:grid-cols-2">
          <AppSurface title="Textarea states" description="Long-form fields use the same density and validation contract.">
            <div className="grid gap-3">
              <Textarea aria-label="Default textarea" name="review-default-textarea" placeholder="Session notes" />
              <Textarea aria-label="Inset textarea" name="review-inset-textarea" surface="inset" density="compact" defaultValue="Compact inset treatment" />
              <Textarea aria-label="Error textarea" name="review-error-textarea" status="error" defaultValue="Needs more detail" />
              <Textarea aria-label="Disabled textarea" name="review-disabled-textarea" disabled value="Locked during review" readOnly />
            </div>
          </AppSurface>

          <AppSurface title="Route tones" description="Approved route palettes change accents without changing field construction.">
            <div className="grid gap-3">
              <Input aria-label="Setup tone field" name="review-setup-input" tone="setup" surface="cutout" value="Chimer setup" readOnly />
              <Input aria-label="Anatomime tone field" name="review-anatomime-tone-input" tone="anatomime" surface="cutout" value="Anatomime team" readOnly />
              <Textarea aria-label="Setup tone textarea" name="review-setup-textarea" tone="setup" surface="inset" defaultValue="Shared setup treatment" />
            </div>
          </AppSurface>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="select-family-heading">
        <div>
          <h2 id="select-family-heading" className="text-2xl font-semibold">Select fields and dropdowns</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Native and Radix adapters expose the same density, surface, tone, disabled, and error vocabulary.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AppSurface title="Native SelectField" description="Use the native adapter where browser-native selection is preferable.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Default" defaultValue="standard">
                <option value="standard">Standard</option>
                <option value="compact">Compact</option>
              </SelectField>
              <SelectField label="Compact cutout" density="compact" surface="cutout" defaultValue="digital">
                <option value="digital">Digital</option>
                <option value="mono">Mono</option>
              </SelectField>
              <SelectField label="Setup tone" tone="setup" surface="inset" value={routeValue} onChange={(event) => setRouteValue(event.target.value)}>
                <option value="setup">Setup</option>
                <option value="running">Running</option>
              </SelectField>
              <SelectField label="Error" errorMessage="Choose an available option" defaultValue="">
                <option value="">Select one</option>
                <option value="available">Available</option>
              </SelectField>
              <SelectField label="Disabled" disabled defaultValue="disabled">
                <option value="disabled">Disabled</option>
              </SelectField>
            </div>
          </AppSurface>

          <AppSurface title="Radix Select" description="Portaled menus retain shared trigger construction and keyboard navigation.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 text-sm font-medium">
                <span>Default</span>
                <Select value={radixValue} onValueChange={setRadixValue}>
                  <SelectTrigger aria-label="Default Radix select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="dense">Dense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5 text-sm font-medium">
                <span>Compact cutout</span>
                <Select defaultValue="clock">
                  <SelectTrigger aria-label="Compact cutout Radix select" density="compact" surface="cutout" tone="setup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clock">Clock</SelectItem>
                    <SelectItem value="visual">Visual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5 text-sm font-medium">
                <span>Error</span>
                <Select defaultValue="error">
                  <SelectTrigger aria-label="Error Radix select" status="error" aria-describedby="radix-select-error">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Unavailable choice</SelectItem>
                  </SelectContent>
                </Select>
                <span id="radix-select-error" className="text-xs text-destructive">Review this selection.</span>
              </div>

              <div className="grid gap-1.5 text-sm font-medium">
                <span>Disabled</span>
                <Select disabled defaultValue="disabled">
                  <SelectTrigger aria-label="Disabled Radix select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="disabled">Disabled</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </AppSurface>
        </div>
      </section>

      <AppSurface title="Dense admin filters" description="Admin density uses shared field, select, switch, and button families.">
        <div className="grid gap-2 md:grid-cols-[minmax(10rem,1fr)_minmax(9rem,0.6fr)_auto_auto] md:items-end">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Search
            <span className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2" aria-hidden="true" />
              <Input name="admin-review-search" density="dense" surface="cutout" className="pl-7" placeholder="Media or anatomy item" />
            </span>
          </label>
          <SelectField label="Status" density="dense" surface="cutout" defaultValue="needs-review">
            <option value="needs-review">Needs review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </SelectField>
          <label className="flex h-8 items-center gap-2 text-xs font-medium">
            <Switch size="dense" tone="leaf" checked={adminEnabled} onCheckedChange={setAdminEnabled} />
            Active
          </label>
          <Button size="compact" variant="outline">
            <Filter aria-hidden="true" />
            Apply
          </Button>
        </div>
      </AppSurface>

      <AppSurface title="Color controls" description="ColorPickerInput, ColorPickerSwatch, saved colors, harmony, and channel sliders remain one shared family.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid gap-4">
            <ColorPickerInput label="ColorPickerInput" value={pickerColor} onValueChange={setPickerColor} />
            <div className="grid gap-2">
              <p className="text-sm font-semibold">ColorPickerSwatch</p>
              <ColorPickerSwatch label="Review swatch" value={pickerColor} fallback="#ff5119" onChange={setPickerColor} />
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Palette className="size-4 text-primary" aria-hidden="true" />
              Saved palette row
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Saved palette row">
              {savedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="size-10 rounded-md border-2 border-white/20 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: color }}
                  aria-label={`Use saved color ${color}`}
                  aria-pressed={pickerColor === color}
                  onClick={() => setPickerColor(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </AppSurface>

      <SliderGallery />
    </div>
  )
}
