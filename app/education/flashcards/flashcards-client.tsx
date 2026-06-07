"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ExternalLink, Layers3, Lock, Play, RotateCcw, Save, Shuffle, Sparkles, Target, Timer, Trophy, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type {
  AnatomyStudyDifficulty,
  FlashcardAnswerMode,
  FlashcardPrompt,
  FlashcardPromptType,
} from "@/lib/anatomy-study"
import {
  FLASHCARD_STATIC_ANSWER_MODES,
  FLASHCARD_STATIC_CATEGORY_IDS,
  FLASHCARD_STATIC_PROMPT_TYPES,
  FLASHCARD_STATIC_REGION_IDS,
} from "@/lib/flashcard-static-metadata"
import type { FlashcardDeckSummary, NormalizedFlashcardDeckConfig } from "@/lib/flashcard-community"

type Option = {
  id: string
  label: string
  termCount?: number
}

type Source = {
  id: string
  label: string
  url?: string
  license?: string
  attribution: string
}

type PromptResult = {
  promptId: string
  correct: boolean
  score: number
}

type PromptTypeCount = {
  id: FlashcardPromptType
  label: string
  promptCount: number
}

type ActiveDeckKind = "temporary" | "starter" | "community"

type FlashcardProgressDashboard = {
  trackedPromptCount: number
  activePromptCount: number
  masteredPromptCount: number
  totalAttempts: number
  totalCorrect: number
  totalIncorrect: number
  accuracyPercent: number
  masteryThreshold: number
  completedSessionCount: number
  achievementCount: number
  bestDurationMs: number | null
}

type FlashcardRecentProgress = {
  promptId: string
  promptType: string
  entityType: string
  entitySlug: string
  status: string
  score: number | null
  attemptCount: number
  correctCount: number
  incorrectCount: number
  masteryThreshold: number
  masteredAt: string | null
  lastSeenAt: string
}

type FlashcardAchievementSummary = {
  key: string
  earnedAt: string
}

type FlashcardProgressPayload = {
  progress: FlashcardProgressDashboard
  recentProgress: FlashcardRecentProgress[]
  achievements: FlashcardAchievementSummary[]
}

type FlashcardsClientProps = {
  categories: Option[]
  regions: Option[]
  sources: Source[]
  initialDecks: FlashcardDeckSummary[]
  initialPromptTypeCounts: PromptTypeCount[]
  isSignedIn: boolean
  initialDeck?: FlashcardDeckSummary | null
}

const difficultyLabels: Record<AnatomyStudyDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const answerModeLabels: Record<FlashcardAnswerMode, string> = {
  typed: "Typed Check",
  review: "Reveal Review",
}

const activeDeckKindLabels: Record<ActiveDeckKind, string> = {
  temporary: "Temporary Deck",
  starter: "Starter Deck",
  community: "Community Deck",
}

const deckSizeOptions = [10, 20, 30, 50, 100]
const draftStorageKey = "massagelab-flashcard-draft-config-v1"

function selectClassName() {
  return "h-10 rounded-md border border-border/80 bg-background/80 px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
}

function normalizeAnswer(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

function fieldMatches(value: string, acceptedAnswers: string[]) {
  const normalized = normalizeAnswer(value)
  if (!normalized) return false

  return acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalized)
}

function promptRows(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.filter((prompt): prompt is FlashcardPrompt => (
    Boolean(prompt && typeof prompt === "object" && !Array.isArray(prompt) && typeof (prompt as { id?: unknown }).id === "string")
  ))
}

function sessionStartPayload(value: unknown) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const session = record.session && typeof record.session === "object" && !Array.isArray(record.session)
    ? record.session as Record<string, unknown>
    : {}
  const promptIds = Array.isArray(session.promptIds)
    ? session.promptIds.filter((promptId): promptId is string => typeof promptId === "string")
    : []

  return {
    id: typeof session.id === "string" ? session.id : "",
    promptIds,
    prompts: promptRows(session.prompts),
  }
}

