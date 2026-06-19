"use client"

import { Pause, Play, Square, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { useMusic } from "./music-provider"

export function MusicMiniPlayer({ compact = false }: { compact?: boolean }) {
  const music = useMusic()
  const hasStation = Boolean(music.activeStationId)

  if (!hasStation && music.playbackState !== "failed") {
    return null
  }

  if (music.miniPlayerCollapsed || compact) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-md border border-border/80 bg-card/95 px-3 py-2 shadow-xl shadow-black/30 backdrop-blur">
          <span className="max-w-[11rem] truncate text-xs font-medium">
            {music.activeStationTitle ?? "Atmosphere"}
          </span>
          <Button size="sm" variant="secondary" onClick={() => void music.stopCurrent()}>
            <Square aria-hidden="true" />
            Stop
          </Button>
          {!compact ? (
            <Button size="sm" variant="ghost" onClick={() => music.setMiniPlayerCollapsed(false)}>
              Expand
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-md border border-border/80 bg-card/95 p-3 shadow-2xl shadow-black/35 backdrop-blur sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{music.activeStationTitle ?? "Atmosphere"}</p>
          <p className={cn("text-xs text-muted-foreground", music.error && "text-destructive")}>
            {music.error ?? playerStatusLabel(music.playbackState)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (music.activeStationId) void music.playStation(music.activeStationId)
            }}
            disabled={!music.activeStationId || music.playbackState === "loading"}
          >
            {music.playbackState === "playing" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {music.playbackState === "playing" ? "Restart" : "Play"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void music.stopCurrent()}>
            <Square aria-hidden="true" />
            Stop
          </Button>
        </div>
        <label className="flex min-w-36 items-center gap-2 text-xs text-muted-foreground">
          <Volume2 aria-hidden="true" className="size-4 shrink-0" />
          <Slider
            aria-label="Atmosphere volume"
            min={0}
            max={1}
            step={0.05}
            value={[music.volume]}
            onValueChange={([value]) => music.setVolume(value ?? 0.75)}
          />
        </label>
        <Button size="sm" variant="ghost" onClick={() => music.setMiniPlayerCollapsed(true)}>
          Collapse
        </Button>
      </div>
    </div>
  )
}

function playerStatusLabel(state: string) {
  if (state === "loading") return "Preparing audio..."
  if (state === "playing") return "Playing"
  if (state === "stopped") return "Stopped"
  return "Ready"
}
