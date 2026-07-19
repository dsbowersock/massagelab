"use client"

import { useEffect } from "react"
import { Play, RefreshCw, SkipBack, SkipForward, Square, Volume2, Wallpaper } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  buildMusicVisualizerHref,
  sanitizeMusicVisualizerReturnTo,
} from "@/lib/music-visualizer"
import { cn } from "@/lib/utils"
import { MusicLoadingProgress } from "./music-loading-progress"
import { useMusic } from "./music-provider"

type MusicMiniPlayerPlacement = "top" | "bottom"

export function MusicMiniPlayer({ placement = "bottom" }: { placement?: MusicMiniPlayerPlacement }) {
  const music = useMusic()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasStation = Boolean(music.activeStationId)
  const showPlayer = hasStation || music.playbackState === "failed"
  const isMusicVisualizerRoute =
    pathname === "/clock"
    && searchParams.getAll("source").includes("music")
  const visualizerActionLabel = isMusicVisualizerRoute ? "Minimize visualizer" : "Background"

  const handleVisualizerAction = () => {
    if (isMusicVisualizerRoute) {
      router.push(sanitizeMusicVisualizerReturnTo(searchParams.get("returnTo")))
      return
    }

    const currentSearch = searchParams.toString()
    const returnTo = currentSearch ? `${pathname}?${currentSearch}` : pathname
    router.push(buildMusicVisualizerHref({
      returnTo,
      openBackgroundPanel:
        !music.visualizer.backgroundId
        && !music.visualizer.accountDefaultBackgroundId,
    }))
  }

  useEffect(() => {
    const { body } = document
    body.classList.toggle("ml-music-player-active", showPlayer)
    body.classList.toggle("ml-music-player-top", showPlayer && placement === "top")
    body.classList.toggle("ml-music-player-bottom", showPlayer && placement === "bottom")

    return () => {
      body.classList.remove("ml-music-player-active", "ml-music-player-top", "ml-music-player-bottom")
    }
  }, [placement, showPlayer])

  if (!showPlayer) {
    return null
  }

  const isCollapsed = music.miniPlayerCollapsed
  const isLoading = music.playbackState === "loading"
  const title = music.activeStationTitle ?? "Atmosphere"

  return (
    <div
      className="ml-music-player-toolbar pointer-events-none absolute inset-x-0 z-[10020]"
      data-placement={placement}
      data-testid="music-player-toolbar"
      role="region"
      aria-label="Atmosphere audio player"
    >
      <div className="ml-music-player-toolbar-surface pointer-events-auto bg-card/95 shadow-2xl shadow-black/35 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-screen-2xl items-center gap-2 overflow-x-auto px-3 py-2 sm:px-4 md:gap-3">
          <div className="min-w-[8rem] flex-1">
            <p className="truncate text-sm font-semibold">{title}</p>
            {!isCollapsed ? (
              <p className={cn("truncate text-xs text-muted-foreground", music.error && "text-destructive")}>
                {music.error ?? playerStatusLabel(music.playbackState)}
              </p>
            ) : null}
            {isLoading ? (
              <div className="mt-1 w-full max-w-72">
                <MusicLoadingProgress compact progress={music.loadingProgress} startedAt={music.loadingStartedAt} />
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Previous station"
              title="Previous station"
              className="size-9"
              disabled={isLoading}
              onClick={() => void music.playPreviousStation()}
            >
              <SkipBack aria-hidden="true" />
            </Button>
            {!isCollapsed ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (music.activeStationId) void music.playStation(music.activeStationId)
                }}
                disabled={!music.activeStationId || isLoading}
              >
                {music.playbackState === "playing" ? <RefreshCw aria-hidden="true" /> : <Play aria-hidden="true" />}
                <span className="hidden sm:inline">{music.playbackState === "playing" ? "Restart" : "Play"}</span>
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              aria-label="Next station"
              title="Next station"
              className="size-9"
              disabled={isLoading}
              onClick={() => void music.playNextStation()}
            >
              <SkipForward aria-hidden="true" />
            </Button>
            {hasStation ? (
              <Button
                size={isCollapsed ? "icon" : "sm"}
                variant="secondary"
                aria-label={visualizerActionLabel}
                title={visualizerActionLabel}
                className={cn(isCollapsed && "size-9")}
                onClick={handleVisualizerAction}
              >
                <Wallpaper aria-hidden="true" />
                {!isCollapsed ? <span>{visualizerActionLabel}</span> : null}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void music.stopCurrent()}>
              <Square aria-hidden="true" />
              Stop
            </Button>
          </div>

          {!isCollapsed ? (
            <label className="hidden min-w-36 max-w-56 flex-1 items-center gap-2 text-xs text-muted-foreground md:flex">
              <Volume2 aria-hidden="true" className="size-4 shrink-0" />
              <Slider
                aria-label="Atmosphere volume"
                className="ml-slider-fill-blue"
                min={0}
                max={1}
                step={0.05}
                value={[music.volume]}
                onValueChange={([value]) => music.setVolume(value ?? 0.75)}
              />
            </label>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            className={cn("shrink-0", !isCollapsed && "hidden sm:inline-flex")}
            onClick={() => music.setMiniPlayerCollapsed(!isCollapsed)}
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </Button>
        </div>
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
