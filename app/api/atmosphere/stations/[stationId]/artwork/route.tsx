import { ImageResponse } from "next/og"

import {
  getAtmosphereStationArtworkModel,
  type ArtworkMotif,
  type ArtworkPalette,
} from "@/components/atmosphere/station-artwork"
import { ATMOSPHERE_STATION_GROUP_DEFINITIONS } from "@/lib/atmosphere/station-groups"
import { getAtmosphereStationById } from "@/lib/atmosphere/stations"

export const revalidate = 86_400

type ArtworkRouteContext = {
  params: Promise<{ stationId: string }>
}

/** Renders the same deterministic station motif used by the in-app carousel. */
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
  const artwork = getAtmosphereStationArtworkModel({
    description: station.description,
    groupId,
    stationId: station.id,
    title: station.title,
  })

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: `linear-gradient(135deg, ${artwork.palette.background}, ${artwork.palette.muted})`,
          display: "flex",
          height: "512px",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "512px",
        }}
      >
        {renderRasterMotif(artwork.motif, artwork.palette, artwork.seed)}
        <div
          style={{
            border: `4px solid ${artwork.palette.line}`,
            borderRadius: "24px",
            display: "flex",
            inset: "24px",
            opacity: 0.55,
            position: "absolute",
          }}
        />
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  )
}

/** Builds an ImageResponse-safe echo of the carousel artwork's selected motif. */
function renderRasterMotif(motif: ArtworkMotif, palette: ArtworkPalette, seed: number) {
  if (motif === "rings") {
    return (
      <div style={{ alignItems: "center", display: "flex", height: "420px", justifyContent: "center", position: "relative", width: "420px" }}>
        {[340, 280, 220, 160, 100].map((size) => (
          <div key={size} style={{ border: `6px solid ${palette.line}`, borderRadius: "999px", display: "flex", height: `${size}px`, opacity: 0.72, position: "absolute", width: `${size}px` }} />
        ))}
        <div style={{ background: palette.foreground, borderRadius: "999px", display: "flex", height: "72px", position: "absolute", width: "72px" }} />
      </div>
    )
  }

  if (motif === "seed-lines") {
    return (
      <div style={{ alignItems: "flex-end", display: "flex", gap: "30px", height: "390px", justifyContent: "center", width: "420px" }}>
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <div key={index} style={{ alignItems: "center", display: "flex", flexDirection: "column", height: `${230 + ((seed + index) % 4) * 34}px`, justifyContent: "space-between" }}>
            <div style={{ background: index % 2 ? palette.muted : palette.foreground, borderRadius: "999px", display: "flex", height: "64px", transform: `rotate(${index % 2 ? 28 : -28}deg)`, width: "28px" }} />
            <div style={{ background: palette.line, display: "flex", height: "100%", opacity: 0.8, width: "6px" }} />
          </div>
        ))}
      </div>
    )
  }

  if (motif === "moon-waves") {
    return (
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: "26px", height: "410px", justifyContent: "center", width: "460px" }}>
        <div style={{ background: palette.accent, borderRadius: "999px", boxShadow: `28px -16px 0 0 ${palette.background}`, display: "flex", height: "120px", width: "120px" }} />
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} style={{ borderTop: `7px solid ${index % 2 ? palette.muted : palette.line}`, borderRadius: "50%", display: "flex", height: "24px", opacity: 0.9 - index * 0.1, transform: `rotate(${index % 2 ? 3 : -3}deg)`, width: `${420 - index * 28}px` }} />
        ))}
      </div>
    )
  }

  const count = motif === "spiral" ? 28 : motif === "honeycomb" ? 20 : 12
  return (
    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: motif === "spiral" ? "8px" : "18px", height: "360px", justifyContent: "center", width: "360px", ...(motif === "spiral" ? { transform: `rotate(${seed % 24}deg)` } : {}) }}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          style={{
            background: index % 4 === 0 ? palette.foreground : palette.line,
            borderRadius: motif === "honeycomb" ? "12px" : "999px",
            display: "flex",
            height: `${motif === "sunrise" ? 42 + (index % 3) * 18 : 22 + (index % 5) * 5}px`,
            opacity: 0.82,
            width: `${motif === "sunrise" ? 42 + (index % 3) * 18 : 22 + (index % 5) * 5}px`,
            ...(motif === "honeycomb" ? { transform: "rotate(45deg)" } : {}),
          }}
        />
      ))}
    </div>
  )
}
