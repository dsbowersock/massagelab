"use client"

import Link from "next/link"
import { Heart, Play, Radio, Square } from "lucide-react"
import { AppNotice, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { useMusic } from "@/components/providers/music-provider"
import { AtmosphereBreathingGuide } from "@/app/wellness/atmosphere/breathing-guide"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"

const stations = getVisibleAtmosphereStations()
const generativeFmStations = stations.filter((station) => station.sourceType === "generative-fm-piece")
const playableGenerativeFmStationCount = generativeFmStations.filter((station) => station.enabled).length
const pendingGenerativeFmStationCount = generativeFmStations.length - playableGenerativeFmStationCount

export function AtmosphereWorkspace() {
  const music = useMusic()

  return (
    <AppPageShell width="full" contentClassName="pb-28">
      <section className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-normal text-primary">Atmosphere</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Wellness audio stations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Start a station, move to another MassageLab tool, and the bottom player keeps control of the sound.
              {` The proof drone and ${playableGenerativeFmStationCount} Generative.fm ${playableGenerativeFmStationCount === 1 ? "station" : "stations"} are playable now; ${pendingGenerativeFmStationCount} more Generative.fm stations are being prepared.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/wellness">Wellness hub</Link>
              </Button>
            </div>
          </div>
          <AppNotice
            tone="accent"
            title="Generative.fm catalog"
            description="Browse calm generative stations for different treatment-room moods. New stations are added as playback is verified."
          />
        </div>
      </section>

      <AtmosphereBreathingGuide />

      <section className="grid gap-4 lg:grid-cols-2">
        {stations.map((station) => {
          const isActive = music.activeStationId === station.id
          const isFavorite = music.favorites.includes(station.id)

          return (
            <AppSurface
              id={`station-${station.id}`}
              key={station.id}
              title={station.title}
              icon={<Radio aria-hidden="true" className="size-5" />}
              badge={station.enabled ? "Playable" : "Samples pending"}
              className={cn(isActive && "border-primary/70")}
              contentClassName="gap-4"
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{station.description}</p>
                {station.attribution.notice ? (
                  <p className="text-xs text-muted-foreground">{station.attribution.notice}</p>
                ) : null}
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
