"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Lock, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { getBackgroundPreviewMedia, getBackgroundVisualTags } from "@/lib/background-catalog"

export type LabBackgroundAccessState =
  | "free"
  | "owned"
  | "subscriber-unlocked"
  | "credit-available"
  | "locked"

export interface BackgroundLabCardProps {
  option: BackgroundDefinition
  centered: boolean
  detailLevel: "full" | "summary"
  accessState: LabBackgroundAccessState
  selected: boolean
  saved: boolean
  reducedMotion: boolean
  onSelect: () => void
  onToggleSaved: () => void
}

/** Renders real catalog media while keeping prototype access decisions local-only. */
export function BackgroundLabCard(props: BackgroundLabCardProps) {
  const { option, centered, detailLevel, accessState, selected, saved, reducedMotion } = props
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [devOutcome, setDevOutcome] = useState("")
  const media = getBackgroundPreviewMedia(option, "landscape")
  const canUse = accessState === "free" || accessState === "owned" || accessState === "subscriber-unlocked"
  const showVideo = detailLevel === "full" && centered && !reducedMotion && media?.type === "video"

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

  const requestSelection = () => {
    if (canUse) {
      setDevOutcome("")
      props.onSelect()
      return
    }
    setDecisionOpen(true)
  }

  return (
    <article className="grid h-full overflow-hidden rounded-xl border border-border bg-background/90">
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-t-xl"
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

      <div className="grid gap-2 p-3">
        <div>
          <h3 className="font-semibold">{option.label}</h3>
          {detailLevel === "full" ? (
            <>
              <p className="text-xs text-muted-foreground">{option.provider}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {getBackgroundVisualTags(option).slice(0, 4).join(" - ")}
              </p>
            </>
          ) : null}
        </div>

        {detailLevel === "full" ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={requestSelection} size="sm">
              {!canUse ? <Lock aria-hidden="true" /> : null}
              {selected ? "Selected" : "Select"}
            </Button>
            <Button
              aria-label={`${saved ? "Unsave" : "Save"} ${option.label}`}
              aria-pressed={saved}
              onClick={props.onToggleSaved}
              size="icon"
              variant="outline"
            >
              <Star className={saved ? "fill-current" : ""} aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        {devOutcome ? <p role="status" className="text-xs text-primary">{devOutcome}</p> : null}
      </div>

      <AlertDialog open={decisionOpen} onOpenChange={setDecisionOpen}>
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
    </article>
  )
}
