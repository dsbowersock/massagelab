"use client"

import { useMemo, useRef, useState } from "react"

import type {
  BackgroundPreviewAspect,
} from "@/components/backgrounds/backgroundPreviewRenditionManifest"
import { resolvePreviewRenditionUrl } from "@/components/backgrounds/backgroundPreviewRenditionManifest"
import type {
  BackgroundPreviewCatalogPoster,
  BackgroundPreviewCatalogRendition,
} from "@/components/backgrounds/backgroundPreviewCatalogManifest"
import { resolveCatalogPreviewUrl } from "@/components/backgrounds/backgroundPreviewCatalogManifest"
import { Button } from "@/components/ui/button"
import { AppSurface } from "@/components/ui/app-surface"
import styles from "./preview-pilot-review.module.css"

type ReviewEntry = {
  backgroundId: string
  batchSlug?: string
  label: string
  loopBoundaryMs: number
  loopStrategy: "natural" | "crossfade" | "static"
  mediaKind?: "animated" | "poster-only"
  posters: Record<BackgroundPreviewAspect, BackgroundPreviewCatalogPoster>
  recipeRevision: string
  renditions: readonly BackgroundPreviewCatalogRendition[]
  reviewStatus?: "candidate" | "approved"
}
type ReviewBatch = { slug: string; title: string }

const ASPECTS: readonly BackgroundPreviewAspect[] = ["landscape", "square", "vertical"]
const QUALITY_LABELS = { low: "Low", standard: "Standard", high: "High" } as const
const CODEC_LABELS = { vp9: "VP9", h264: "H.264" } as const

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Derives the sibling decoded-frame evidence image from a WebM or MP4 rendition basename. */
function frameStripUrl(url: string, resolveUrl: (value: string) => string) {
  return resolveUrl(url.replace(/\.(webm|mp4)$/i, ".frames.png"))
}

