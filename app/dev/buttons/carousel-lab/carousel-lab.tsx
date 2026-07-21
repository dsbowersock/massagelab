"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { BackgroundLabSurface } from "./background-lab-surface"
import {
  CAROUSEL_LAB_STORAGE_KEY,
  getCarouselLabViewportProfileLabel,
  getDefaultCarouselLabTuning,
  getResponsiveBackgroundTuning,
  parseCarouselLabStorage,
  resolveCarouselLabViewportProfile,
  sanitizeCarouselLabTuning,
  serializeCarouselLabStorage,
} from "./carousel-lab-model"
import { StationLabSurface } from "./station-lab-surface"
import { TuningPanel } from "./tuning-panel"

type CarouselSurface = "backgrounds" | "stations"
type CarouselPresentation = "existing" | "cover-flow" | "three-d" | "background-picker"
type CarouselViewportProfile =
  | "phone-portrait"
  | "short-landscape"
  | "tablet"
  | "compact-desktop"
  | "wide-landscape"

const SURFACES: readonly { value: CarouselSurface; label: string }[] = [
  { value: "backgrounds", label: "Backgrounds" },
  { value: "stations", label: "Music Stations" },
]

const PRESENTATIONS: readonly {
  value: CarouselPresentation
  label: string
}[] = [
  { value: "existing", label: "Existing" },
  { value: "background-picker", label: "Background Picker" },
]

/**
 * Hosts the two selected device-local tuning records while mounting only the
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
  const [viewportProfile, setViewportProfile] =
    useState<CarouselViewportProfile>("compact-desktop")
  const previewColumnRef = useRef<HTMLDivElement>(null)
  const availablePresentations = PRESENTATIONS.filter((option) =>
    surface === "stations"
      ? option.value === "background-picker"
      : option.value !== "background-picker",
  )

  useEffect(() => {
    try {
      setRecords(parseCarouselLabStorage(window.localStorage.getItem(CAROUSEL_LAB_STORAGE_KEY)))
    } catch {
      setRecords(parseCarouselLabStorage(null))
    }
    setStorageHydrated(true)
  }, [])

  useEffect(() => {
    const previewColumn = previewColumnRef.current
    if (!previewColumn) return

    let frame: number | null = null
    const measure = () => {
      frame = null
      const nextProfile = resolveCarouselLabViewportProfile({
        containerWidth: previewColumn.getBoundingClientRect().width,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }) as CarouselViewportProfile
      setViewportProfile((current) => current === nextProfile ? current : nextProfile)
    }
    const scheduleMeasure = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(previewColumn)
    window.addEventListener("resize", scheduleMeasure)
    scheduleMeasure()

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", scheduleMeasure)
      if (frame !== null) cancelAnimationFrame(frame)
    }
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
  const storedTuning = records[pairKey]
  const responsiveSizing = surface === "backgrounds"
    && presentation === "existing"
    && storedTuning.responsive !== false
  const tuning = responsiveSizing
    ? getResponsiveBackgroundTuning(viewportProfile, storedTuning)
    : storedTuning
  const reducedMotion = deviceReducedMotion || tuning.motion === false
  const surfaceLabel = SURFACES.find((option) => option.value === surface)?.label ?? surface
  const presentationLabel =
    PRESENTATIONS.find((option) => option.value === presentation)?.label ?? presentation
  const screenFitLabel = responsiveSizing
    ? getCarouselLabViewportProfileLabel(viewportProfile)
    : surface === "backgrounds" ? "Manual" : "Fixed on every device"

  const handleSurfaceChange = (nextSurface: CarouselSurface) => {
    setEffectiveLoop(false)
    setPresentation(nextSurface === "stations" ? "background-picker" : "existing")
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
          Review the selected Existing Background and Music Station Background Picker treatments with real cards.
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
            {availablePresentations.map((option) => (
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
        {Number(tuning.cardWidth)}px · Height: {Number(tuning.cardHeight)}px · Gap:{" "}
        {Number(tuning.gap)}px · Nearby radius:{" "}
        {Number(tuning.visibleRadius)} · Screen fit: {screenFitLabel} · Loop:{" "}
        {effectiveLoop ? "On" : "Off"} · Motion:{" "}
        {reducedMotion ? "Reduced-motion rail" : "On"}
      </p>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div
          ref={previewColumnRef}
          className="min-w-0"
          data-carousel-responsive-profile={responsiveSizing ? viewportProfile : undefined}
        >
          {surface === "backgrounds" ? (
            <BackgroundLabSurface
              key={pairKey}
              presentation={presentation === "background-picker" ? "existing" : presentation}
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
          responsiveSizing={responsiveSizing}
          responsiveProfileLabel={getCarouselLabViewportProfileLabel(viewportProfile)}
          onChange={updateCurrentTuning}
          onReset={resetCurrentTuning}
        />
      </div>
    </section>
  )
}
