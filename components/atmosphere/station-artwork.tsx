"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import {
  getAtmosphereStationArtworkUrl,
  type AtmosphereStationArtworkInput,
} from "@/lib/atmosphere/station-artwork"
import { cn } from "@/lib/utils"

type AtmosphereStationArtworkProps = AtmosphereStationArtworkInput & {
  className?: string
}

/**
 * Presents canonical server-rendered station art and preserves a readable
 * fallback when a same-origin artwork request is unavailable.
 */
export function AtmosphereStationArtwork({ className, stationId, title }: AtmosphereStationArtworkProps) {
  const artworkUrl = getAtmosphereStationArtworkUrl(stationId)
  const [failedArtworkUrl, setFailedArtworkUrl] = useState<string | null>(null)

  useEffect(() => {
    setFailedArtworkUrl(null)
  }, [artworkUrl])

  if (failedArtworkUrl === artworkUrl) {
    return (
      <div
        aria-label={`${title} station artwork unavailable`}
        className={cn(
          "grid h-full w-full place-items-center rounded-[9px] bg-muted px-3 text-center text-xs font-medium text-muted-foreground",
          className,
        )}
        role="img"
      >
        MassageLab station artwork unavailable
      </div>
    )
  }

  return (
    <Image
      unoptimized
      alt={`${title} station artwork`}
      className={cn("h-full w-full rounded-[9px] object-cover", className)}
      height={512}
      onError={() => setFailedArtworkUrl(artworkUrl)}
      src={artworkUrl}
      width={512}
    />
  )
}
