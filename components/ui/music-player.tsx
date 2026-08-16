import Image from "next/image"
import * as React from "react"

import { cn } from "@/lib/utils"

export type StationVinylProps = React.HTMLAttributes<HTMLDivElement> & {
  artworkSrc: string
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
  artworkSrc,
  playing,
  className,
  ...props
}: StationVinylProps): React.ReactNode {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn("ml-station-vinyl pointer-events-none", className)}
      data-artwork-src={artworkSrc}
      data-playing={playing}
      data-testid="station-vinyl"
    >
      <div className="ml-station-vinyl-disc">
        <Image
          unoptimized
          alt=""
          className="ml-station-vinyl-artwork"
          draggable={false}
          fill
          sizes="8rem"
          src={artworkSrc}
        />
        <span className="ml-station-vinyl-grooves" />
        <span className="ml-station-vinyl-glare" />
        <span className="ml-station-vinyl-label"><span /></span>
      </div>
    </div>
  )
}
