"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { BackgroundLabSurface } from "./background-lab-surface"
import {
  CAROUSEL_LAB_STORAGE_KEY,
  getDefaultCarouselLabTuning,
  parseCarouselLabStorage,
  sanitizeCarouselLabTuning,
  serializeCarouselLabStorage,
} from "./carousel-lab-model"
import { StationLabSurface } from "./station-lab-surface"
import { TuningPanel } from "./tuning-panel"

type CarouselSurface = "backgrounds" | "stations"
type CarouselPresentation = "existing" | "cover-flow" | "three-d"

const SURFACES: readonly { value: CarouselSurface; label: string }[] = [
  { value: "backgrounds", label: "Backgrounds" },
  { value: "stations", label: "Music Stations" },
]

const PRESENTATIONS: readonly { value: CarouselPresentation; label: string }[] = [
  { value: "existing", label: "Existing" },
  { value: "cover-flow", label: "Cover Flow" },
  { value: "three-d", label: "3D Carousel" },
]

/**
 * Hosts six independent device-local tuning records while mounting only the
 * currently selected prototype surface.
 */
export function CarouselLab() {
  const [surface, setSurface] = useState<CarouselSurface>("backgrounds")
  const [presentation, setPresentation] =
    useState<CarouselPresentation>("existing")
  const [records, setRecords] = useState(() => parseCarouselLabStorage(null))
  const [storageHydrated, setStorageHydrated] = useState(false)
  const [deviceReducedMotion, setDeviceReducedMotion] = useState(false)
  const [effectiveLoop, setEffectiveLoop] = useState(false)

  useEffect(() => {
    try {
      setRecords(parseCarouselLabStorage(window.localStorage.getItem(CAROUSEL_LAB_STORAGE_KEY)))
    } catch {
      setRecords(parseCarouselLabStorage(null))
    }
    setStorageHydrated(true)
  }, [])

  useEffect(() => {
    if (!storageHydrated) return
    try {
      window.localStorage.setItem(CAROUSEL_LAB_STORAGE_KEY, serializeCarouselLabStorage(records))
    } catch {
      // Device-only review tuning stays usable in memory when storage is denied.
    }
  }, [records, storageHydrated])

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setDeviceReducedMotion(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  const pairKey = `${surface}:${presentation}`
  const tuning = records[pairKey]
  const reducedMotion = deviceReducedMotion || tuning.motion === false
  const surfaceLabel = SURFACES.find((option) => option.value === surface)?.label ?? surface
  const presentationLabel =
    PRESENTATIONS.find((option) => option.value === presentation)?.label ?? presentation

  const handleSurfaceChange = (nextSurface: CarouselSurface) => {
    setEffectiveLoop(false)
    setSurface(nextSurface)
  }

  const handlePresentationChange = (nextPresentation: CarouselPresentation) => {
    setEffectiveLoop(false)
    setPresentation(nextPresentation)
  }

  const updateCurrentTuning = (next: Record<string, number | boolean>) => {
    setRecords((current) => ({
      ...current,
      [pairKey]: sanitizeCarouselLabTuning(surface, presentation, next),
    }))
  }

  const resetCurrentTuning = () => {
    setRecords((current) => ({
      ...current,
      [pairKey]: getDefaultCarouselLabTuning(surface, presentation),
    }))
  }

  return (
    <section data-testid="carousel-lab" className="grid gap-6" aria-labelledby="carousel-lab-title">
      <header className="space-y-2">
        <h2 id="carousel-lab-title" className="text-2xl font-semibold">
          Carousel comparison lab
        </h2>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Compare the existing rail, Cover Flow, and 3D treatments with real Background and Music Station cards.
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Surface</p>
          <div role="radiogroup" aria-label="Surface" className="flex flex-wrap gap-2">
            {SURFACES.map((option) => (
              <Button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={surface === option.value}
                variant={surface === option.value ? "default" : "outline"}
                data-testid={`carousel-surface-${option.value}`}
                onClick={() => handleSurfaceChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Presentation</p>
          <div role="radiogroup" aria-label="Presentation" className="flex flex-wrap gap-2">
            {PRESENTATIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={presentation === option.value}
                variant={presentation === option.value ? "default" : "outline"}
                data-testid={`carousel-presentation-${option.value}`}
                onClick={() => handlePresentationChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <p
        data-testid="carousel-lab-summary"
        className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      >
        Surface: {surfaceLabel} · Presentation: {presentationLabel} · Card width:{" "}
        {Number(tuning.cardWidth)}px · Gap: {Number(tuning.gap)}px · Nearby radius:{" "}
        {Number(tuning.visibleRadius)} · Loop: {effectiveLoop ? "On" : "Off"} · Motion:{" "}
        {reducedMotion ? "Reduced-motion rail" : "On"}
      </p>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {surface === "backgrounds" ? (
            <BackgroundLabSurface
              key={pairKey}
              presentation={presentation}
              tuning={tuning}
              reducedMotion={reducedMotion}
              onEffectiveLoopChange={setEffectiveLoop}
            />
          ) : (
            <StationLabSurface
              key={pairKey}
              presentation={presentation}
              tuning={tuning}
              reducedMotion={reducedMotion}
              onEffectiveLoopChange={setEffectiveLoop}
            />
          )}
        </div>

        <TuningPanel
          surface={surface}
          presentation={presentation}
          value={tuning}
          effectiveLoop={effectiveLoop}
          reducedMotion={reducedMotion}
          onChange={updateCurrentTuning}
          onReset={resetCurrentTuning}
        />
      </div>
    </section>
  )
}
