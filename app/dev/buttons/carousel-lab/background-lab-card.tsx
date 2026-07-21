"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MetalFavoriteIcon } from "@/components/ui/metal-favorite-icon"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { getBackgroundPreviewMedia, getBackgroundVisualTags } from "@/lib/background-catalog"
import { purpleGlowClassName } from "./carousel-lab-button-classes"

export type LabBackgroundAccessState =
  | "free"
  | "owned"
  | "subscriber-unlocked"
  | "credit-available"
  | "locked"

export interface BackgroundLabCardProps {
  option: BackgroundDefinition
  centered: boolean
  detailLevel: "full" | "summary" | "shell"
  presentation: "existing" | "cover-flow" | "three-d"
  accessState: LabBackgroundAccessState
  selected: boolean
  saved: boolean
  reducedMotion: boolean
  onSelect: () => void
  onToggleSaved: () => void
}

/** Renders real catalog media while keeping prototype access decisions local-only. */
export function BackgroundLabCard(props: BackgroundLabCardProps) {
  const { option, detailLevel, presentation, accessState, selected, saved, reducedMotion } = props
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [devOutcome, setDevOutcome] = useState("")
  const media = getBackgroundPreviewMedia(option, "landscape")
  const canUse = accessState === "free" || accessState === "owned" || accessState === "subscriber-unlocked"
  const showVideo = detailLevel !== "shell" && !reducedMotion && media?.type === "video"
  const productionExisting = presentation === "existing"
  const previewTags = getBackgroundVisualTags(option)
    .filter((tag) => !["shader", "video"].includes(tag.toLowerCase()))
    .slice(0, 4)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const syncPlayback = () => {
      if (!showVideo || document.visibilityState !== "visible") {
        video.pause()
        return
      }
      void video.play().catch(() => undefined)
    }
    syncPlayback()
    document.addEventListener("visibilitychange", syncPlayback)
    return () => {
      document.removeEventListener("visibilitychange", syncPlayback)
      video.pause()
    }
  }, [showVideo])

  return (
    <AlertDialog>
      <article
        className={productionExisting
          ? "relative grid aspect-[5/7] h-full overflow-hidden rounded-2xl border border-white/20 bg-black text-white shadow-2xl"
          : "relative grid h-full overflow-hidden rounded-xl border border-border bg-background/90"}
        data-background-id={option.id}
        data-background-selected={selected}
        data-background-access-state={accessState}
      >
      <div
        className={productionExisting
          ? "absolute inset-0 overflow-hidden rounded-[inherit]"
          : "relative aspect-[4/3] overflow-hidden rounded-t-xl"}
        data-carousel-artwork
      >
        {showVideo ? (
          <video
            ref={videoRef}
            data-testid="carousel-background-video"
            src={media.source}
            muted
            loop
            playsInline
            preload="metadata"
            className="size-full object-cover"
            aria-hidden="true"
          />
        ) : media?.type === "image" || option.previewImageUrl ? (
          <Image
            src={media?.type === "image" ? media.source : option.previewImageUrl ?? ""}
            alt=""
            fill
            sizes="(max-width: 640px) 70vw, 280px"
            className="object-cover"
            unoptimized
            aria-hidden="true"
          />
        ) : (
          <div
            className="size-full"
            style={option.fallbackStyle ?? { background: "#0f172a" }}
            aria-hidden="true"
          />
        )}
      </div>

      {detailLevel === "full" ? (
        <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          {canUse ? (
            <Button
              data-carousel-primary-action
              onClick={() => {
                setDevOutcome("")
                props.onSelect()
              }}
              size="sm"
              variant="glow"
            >
              {selected ? "Selected" : "Select"}
            </Button>
          ) : (
            <AlertDialogTrigger asChild>
              <Button data-carousel-primary-action size="sm" variant="glow">
                <Lock aria-hidden="true" />
                {selected ? "Selected" : "Select"}
              </Button>
            </AlertDialogTrigger>
          )}
          <Button
            data-carousel-favorite-action
            aria-label={`${saved ? "Unsave" : "Save"} ${option.label}`}
            aria-pressed={saved}
            onClick={props.onToggleSaved}
            size="icon"
            variant="glow"
            className={purpleGlowClassName}
          >
            <MetalFavoriteIcon kind="star" selected={saved} />
          </Button>
        </div>
      ) : null}

      <div className={productionExisting
        ? "relative z-10 mt-auto grid gap-2 self-end bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-14"
        : "grid gap-2 p-3"}>
        <div>
          <h3 className="font-semibold">{option.label}</h3>
          {detailLevel === "full" || productionExisting ? (
            previewTags.length > 0 ? (
              <p className={productionExisting ? "mt-1 text-xs text-white/70" : "mt-1 text-xs text-muted-foreground"}>
                {previewTags.join(" - ")}
              </p>
            ) : null
          ) : null}
        </div>

        {devOutcome ? <p role="status" className="text-xs text-primary">{devOutcome}</p> : null}
        </div>
      </article>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unlock {option.label}</AlertDialogTitle>
          <AlertDialogDescription>
            Development preview only. These actions do not change credits, purchases, or membership.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-wrap">
          <AlertDialogAction onClick={() => setDevOutcome("Dev preview: Use free credit")}>
            Use free credit
          </AlertDialogAction>
          <AlertDialogAction onClick={() => setDevOutcome("Dev preview: Buy for $1")}>
            Buy for $1
          </AlertDialogAction>
          <AlertDialogAction onClick={() => setDevOutcome("Dev preview: Unlock all")}>
            Unlock all
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
