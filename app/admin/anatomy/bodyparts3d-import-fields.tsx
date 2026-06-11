"use client"

import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BODYPARTS3D_VIEWS,
  bodyParts3dImageUrl,
  normalizeBodyParts3dPartIds,
  type BodyParts3dTreeName,
  type BodyParts3dViewSlug,
} from "@/lib/anatomy-media-review"

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
  const previewUrl = sourceUrl.trim() || generatedPreviewUrl

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="bodyparts3d-part-ids">Part IDs</Label>
        <Input
          id="bodyparts3d-part-ids"
          name="part_ids"
          value={partIds}
          onChange={(event) => setPartIds(event.target.value)}
          placeholder="FMA37670, FMA37671"
        />
        <p className="text-xs text-muted-foreground">
          {normalizedPartIds.length > 0 ? normalizedPartIds.join(", ") : "Enter one or more BodyParts3D/FMA IDs."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bodyparts3d-tree-name">Tree</Label>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="bodyparts3d-view">View</Label>
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
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bodyparts3d-source-url">BodyParts3D URL Override</Label>
        <Input
          id="bodyparts3d-source-url"
          name="source_url"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="Optional API/image URL"
        />
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
        </div>
      ) : null}
    </>
  )
}
