import { notFound } from "next/navigation"

import { backgroundPreviewRenditionManifest } from "@/components/backgrounds/backgroundPreviewRenditionManifest"
import { backgroundPreviewCatalogManifest } from "@/components/backgrounds/backgroundPreviewCatalogManifest"
import { findBackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { AppPageShell } from "@/components/ui/app-surface"
import { PreviewPilotReview } from "./preview-pilot-review"

export const metadata = {
  title: "Background Preview Review",
  robots: {
    index: false,
    follow: false,
  },
}

const CATALOG_BATCHES = [
  { slug: "01-foundations", title: "Foundations and signature forms" },
  { slug: "02-flow-and-liquid", title: "Flow and liquid motion" },
  { slug: "03-light-and-rays", title: "Light, rays, and beams" },
  { slug: "04-grids-and-pixels", title: "Grids, pixels, and geometry" },
  { slug: "05-atmosphere-and-cosmos", title: "Atmosphere and cosmos" },
  { slug: "06-digital-energy", title: "Digital and high-energy effects" },
  { slug: "07-fields-and-celestial", title: "Fields and celestial motion" },
] as const

export default async function BackgroundPreviewPilotPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const { catalog } = await searchParams
  const catalogMode = catalog === "full"
  const sourceEntries = catalogMode
    ? backgroundPreviewCatalogManifest.entries
    : Object.values(backgroundPreviewRenditionManifest)
  const entries = sourceEntries.map((entry) => ({
    ...entry,
    label: findBackgroundDefinition(entry.backgroundId)?.label ?? entry.backgroundId,
  }))

  return (
    <AppPageShell width="full" contentClassName="gap-8 pb-24">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Local development · visual approval gate</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Background preview {catalogMode ? "catalog" : "pilot"}</h1>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          {catalogMode
            ? "Review every curated batch across all aspects, quality tiers, and codecs. Static backgrounds remain poster-only."
            : "Compare the three quality tiers and both codecs from one validated capture recipe."}
          {" "}This sidecar is local-only and does not replace the production preview manifest.
        </p>
      </header>
      <PreviewPilotReview entries={entries} mode={catalogMode ? "catalog" : "pilot"} batches={catalogMode ? CATALOG_BATCHES : []} />
    </AppPageShell>
  )
}