function promptDeckPayload(value: unknown) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return promptRows(record.prompts)
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function nullableNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function progressPayload(value: unknown): FlashcardProgressPayload | null {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const progress = record.progress && typeof record.progress === "object" && !Array.isArray(record.progress)
    ? record.progress as Record<string, unknown>
    : null

  if (!progress) return null

  const recentProgress = Array.isArray(record.recentProgress)
    ? record.recentProgress.map((item) => {
      const row = item && typeof item === "object" && !Array.isArray(item)
        ? item as Record<string, unknown>
        : {}

      return {
        promptId: text(row.promptId),
        promptType: text(row.promptType),
        entityType: text(row.entityType),
        entitySlug: text(row.entitySlug),
        status: text(row.status),
        score: nullableNumber(row.score),
        attemptCount: numeric(row.attemptCount),
        correctCount: numeric(row.correctCount),
        incorrectCount: numeric(row.incorrectCount),
        masteryThreshold: numeric(row.masteryThreshold, 10),
        masteredAt: text(row.masteredAt) || null,
        lastSeenAt: text(row.lastSeenAt),
      }
    }).filter((item) => item.promptId)
    : []
  const achievements = Array.isArray(record.achievements)
    ? record.achievements.map((item) => {
      const row = item && typeof item === "object" && !Array.isArray(item)
        ? item as Record<string, unknown>
        : {}

      return {
        key: text(row.key),
        earnedAt: text(row.earnedAt),
      }
    }).filter((item) => item.key)
    : []

  return {
    progress: {
      trackedPromptCount: numeric(progress.trackedPromptCount),
      activePromptCount: numeric(progress.activePromptCount),
      masteredPromptCount: numeric(progress.masteredPromptCount),
      totalAttempts: numeric(progress.totalAttempts),
      totalCorrect: numeric(progress.totalCorrect),
      totalIncorrect: numeric(progress.totalIncorrect),
      accuracyPercent: numeric(progress.accuracyPercent),
      masteryThreshold: numeric(progress.masteryThreshold, 10),
      completedSessionCount: numeric(progress.completedSessionCount),
      achievementCount: numeric(progress.achievementCount),
      bestDurationMs: nullableNumber(progress.bestDurationMs),
    },
    recentProgress,
    achievements,
  }
}

