"use client"

import { useMemo, useRef, useState } from "react"

import type {
  BackgroundPreviewAspect,
  BackgroundPreviewRenditionEntry,
} from "@/components/backgrounds/backgroundPreviewRenditionManifest"
import { resolvePreviewRenditionUrl } from "@/components/backgrounds/backgroundPreviewRenditionManifest"
import { Button } from "@/components/ui/button"
import { AppSurface } from "@/components/ui/app-surface"
import styles from "./preview-pilot-review.module.css"

type ReviewEntry = BackgroundPreviewRenditionEntry & { label: string }

const ASPECTS: readonly BackgroundPreviewAspect[] = ["landscape", "square", "vertical"]
const QUALITY_LABELS = { low: "Low", standard: "Standard", high: "High" } as const
const CODEC_LABELS = { vp9: "VP9", h264: "H.264" } as const

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Derives the sibling decoded-frame evidence image from a WebM or MP4 rendition basename. */
function frameStripUrl(url: string) {
  return resolvePreviewRenditionUrl(url.replace(/\.(webm|mp4)$/i, ".frames.png"))
}

/** Keeps six comparison players on the same user-controlled playback boundary. */
export function PreviewPilotReview({ entries }: { entries: readonly ReviewEntry[] }) {
  const [backgroundId, setBackgroundId] = useState(entries[0]?.backgroundId ?? "")
  const [aspect, setAspect] = useState<BackgroundPreviewAspect>("vertical")
  const [playing, setPlaying] = useState(false)
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const entry = entries.find((candidate) => candidate.backgroundId === backgroundId) ?? entries[0]
  const renditions = useMemo(() => entry?.renditions.filter((item) => item.aspect === aspect) ?? [], [entry, aspect])

  function restartAll() {
    for (const video of videoRefs.current) {
      if (video) video.currentTime = 0
    }
  }

  async function playAll() {
    restartAll()
    await Promise.all(videoRefs.current.map((video) => video?.play().catch(() => undefined)))
    setPlaying(true)
  }

  function pauseAll() {
    for (const video of videoRefs.current) video?.pause()
    setPlaying(false)
  }

  if (!entry) {
    return (
      <div data-testid="background-preview-pilot-review">
        <AppSurface title="Pilot evidence unavailable" variant="inset">
          <div className={styles.emptyState}>
            <h2>No validated pilot media is loaded</h2>
            <p>
              Generate and validate the local pilot, then write the typed sidecar to populate this review matrix.
              Production preview media remains untouched.
            </p>
          </div>
        </AppSurface>
      </div>
    )
  }

  const poster = entry.posters[aspect]
  return (
    <div data-testid="background-preview-pilot-review" className={styles.review}>
      <AppSurface title="Review controls" description="All players stay muted and restart from the same loop boundary." variant="inset">
        <div className={styles.controls}>
          <label>
            <span>Background</span>
            <select value={entry.backgroundId} onChange={(event) => { pauseAll(); setBackgroundId(event.target.value) }}>
              {entries.map((candidate) => <option key={candidate.backgroundId} value={candidate.backgroundId}>{candidate.label}</option>)}
            </select>
          </label>
          <label>
            <span>Aspect</span>
            <select value={aspect} onChange={(event) => { pauseAll(); setAspect(event.target.value as BackgroundPreviewAspect) }}>
              {ASPECTS.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
            </select>
          </label>
          <div className={styles.actions}>
            <Button type="button" onClick={playing ? pauseAll : playAll}>{playing ? "Pause all" : "Play all"}</Button>
            <Button type="button" variant="outline" onClick={restartAll}>Restart all previews</Button>
          </div>
        </div>
        <dl className={styles.summary}>
          <div><dt>Loop strategy</dt><dd>{entry.loopStrategy}</dd></div>
          <div><dt>Loop boundary</dt><dd>{(entry.loopBoundaryMs / 1000).toFixed(2)}s</dd></div>
          <div><dt>Recipe</dt><dd>{entry.recipeRevision}</dd></div>
          <div><dt>Validation</dt><dd>Complete manifest accepted</dd></div>
        </dl>
      </AppSurface>

      <AppSurface title={`${entry.label} · ${aspect}`} description="One poster and six independently encoded renditions from the same authored timeline." variant="card">
        <div className={styles.posterRow}>
          {/* The poster is evidence, not decorative content. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolvePreviewRenditionUrl(poster.url)} alt={`${entry.label} ${aspect} pilot poster`} />
          <p>{poster.width}×{poster.height} · {formatBytes(poster.bytes)}</p>
        </div>
        <div className={styles.grid}>
          {renditions.map((rendition, index) => (
            <article key={`${rendition.quality}:${rendition.codec}`} className={styles.card}>
              <h3>{CODEC_LABELS[rendition.codec]} · {QUALITY_LABELS[rendition.quality]}</h3>
              {/* A changed <source> does not reload an existing media element, so selection changes must remount it. */}
              <video
                key={`${entry.backgroundId}:${aspect}:${rendition.quality}:${rendition.codec}`}
                ref={(node) => { videoRefs.current[index] = node }}
                muted
                loop
                playsInline
                preload="metadata"
                poster={resolvePreviewRenditionUrl(poster.url)}
              >
                <source src={resolvePreviewRenditionUrl(rendition.url)} type={rendition.mimeType} />
              </video>
              <p>{rendition.width}×{rendition.height} · {rendition.fps}fps · {(rendition.durationMs / 1000).toFixed(2)}s · {formatBytes(rendition.bytes)}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.frameStrip} src={frameStripUrl(rendition.url)} alt={`${QUALITY_LABELS[rendition.quality]} ${CODEC_LABELS[rendition.codec]} decoded frame strip`} />
            </article>
          ))}
        </div>
      </AppSurface>
    </div>
  )
}
