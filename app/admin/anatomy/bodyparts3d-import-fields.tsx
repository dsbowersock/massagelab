"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BODYPARTS3D_VIEWS,
  bodyParts3dComposerUrl,
  bodyParts3dImageUrl,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dRenderableImageUrl,
  type BodyParts3dTreeName,
  type BodyParts3dViewSlug,
} from "@/lib/anatomy-media-review"

const BODYPARTS3D_BROWSER_URL = "https://lifesciencedb.jp/bp3d/?lng=en"
const VIEW_SHORTCUT_LABELS: Record<BodyParts3dViewSlug, string> = {
  anterior: "Anterior",
  posterior: "Posterior",
  "left-lateral": "Left",
  "right-lateral": "Right",
  superior: "Superior",
  inferior: "Inferior",
  transverse: "Transverse",
}

export function BodyParts3dImportFields({ initialPartIds = "" }: { initialPartIds?: string }) {
  const [partIds, setPartIds] = useState(initialPartIds)
  const [treeName, setTreeName] = useState<BodyParts3dTreeName>("isa")
  const [view, setView] = useState<BodyParts3dViewSlug>("anterior")
  const [sourceUrl, setSourceUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const normalizedPartIds = useMemo(() => normalizeBodyParts3dPartIds(partIds), [partIds])
  const generatedPreviewUrl = useMemo(() => (
    normalizedPartIds.length > 0
      ? bodyParts3dImageUrl({ partIds: normalizedPartIds, treeName, view })
      : ""
  ), [normalizedPartIds, treeName, view])
  // BodyParts3D composer map URLs seed the item parts/tree. The generated image URL carries the selected preset camera.
  const composerUrl = useMemo(() => (
    normalizedPartIds.length > 0
      ? bodyParts3dComposerUrl({ partIds: normalizedPartIds, treeName })
      : ""
  ), [normalizedPartIds, treeName])
  const safeOverrideUrl = useMemo(() => safeBodyParts3dRenderableImageUrl(sourceUrl), [sourceUrl])
  const invalidOverrideUrl = sourceUrl.trim().length > 0 && !safeOverrideUrl
  const previewUrl = safeOverrideUrl || generatedPreviewUrl

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  async function copyPreviewUrl() {
    if (!previewUrl || typeof navigator === "undefined" || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copyResetTimeoutRef.current = null
      }, 1500)
    } catch {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
        copyResetTimeoutRef.current = null
      }
      setCopied(false)
    }
  }

  return (
    <>
      <div className="rounded-md border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Fast path</p>
        <p>Select a view shortcut and check the preview. If it is the image you want, leave the custom URL blank and click Import and Link View.</p>
        <p className="mt-2">Open the BodyParts3D parts composer when you need custom angle, zoom, or framing. It starts from the item parts and tree; rotate or zoom there, then paste the composer URL here.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bodyparts3d-part-ids">BodyParts3D/FMA IDs</Label>
        <Input
          id="bodyparts3d-part-ids"
          name="part_ids"
          value={partIds}
          onChange={(event) => setPartIds(event.target.value)}
          placeholder="FMA37670, FMA37671"
        />
        <p className="text-xs text-muted-foreground">
          {normalizedPartIds.length > 0
            ? `Will request: ${normalizedPartIds.join(", ")}`
            : "Use one or more BodyParts3D/FMA IDs for the anatomy item. Existing BodyParts3D images and FMA IDs fill this in when available."}
        </p>
      </div>

      <div className="space-y-2">
        <Label>View shortcuts</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BODYPARTS3D_VIEWS.map((viewOption) => (
            <Button
              key={viewOption.slug}
              type="button"
              variant={view === viewOption.slug ? "default" : "outline"}
              className="justify-start"
              onClick={() => setView(viewOption.slug)}
            >
              {VIEW_SHORTCUT_LABELS[viewOption.slug]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Superior and inferior use top and bottom orientations. Transverse is an approximation using the top orientation; paste a custom URL when BodyParts3D gives you a better exact angle.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bodyparts3d-tree-name">BodyParts3D tree</Label>
          <select
            id="bodyparts3d-tree-name"
            name="tree_name"
            value={treeName}
            onChange={(event) => setTreeName(event.target.value as BodyParts3dTreeName)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="isa">Is-a</option>
            <option value="partof">Part-of</option>
          </select>
          <p className="text-xs text-muted-foreground">Use Is-a for the specific structure; use Part-of when the surrounding region helps.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bodyparts3d-view">Preset view</Label>
          <select
            id="bodyparts3d-view"
            name="view"
            value={view}
            onChange={(event) => setView(event.target.value as BodyParts3dViewSlug)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {BODYPARTS3D_VIEWS.map((viewOption) => (
              <option key={viewOption.slug} value={viewOption.slug}>{viewOption.title}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">The shortcuts above and this preset menu use the same BodyParts3D/FMA IDs.</p>
        </div>
      </div>

      {previewUrl ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/80 bg-background/70 p-2">
          {composerUrl ? (
            <Button asChild type="button" variant="outline" size="sm">
              <a href={composerUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open BodyParts3D parts composer
              </a>
            </Button>
          ) : null}
          <Button asChild type="button" variant="outline" size="sm">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open generated image
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={copyPreviewUrl}>
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? "Copied URL" : "Copy generated image URL"}
          </Button>
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            The composer opens the item parts and tree for editing. The generated image is the current preset preview.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="bodyparts3d-source-url">Custom BodyParts3D URL</Label>
          <a href={BODYPARTS3D_BROWSER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline">
            Open BodyParts3D home
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
        <Input
          id="bodyparts3d-source-url"
          name="source_url"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://lifesciencedb.jp/bp3d/?tp_ap=..."
        />
        {invalidOverrideUrl ? (
          <p className="text-xs text-destructive">Use a BodyParts3D composer/map URL or HTTPS API image URL.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Leave blank when a preset preview looks right. Paste a BodyParts3D composer URL after you adjust a view.</p>
        )}
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-md border border-border/80 bg-background/80">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2 text-xs text-muted-foreground">
            <span>Preview</span>
            <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              Open generated image
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
          <div className="grid aspect-square place-items-center bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- BodyParts3D API preview is generated before upload. */}
            <img src={previewUrl} alt="BodyParts3D preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <p className="border-t border-border/80 px-3 py-2 text-xs text-muted-foreground">
            This preview is the image that will be uploaded and linked when you import.
          </p>
        </div>
      ) : null}
    </>
  )
}
