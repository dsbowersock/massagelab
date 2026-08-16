import sharp from "sharp"

import {
  renderAtmosphereStationArtworkSvg,
  resolveAtmosphereStationArtworkInput,
  type AtmosphereStationArtworkSize,
} from "@/lib/atmosphere/station-artwork"
import { getAtmosphereStationById } from "@/lib/atmosphere/stations"

export const revalidate = 86_400
export const runtime = "nodejs"

type ArtworkRouteContext = {
  params: Promise<{ stationId: string }>
}

/** Renders the canonical vector artwork at one honest, allowlisted PNG size. */
export async function GET(request: Request, context: ArtworkRouteContext) {
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

  const size = parseArtworkSize(new URL(request.url).searchParams.get("size"))
  if (!size) {
    return new Response("Unsupported artwork size", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    })
  }

  try {
    const input = resolveAtmosphereStationArtworkInput(station)
    if (!input) throw new Error("Station artwork input is invalid")
    const svg = renderAtmosphereStationArtworkSvg(input)
    const png = await sharp(Buffer.from(svg))
      .resize(size, size, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer()

    return new Response(new Uint8Array(png), {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": "image/png",
      },
    })
  } catch {
    return new Response("Artwork generation failed", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    })
  }
}

function parseArtworkSize(value: string | null): AtmosphereStationArtworkSize | null {
  if (value === null || value === "512") return 512
  if (value === "256") return 256
  return null
}
