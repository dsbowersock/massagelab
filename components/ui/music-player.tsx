import * as React from "react"

import { AtmosphereStationArtwork } from "@/components/atmosphere/station-artwork"
import type { AtmosphereStationArtworkInput } from "@/lib/atmosphere/station-artwork"
import { cn } from "@/lib/utils"

export type StationVinylProps = React.HTMLAttributes<HTMLDivElement> & {
  artworkInput: AtmosphereStationArtworkInput
  playing: boolean
}

/**
 * Decorative record primitive adapted from Componentry's Music Player:
 * https://componentry.dev/docs/components/music-player
 *
 * The upstream MIT notice is retained in docs/licenses/componentry-mit.txt.
 * This boundary keeps only the record artwork and decorative layers; playback,
 * animation timing, interaction, and media ownership remain with MassageLab.
 */
export function StationVinyl({
  artworkInput,
  playing,
  className,
  ...props
}: StationVinylProps): React.ReactNode {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn("ml-station-vinyl pointer-events-none", className)}
      data-artwork-station-id={artworkInput.stationId}
      data-playing={playing}
      data-testid="station-vinyl"
    >
      <div className="ml-station-vinyl-disc">
        <AtmosphereStationArtwork
          artworkInput={artworkInput}
          className="ml-station-vinyl-artwork"
          decorative
        />
        <span className="ml-station-vinyl-grooves" />
        <span className="ml-station-vinyl-glare" />
        <span className="ml-station-vinyl-label"><span /></span>
      </div>
    </div>
  )
}
