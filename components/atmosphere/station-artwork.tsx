import {
  renderAtmosphereStationArtworkSvg,
  resolveAtmosphereStationArtworkInput,
  type AtmosphereStationArtworkInput,
} from "@/lib/atmosphere/station-artwork"
import { cn } from "@/lib/utils"

type AtmosphereStationArtworkProps = {
  artworkInput: AtmosphereStationArtworkInput | null
  className?: string
  decorative?: boolean
}

/**
 * Presents the canonical serializer inline so app artwork is synchronous and
 * independent from the platform-only PNG adapter.
 */
export function AtmosphereStationArtwork({
  artworkInput,
  className,
  decorative = false,
}: AtmosphereStationArtworkProps) {
  const resolvedInput = artworkInput
    ? resolveAtmosphereStationArtworkInput(artworkInput)
    : null
  if (!resolvedInput) {
    return (
      <div
        aria-hidden={decorative ? "true" : undefined}
        aria-label={decorative ? undefined : "MassageLab station artwork unavailable"}
        className={cn(
          "grid h-full w-full place-items-center rounded-[9px] bg-muted px-3 text-center text-xs font-medium text-muted-foreground",
          className,
        )}
        role={decorative ? undefined : "img"}
      >
        MassageLab station artwork unavailable
      </div>
    )
  }

  return (
    <div
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : `${resolvedInput.title} station artwork`}
      className={cn("h-full w-full overflow-hidden rounded-[9px] [&_svg]:block [&_svg]:h-full [&_svg]:w-full", className)}
      data-artwork-station-id={resolvedInput.stationId}
      dangerouslySetInnerHTML={{
        __html: renderAtmosphereStationArtworkSvg(resolvedInput),
      }}
      role={decorative ? undefined : "img"}
    />
  )
}
