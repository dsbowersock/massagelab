"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  Wallpaper,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { purpleGlowClassName } from "@/components/ui/carousel-button-classes"
import { Button } from "@/components/ui/button"
import { MetalFavoriteIcon } from "@/components/ui/metal-favorite-icon"
import { StationVinyl } from "@/components/ui/music-player"
import { Slider } from "@/components/ui/slider"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { MusicInterruptionNotice } from "./music-interruption-notice"
import { useMusic } from "./music-provider"

type MusicMiniPlayerPlacement = "top" | "bottom"

const compactLandscapePlayerQuery = "(orientation: landscape) and (max-width: 60rem) and (max-height: 31.25rem)"

export function MusicMiniPlayer({ placement = "bottom" }: { placement?: MusicMiniPlayerPlacement }) {
  const music = useMusic()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hasStation = Boolean(music.activeStationId)
  const showPlayer = hasStation || music.playbackState === "failed"
  const isCollapsed = music.miniPlayerCollapsed
  const isLoading = music.playbackState === "loading"
  const isPlayingOrLoading = music.playbackState === "playing" || isLoading
  const isVinylPlaying = music.playbackState === "playing"
  const isMusicRoute = pathname === "/music"
  const [isCompactLandscape, setIsCompactLandscape] = useState(false)
  const isFavorite = music.activeStationId
    ? music.favorites.includes(music.activeStationId)
    : false
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
    const mediaQuery = window.matchMedia(compactLandscapePlayerQuery)
    const updateLayout = () => setIsCompactLandscape(mediaQuery.matches)
    updateLayout()
    mediaQuery.addEventListener("change", updateLayout)
    return () => mediaQuery.removeEventListener("change", updateLayout)
  }, [])

  useEffect(() => {
    const { body } = document
    body.classList.toggle("ml-music-player-active", showPlayer)
    body.classList.toggle("ml-music-player-top", showPlayer && placement === "top")
    body.classList.toggle("ml-music-player-bottom", showPlayer && placement === "bottom")
    body.classList.toggle("ml-music-player-collapsed", showPlayer && isCollapsed)
    body.classList.toggle("ml-music-player-rail", showPlayer && isCompactLandscape)
    body.classList.toggle("ml-music-player-music-route", showPlayer && isMusicRoute)

    return () => {
      body.classList.remove(
        "ml-music-player-active",
        "ml-music-player-top",
        "ml-music-player-bottom",
        "ml-music-player-collapsed",
        "ml-music-player-rail",
        "ml-music-player-music-route",
      )
    }
  }, [isCollapsed, isCompactLandscape, isMusicRoute, placement, showPlayer])

  if (!showPlayer) {
    return null
  }

  const title = music.activeStationTitle ?? "Atmosphere"

  function handlePlayStop() {
    // Loading is an active, cancellable playback intent, so Stop must invalidate pending startup.
    if (isPlayingOrLoading) {
      void music.stopCurrent()
      return
    }
    if (music.activeStationId) void music.playStation(music.activeStationId)
  }

  const favoriteAction = music.activeStationId ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="glow"
          aria-label={isFavorite ? `Remove ${title} from favorites` : `Favorite ${title}`}
          aria-pressed={isFavorite}
          className={purpleGlowClassName}
          onClick={() => music.toggleFavorite(music.activeStationId!)}
        >
          <MetalFavoriteIcon kind="heart" selected={isFavorite} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isFavorite ? "Favorited" : "Favorite"}</TooltipContent>
    </Tooltip>
  ) : null

  const previousAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="glow"
          aria-label="Previous station"
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
          variant={isPlayingOrLoading ? "destructive" : "success"}
          aria-label={playStopLabel}
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
          variant="glow"
          aria-label="Next station"
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
        <Button asChild size="icon" variant="attention">
          {/* The shared dirty-draft guard intercepts this marker. On the
              visualizer route, href plus replace preserves the Music return
              target without stacking another /clock entry. */}
          <Link
            href={visualizerHref}
            replace={isMusicVisualizerRoute}
            data-visual-draft-navigation-mode={isMusicVisualizerRoute ? "replace" : undefined}
            aria-label={visualizerActionLabel}
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
          variant="glow"
          aria-label="Minimize"
          onClick={() => music.setMiniPlayerCollapsed(true)}
        >
          {isCompactLandscape
            ? <ChevronRight aria-hidden="true" />
            : <ChevronDown aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Minimize</TooltipContent>
    </Tooltip>
  )

  const settingsAction = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="glow"
              aria-label="Player settings"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Player settings</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="left" className="min-w-56 border-border bg-card">
        <DropdownMenuCheckboxItem
          checked={music.resumeAfterInterruptionDefault}
          disabled={!music.mediaIntegrationAvailable}
          aria-description={music.mediaIntegrationAvailable
            ? undefined
            : "External interruption controls are unavailable in this browser."}
          onCheckedChange={(checked) => music.setResumeAfterInterruptionDefault(checked === true)}
        >
          Resume after interruptions
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const expandAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="glow"
          aria-label="Expand"
          onClick={() => music.setMiniPlayerCollapsed(false)}
        >
          {isCompactLandscape
            ? <ChevronLeft aria-hidden="true" />
            : <ChevronUp aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Expand</TooltipContent>
    </Tooltip>
  )

  return (
    <div
      className="ml-music-player-toolbar pointer-events-none absolute inset-x-0 z-[10020]"
      data-placement={placement}
      data-layout={isCompactLandscape ? "rail" : "bottom"}
      data-music-route={isMusicRoute}
      data-collapsed={isCollapsed}
      data-playback-state={music.playbackState}
      data-testid="music-player-toolbar"
      role="region"
      aria-label="Atmosphere audio player"
    >
      <MusicInterruptionNotice placement={placement} />
      <div className="ml-music-player-toolbar-surface pointer-events-auto relative bg-card/95 shadow-2xl shadow-black/35 backdrop-blur">
        {music.activeStationArtwork ? (
          <div className="ml-station-vinyl-layer" aria-hidden="true">
            <StationVinyl artworkInput={music.activeStationArtwork} playing={isVinylPlaying} />
          </div>
        ) : null}
        <TooltipProvider>
          {/* CSS keeps the record in a bounded background layer while this
              foreground grid owns identity and breakpoint-stable actions. */}
          <div
            className="ml-music-player-toolbar-layout mx-auto grid w-full max-w-screen-2xl gap-2 py-2"
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
            ) : isCompactLandscape ? (
              <div
                className="ml-music-player-toolbar-controls grid min-w-0 items-center gap-2"
                data-control-layout="rail"
                data-testid="music-player-toolbar-controls"
              >
                <div
                  className="ml-music-player-toolbar-rail-row"
                  data-testid="music-player-toolbar-rail-transport"
                >
                  {previousAction}
                  {playStopAction}
                  {nextAction}
                </div>
                <div
                  className="ml-music-player-toolbar-rail-row"
                  data-testid="music-player-toolbar-rail-options"
                >
                  {settingsAction}
                  {favoriteAction}
                  {visualizerAction}
                  {collapseAction}
                </div>
              </div>
            ) : (
              <>
                <div
                  className="ml-music-player-toolbar-controls grid min-w-0 items-center gap-1 sm:gap-2"
                  data-testid="music-player-toolbar-controls"
                >
                  <div className="flex items-center justify-start" data-testid="music-player-toolbar-left">
                    {settingsAction}
                  </div>
                  <div
                    className="flex min-w-0 items-center justify-center gap-1 sm:gap-2"
                    data-testid="music-player-toolbar-primary-controls"
                  >
                    {favoriteAction}
                    {previousAction}
                    {playStopAction}
                    {nextAction}
                    {visualizerAction}
                  </div>
                  <div
                    className="flex min-w-0 items-center justify-end gap-2"
                    data-testid="music-player-toolbar-right"
                  >
                    <label className="hidden min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground lg:flex">
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
                    {collapseAction}
                  </div>
                </div>
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
  if (state === "interrupted") return "Interrupted"
  if (state === "paused") return "Paused"
  if (state === "stopped") return "Stopped"
  return "Ready"
}