function formatDuration(durationMs: number | null) {
  if (!durationMs) return "Not yet"
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

async function localPromptDeck(config: NormalizedFlashcardDeckConfig) {
  const { createFlashcardPromptDeck } = await import("@/lib/anatomy-study")

  return createFlashcardPromptDeck(config, { mediaUrlBySlug: new Map() })
}

async function localPromptTypeCounts(config: NormalizedFlashcardDeckConfig) {
  const { getFlashcardPromptTypeCounts } = await import("@/lib/anatomy-study")

  return getFlashcardPromptTypeCounts(config, { mediaUrlBySlug: new Map() })
}

function configFromState(state: {
  category: string
  region: string
  difficulty: AnatomyStudyDifficulty
  promptTypes: FlashcardPromptType[]
  answerMode: FlashcardAnswerMode
  deckSize: number
}): NormalizedFlashcardDeckConfig {
  return {
    categories: state.category === "all" ? [...FLASHCARD_STATIC_CATEGORY_IDS] : [state.category as NormalizedFlashcardDeckConfig["categories"][number]],
    regions: state.region === "all" ? [...FLASHCARD_STATIC_REGION_IDS] : [state.region as NormalizedFlashcardDeckConfig["regions"][number]],
    difficulty: state.difficulty,
    promptTypes: state.promptTypes,
    answerMode: state.answerMode,
    count: state.deckSize,
    seed: `browser-${Date.now().toString(36)}`,
  }
}

function accuracy(correct: number, answered: number) {
  if (answered === 0) return 0
  return Math.round((correct / answered) * 100)
}

function optionLabel(option: Option) {
  return typeof option.termCount === "number" ? `${option.label} (${option.termCount})` : option.label
}

function PromptSourceLinks({ prompt }: { prompt: FlashcardPrompt }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      {prompt.sources.map((source) => (
        source.url ? (
          <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/80 px-2 py-1 transition hover:text-foreground">
            {source.label}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : <span key={source.id} className="rounded-md border border-border/80 px-2 py-1">{source.label}</span>
      ))}
    </div>
  )
}

function PromptBadges({ prompt }: { prompt: FlashcardPrompt }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <Badge variant="outline">{prompt.typeLabel}</Badge>
      <Badge variant="outline">{prompt.categoryLabel}</Badge>
      {prompt.regionLabels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
      <Badge variant="outline">{difficultyLabels[prompt.difficulty]}</Badge>
    </div>
  )
}

function PromptFront({ prompt, isReviewMode }: { prompt: FlashcardPrompt; isReviewMode: boolean }) {
  return (
    <div className="flex h-full flex-col gap-5 p-5 sm:p-7">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase text-muted-foreground">
          <span>Question</span>
          <span>{prompt.typeLabel}</span>
        </div>
        <p className="text-sm text-muted-foreground">{prompt.front.instruction}</p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {prompt.front.mode === "media" && prompt.front.media ? (
          <figure className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border/80 bg-background/70">
            <div className="flex min-h-0 flex-1 items-center justify-center p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- reviewed source media can come from multiple external hosts not configured for next/image. */}
              <img src={prompt.front.media.url} alt={prompt.front.media.title} className="max-h-[20rem] w-full object-contain sm:max-h-[26rem]" loading="lazy" referrerPolicy="no-referrer" />
            </div>
            <figcaption className="border-t border-border/80 px-3 py-2 text-xs text-muted-foreground">{prompt.front.media.title}</figcaption>
          </figure>
        ) : (
          <h2 className="max-w-3xl break-words text-center text-3xl font-semibold tracking-normal sm:text-5xl">{prompt.front.title}</h2>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span>{isReviewMode ? "Reveal when ready, then mark your recall." : "Type your answer below, then check it."}</span>
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
    </div>
  )
}

function PromptBack({ prompt, result }: { prompt: FlashcardPrompt; result: PromptResult | null }) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5 sm:p-7">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase text-muted-foreground">
          <span>Sourced Answer</span>
          {result ? (
            <span className={cn("inline-flex items-center gap-1", result.correct ? "text-emerald-500" : "text-destructive")}>
              {result.correct ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              {result.correct ? "Correct" : "Review"}
            </span>
          ) : null}
        </div>
        <h2 className="break-words text-2xl font-semibold tracking-normal sm:text-4xl">{prompt.name}</h2>
        {prompt.aliases.length > 0 ? (
          <p className="text-sm text-muted-foreground">Also: {prompt.aliases.slice(0, 6).join(", ")}</p>
        ) : null}
      </div>

      <div className="grid gap-3">
        {prompt.answerFields.map((field) => (
          <div key={field.id} className="rounded-md border border-border/80 bg-background/70 p-4">
            <div className="text-xs font-medium uppercase text-muted-foreground">{field.label}</div>
            <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-foreground">{field.answer}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-3 border-t border-border/70 pt-4">
        <PromptBadges prompt={prompt} />
        <PromptSourceLinks prompt={prompt} />
      </div>
    </div>
  )
}

function FlashcardSurface({
  prompt,
  isFlipped,
  isReviewMode,
  onReveal,
  result,
}: {
  prompt: FlashcardPrompt
  isFlipped: boolean
  isReviewMode: boolean
  onReveal: () => void
  result: PromptResult | null
}) {
  const canRevealFromCard = isReviewMode && !isFlipped && !result
  const shouldRenderBack = isFlipped || Boolean(result)

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="relative min-h-[30rem] sm:min-h-[34rem] [perspective:1600px]">
        <div
          role={canRevealFromCard ? "button" : undefined}
          tabIndex={canRevealFromCard ? 0 : undefined}
          aria-label={canRevealFromCard ? "Flip flashcard" : undefined}
          onClick={canRevealFromCard ? onReveal : undefined}
          onKeyDown={(event) => {
            if (!canRevealFromCard) return
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onReveal()
            }
          }}
          className={cn(
            "absolute inset-0 rounded-lg transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            isFlipped && "[transform:rotateY(180deg)]",
            canRevealFromCard && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <article className="absolute inset-0 overflow-hidden rounded-lg border border-border/80 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] shadow-[0_24px_70px_rgba(0,0,0,0.28)] [backface-visibility:hidden]">
            <PromptFront prompt={prompt} isReviewMode={isReviewMode} />
          </article>
          <article aria-hidden={!shouldRenderBack} className="absolute inset-0 overflow-hidden rounded-lg border border-primary/40 bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--card)))] shadow-[0_24px_70px_rgba(0,0,0,0.28)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {shouldRenderBack ? <PromptBack prompt={prompt} result={result} /> : null}
          </article>
        </div>
      </div>
    </div>
  )
}

export function FlashcardsClient({ categories, regions, sources, initialDecks, initialPromptTypeCounts, isSignedIn, initialDeck }: FlashcardsClientProps) {
  const communityDecksRef = useRef<HTMLDivElement | null>(null)
  const customDeckBuilderRef = useRef<HTMLDivElement | null>(null)
  const [category, setCategory] = useState("all")
  const [region, setRegion] = useState("all")
  const [difficulty, setDifficulty] = useState<AnatomyStudyDifficulty>("medium")
  const [promptTypes, setPromptTypes] = useState<FlashcardPromptType[]>(["identify_from_media", "name_to_region", "name_to_category"])
  const [answerMode, setAnswerMode] = useState<FlashcardAnswerMode>("typed")
  const [deckSize, setDeckSize] = useState(20)
  const [deckTitle, setDeckTitle] = useState("My flashcard deck")
  const [deckDescription, setDeckDescription] = useState("")
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC")
  const [communityDecks, setCommunityDecks] = useState(initialDecks)
  const [activeDeck, setActiveDeck] = useState<FlashcardPrompt[]>([])
  const [activeConfig, setActiveConfig] = useState<NormalizedFlashcardDeckConfig | null>(null)
  const [activeDeckKind, setActiveDeckKind] = useState<ActiveDeckKind>("temporary")
  const [sessionId, setSessionId] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  const [isStartingDeck, setIsStartingDeck] = useState(false)
  const [checkedResult, setCheckedResult] = useState<PromptResult | null>(null)
  const [results, setResults] = useState<PromptResult[]>([])
  const [saveMessage, setSaveMessage] = useState("")
  const [promptTypeCounts, setPromptTypeCounts] = useState(initialPromptTypeCounts)
  const [isLoadingPromptCounts, setIsLoadingPromptCounts] = useState(false)
  const [canPersistProgress, setCanPersistProgress] = useState(isSignedIn)
  const [skipMasteredPrompts, setSkipMasteredPrompts] = useState(false)
  const [progressDashboard, setProgressDashboard] = useState<FlashcardProgressPayload | null>(null)
  const [isLoadingProgressDashboard, setIsLoadingProgressDashboard] = useState(false)
  const studyStartedAtRef = useRef<number | null>(null)

  const refreshProgressDashboard = useCallback(async () => {
    if (!canPersistProgress) {
      setProgressDashboard(null)
      return
    }

    setIsLoadingProgressDashboard(true)
    try {
      const response = await fetch("/api/education/flashcards/progress")
      if (!response.ok) return

      const payload = progressPayload(await response.json())
      if (payload) setProgressDashboard(payload)
    } catch (error) {
      console.error("Failed to load flashcard progress", error)
    } finally {
      setIsLoadingProgressDashboard(false)
    }
  }, [canPersistProgress])

  useEffect(() => {
    const stored = window.localStorage.getItem(draftStorageKey)
    if (!stored) return

    try {
      const parsed = JSON.parse(stored) as Partial<NormalizedFlashcardDeckConfig>
      if (parsed.categories?.length === 1) setCategory(parsed.categories[0])
      if (parsed.regions?.length === 1) setRegion(parsed.regions[0])
      if (parsed.difficulty) setDifficulty(parsed.difficulty)
      if (parsed.promptTypes?.length) setPromptTypes(parsed.promptTypes)
      if (parsed.answerMode) setAnswerMode(parsed.answerMode)
      if (parsed.count) setDeckSize(parsed.count)
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch("/api/auth/session")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && payload?.user) setCanPersistProgress(true)
      })
      .catch(() => undefined)

    fetch("/api/education/flashcards/decks")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && payload?.decks) setCommunityDecks(payload.decks)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void refreshProgressDashboard()
  }, [refreshProgressDashboard])

  const countConfig = useMemo(() => configFromState({
    category,
    region,
    difficulty,
    promptTypes: [...FLASHCARD_STATIC_PROMPT_TYPES],
    answerMode: "typed",
    deckSize: 20,
  }), [category, difficulty, region])
  const setupConfig = useMemo(() => configFromState({ category, region, difficulty, promptTypes, answerMode, deckSize }), [answerMode, category, deckSize, difficulty, promptTypes, region])
  const eligiblePromptCount = useMemo(() => (
    promptTypeCounts
      .filter((type) => promptTypes.includes(type.id))
      .reduce((sum, type) => sum + type.promptCount, 0)
  ), [promptTypeCounts, promptTypes])

  useEffect(() => {
    let cancelled = false
    setIsLoadingPromptCounts(true)

    async function updatePromptCounts() {
      try {
        const response = await fetch("/api/education/flashcards/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: countConfig }),
        })
        const payload = response.ok ? await response.json() : null

        if (!cancelled && Array.isArray(payload?.promptTypeCounts)) {
          setPromptTypeCounts(payload.promptTypeCounts)
          return
        }
      } catch {
        // Fall back to the browser-side sourced adapter below.
      }

      try {
        const counts = await localPromptTypeCounts(countConfig)
        if (!cancelled) setPromptTypeCounts(counts)
      } catch (error) {
        console.error("Failed to calculate local flashcard prompt counts", error)
      }
    }

    void updatePromptCounts().finally(() => {
      if (!cancelled) setIsLoadingPromptCounts(false)
    })

    return () => {
      cancelled = true
    }
  }, [countConfig])

  const currentPrompt = activeDeck[currentIndex]
  const currentResult = currentPrompt ? results.find((result) => result.promptId === currentPrompt.id) ?? checkedResult : null
  const answeredCount = results.length + (checkedResult && !results.some((result) => result.promptId === checkedResult.promptId) ? 1 : 0)
  const correctCount = results.filter((result) => result.correct).length + (checkedResult && !results.some((result) => result.promptId === checkedResult.promptId) && checkedResult.correct ? 1 : 0)
  const progress = activeDeck.length > 0 ? ((currentIndex + 1) / activeDeck.length) * 100 : 0
  const promptTypeLabelById = useMemo(() => new Map(promptTypeCounts.map((type) => [type.id, type.label])), [promptTypeCounts])

  const togglePromptType = (type: FlashcardPromptType) => {
    setPromptTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((item) => item !== type)
      }

      return [...current, type]
    })
  }

  const showSetupSection = (section: "community" | "custom") => {
    const target = section === "community" ? communityDecksRef.current : customDeckBuilderRef.current
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const startDeck = async (config = setupConfig, deckSlug = "", deckKind: ActiveDeckKind = deckSlug ? "community" : "temporary") => {
    if (isStartingDeck) return

    setSaveMessage("")
    setIsStartingDeck(true)

    try {
      const activateDeck = (nextDeck: FlashcardPrompt[], nextSessionId = "", nextDeckKind = deckKind) => {
        setActiveConfig(config)
        setActiveDeck(nextDeck)
        setActiveDeckKind(nextDeckKind)
        setSessionId(nextSessionId)
        studyStartedAtRef.current = Date.now()
        setCurrentIndex(0)
        setAnswers({})
        setIsCardFlipped(false)
        setCheckedResult(null)
        setResults([])
      }

      const startTemporaryDeck = async (message = "") => {
        try {
          const response = await fetch("/api/education/flashcards/prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config, includePrompts: true }),
          })

          if (!response.ok) {
            throw new Error(`Prompt API returned ${response.status}.`)
          }

          const prompts = promptDeckPayload(await response.json())
          if (prompts.length === 0) {
            throw new Error("Prompt API returned no prompts.")
          }

          activateDeck(prompts)
          if (message) setSaveMessage(message)
          return
        } catch (error) {
          console.warn("Falling back to local flashcard prompt generation", error)
        }

        try {
          const prompts = await localPromptDeck(config)
          if (prompts.length === 0) {
            setSaveMessage("Deck could not be started.")
            return
          }

          activateDeck(prompts)
          if (message) setSaveMessage(message)
        } catch (error) {
          console.error("Failed to start temporary flashcard deck locally", error)
          setSaveMessage("Deck could not be started.")
        }
      }

      if (canPersistProgress) {
        let fallbackMessage = ""

        try {
          const response = await fetch("/api/education/flashcards/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deckSlug ? { deckSlug, skipMastered: skipMasteredPrompts } : { config, skipMastered: skipMasteredPrompts }),
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            if (skipMasteredPrompts && response.status === 409) {
              setSaveMessage(typeof payload?.error === "string" ? payload.error : "All selected prompts are already mastered.")
              return
            }

            fallbackMessage = "Studying temporarily; progress tracking could not be started."
            await startTemporaryDeck(fallbackMessage)
            return
          }

          const session = sessionStartPayload(await response.json())

          if (!session.id || session.promptIds.length === 0 || session.prompts.length !== session.promptIds.length) {
            fallbackMessage = "Studying temporarily; progress tracking could not be started."
            await startTemporaryDeck(fallbackMessage)
            return
          }

          activateDeck(session.prompts, session.id)
          return
        } catch (error) {
          console.error("Failed to start flashcard study session", error)
          fallbackMessage = "Studying temporarily; progress tracking could not be started."
          await startTemporaryDeck(fallbackMessage)
          return
        }
      }

      await startTemporaryDeck()
    } finally {
      setIsStartingDeck(false)
    }
  }

  const startFromDeck = (deck: FlashcardDeckSummary) => {
    setDeckTitle(deck.title)
    setDeckDescription(deck.description)
    setVisibility(deck.visibility)
    setCategory(deck.config.categories.length === 1 ? deck.config.categories[0] : "all")
    setRegion(deck.config.regions.length === 1 ? deck.config.regions[0] : "all")
    setDifficulty(deck.config.difficulty)
    setPromptTypes(deck.config.promptTypes)
    setAnswerMode(deck.config.answerMode)
    setDeckSize(deck.config.count)
    void startDeck(deck.config, deck.isStarter ? "" : deck.slug, deck.isStarter ? "starter" : "community")
  }

  useEffect(() => {
    if (initialDeck) startFromDeck(initialDeck)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeck?.slug])

  const persistDraftAndPromptSignIn = () => {
    window.localStorage.setItem(draftStorageKey, JSON.stringify(setupConfig))
    setSaveMessage("Sign in to save decks, progress, and achievements.")
  }

  const saveDeck = async () => {
    if (!canPersistProgress) {
      persistDraftAndPromptSignIn()
      return
    }

    const response = await fetch("/api/education/flashcards/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: deckTitle,
        description: deckDescription,
        visibility,
        config: setupConfig,
      }),
    }).catch(() => null)

    if (!response?.ok) {
      setSaveMessage("Deck could not be saved.")
      return
    }

    const payload = await response.json()
    if (payload.deck) {
      setCommunityDecks((current) => [payload.deck, ...current.filter((deck) => deck.slug !== payload.deck.slug)])
      setSaveMessage("Deck saved.")
    }
  }

  const checkCurrentAnswer = (correctOverride?: boolean) => {
    if (!currentPrompt) return
    const fieldResults = currentPrompt.answerFields.map((field) => ({
      correct: fieldMatches(answers[field.id] ?? "", field.acceptedAnswers),
    }))
    const correct = typeof correctOverride === "boolean" ? correctOverride : fieldResults.every((field) => field.correct)
    const score = typeof correctOverride === "boolean"
      ? (correctOverride ? 100 : 0)
      : Math.round((fieldResults.filter((field) => field.correct).length / Math.max(1, fieldResults.length)) * 100)

    setCheckedResult({ promptId: currentPrompt.id, correct, score })
    setIsCardFlipped(true)
  }

  const commitCurrentResult = () => {
    if (!currentPrompt || !checkedResult) return
    setResults((current) => [
      ...current.filter((result) => result.promptId !== currentPrompt.id),
      checkedResult,
    ])
    setCheckedResult(null)
    setAnswers({})
  }

  const nextPrompt = () => {
    if (checkedResult) commitCurrentResult()
    setIsCardFlipped(false)
    setCurrentIndex((index) => Math.min(activeDeck.length - 1, index + 1))
  }

  const previousPrompt = () => {
    if (checkedResult) commitCurrentResult()
    setCheckedResult(null)
    setAnswers({})
    setIsCardFlipped(false)
    setCurrentIndex((index) => Math.max(0, index - 1))
  }

  const resetStudy = () => {
    setActiveDeck([])
    setActiveConfig(null)
    setActiveDeckKind("temporary")
    setSessionId("")
    setCurrentIndex(0)
    setResults([])
    setCheckedResult(null)
    setAnswers({})
    setIsCardFlipped(false)
    studyStartedAtRef.current = null
  }

  const completeStudy = async () => {
    if (checkedResult) commitCurrentResult()
    const finalResults = checkedResult && !results.some((result) => result.promptId === checkedResult.promptId)
      ? [...results, checkedResult]
      : results

    if (!canPersistProgress) {
      setSaveMessage("Sign in to save progress and achievements.")
      return
    }
    if (!sessionId) {
      setSaveMessage("This temporary session cannot save progress.")
      return
    }

    try {
      const response = await fetch(`/api/education/flashcards/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: finalResults,
          durationMs: studyStartedAtRef.current ? Date.now() - studyStartedAtRef.current : undefined,
        }),
      })

      if (!response.ok) {
        setSaveMessage("Progress could not be saved.")
        return
      }

      setSaveMessage("Progress saved.")
      studyStartedAtRef.current = null
      void refreshProgressDashboard()
    } catch (error) {
      console.error("Failed to complete flashcard study session", error)
      setSaveMessage("Progress could not be saved.")
    }
  }

  if (activeDeck.length > 0 && currentPrompt && activeConfig) {
    const isReviewMode = activeConfig.answerMode === "review"
    const isCurrentCardFlipped = Boolean(currentResult) || isCardFlipped

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={resetStudy}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Setup
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{currentIndex + 1} of {activeDeck.length}</span>
            <span>{accuracy(correctCount, answeredCount)}% correct</span>
            <Badge variant="outline">{activeDeckKindLabels[activeDeckKind]}</Badge>
          </div>
        </div>

        <Progress value={progress} className="h-2 bg-neutral-800 [&>div]:bg-primary" />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <FlashcardSurface
              prompt={currentPrompt}
              isFlipped={isCurrentCardFlipped}
              isReviewMode={isReviewMode}
              onReveal={() => setIsCardFlipped(true)}
              result={currentResult}
            />

            {!isReviewMode ? (
              <div className="mx-auto grid w-full max-w-5xl gap-3 rounded-md border border-border/80 bg-background/70 p-4 md:grid-cols-2">
                {currentPrompt.answerFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`answer-${field.id}`}>{field.label}</Label>
                    <Input
                      id={`answer-${field.id}`}
                      value={answers[field.id] ?? ""}
                      onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
                      disabled={Boolean(currentResult)}
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-md border border-border/80 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={previousPrompt} disabled={currentIndex === 0} className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <div className="flex flex-wrap justify-center gap-2">
                {isReviewMode ? (
                  <>
                    {!isCurrentCardFlipped ? (
                      <Button type="button" onClick={() => setIsCardFlipped(true)}>
                        Reveal Answer
                      </Button>
                    ) : !currentResult ? (
                      <>
                        <Button type="button" variant="outline" onClick={() => checkCurrentAnswer(false)}>Missed</Button>
                        <Button type="button" onClick={() => checkCurrentAnswer(true)}>Correct</Button>
                      </>
                    ) : (
                      <Badge variant="outline">{currentResult.correct ? "Marked correct" : "Marked missed"}</Badge>
                    )}
                  </>
                ) : (
                  <Button type="button" onClick={() => checkCurrentAnswer()} disabled={Boolean(currentResult)}>
                    {currentResult ? "Checked" : "Check Answer"}
                  </Button>
                )}
              </div>
              {currentIndex >= activeDeck.length - 1 ? (
                <Button type="button" variant="outline" onClick={completeStudy} className="w-full sm:w-auto">
                  Save Results
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={nextPrompt} className="w-full sm:w-auto">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          <aside className="space-y-3 rounded-md border border-border/80 bg-background/70 p-4 xl:sticky xl:top-4 xl:self-start">
            <h3 className="text-sm font-medium">Deck Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-border/80 p-3"><div className="text-muted-foreground">Answered</div><div className="text-lg font-semibold">{answeredCount}</div></div>
              <div className="rounded-md border border-border/80 p-3"><div className="text-muted-foreground">Correct</div><div className="text-lg font-semibold">{correctCount}</div></div>
            </div>
            <div className="rounded-md border border-border/80 p-3 text-sm">
              <div className="text-muted-foreground">Mode</div>
              <div className="font-medium">{answerModeLabels[activeConfig.answerMode]}</div>
            </div>
            {!canPersistProgress ? (
              <div className="rounded-md border border-border/80 bg-card/70 p-3 text-sm text-muted-foreground">
                <Lock className="mb-2 h-4 w-4" aria-hidden="true" />
                Sign in to save progress and achievements.
                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link href="/login?callbackUrl=/education/flashcards">Sign In</Link>
                </Button>
              </div>
            ) : null}
            {saveMessage ? <p className="text-sm text-muted-foreground">{saveMessage}</p> : null}
          </aside>
        </section>
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-primary/40 bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-primary/30 bg-background/70 p-2 text-primary">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="text-lg font-semibold">Try A Premade Deck</h2>
                <p className="text-sm text-muted-foreground">Start from MassageLab or community deck templates.</p>
              </div>
            </div>
            {communityDecks.length > 0 ? (
              <Button type="button" className="mt-4 w-full sm:w-auto" onClick={() => showSetupSection("community")}>
                <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                Browse Premade Decks
              </Button>
            ) : null}
          </div>

          <div className="rounded-md border border-border/80 bg-background/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-border/80 bg-card/70 p-2 text-primary">
                <Layers3 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="text-lg font-semibold">Create Your Own</h2>
                <p className="text-sm text-muted-foreground">Choose the anatomy, prompt types, and review style before seeing cards.</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-4 w-full sm:w-auto" onClick={() => showSetupSection("custom")}>
              <Layers3 className="mr-2 h-4 w-4" aria-hidden="true" />
              Configure Custom Deck
            </Button>
          </div>
        </div>

        <div ref={communityDecksRef} className="scroll-mt-6 rounded-md border border-border/80 bg-background/70 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Community Decks</h2>
            </div>
            <Badge variant="outline">{communityDecks.length} available</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {communityDecks.map((deck) => (
              <article key={deck.slug} className="rounded-md border border-border/80 bg-card/60 p-4 transition hover:border-primary/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-medium">{deck.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{deck.description || deck.ownerName}</p>
                  </div>
                  <Badge variant="outline">{deck.isStarter ? "Starter" : deck.visibility}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{deck.promptCount} prompts</span>
                  <span>{deck.completionCount} completions</span>
                  <span>{deck.accuracyPercent}% accuracy</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button type="button" size="sm" onClick={() => startFromDeck(deck)} disabled={isStartingDeck}>
                    <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                    {isStartingDeck ? "Starting..." : "Study"}
                  </Button>
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link href={`/education/flashcards/decks/${deck.slug}`}>View</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div ref={customDeckBuilderRef} className="scroll-mt-6 rounded-md border border-border/80 bg-background/70 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Build A Deck</h2>
            </div>
            <Badge variant="outline">{eligiblePromptCount} eligible</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="flashcard-category">Category</Label>
              <select id="flashcard-category" value={category} onChange={(event) => setCategory(event.target.value)} className={cn(selectClassName(), "w-full")}>
                <option value="all">All categories</option>
                {categories.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="flashcard-region">Region</Label>
              <select id="flashcard-region" value={region} onChange={(event) => setRegion(event.target.value)} className={cn(selectClassName(), "w-full")}>
                <option value="all">All regions</option>
                {regions.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="flashcard-difficulty">Depth</Label>
              <select id="flashcard-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as AnatomyStudyDifficulty)} className={cn(selectClassName(), "w-full")}>
                {Object.entries(difficultyLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="flashcard-deck-size">Deck Size</Label>
              <select id="flashcard-deck-size" value={deckSize} onChange={(event) => setDeckSize(Number(event.target.value))} className={cn(selectClassName(), "w-full")}>
                {deckSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {promptTypeCounts.map((type) => {
              const selected = promptTypes.includes(type.id)
              const disabled = !selected && type.promptCount === 0

              return (
                <label key={type.id} className={cn(
                  "flex min-h-16 items-center justify-between gap-3 rounded-md border border-border/80 bg-card/60 px-3 py-3 text-sm transition",
                  selected && "border-primary/60 bg-primary/10",
                  disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-primary/50",
                )}>
                  <span className="flex min-w-0 items-center gap-3">
                    <Checkbox checked={selected} onCheckedChange={() => togglePromptType(type.id)} disabled={disabled} />
                    <span className="break-words">{type.label}</span>
                  </span>
                  <Badge variant="outline">{type.promptCount}</Badge>
                </label>
              )
            })}
          </div>

          {canPersistProgress ? (
            <label className="mt-4 flex items-start gap-3 rounded-md border border-border/80 bg-card/60 px-3 py-3 text-sm">
              <Checkbox checked={skipMasteredPrompts} onCheckedChange={(checked) => setSkipMasteredPrompts(checked === true)} />
              <span className="space-y-1">
                <span className="block font-medium">Skip mastered prompts</span>
                <span className="block text-muted-foreground">Hide prompts after {progressDashboard?.progress.masteryThreshold ?? 10} correct answers so new cards stay in rotation.</span>
              </span>
            </label>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="answer-mode">Answer Mode</Label>
              <select id="answer-mode" value={answerMode} onChange={(event) => setAnswerMode(event.target.value as FlashcardAnswerMode)} className={cn(selectClassName(), "w-full")}>
                {FLASHCARD_STATIC_ANSWER_MODES.map((mode) => <option key={mode} value={mode}>{answerModeLabels[mode]}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-title">Deck Title</Label>
              <Input id="deck-title" value={deckTitle} onChange={(event) => setDeckTitle(event.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => startDeck()} disabled={eligiblePromptCount === 0 || isStartingDeck} className="w-full md:w-auto">
                <Shuffle className="mr-2 h-4 w-4" aria-hidden="true" />
                {isStartingDeck ? "Starting..." : `Start ${Math.min(deckSize, eligiblePromptCount)}`}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input value={deckDescription} onChange={(event) => setDeckDescription(event.target.value)} placeholder="Deck note" />
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")} className={cn(selectClassName(), "w-full")}>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
            <Button type="button" variant="outline" onClick={saveDeck} className="w-full md:w-auto">
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              Save
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{eligiblePromptCount} eligible prompts</Badge>
            {isLoadingPromptCounts ? <Badge variant="outline">Updating counts</Badge> : null}
            {!canPersistProgress ? (
              <Button asChild variant="link" className="h-auto p-0 text-sm">
                <Link href="/login?callbackUrl=/education/flashcards" onClick={persistDraftAndPromptSignIn}>Sign in to save progress</Link>
              </Button>
            ) : null}
            {saveMessage ? <span>{saveMessage}</span> : null}
          </div>
        </div>
      </section>

      <aside className="space-y-4 rounded-md border border-border/80 bg-background/70 p-4 xl:sticky xl:top-4 xl:self-start">
        <h2 className="text-lg font-semibold">Study Setup</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-border/80 p-3">
            <Timer className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <div className="text-muted-foreground">Deck Size</div>
            <div className="font-medium">{Math.min(deckSize, eligiblePromptCount)}</div>
          </div>
          <div className="rounded-md border border-border/80 p-3">
            <Shuffle className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <div className="text-muted-foreground">Modes</div>
            <div className="font-medium">{promptTypes.length}</div>
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => {
          setPromptTypes([...FLASHCARD_STATIC_PROMPT_TYPES])
          setCategory("all")
          setRegion("all")
          setDifficulty("hard")
          setDeckSize(50)
        }}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Select All
        </Button>
        {canPersistProgress ? (
          <div className="space-y-3 rounded-md border border-border/80 bg-card/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-medium">Your Progress</h3>
              </div>
              {isLoadingProgressDashboard ? <Badge variant="outline">Updating</Badge> : null}
            </div>
            {progressDashboard ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Mastered</div>
                    <div className="font-semibold">{progressDashboard.progress.masteredPromptCount}</div>
                  </div>
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Active</div>
                    <div className="font-semibold">{progressDashboard.progress.activePromptCount}</div>
                  </div>
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Accuracy</div>
                    <div className="font-semibold">{progressDashboard.progress.accuracyPercent}%</div>
                  </div>
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Best Time</div>
                    <div className="font-semibold">{formatDuration(progressDashboard.progress.bestDurationMs)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{progressDashboard.progress.completedSessionCount} sessions</Badge>
                  <Badge variant="outline">{progressDashboard.progress.achievementCount} badges</Badge>
                  <Badge variant="outline">{progressDashboard.progress.totalCorrect} correct</Badge>
                </div>
                {progressDashboard.recentProgress.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium uppercase text-muted-foreground">Recent prompts</h4>
                    {progressDashboard.recentProgress.slice(0, 3).map((item) => (
                      <div key={item.promptId} className="rounded-md border border-border/80 px-2 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">{titleFromSlug(item.entitySlug)}</span>
                          {item.correctCount >= item.masteryThreshold ? (
                            <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                          <span className="truncate">{promptTypeLabelById.get(item.promptType as FlashcardPromptType) ?? item.promptType}</span>
                          <span>{item.correctCount}/{item.masteryThreshold}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Complete a signed-in session to start tracking mastered prompts.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Complete a signed-in session to start tracking mastered prompts.</p>
            )}
          </div>
        ) : null}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Sources</h3>
          {sources.slice(0, 8).map((source) => (
            source.url ? (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-card/70 px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground">
                <span className="min-w-0 truncate">{source.label}</span>
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            ) : <div key={source.id} className="rounded-md border border-border/80 bg-card/70 px-3 py-2 text-sm text-muted-foreground">{source.label}</div>
          ))}
        </div>
      </aside>
    </div>
  )
}
