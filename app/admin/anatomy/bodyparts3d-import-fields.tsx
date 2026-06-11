"use client"

import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BODYPARTS3D_VIEWS,
  bodyParts3dImageUrl,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dImageUrl,
  type BodyParts3dTreeName,
  type BodyParts3dViewSlug,
} from "@/lib/anatomy-media-review"

const BODYPARTS3D_BROWSER_URL = "https://lifesciencedb.jp/bp3d/?lng=en"

export function BodyParts3dImportFields({ initialPartIds = "" }: { initialPartIds?: string }) {
  const [partIds, setPartIds] = useState(initialPartIds)
  const [treeName, setTreeName] = useState<BodyParts3dTreeName>("isa")
  const [view, setView] = useState<BodyParts3dViewSlug>("anterior")
  const [sourceUrl, setSourceUrl] = useState("")
  const normalizedPartIds = useMemo(() => normalizeBodyParts3dPartIds(partIds), [partIds])
  const generatedPreviewUrl = useMemo(() => (
    normalizedPartIds.length > 0
      ? bodyParts3dImageUrl({ partIds: normalizedPartIds, treeName, view })
      : ""
  ), [normalizedPartIds, treeName, view])
  const safeOverrideUrl = useMemo(() => safeBodyParts3dImageUrl(sourceUrl), [sourceUrl])
  const invalidOverrideUrl = sourceUrl.trim().length > 0 && !safeOverrideUrl
  const previewUrl = safeOverrideUrl || generatedPreviewUrl

  return (
    <>
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
            : "Use one or more BodyParts3D/FMA IDs for the anatomy item."}
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
          <p className="text-xs text-muted-foreground">For custom angles such as superior, inferior, transverse, or zoomed-out views, paste an API image URL below.</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="bodyparts3d-source-url">Custom BodyParts3D image URL</Label>
          <a href={BODYPARTS3D_BROWSER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline">
            Open BodyParts3D
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
        <Input
          id="bodyparts3d-source-url"
          name="source_url"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://lifesciencedb.jp/bp3d/API/image?..."
        />
        {invalidOverrideUrl ? (
          <p className="text-xs text-destructive">Override must be a BodyParts3D HTTPS API/image URL.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Paste the BodyParts3D API image URL after composing the exact view you want.</p>
        )}
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-md border border-border/80 bg-background/80">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2 text-xs text-muted-foreground">
            <span>Preview</span>
            <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              Open source
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
