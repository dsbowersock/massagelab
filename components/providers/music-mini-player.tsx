"use client"

import { useEffect } from "react"
import {
  ChevronDown,
  ChevronUp,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  Wallpaper,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  const searchParams = useSearchParams()
  const hasStation = Boolean(music.activeStationId)
  const showPlayer = hasStation || music.playbackState === "failed"
  const isCollapsed = music.miniPlayerCollapsed
  const isLoading = music.playbackState === "loading"
  const isPlayingOrLoading = music.playbackState === "playing" || isLoading
  const isMusicVisualizerRoute =
    pathname === "/clock"
    && searchParams.getAll("source").includes("music")
  const visualizerActionLabel = isMusicVisualizerRoute ? "Minimize visualizer" : "Background"
  const currentSearch = searchParams.toString()
  const returnTo = currentSearch ? `${pathname}?${currentSearch}` : pathname
  const visualizerHref = isMusicVisualizerRoute
    ? sanitizeMusicVisualizerReturnTo(searchParams.get("returnTo"))
    : buildMusicVisualizerHref({
        returnTo,
        openBackgroundPanel:
          !music.visualizer.backgroundId
          && !music.visualizer.accountDefaultBackgroundId,
      })

  useEffect(() => {
    const { body } = document
    body.classList.toggle("ml-music-player-active", showPlayer)
    body.classList.toggle("ml-music-player-top", showPlayer && placement === "top")
    body.classList.toggle("ml-music-player-bottom", showPlayer && placement === "bottom")
    body.classList.toggle("ml-music-player-collapsed", showPlayer && isCollapsed)

    return () => {
      body.classList.remove(
        "ml-music-player-active",
        "ml-music-player-top",
        "ml-music-player-bottom",
        "ml-music-player-collapsed",
      )
    }
  }, [isCollapsed, placement, showPlayer])

  if (!showPlayer) {
    return null
  }

  const title = music.activeStationTitle ?? "Atmosphere"

  function handlePlayStop() {
    if (isPlayingOrLoading) {
      void music.stopCurrent()
      return
    }
    if (music.activeStationId) void music.playStation(music.activeStationId)
  }

  const previousAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="success"
          aria-label="Previous station"
          title="Previous station"
          disabled={isLoading}
          onClick={() => void music.playPreviousStation()}
        >
          <SkipBack aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Previous station</TooltipContent>
    </Tooltip>
  )

  const playStopLabel = isPlayingOrLoading ? "Stop" : "Play"
  const playStopAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="success"
          aria-label={playStopLabel}
          title={playStopLabel}
          disabled={!music.activeStationId}
          onClick={handlePlayStop}
        >
          {isPlayingOrLoading ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{playStopLabel}</TooltipContent>
    </Tooltip>
  )

  const nextAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="success"
          aria-label="Next station"
          title="Next station"
          disabled={isLoading}
          onClick={() => void music.playNextStation()}
        >
          <SkipForward aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Next station</TooltipContent>
    </Tooltip>
  )

  const visualizerAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild size="icon" variant="success">
          {/* The shared dirty-draft guard intercepts this marker. On the
              visualizer route, href plus replace preserves the Music return
              target without stacking another /clock entry. */}
          <Link
            href={visualizerHref}
            replace={isMusicVisualizerRoute}
            data-visual-draft-navigation-mode={isMusicVisualizerRoute ? "replace" : undefined}
            aria-label={visualizerActionLabel}
            title={visualizerActionLabel}
          >
            <Wallpaper aria-hidden="true" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{visualizerActionLabel}</TooltipContent>
    </Tooltip>
  )

  const collapseAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="success"
          aria-label="Collapse"
          title="Collapse"
          onClick={() => music.setMiniPlayerCollapsed(true)}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Collapse</TooltipContent>
    </Tooltip>
  )

  const expandAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="success"
          aria-label="Expand"
          title="Expand"
          onClick={() => music.setMiniPlayerCollapsed(false)}
        >
          <ChevronUp aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Expand</TooltipContent>
    </Tooltip>
  )

  return (
    <div
      className="ml-music-player-toolbar pointer-events-none absolute inset-x-0 z-[10020]"
      data-placement={placement}
      data-collapsed={isCollapsed}
      data-playback-state={music.playbackState}
      data-testid="music-player-toolbar"
      role="region"
      aria-label="Atmosphere audio player"
    >
      <div className="ml-music-player-toolbar-surface pointer-events-auto bg-card/95 shadow-2xl shadow-black/35 backdrop-blur">
        <TooltipProvider>
          {/* The grid owns responsive shape: two rows on narrow expanded
              screens, one compact row when collapsed, and wide columns above. */}
          <div
            className={cn(
              "ml-music-player-toolbar-layout mx-auto grid w-full max-w-screen-2xl gap-2 px-3 py-2 sm:px-4",
              isCollapsed
                ? "min-h-[4.5rem] grid-cols-[minmax(0,1fr)_auto_auto] items-center"
                : "min-h-[7rem] grid-cols-1 content-center sm:min-h-16 sm:grid-cols-[minmax(8rem,1fr)_auto] sm:items-center lg:grid-cols-[minmax(8rem,1fr)_auto_minmax(9rem,14rem)]",
            )}
          >
            <div className="min-w-0" data-testid="music-player-toolbar-identity">
              <p className="ml-music-player-toolbar-title truncate text-sm font-semibold">{title}</p>
              <p className={cn(
                "ml-music-player-toolbar-status truncate text-xs text-muted-foreground",
                music.error && "text-destructive",
              )}>
                {music.error ?? playerStatusLabel(music.playbackState)}
              </p>
              {isLoading ? (
                <div className="ml-music-player-toolbar-progress mt-1 w-full max-w-72">
                  <MusicLoadingProgress compact progress={music.loadingProgress} startedAt={music.loadingStartedAt} />
                </div>
              ) : null}
            </div>

            {isCollapsed ? (
              <>
                {playStopAction}
                {expandAction}
              </>
            ) : (
              <>
                <div
                  className="grid min-w-0 grid-cols-5 gap-1 sm:flex sm:shrink-0 sm:items-center sm:gap-2"
                  data-testid="music-player-toolbar-controls"
                >
                  {previousAction}
                  {playStopAction}
                  {nextAction}
                  {visualizerAction}
                  {collapseAction}
                </div>

                <label className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground lg:flex">
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
              </>
            )}
          </div>
        </TooltipProvider>
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
