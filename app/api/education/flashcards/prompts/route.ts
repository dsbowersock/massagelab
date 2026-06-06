import { NextResponse } from "next/server"
import {
  createFlashcardPromptDeck,
  getFlashcardPromptTypeCounts,
} from "@/lib/anatomy-study"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import { normalizeFlashcardDeckConfig } from "@/lib/flashcard-community"

function objectBody(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function POST(request: Request) {
  const body = objectBody(await request.json().catch(() => ({})))
  const config = normalizeFlashcardDeckConfig(body.config)
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const promptTypeCounts = getFlashcardPromptTypeCounts(config, mediaOptions)
  const prompts = body.includePrompts === true
    ? createFlashcardPromptDeck(config, mediaOptions)
    : []

  return NextResponse.json({
    promptTypeCounts,
    prompts,
  })
}