/** Keeps six comparison players on the same user-controlled playback boundary. */
export function PreviewPilotReview({
  batches = [],
  entries,
  mode = "pilot",
}: {
  batches?: readonly ReviewBatch[]
  entries: readonly ReviewEntry[]
  mode?: "pilot" | "catalog"
}) {
  const resolveUrl = mode === "catalog" ? resolveCatalogPreviewUrl : resolvePreviewRenditionUrl
  const [batchSlug, setBatchSlug] = useState(batches[0]?.slug ?? "")
  const [backgroundId, setBackgroundId] = useState(entries[0]?.backgroundId ?? "")
  const [aspect, setAspect] = useState<BackgroundPreviewAspect>("vertical")
  const [playing, setPlaying] = useState(false)
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const visibleEntries = mode === "catalog" && batchSlug
    ? entries.filter((candidate) => "batchSlug" in candidate && candidate.batchSlug === batchSlug)
    : entries
  const entry = visibleEntries.find((candidate) => candidate.backgroundId === backgroundId) ?? visibleEntries[0]
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
      <div data-testid={mode === "catalog" ? "background-preview-catalog-review" : "background-preview-pilot-review"}>
        <AppSurface title="Pilot evidence unavailable" variant="inset">
          <div className={styles.emptyState}>
            <h2>No validated {mode === "catalog" ? "catalog" : "pilot"} media is loaded</h2>
            <p>
              Generate and validate the local {mode === "catalog" ? "catalog" : "pilot"} to populate this review matrix.
              Production preview media remains untouched.
            </p>
          </div>
        </AppSurface>
      </div>
    )
  }

  const poster = entry.posters[aspect]
  return (
    <div data-testid={mode === "catalog" ? "background-preview-catalog-review" : "background-preview-pilot-review"} className={styles.review}>
      <AppSurface title="Review controls" description="All players stay muted and restart from the same loop boundary." variant="inset">
        <div className={styles.controls}>
          {mode === "catalog" ? (
            <label>
              <span>Batch</span>
              <select value={batchSlug} onChange={(event) => {
                pauseAll()
                const nextBatch = event.target.value
                setBatchSlug(nextBatch)
                setBackgroundId(entries.find((candidate) => "batchSlug" in candidate && candidate.batchSlug === nextBatch)?.backgroundId ?? "")
              }}>
                {batches.map((batch) => <option key={batch.slug} value={batch.slug}>{batch.title}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            <span>Background</span>
            <select value={entry.backgroundId} onChange={(event) => { pauseAll(); setBackgroundId(event.target.value) }}>
              {visibleEntries.map((candidate) => <option key={candidate.backgroundId} value={candidate.backgroundId}>{candidate.label}</option>)}
            </select>
          </label>
          <label>
            <span>Aspect</span>
            <select value={aspect} onChange={(event) => { pauseAll(); setAspect(event.target.value as BackgroundPreviewAspect) }}>
              {ASPECTS.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
            </select>
          </label>
          <div className={styles.actions}>
            {entry.mediaKind !== "poster-only" ? <Button type="button" onClick={playing ? pauseAll : playAll}>{playing ? "Pause all" : "Play all"}</Button> : null}
            <Button type="button" variant="outline" onClick={restartAll}>Restart at loop boundary</Button>
            {mode === "catalog" ? (
              <>
                <Button type="button" variant="outline" disabled={visibleEntries.indexOf(entry) <= 0} onClick={() => setBackgroundId(visibleEntries[visibleEntries.indexOf(entry) - 1].backgroundId)}>Previous</Button>
                <Button type="button" variant="outline" disabled={visibleEntries.indexOf(entry) >= visibleEntries.length - 1} onClick={() => setBackgroundId(visibleEntries[visibleEntries.indexOf(entry) + 1].backgroundId)}>Next</Button>
              </>
            ) : null}
          </div>
        </div>
        <dl className={styles.summary}>
          <div><dt>Loop strategy</dt><dd>{entry.loopStrategy}</dd></div>
          <div><dt>Loop boundary</dt><dd>{(entry.loopBoundaryMs / 1000).toFixed(2)}s</dd></div>
          <div><dt>Recipe</dt><dd>{entry.recipeRevision}</dd></div>
          <div><dt>Validation</dt><dd>Complete manifest accepted</dd></div>
          {"reviewStatus" in entry ? <div><dt>Review status</dt><dd>{entry.reviewStatus}</dd></div> : null}
        </dl>
      </AppSurface>

      <AppSurface title={`${entry.label} · ${aspect}`} description="One poster and six independently encoded renditions from the same authored timeline." variant="card">
        {entry.mediaKind !== "poster-only" ? <div className={styles.posterRow}>
          {/* The poster is evidence, not decorative content. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveUrl(poster.url)} alt={`${entry.label} ${aspect} preview poster`} />
          <p>{poster.width}×{poster.height} · {formatBytes(poster.bytes)}</p>
        </div> : null}
        {entry.mediaKind === "poster-only" ? (
          <div className={styles.staticGrid}>
            {ASPECTS.map((posterAspect) => (
              <article key={posterAspect} className={styles.card}>
                <h3>{posterAspect}</h3>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveUrl(entry.posters[posterAspect].url)} alt={`${entry.label} ${posterAspect} static poster`} />
                <p>{entry.posters[posterAspect].width}×{entry.posters[posterAspect].height} · {formatBytes(entry.posters[posterAspect].bytes)}</p>
              </article>
            ))}
            <p className={styles.staticNotice}>Static background — no motion preview required.</p>
          </div>
        ) : <div className={styles.grid}>
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
                poster={resolveUrl(poster.url)}
              >
                <source src={resolveUrl(rendition.url)} type={rendition.mimeType} />
              </video>
              <p>{rendition.width}×{rendition.height} · {rendition.fps}fps · {(rendition.durationMs / 1000).toFixed(2)}s · {formatBytes(rendition.bytes)}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.frameStrip} src={frameStripUrl(rendition.url, resolveUrl)} alt={`${QUALITY_LABELS[rendition.quality]} ${CODEC_LABELS[rendition.codec]} decoded frame strip`} />
            </article>
          ))}
        </div>}
      </AppSurface>
    </div>
  )
}
