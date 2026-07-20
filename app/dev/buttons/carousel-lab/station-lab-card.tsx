"use client"

import {
  AtmosphereStationCarouselCard,
  type AtmosphereStation,
} from "@/components/atmosphere/station-carousel-card"
import { useMusic } from "@/components/providers/music-provider"

interface StationLabCardProps {
  groupId: string
  station: AtmosphereStation
  detailLevel: "full" | "summary"
  prewarmStation: (
    stationId: string,
    options?: { includeSamplePayloads?: boolean },
  ) => void
}

/** Binds the production station card to the real shared Music provider. */
export function StationLabCard(props: StationLabCardProps) {
  const music = useMusic()
  return <AtmosphereStationCarouselCard {...props} music={music} />
}
