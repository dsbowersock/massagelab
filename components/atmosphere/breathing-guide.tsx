"use client"

import { Pause, Play, RotateCcw, Wind } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BreathingPhase = {
  label: string
  seconds: number
  scale: number
}

type BreathingPreset = {
  id: string
  title: string
  description: string
  phases: BreathingPhase[]
}

const tickMs = 250

const breathingPresets: BreathingPreset[] = [
  {
    id: "coherent",
    title: "Coherent",
    description: "5 in, 5 out",
    phases: [
      { label: "Inhale", seconds: 5, scale: 1.08 },
      { label: "Exhale", seconds: 5, scale: 0.94 },
    ],
  },
  {
    id: "box",
    title: "Box",
    description: "4 sides",
    phases: [
      { label: "Inhale", seconds: 4, scale: 1.08 },
      { label: "Hold", seconds: 4, scale: 1.08 },
      { label: "Exhale", seconds: 4, scale: 0.94 },
      { label: "Hold", seconds: 4, scale: 0.94 },
    ],
  },
  {
    id: "settle",
    title: "Settle",
    description: "4, 7, 8",
    phases: [
      { label: "Inhale", seconds: 4, scale: 1.08 },
      { label: "Hold", seconds: 7, scale: 1.08 },
      { label: "Exhale", seconds: 8, scale: 0.94 },
    ],
  },
]

export function AtmosphereBreathingGuide() {
  const [presetId, setPresetId] = useState("coherent")
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const preset = useMemo(
    () => breathingPresets.find((candidate) => candidate.id === presetId) ?? breathingPresets[0],
    [presetId],
  )
  const totalMs = preset.phases.reduce((sum, phase) => sum + phase.seconds * 1000, 0)
  const current = getBreathingPhase(preset, totalMs > 0 ? elapsedMs % totalMs : 0)
  const cycleCount = totalMs > 0 ? Math.floor(elapsedMs / totalMs) : 0
  const remainingSeconds = Math.max(0, Math.ceil((current.phaseDurationMs - current.phaseElapsedMs) / 1000))
  const phaseProgress = current.phaseDurationMs > 0 ? current.phaseElapsedMs / current.phaseDurationMs : 0
  const ringDegrees = Math.round(Math.min(1, Math.max(0, phaseProgress)) * 360)

  useEffect(() => {
    if (!isRunning) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setElapsedMs((value) => value + tickMs)
    }, tickMs)

    return () => window.clearInterval(intervalId)
  }, [isRunning])

  function selectPreset(nextPresetId: string) {
    setPresetId(nextPresetId)
    setElapsedMs(0)
    setIsRunning(false)
  }

  function resetBreathing() {
    setElapsedMs(0)
    setIsRunning(false)
  }

  return (
    <AppSurface
      title="Breathing guide"
      description="A public calmness tool for pacing breath before, during, or after a session."
      icon={<Wind aria-hidden="true" className="size-5" />}
      badge="Public"
      contentClassName="gap-5"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(14rem,0.6fr)] lg:items-center">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {breathingPresets.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                variant={candidate.id === preset.id ? "default" : "outline"}
                onClick={() => selectPreset(candidate.id)}
                className="h-auto flex-col items-start gap-0 px-3 py-2 text-left"
              >
                <span>{candidate.title}</span>
                <span className={cn(
                  "text-xs font-normal",
                  candidate.id === preset.id ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
                >
                  {candidate.description}
                </span>
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setIsRunning((value) => !value)}>
              {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {isRunning ? "Pause breathing" : "Start breathing"}
            </Button>
            <Button type="button" variant="outline" onClick={resetBreathing}>
              <RotateCcw aria-hidden="true" />
              Reset breathing
            </Button>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            className="grid aspect-square w-full max-w-56 place-items-center rounded-full border border-border/80 p-2 transition-transform duration-700 ease-in-out"
            style={{
              background: `conic-gradient(hsl(var(--primary)) ${ringDegrees}deg, hsl(var(--muted)) ${ringDegrees}deg)`,
              transform: `scale(${current.phase.scale})`,
            }}
          >
            <div className="grid size-full place-items-center rounded-full bg-card text-center shadow-inner">
              <div aria-live="polite">
                <p className="text-sm font-medium text-primary">{current.phase.label}</p>
                <p className="mt-1 text-4xl font-semibold tabular-nums">{remainingSeconds}</p>
                <p className="mt-1 text-xs text-muted-foreground">Cycle {cycleCount + 1}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {preset.phases.map((phase, index) => (
          <div
            key={`${preset.id}-${index}-${phase.label}`}
            className={cn(
              "rounded-md border border-border/80 bg-background/70 p-3 text-sm",
              index === current.phaseIndex && "border-primary/70 bg-primary/10",
            )}
          >
            <p className="font-medium">{phase.label}</p>
            <p className="text-xs text-muted-foreground">{phase.seconds}s</p>
          </div>
        ))}
      </div>
    </AppSurface>
  )
}

function getBreathingPhase(preset: BreathingPreset, elapsedWithinCycleMs: number) {
  // Walk the preset timeline so the visual phase, countdown, and highlighted
  // phase chip stay derived from one elapsed-time value.
  let cursorMs = 0

  for (let phaseIndex = 0; phaseIndex < preset.phases.length; phaseIndex += 1) {
    const phase = preset.phases[phaseIndex]
    const phaseDurationMs = phase.seconds * 1000
    if (elapsedWithinCycleMs < cursorMs + phaseDurationMs) {
      return {
        phase,
        phaseIndex,
        phaseDurationMs,
        phaseElapsedMs: elapsedWithinCycleMs - cursorMs,
      }
    }

    cursorMs += phaseDurationMs
  }

  const fallbackPhaseIndex = Math.max(0, preset.phases.length - 1)
  const fallbackPhase = preset.phases[fallbackPhaseIndex]
  return {
    phase: fallbackPhase,
    phaseIndex: fallbackPhaseIndex,
    phaseDurationMs: fallbackPhase.seconds * 1000,
    phaseElapsedMs: fallbackPhase.seconds * 1000,
  }
}
