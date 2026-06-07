import { NextResponse } from "next/server"
import {
  createFlashcardPromptDeck,
  getFlashcardPromptTypeCounts,
} from "@/lib/anatomy-study"
import { normalizeFlashcardDeckConfig } from "@/lib/flashcard-community"

const emptyMediaOptions = { mediaUrlBySlug: new Map<string, string>() }

function objectBody(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function optionalMediaOptions(shouldLoad: boolean) {
  if (!shouldLoad) return emptyMediaOptions

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const { loadAnatomyStudyMediaUrlOptions } = await import("@/lib/anatomy-study-media")

    return await Promise.race([
      loadAnatomyStudyMediaUrlOptions(),
      new Promise<typeof emptyMediaOptions>((resolve) => {
        timeoutId = setTimeout(() => resolve(emptyMediaOptions), 1500)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function POST(request: Request) {
  const body = objectBody(await request.json().catch(() => ({})))
  const config = normalizeFlashcardDeckConfig(body.config)
  const shouldLoadMediaUrls = config.promptTypes.includes("identify_from_media")
  const mediaOptions = await optionalMediaOptions(shouldLoadMediaUrls)
  const promptTypeCounts = getFlashcardPromptTypeCounts(config, mediaOptions)
  const prompts = body.includePrompts === true
    ? createFlashcardPromptDeck(config, mediaOptions)
    : []

  return NextResponse.json({
    promptTypeCounts,
    prompts,
  })
}
