"use client"

import { Heart, Play, Radio, Square } from "lucide-react"
import { AppNotice, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { useMusic } from "@/components/providers/music-provider"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"

const stations = getVisibleAtmosphereStations()

export function AtmosphereWorkspace() {
  const music = useMusic()

  return (
    <AppPageShell width="full" contentClassName="pb-28">
      <section className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-normal text-primary">Atmosphere</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              MassageLab-hosted audio stations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Start the proof station, move to another MassageLab tool, and the bottom player keeps control of the sound.
            </p>
          </div>
          <AppNotice
            tone="accent"
            title="Runtime spike"
            description="Generative.fm packages are installed and attributed, while imported sample-heavy pieces stay disabled until sample hosting is verified."
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {stations.map((station) => {
          const isActive = music.activeStationId === station.id
          const isFavorite = music.favorites.includes(station.id)

          return (
            <AppSurface
              key={station.id}
              title={station.title}
              icon={<Radio aria-hidden="true" className="size-5" />}
              badge={station.enabled ? "Playable" : "Probe"}
              className={cn(isActive && "border-primary/70")}
              contentClassName="gap-4"
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{station.description}</p>
                <p className="text-xs text-muted-foreground">{station.attribution.notice}</p>
                {!station.enabled && station.disabledReason ? (
                  <AppNotice tone="default" title="Not playable yet" description={station.disabledReason} />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void music.playStation(station.id)}
                  disabled={!station.enabled || music.playbackState === "loading"}
                >
                  <Play aria-hidden="true" />
                  {isActive ? "Restart station" : "Play station"}
                </Button>
                {isActive ? (
                  <Button variant="outline" onClick={() => void music.stopCurrent()}>
                    <Square aria-hidden="true" />
                    Stop
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => music.toggleFavorite(station.id)}>
                  <Heart aria-hidden="true" className={cn(isFavorite && "fill-primary text-primary")} />
                  {isFavorite ? "Favorited" : "Favorite"}
                </Button>
              </div>
            </AppSurface>
          )
        })}
      </section>
    </AppPageShell>
  )
}
