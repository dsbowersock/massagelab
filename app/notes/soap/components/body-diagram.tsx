"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getAnatomyTerms } from "@/lib/anatomy"
import type { PainMapSelection, PainMapSide, PainMapView } from "../types"

interface BodyDiagramProps {
  formData: any
  setFormData: (data: any) => void
}

const regionOptions = [
  { id: "head-neck", label: "Head / Neck", view: "front", anatomyRegion: "head" },
  { id: "shoulder-left", label: "Left Shoulder", view: "front", anatomyRegion: "upper-extremity" },
  { id: "shoulder-right", label: "Right Shoulder", view: "front", anatomyRegion: "upper-extremity" },
  { id: "chest", label: "Chest", view: "front", anatomyRegion: "thorax" },
  { id: "abdomen", label: "Abdomen", view: "front", anatomyRegion: "abdomen" },
  { id: "arm-left", label: "Left Arm", view: "front", anatomyRegion: "upper-extremity" },
  { id: "arm-right", label: "Right Arm", view: "front", anatomyRegion: "upper-extremity" },
  { id: "hip-left", label: "Left Hip", view: "front", anatomyRegion: "pelvis" },
  { id: "hip-right", label: "Right Hip", view: "front", anatomyRegion: "pelvis" },
  { id: "leg-left", label: "Left Leg", view: "front", anatomyRegion: "lower-extremity" },
  { id: "leg-right", label: "Right Leg", view: "front", anatomyRegion: "lower-extremity" },
  { id: "upper-back", label: "Upper Back", view: "back", anatomyRegion: "spine" },
  { id: "mid-back", label: "Mid Back", view: "back", anatomyRegion: "spine" },
  { id: "low-back", label: "Low Back", view: "back", anatomyRegion: "spine" },
  { id: "gluteal-pelvis", label: "Gluteal / Pelvis", view: "back", anatomyRegion: "pelvis" },
  { id: "posterior-leg", label: "Posterior Leg", view: "back", anatomyRegion: "lower-extremity" },
] as const

const symptomOptions = ["pain", "tender point", "trigger point", "hypertonicity", "spasm", "inflammation", "restriction"]
const descriptorOptions = ["dull", "sharp", "aching", "burning", "tingling", "radiating", "stiff", "pressure"]

