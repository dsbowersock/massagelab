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
            background: artwork.palette.accent,
            borderRadius: "999px",
            display: "flex",
            height: `${12 + (artwork.seed % 11)}px`,
            left: `${32 + (artwork.seed % 397)}px`,
            opacity: 0.9,
            position: "absolute",
            top: `${32 + ((artwork.seed >>> 9) % 397)}px`,
            width: `${12 + ((artwork.seed >>> 5) % 11)}px`,
          }}
        />
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
    const centerX = ((seed % 19) - 9) * 2
    const centerY = ((seed % 27) - 13) * 2
    return (
      <div style={{ alignItems: "center", display: "flex", height: "420px", justifyContent: "center", position: "relative", transform: `translate(${centerX}px, ${centerY}px)`, width: "420px" }}>
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
          <div key={index} style={{ alignItems: "center", display: "flex", flexDirection: "column", height: `${230 + ((seed >>> (index % 8)) % 92)}px`, justifyContent: "space-between", transform: `rotate(${((seed + index) % 3 - 1) * 4}deg)` }}>
            <div style={{ background: index % 2 ? palette.muted : palette.foreground, borderRadius: "999px", display: "flex", height: "64px", transform: `rotate(${((seed + index) % 3 - 1) * 28}deg)`, width: `${24 + ((seed >>> ((index % 4) * 4)) % 10)}px` }} />
            <div style={{ background: palette.line, display: "flex", height: "100%", opacity: 0.8, width: "6px" }} />
          </div>
        ))}
      </div>
    )
  }

  if (motif === "moon-waves") {
    const moonOffset = (seed % 35) - 17
    return (
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: "26px", height: "410px", justifyContent: "center", width: "460px" }}>
        <div style={{ background: palette.accent, borderRadius: "999px", boxShadow: `28px -16px 0 0 ${palette.background}`, display: "flex", height: "120px", transform: `translateX(${moonOffset}px)`, width: "120px" }} />
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} style={{ borderTop: `7px solid ${index % 2 ? palette.muted : palette.line}`, borderRadius: "50%", display: "flex", height: "24px", opacity: 0.9 - index * 0.1, transform: `rotate(${index % 2 ? 3 : -3}deg)`, width: `${420 - index * 28}px` }} />
        ))}
      </div>
    )
  }

  if (motif === "sunrise") {
    const sunX = 70 + (seed % 220)
    return (
      <div style={{ display: "flex", height: "390px", position: "relative", width: "440px" }}>
        <div style={{ background: palette.foreground, borderRadius: "999px", display: "flex", height: "138px", left: `${sunX}px`, position: "absolute", top: "48px", width: "138px" }} />
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} style={{ background: index % 2 ? palette.muted : palette.line, borderRadius: "999px", bottom: `${30 + index * 42}px`, display: "flex", height: `${index === 0 ? 32 : 8}px`, left: `${(seed + index * 13) % 28}px`, opacity: 0.8 - index * 0.08, position: "absolute", width: `${420 - index * 22}px` }} />
        ))}
      </div>
    )
  }

  const count = motif === "spiral" ? 28 : 20
  return (
    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: motif === "spiral" ? "8px" : "18px", height: "360px", justifyContent: "center", width: "360px", ...(motif === "spiral" ? { transform: `rotate(${seed % 360}deg)` } : {}) }}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          style={{
            background: (index + seed) % 4 === 0 ? palette.foreground : palette.line,
            borderRadius: motif === "honeycomb" ? "12px" : "999px",
            display: "flex",
            height: `${22 + (index % 5) * 5 + ((seed >>> ((index % 4) * 8)) % 7)}px`,
            opacity: 0.82,
            width: `${22 + (index % 5) * 5 + ((seed >>> ((index % 4) * 8)) % 7)}px`,
            ...(motif === "honeycomb" ? { transform: "rotate(45deg)" } : {}),
          }}
        />
      ))}
    </div>
  )
}
