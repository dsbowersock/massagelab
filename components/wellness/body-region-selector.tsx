"use client"

import { cn } from "@/lib/utils"

export const BODY_REGION_OPTIONS = [
  "head",
  "neck",
  "shoulders",
  "chest",
  "abdomen",
  "upper back",
  "low back",
  "hips",
  "arms",
  "hands",
  "thighs",
  "knees",
  "calves",
  "ankles",
  "feet",
] as const

type BodyRegion = typeof BODY_REGION_OPTIONS[number]

type RegionButton = {
  id: BodyRegion
  label: string
  className: string
}

const frontRegions: RegionButton[] = [
  { id: "head", label: "Head", className: "col-start-2 row-start-1" },
  { id: "neck", label: "Neck", className: "col-start-2 row-start-2" },
  { id: "shoulders", label: "Shoulders", className: "col-span-3 row-start-3" },
  { id: "chest", label: "Chest", className: "col-start-2 row-start-4" },
  { id: "arms", label: "Arms", className: "col-span-3 row-start-5" },
  { id: "hands", label: "Hands", className: "col-span-3 row-start-6" },
  { id: "abdomen", label: "Abdomen", className: "col-start-2 row-start-7" },
  { id: "hips", label: "Hips", className: "col-start-2 row-start-8" },
  { id: "thighs", label: "Thighs", className: "col-start-2 row-start-9" },
  { id: "knees", label: "Knees", className: "col-start-2 row-start-10" },
  { id: "ankles", label: "Ankles", className: "col-start-2 row-start-11" },
  { id: "feet", label: "Feet", className: "col-start-2 row-start-12" },
]

const backRegions: RegionButton[] = [
  { id: "head", label: "Head", className: "col-start-2 row-start-1" },
  { id: "neck", label: "Neck", className: "col-start-2 row-start-2" },
  { id: "shoulders", label: "Shoulders", className: "col-span-3 row-start-3" },
  { id: "upper back", label: "Upper back", className: "col-start-2 row-start-4" },
  { id: "arms", label: "Arms", className: "col-span-3 row-start-5" },
  { id: "hands", label: "Hands", className: "col-span-3 row-start-6" },
  { id: "low back", label: "Low back", className: "col-start-2 row-start-7" },
  { id: "hips", label: "Hips", className: "col-start-2 row-start-8" },
  { id: "thighs", label: "Thighs", className: "col-start-2 row-start-9" },
  { id: "calves", label: "Calves", className: "col-start-2 row-start-10" },
  { id: "ankles", label: "Ankles", className: "col-start-2 row-start-11" },
  { id: "feet", label: "Feet", className: "col-start-2 row-start-12" },
]

export function BodyRegionSelector({
  selectedRegions,
  onChange,
}: {
  selectedRegions: string[]
  onChange: (regions: string[]) => void
}) {
  const selectedSet = new Set(selectedRegions)

  const toggleRegion = (region: string) => {
    if (selectedSet.has(region)) {
      onChange(selectedRegions.filter((candidate) => candidate !== region))
      return
    }

    onChange([...selectedRegions, region])
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">Body regions</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <BodyRegionMap title="Front" regions={frontRegions} selectedSet={selectedSet} onToggle={toggleRegion} />
        <BodyRegionMap title="Back" regions={backRegions} selectedSet={selectedSet} onToggle={toggleRegion} />
      </div>
      <div aria-hidden="true">
        {selectedRegions.map((region) => (
          <input key={region} name="regions" value={region} type="hidden" readOnly />
        ))}
      </div>
    </fieldset>
  )
}

function BodyRegionMap({
  title,
  regions,
  selectedSet,
  onToggle,
}: {
  title: string
  regions: RegionButton[]
  selectedSet: Set<string>
  onToggle: (region: string) => void
}) {
  return (
    <div className="rounded-md border border-border/80 bg-card p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <div className="mt-2 grid min-h-[470px] grid-cols-3 grid-rows-[repeat(12,minmax(34px,1fr))] gap-1">
        {regions.map((region) => {
          const selected = selectedSet.has(region.id)

          return (
            <button
              key={`${title}-${region.id}`}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(region.id)}
              className={cn(
                "min-h-10 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "border-border/80 bg-background text-foreground hover:border-primary/60 hover:bg-primary/10",
                selected && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                region.className,
              )}
            >
              {region.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
