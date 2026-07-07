import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getBackgroundDefinition,
  type BackgroundId,
} from "@/components/backgrounds/backgroundRegistry"
import { ChimerBackgroundPreviewScene } from "./preview-scene"

export const metadata: Metadata = {
  title: "Chimer background preview",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function ChimerBackgroundPreviewPage({
  params,
}: {
  params: Promise<{ backgroundId: string }>
}) {
  const { backgroundId } = await params
  const background = getBackgroundDefinition(backgroundId)

  if (background.id !== backgroundId || !background.enabled || !background.category.includes("chimer")) {
    notFound()
  }

  return (
    <ChimerBackgroundPreviewScene
      backgroundId={background.id as BackgroundId}
      label={background.label}
    />
  )
}