function createSelection(regionId: string): PainMapSelection {
  const region = regionOptions.find((option) => option.id === regionId) ?? regionOptions[0]
  const side: PainMapSide = region.id.includes("left") ? "left" : region.id.includes("right") ? "right" : "center"

  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${regionId}-${Date.now()}`,
    regionId: region.id,
    side,
    view: region.view as PainMapView,
    intensity: 5,
    symptomTypes: ["pain"],
    descriptors: [],
    notes: "",
    anatomyTermIds: [],
  }
}

export function BodyDiagram({ formData, setFormData }: BodyDiagramProps) {
  const bodyDiagram = formData.bodyDiagram || {}
  const selections: PainMapSelection[] = Array.isArray(bodyDiagram.painMapSelections) ? bodyDiagram.painMapSelections : []
  const [selectedRegionId, setSelectedRegionId] = useState<string>(regionOptions[0].id)

  const candidatesByRegion = useMemo(() => {
    return Object.fromEntries(
      regionOptions.map((region) => [
        region.id,
        getAnatomyTerms({
          kinds: ["muscle"],
          regions: [region.anatomyRegion],
          difficulty: "medium",
        }).slice(0, 8),
      ]),
    )
  }, [])

  const updateBodyDiagram = (next: Partial<typeof bodyDiagram>) => {
    setFormData({
      ...formData,
      bodyDiagram: {
        regions: "",
        notes: "",
        painMapSelections: [],
        googleImportNotes: "",
        ...bodyDiagram,
        ...next,
      },
    })
  }

  const updateSelection = (selectionId: string, next: Partial<PainMapSelection>) => {
    updateBodyDiagram({
      painMapSelections: selections.map((selection) => (
        selection.id === selectionId ? { ...selection, ...next } : selection
      )),
    })
  }

  const toggleArrayValue = (values: string[], value: string, checked: boolean) => {
    return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value)
  }

  const addSelection = () => {
    updateBodyDiagram({
      painMapSelections: [...selections, createSelection(selectedRegionId)],
    })
  }

  const removeSelection = (selectionId: string) => {
    updateBodyDiagram({
      painMapSelections: selections.filter((selection) => selection.id !== selectionId),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Body Map</CardTitle>
        <CardDescription>
          Select client-reported areas, map symptoms to likely muscles, and keep Google-era imports as local notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="rounded-md border border-neutral-800 bg-background/70 p-4">
              <div className="mb-3 text-sm font-medium text-muted-foreground">Front / Back Regions</div>
              <div className="grid grid-cols-2 gap-2">
                {regionOptions.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => setSelectedRegionId(region.id)}
                    className={`min-h-12 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedRegionId === region.id
                        ? "border-brand-orange bg-primary/20 text-foreground"
                        : "border-neutral-800 bg-black/20 text-muted-foreground hover:border-brand-orange/60"
                    }`}
                  >
                    {region.label}
                  </button>
                ))}
              </div>
              <Button type="button" onClick={addSelection} className="mt-4 w-full bg-primary hover:bg-brand-orange-glow">
                <Plus className="mr-2 h-4 w-4" />
                Add Selection
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="googleImportNotes">Google Forms / Sheets Import Notes</Label>
              <Textarea
                id="googleImportNotes"
                value={bodyDiagram.googleImportNotes || ""}
                onChange={(event) => updateBodyDiagram({ googleImportNotes: event.target.value })}
                placeholder="Paste or summarize legacy Google Forms/Sheets pain-map data before converting it into selections."
                className="min-h-[120px]"
              />
            </div>
          </div>

          <div className="space-y-4">
            {selections.length > 0 ? selections.map((selection) => {
              const region = regionOptions.find((option) => option.id === selection.regionId)
              const anatomyCandidates = candidatesByRegion[selection.regionId] ?? []

              return (
                <div key={selection.id} className="rounded-md border border-neutral-800 bg-background/70 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{region?.label ?? selection.regionId}</div>
                      <div className="text-sm text-muted-foreground">{selection.view} view</div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSelection(selection.id)} aria-label="Remove pain map selection">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Side</Label>
                      <Select value={selection.side} onValueChange={(value) => updateSelection(selection.id, { side: value as PainMapSide })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="bilateral">Bilateral</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>View</Label>
                      <Select value={selection.view} onValueChange={(value) => updateSelection(selection.id, { view: value as PainMapView })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="front">Front</SelectItem>
                          <SelectItem value="back">Back</SelectItem>
                          <SelectItem value="side">Side</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`intensity-${selection.id}`}>Intensity: {selection.intensity}/10</Label>
                      <input
                        id={`intensity-${selection.id}`}
                        type="range"
                        min="0"
                        max="10"
                        value={selection.intensity}
                        onChange={(event) => updateSelection(selection.id, { intensity: Number(event.target.value) })}
                        className="w-full accent-brand-orange"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <SelectionChecks
                      label="Symptoms"
                      values={selection.symptomTypes}
                      options={symptomOptions}
                      onChange={(value, checked) => updateSelection(selection.id, {
                        symptomTypes: toggleArrayValue(selection.symptomTypes, value, checked),
                      })}
                    />
                    <SelectionChecks
                      label="Descriptors"
                      values={selection.descriptors}
                      options={descriptorOptions}
                      onChange={(value, checked) => updateSelection(selection.id, {
                        descriptors: toggleArrayValue(selection.descriptors, value, checked),
                      })}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label>Likely muscles to assess</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {anatomyCandidates.map((term: any) => (
                        <label key={term.id} className="flex items-center gap-2 rounded-md border border-neutral-800 bg-black/20 p-2 text-sm">
                          <Checkbox
                            checked={selection.anatomyTermIds.includes(term.id)}
                            onCheckedChange={(checked) => updateSelection(selection.id, {
                              anatomyTermIds: toggleArrayValue(selection.anatomyTermIds, term.id, Boolean(checked)),
                            })}
                          />
                          <span>{term.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`notes-${selection.id}`}>Selection Notes</Label>
                    <Textarea
                      id={`notes-${selection.id}`}
                      value={selection.notes}
                      onChange={(event) => updateSelection(selection.id, { notes: event.target.value })}
                      className="min-h-[90px]"
                    />
                  </div>
                </div>
              )
            }) : (
              <div className="rounded-md border border-dashed border-neutral-700 p-6 text-sm text-muted-foreground">
                No body-map selections yet. Choose a region and add a selection to start mapping client-reported symptoms.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="regions">Legacy Regions / Areas</Label>
            <Textarea
              id="regions"
              value={bodyDiagram.regions || ""}
              onChange={(event) => updateBodyDiagram({ regions: event.target.value })}
              placeholder="Optional free-text body map notes retained for older SOAP exports."
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bodyNotes">Additional Notes</Label>
            <Textarea
              id="bodyNotes"
              value={bodyDiagram.notes || ""}
              onChange={(event) => updateBodyDiagram({ notes: event.target.value })}
              className="min-h-[100px]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SelectionChecks({
  label,
  values,
  options,
  onChange,
}: {
  label: string
  values: string[]
  options: string[]
  onChange: (value: string, checked: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <Checkbox checked={values.includes(option)} onCheckedChange={(checked) => onChange(option, Boolean(checked))} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
