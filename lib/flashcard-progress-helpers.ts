import {
  ANATOMY_STUDY_CATEGORIES,
  ANATOMY_STUDY_REGION_ORDER,
  FLASHCARD_PROMPT_TYPES,
  getAnatomyStudyPrompts,
  type AnatomyStudyBuildOptions,
} from "./anatomy-study.ts"
import { FLASHCARD_TOOL } from "./flashcard-community.ts"

export const emptyFlashcardMediaOptions = { mediaUrlBySlug: new Map<string, string>() }

export function flashcardPromptIdFromTool(tool: string) {
  const prefix = `${FLASHCARD_TOOL}:`
  return tool.startsWith(prefix) ? tool.slice(prefix.length) : ""
}

export async function optionalFlashcardMediaOptions() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const { loadAnatomyStudyMediaUrlOptions } = await import("./anatomy-study-media.ts")

    return await Promise.race([
      loadAnatomyStudyMediaUrlOptions(),
      new Promise<typeof emptyFlashcardMediaOptions>((resolve) => {
        timeoutId = setTimeout(() => resolve(emptyFlashcardMediaOptions), 1500)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function allFlashcardPrompts(options: AnatomyStudyBuildOptions = emptyFlashcardMediaOptions) {
  return getAnatomyStudyPrompts({
    categories: [...ANATOMY_STUDY_CATEGORIES],
    regions: [...ANATOMY_STUDY_REGION_ORDER],
    difficulty: "hard",
    promptTypes: [...FLASHCARD_PROMPT_TYPES],
    answerMode: "typed",
  }, options)
}

export function allFlashcardPromptIds(options: AnatomyStudyBuildOptions = emptyFlashcardMediaOptions) {
  return new Set(allFlashcardPrompts(options).map((prompt) => prompt.id))
}
