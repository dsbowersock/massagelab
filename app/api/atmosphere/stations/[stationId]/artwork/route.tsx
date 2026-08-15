import sharp from "sharp"

import { renderAtmosphereStationArtworkSvg } from "@/lib/atmosphere/station-artwork"
import { ATMOSPHERE_STATION_GROUP_DEFINITIONS } from "@/lib/atmosphere/station-groups"
import { getAtmosphereStationById } from "@/lib/atmosphere/stations"

export const revalidate = 86_400
export const runtime = "nodejs"

type ArtworkRouteContext = {
  params: Promise<{ stationId: string }>
}

/** Renders the carousel's canonical SVG as cacheable PNG artwork. */
export async function GET(_request: Request, context: ArtworkRouteContext) {
  const { stationId } = await context.params
  let station

  try {
    station = getAtmosphereStationById(stationId)
  } catch {
    return new Response("Station not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=60" },
    })
  }

  const groupId = ATMOSPHERE_STATION_GROUP_DEFINITIONS.find((group) => (
    group.stationIds.includes(station.id)
  ))?.id ?? "more-stations"
  const svg = renderAtmosphereStationArtworkSvg({
    description: station.description,
    groupId,
    stationId: station.id,
    title: station.title,
  })
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()

  return new Response(png, {
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": "image/png",
    },
  })
}
