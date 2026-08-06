import { notFound } from "next/navigation"

import { backgroundPreviewRenditionManifest } from "@/components/backgrounds/backgroundPreviewRenditionManifest"
import { findBackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { AppPageShell } from "@/components/ui/app-surface"
import { PreviewPilotReview } from "./preview-pilot-review"

export const metadata = {
  title: "Background Preview Pilot Review",
  robots: {
    index: false,
    follow: false,
  },
}

export default function BackgroundPreviewPilotPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const entries = Object.values(backgroundPreviewRenditionManifest).map((entry) => ({
    ...entry,
    label: findBackgroundDefinition(entry.backgroundId)?.label ?? entry.backgroundId,
  }))

  return (
    <AppPageShell width="full" contentClassName="gap-8 pb-24">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Local development · visual approval gate</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Background preview pilot</h1>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Compare the three quality tiers and both codecs from one validated capture recipe.
          This sidecar is local-only and does not replace the production preview manifest.
        </p>
      </header>
      <PreviewPilotReview entries={entries} />
    </AppPageShell>
  )
}

