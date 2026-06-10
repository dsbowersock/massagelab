"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Activity, ArrowLeft, ArrowRight, Bone, BookOpen, Boxes, Brain, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Dumbbell, ExternalLink, Eye, Image, Keyboard, Landmark, Layers3, Lock, MapPin, Play, RotateCcw, Save, Shuffle, Sparkles, Target, Timer, Trophy, XCircle } from "lucide-react"
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

type PromptSummary = {
  id: string
  type: FlashcardPromptType
  typeLabel: string
  name: string
  categoryLabel: string
  regionLabels: string[]
  difficulty: AnatomyStudyDifficulty
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
  targetPromptCount: number
  roundCompletionPercent: number
  completedRoundCount: number
  currentRound: number
  canStartNextRound: boolean
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
  lifetimeAttemptCount: number
  lifetimeCorrectCount: number
  lifetimeIncorrectCount: number
  masteryThreshold: number
  masteryRound: number
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

const draftStorageKey = "massagelab-flashcard-draft-config-v1"
const allCategoryIds = [...FLASHCARD_STATIC_CATEGORY_IDS] as NormalizedFlashcardDeckConfig["categories"]
const allRegionIds = [...FLASHCARD_STATIC_REGION_IDS] as NormalizedFlashcardDeckConfig["regions"]

const categoryIconById: Record<string, LucideIcon> = {
  bone: Bone,
  bone_landmark: Landmark,
  muscle: Dumbbell,
  anatomy_structure: Boxes,
  anatomy_concept: Brain,
}

const regionIconById: Record<string, LucideIcon> = {
  head: Brain,
  "upper-extremity": Dumbbell,
  spine: Activity,
  thorax: Boxes,
  abdomen: CircleHelp,
  pelvis: CircleHelp,
  "lower-extremity": MapPin,
}

const promptTypeIconById: Record<FlashcardPromptType, LucideIcon> = {
  identify_from_media: Image,
  name_to_summary: BookOpen,
  name_to_region: MapPin,
  name_to_category: Boxes,
  muscle_origin_insertion: Landmark,
  muscle_action: Activity,
  muscle_innervation: Brain,
}

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

function promptSummaryRows(value: unknown) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  if (!Array.isArray(record.promptSummaries)) return []

  return record.promptSummaries.map((item) => {
    const row = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {}

    return {
      id: text(row.id),
      type: text(row.type) as FlashcardPromptType,
      typeLabel: text(row.typeLabel),
      name: text(row.name),
      categoryLabel: text(row.categoryLabel),
      regionLabels: Array.isArray(row.regionLabels) ? row.regionLabels.map(String) : [],
      difficulty: text(row.difficulty) as AnatomyStudyDifficulty,
    }
  }).filter((prompt): prompt is PromptSummary => (
    Boolean(prompt.id && FLASHCARD_STATIC_PROMPT_TYPES.includes(prompt.type))
  ))
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
        lifetimeAttemptCount: numeric(row.lifetimeAttemptCount, numeric(row.attemptCount)),
        lifetimeCorrectCount: numeric(row.lifetimeCorrectCount, numeric(row.correctCount)),
        lifetimeIncorrectCount: numeric(row.lifetimeIncorrectCount, numeric(row.incorrectCount)),
        masteryThreshold: numeric(row.masteryThreshold, 10),
        masteryRound: numeric(row.masteryRound, 1),
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
      targetPromptCount: numeric(progress.targetPromptCount, numeric(progress.trackedPromptCount)),
      roundCompletionPercent: numeric(progress.roundCompletionPercent),
      completedRoundCount: numeric(progress.completedRoundCount),
      currentRound: numeric(progress.currentRound, 1),
      canStartNextRound: progress.canStartNextRound === true,
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

async function localPromptSummaries(config: NormalizedFlashcardDeckConfig) {
  const { getAnatomyStudyPrompts } = await import("@/lib/anatomy-study")

  return getAnatomyStudyPrompts(config, { mediaUrlBySlug: new Map() }).map((prompt) => ({
    id: prompt.id,
    type: prompt.type,
    typeLabel: prompt.typeLabel,
    name: prompt.name,
    categoryLabel: prompt.categoryLabel,
    regionLabels: prompt.regionLabels,
    difficulty: prompt.difficulty,
  }))
}

function configFromState(state: {
  categories: NormalizedFlashcardDeckConfig["categories"]
  regions: NormalizedFlashcardDeckConfig["regions"]
  difficulty: AnatomyStudyDifficulty
  promptTypes: FlashcardPromptType[]
  answerMode: FlashcardAnswerMode
  deckSize: number
  promptIds?: string[]
}): NormalizedFlashcardDeckConfig {
  return {
    categories: state.categories.length > 0 ? state.categories : [...allCategoryIds],
    regions: state.regions.length > 0 ? state.regions : [...allRegionIds],
    difficulty: state.difficulty,
    promptTypes: state.promptTypes,
    answerMode: state.answerMode,
    count: Math.max(1, Math.trunc(state.deckSize)),
    seed: `browser-${Date.now().toString(36)}`,
    ...(state.promptIds?.length ? { promptIds: state.promptIds } : {}),
  }
}

function promptFrontInstruction(prompt: FlashcardPrompt, isReviewMode: boolean) {
  const reviewInstructions: Record<FlashcardPromptType, string> = {
    identify_from_media: "Identify the anatomy item.",
    name_to_summary: "Recall the key facts for this anatomy item.",
    name_to_region: "Recall where this anatomy item is located.",
    name_to_category: "Recall what kind of anatomy item this is.",
    muscle_origin_insertion: "Recall the origin and insertion.",
    muscle_action: "Recall the action.",
    muscle_innervation: "Recall the innervation.",
  }
  const typedInstructions: Record<FlashcardPromptType, string> = {
    identify_from_media: "Enter the anatomy item name.",
    name_to_summary: "Enter the key facts for this anatomy item.",
    name_to_region: "Enter where this anatomy item is located.",
    name_to_category: "Enter what kind of anatomy item this is.",
    muscle_origin_insertion: "Enter the origin and insertion.",
    muscle_action: "Enter the muscle action.",
    muscle_innervation: "Enter the innervation.",
  }

  return isReviewMode ? reviewInstructions[prompt.type] : typedInstructions[prompt.type]
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
    <div className="mx-0 grid h-full grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--background)))] px-3 py-2 sm:mx-2 sm:px-4 sm:py-3">
      <div className="grid shrink-0 gap-y-1">
        <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase text-muted-foreground">
          <span>Front</span>
          <span className="max-w-[62%] truncate rounded-full border border-border/80 bg-background/70 px-2 py-1 normal-case text-foreground">{prompt.typeLabel}</span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">{promptFrontInstruction(prompt, isReviewMode)}</p>
      </div>

      <div className="mt-1 flex min-h-0 items-center justify-center sm:mt-2">
        {prompt.front.mode === "media" && prompt.front.media ? (
          <figure className="flex h-full w-full flex-col overflow-hidden rounded-none border border-border/80 bg-background/80 shadow-inner">
            <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- reviewed source media can come from multiple external hosts not configured for next/image. */}
              <img src={prompt.front.media.url} alt="Reviewed anatomy study image" className="max-h-full max-w-full object-contain drop-shadow-sm" loading="lazy" referrerPolicy="no-referrer" />
            </div>
            <figcaption className="border-t border-border/80 px-3 py-1.5 text-xs text-muted-foreground">Reviewed BodyParts3D anatomy image</figcaption>
          </figure>
        ) : (
          <div className="grid max-h-full min-h-0 w-full place-items-center overflow-hidden rounded-none border border-border/80 bg-background/65 px-2 py-2 shadow-inner sm:px-3 sm:py-3 md:px-8 md:py-8">
            <h2 className="max-w-3xl break-words text-center text-lg font-semibold leading-tight tracking-normal min-[360px]:text-xl md:text-4xl">{prompt.front.title}</h2>
          </div>
        )}
      </div>

      <div className="mt-1 flex shrink-0 items-center justify-between gap-3 border-t border-border/70 pt-1 text-[11px] leading-tight text-muted-foreground sm:mt-3 sm:text-xs">
        <span>{isReviewMode ? "Tap the card or use Reveal Answer." : "Typed Check counts toward saved progress."}</span>
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
    </div>
  )
}

function PromptBack({ prompt, result }: { prompt: FlashcardPrompt; result: PromptResult | null }) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-[radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.10),transparent_38%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--card)))] p-4 sm:p-5">
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
          <div key={field.id} className="rounded-none border border-border/80 bg-background/75 p-4 shadow-inner">
            <div className="text-xs font-medium uppercase text-muted-foreground">{field.label}</div>
            <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-foreground">{field.answer}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2 border-t border-border/70 pt-3">
        <PromptBadges prompt={prompt} />
        <PromptSourceLinks prompt={prompt} />
      </div>
    </div>
  )
}

function SelectionButton({
  selected,
  icon: Icon,
  label,
  detail,
  onClick,
  disabled = false,
  className,
}: {
  selected: boolean
  icon: LucideIcon
  label: string
  detail?: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-md border border-border/80 bg-card/60 px-3 py-2 text-left text-sm transition",
        selected && "border-primary/70 bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
        disabled ? "cursor-not-allowed opacity-55" : "hover:border-primary/60",
        className,
      )}
    >
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/70 text-muted-foreground",
        selected && "border-primary/50 text-primary",
      )}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block break-words font-medium">{label}</span>
        {detail ? <span className="block break-words text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </button>
  )
}

function toggleRequiredSelection<T extends string>(current: T[], value: T) {
  if (current.includes(value)) {
    return current.length > 1 ? current.filter((item) => item !== value) : current
  }

  return [...current, value]
}

function FlashcardSurface({
  prompt,
  isFlipped,
  isReviewMode,
  onFlip,
  result,
}: {
  prompt: FlashcardPrompt
  isFlipped: boolean
  isReviewMode: boolean
  onFlip: () => void
  result: PromptResult | null
}) {
  const canFlipCard = isReviewMode
  const shouldRenderBack = isFlipped || Boolean(result)

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="relative h-[clamp(11.5rem,calc(100dvh-17.5rem),30rem)] min-h-[11.5rem] [perspective:1800px] sm:h-[clamp(13rem,calc(100dvh-18rem),30rem)] sm:min-h-[13rem]">
        <div
          role={canFlipCard ? "button" : undefined}
          tabIndex={canFlipCard ? 0 : undefined}
          aria-label={canFlipCard ? (isFlipped ? "Flip flashcard to prompt" : "Flip flashcard to answer") : undefined}
          onClick={canFlipCard ? (event) => {
            const target = event.target instanceof HTMLElement ? event.target : null
            if (target?.closest("a,button,input,select,textarea")) return
            onFlip()
          } : undefined}
          onKeyDown={(event) => {
            if (!canFlipCard) return
            const target = event.target instanceof HTMLElement ? event.target : null
            if (target?.closest("a,button,input,select,textarea")) return
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onFlip()
            }
          }}
          className={cn(
            "absolute inset-0 rounded-none transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            isFlipped && "[transform:rotateY(180deg)]",
            canFlipCard && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <article className="absolute inset-0 overflow-hidden border-0 p-1 shadow-[0_28px_90px_rgba(0,0,0,0.34),0_2px_0_hsl(var(--border))] ring-1 ring-white/5 [backface-visibility:hidden] sm:p-2">
            <PromptFront prompt={prompt} isReviewMode={isReviewMode} />
          </article>
          <article
            aria-hidden={!isFlipped}
            inert={!isFlipped ? true : undefined}
            tabIndex={isFlipped ? undefined : -1}
            className="absolute inset-0 overflow-hidden border-0 p-1 shadow-[0_28px_90px_rgba(0,0,0,0.34),0_2px_0_hsl(var(--primary)/0.35)] ring-1 ring-primary/15 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-2"
          >
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
  const runnerTopRef = useRef<HTMLDivElement | null>(null)
  const communityCarouselInteractedRef = useRef(false)
  const communitySwipeStartXRef = useRef<number | null>(null)
  const communitySwipeDeltaXRef = useRef(0)
  const communitySlideTimeoutRef = useRef<number | null>(null)
  const communityAutoAdvanceIntervalRef = useRef<number | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<NormalizedFlashcardDeckConfig["categories"]>([...allCategoryIds])
  const [selectedRegions, setSelectedRegions] = useState<NormalizedFlashcardDeckConfig["regions"]>([...allRegionIds])
  const [difficulty, setDifficulty] = useState<AnatomyStudyDifficulty>("medium")
  const [promptTypes, setPromptTypes] = useState<FlashcardPromptType[]>(["identify_from_media", "name_to_region", "name_to_category"])
  const [answerMode, setAnswerMode] = useState<FlashcardAnswerMode>("typed")
  const [deckSize, setDeckSize] = useState(20)
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([])
  const [expandedPromptType, setExpandedPromptType] = useState<FlashcardPromptType | null>(null)
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
  const [promptSummaries, setPromptSummaries] = useState<PromptSummary[]>([])
  const [isLoadingPromptCounts, setIsLoadingPromptCounts] = useState(false)
  const [canPersistProgress, setCanPersistProgress] = useState(isSignedIn)
  const [skipMasteredPrompts, setSkipMasteredPrompts] = useState(false)
  const [progressDashboard, setProgressDashboard] = useState<FlashcardProgressPayload | null>(null)
  const [isLoadingProgressDashboard, setIsLoadingProgressDashboard] = useState(false)
  const [isStartingNextRound, setIsStartingNextRound] = useState(false)
  const [communityDeckIndex, setCommunityDeckIndex] = useState(0)
  const [communitySlide, setCommunitySlide] = useState<{ direction: 1 | -1 } | null>(null)
  const [activeDeckActivation, setActiveDeckActivation] = useState(0)
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
      if (parsed.categories?.length) setSelectedCategories(parsed.categories)
      if (parsed.regions?.length) setSelectedRegions(parsed.regions)
      if (parsed.difficulty) setDifficulty(parsed.difficulty)
      if (parsed.promptTypes?.length) setPromptTypes(parsed.promptTypes)
      if (parsed.answerMode) setAnswerMode(parsed.answerMode)
      if (parsed.count) setDeckSize(parsed.count)
      if (parsed.promptIds?.length) setSelectedPromptIds(parsed.promptIds)
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
    categories: selectedCategories,
    regions: selectedRegions,
    difficulty,
    promptTypes: [...FLASHCARD_STATIC_PROMPT_TYPES],
    answerMode: "typed",
    deckSize: 20,
  }), [difficulty, selectedCategories, selectedRegions])
  const availablePromptIdSet = useMemo(() => new Set(promptSummaries.map((prompt) => prompt.id)), [promptSummaries])
  const promptTypeByPromptId = useMemo(() => new Map(promptSummaries.map((prompt) => [prompt.id, prompt.type])), [promptSummaries])
  const selectedUsablePromptIds = useMemo(() => (
    selectedPromptIds.filter((promptId) => {
      const promptType = promptTypeByPromptId.get(promptId)
      return Boolean(promptType && promptTypes.includes(promptType))
    })
  ), [promptTypeByPromptId, promptTypes, selectedPromptIds])
  const setupConfig = useMemo(() => configFromState({
    categories: selectedCategories,
    regions: selectedRegions,
    difficulty,
    promptTypes,
    answerMode,
    deckSize,
    promptIds: selectedUsablePromptIds,
  }), [answerMode, deckSize, difficulty, promptTypes, selectedCategories, selectedRegions, selectedUsablePromptIds])
  const eligiblePromptCount = useMemo(() => (
    selectedUsablePromptIds.length > 0
      ? selectedUsablePromptIds.length
      : promptTypeCounts
      .filter((type) => promptTypes.includes(type.id))
      .reduce((sum, type) => sum + type.promptCount, 0)
  ), [promptTypeCounts, promptTypes, selectedUsablePromptIds])

  useEffect(() => {
    let cancelled = false
    setIsLoadingPromptCounts(true)

    async function updatePromptCounts() {
      try {
        const response = await fetch("/api/education/flashcards/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: countConfig, includePromptSummaries: true }),
        })
        const payload = response.ok ? await response.json() : null

        if (!cancelled && Array.isArray(payload?.promptTypeCounts)) {
          setPromptTypeCounts(payload.promptTypeCounts)
          setPromptSummaries(promptSummaryRows(payload))
          return
        }
      } catch {
        // Fall back to the browser-side sourced adapter below.
      }

      try {
        const counts = await localPromptTypeCounts(countConfig)
        const summaries = await localPromptSummaries(countConfig)
        if (!cancelled) {
          setPromptTypeCounts(counts)
          setPromptSummaries(summaries)
        }
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

  useEffect(() => {
    if (selectedPromptIds.length === 0 || availablePromptIdSet.size === 0) return
    setSelectedPromptIds((current) => {
      const next = current.filter((promptId) => availablePromptIdSet.has(promptId))
      return next.length === current.length ? current : next
    })
  }, [availablePromptIdSet, selectedPromptIds])

  const currentPrompt = activeDeck[currentIndex]
  const currentResult = currentPrompt ? results.find((result) => result.promptId === currentPrompt.id) ?? checkedResult : null
  const answeredCount = results.length + (checkedResult && !results.some((result) => result.promptId === checkedResult.promptId) ? 1 : 0)
  const correctCount = results.filter((result) => result.correct).length + (checkedResult && !results.some((result) => result.promptId === checkedResult.promptId) && checkedResult.correct ? 1 : 0)
  const progress = activeDeck.length > 0 ? ((currentIndex + 1) / activeDeck.length) * 100 : 0
  const promptTypeLabelById = useMemo(() => new Map(promptTypeCounts.map((type) => [type.id, type.label])), [promptTypeCounts])
  const allCategoriesSelected = selectedCategories.length === allCategoryIds.length
  const allRegionsSelected = selectedRegions.length === allRegionIds.length
  const selectedPromptIdSet = useMemo(() => new Set(selectedUsablePromptIds), [selectedUsablePromptIds])
  const exactPromptSelectionActive = selectedPromptIds.length > 0
  const displayedDeckSize = eligiblePromptCount > 0 ? Math.min(Math.max(1, deckSize), eligiblePromptCount) : 0
  const progressRoundTarget = progressDashboard ? Math.max(progressDashboard.progress.targetPromptCount, progressDashboard.progress.trackedPromptCount) : 0
  const progressRoundPercent = progressDashboard ? Math.max(0, Math.min(100, progressDashboard.progress.roundCompletionPercent)) : 0
  const sortedCommunityDecks = communityDecks
  const visibleCommunityDecks = useMemo(() => {
    if (sortedCommunityDecks.length <= 2) return sortedCommunityDecks

    const deckAt = (offset: number) => sortedCommunityDecks[
      (communityDeckIndex + offset + sortedCommunityDecks.length) % sortedCommunityDecks.length
    ]

    if (communitySlide?.direction === -1) return [-1, 0, 1].map(deckAt)
    if (communitySlide?.direction === 1) return [0, 1, 2].map(deckAt)
    return [0, 1].map(deckAt)
  }, [communityDeckIndex, communitySlide, sortedCommunityDecks])
  const carouselPositionLabel = sortedCommunityDecks.length > 0
    ? `Community deck carousel position ${Math.min(communityDeckIndex + 1, sortedCommunityDecks.length)}/${sortedCommunityDecks.length}`
    : "Community deck carousel position 0/0"

  useEffect(() => {
    if (communitySlideTimeoutRef.current !== null) {
      window.clearTimeout(communitySlideTimeoutRef.current)
      communitySlideTimeoutRef.current = null
    }
    setCommunitySlide(null)
    setCommunityDeckIndex(0)
  }, [sortedCommunityDecks.length])

  useEffect(() => {
    return () => {
      if (communitySlideTimeoutRef.current !== null) {
        window.clearTimeout(communitySlideTimeoutRef.current)
      }
      if (communityAutoAdvanceIntervalRef.current !== null) {
        window.clearInterval(communityAutoAdvanceIntervalRef.current)
      }
    }
  }, [])

  const togglePromptType = (type: FlashcardPromptType) => {
    setPromptTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((item) => item !== type)
      }

      return [...current, type]
    })
  }

  const toggleCategory = (id: NormalizedFlashcardDeckConfig["categories"][number]) => {
    setSelectedPromptIds([])
    setSelectedCategories((current) => toggleRequiredSelection(current, id))
  }

  const toggleRegion = (id: NormalizedFlashcardDeckConfig["regions"][number]) => {
    setSelectedPromptIds([])
    setSelectedRegions((current) => toggleRequiredSelection(current, id))
  }

  const activateExactPromptSelection = () => {
    const ids = promptSummaries
      .filter((prompt) => promptTypes.includes(prompt.type))
      .map((prompt) => prompt.id)

    setSelectedPromptIds(ids)
  }

  const togglePromptId = (promptId: string) => {
    setSelectedPromptIds((current) => {
      const base = current.length > 0
        ? current
        : promptSummaries.filter((prompt) => promptTypes.includes(prompt.type)).map((prompt) => prompt.id)

      if (base.includes(promptId)) {
        return base.length > 1 ? base.filter((id) => id !== promptId) : base
      }

      return [...base, promptId]
    })
  }

  const showSetupSection = (section: "community" | "custom") => {
    const target = section === "community" ? communityDecksRef.current : customDeckBuilderRef.current
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const moveCommunityCarousel = useCallback((direction: 1 | -1, userInitiated = true) => {
    if (userInitiated) {
      communityCarouselInteractedRef.current = true
      if (communityAutoAdvanceIntervalRef.current !== null) {
        window.clearInterval(communityAutoAdvanceIntervalRef.current)
        communityAutoAdvanceIntervalRef.current = null
      }
    }
    if (sortedCommunityDecks.length <= 2 || communitySlide) return

    const nextIndex = (communityDeckIndex + direction + sortedCommunityDecks.length) % sortedCommunityDecks.length
    const commitSlide = () => {
      setCommunityDeckIndex(nextIndex)
      setCommunitySlide(null)
      communitySlideTimeoutRef.current = null
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commitSlide()
      return
    }

    setCommunitySlide({ direction })
    if (communitySlideTimeoutRef.current !== null) window.clearTimeout(communitySlideTimeoutRef.current)
    communitySlideTimeoutRef.current = window.setTimeout(commitSlide, 360)
  }, [communityDeckIndex, communitySlide, sortedCommunityDecks.length])

  useEffect(() => {
    if (communityCarouselInteractedRef.current || sortedCommunityDecks.length <= 2) return

    const intervalId = window.setInterval(() => moveCommunityCarousel(1, false), 7000)
    communityAutoAdvanceIntervalRef.current = intervalId

    return () => {
      window.clearInterval(intervalId)
      if (communityAutoAdvanceIntervalRef.current === intervalId) communityAutoAdvanceIntervalRef.current = null
    }
  }, [moveCommunityCarousel, sortedCommunityDecks.length])

  const startCommunitySwipe = (clientX: number) => {
    communitySwipeStartXRef.current = clientX
    communitySwipeDeltaXRef.current = 0
  }

  const updateCommunitySwipe = (clientX: number) => {
    if (communitySwipeStartXRef.current === null) return
    communitySwipeDeltaXRef.current = clientX - communitySwipeStartXRef.current
  }

  const finishCommunitySwipe = () => {
    const deltaX = communitySwipeDeltaXRef.current
    communitySwipeStartXRef.current = null
    communitySwipeDeltaXRef.current = 0

    if (Math.abs(deltaX) < 44) return
    moveCommunityCarousel(deltaX < 0 ? 1 : -1)
  }

  const applyDeckConfig = (deck: FlashcardDeckSummary) => {
    setDeckTitle(deck.title)
    setDeckDescription(deck.description)
    setVisibility(deck.visibility)
    setSelectedCategories(deck.config.categories.length > 0 ? deck.config.categories : [...allCategoryIds])
    setSelectedRegions(deck.config.regions.length > 0 ? deck.config.regions : [...allRegionIds])
    setDifficulty(deck.config.difficulty)
    setPromptTypes(deck.config.promptTypes)
    setAnswerMode(deck.config.answerMode)
    setDeckSize(deck.config.count)
    setSelectedPromptIds(deck.config.promptIds ?? [])
  }

  const viewDeckSetup = (deck: FlashcardDeckSummary, message = "Deck options loaded. Adjust or start when ready.") => {
    applyDeckConfig(deck)
    setActiveDeck([])
    setActiveConfig(null)
    setActiveDeckKind(deck.isStarter ? "starter" : "community")
    setSessionId("")
    setCurrentIndex(0)
    setAnswers({})
    setIsCardFlipped(false)
    setCheckedResult(null)
    setResults([])
    setSaveMessage(message)
    studyStartedAtRef.current = null
    window.requestAnimationFrame(() => {
      customDeckBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
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
        setActiveDeckActivation((activation) => activation + 1)
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

      if (canPersistProgress && config.answerMode === "typed") {
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

      await startTemporaryDeck(canPersistProgress && config.answerMode === "review"
        ? "Reveal review is practice only. Use Typed Check to save progress and earn badges."
        : "")
    } finally {
      setIsStartingDeck(false)
    }
  }

  const startFromDeck = (deck: FlashcardDeckSummary) => {
    applyDeckConfig(deck)
    void startDeck(deck.config, deck.isStarter ? "" : deck.slug, deck.isStarter ? "starter" : "community")
  }

  useEffect(() => {
    if (initialDeck) viewDeckSetup(initialDeck, "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeck?.slug])

  useEffect(() => {
    if (activeDeckActivation === 0) return

    const animationId = window.requestAnimationFrame(() => {
      runnerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      const scrollParent = runnerTopRef.current?.closest(".ml-app-scroll")
      if (scrollParent instanceof HTMLElement) {
        scrollParent.scrollTo({ top: 0, behavior: "smooth" })
      }
      window.scrollTo({ top: 0, behavior: "smooth" })
    })

    return () => window.cancelAnimationFrame(animationId)
  }, [activeDeckActivation])

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
    if (activeConfig?.answerMode === "review") {
      setSaveMessage("Practice completed. Use Typed Check to save progress and earn badges.")
      return
    }

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

  const startNextMasteryRound = async () => {
    if (!canPersistProgress || !progressDashboard?.progress.canStartNextRound || isStartingNextRound) return

    setIsStartingNextRound(true)
    setSaveMessage("")

    try {
      const response = await fetch("/api/education/flashcards/progress/round", { method: "POST" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setSaveMessage(typeof payload?.error === "string" ? payload.error : "Next mastery round could not be started.")
        return
      }

      const completedRound = numeric(payload?.round?.round)
      const nextRound = numeric(payload?.round?.nextRound)
      setSkipMasteredPrompts(false)
      setSaveMessage(completedRound && nextRound
        ? `Round ${completedRound} complete. Round ${nextRound} is ready.`
        : "Next mastery round is ready.")
      void refreshProgressDashboard()
    } catch (error) {
      console.error("Failed to start next flashcard mastery round", error)
      setSaveMessage("Next mastery round could not be started.")
    } finally {
      setIsStartingNextRound(false)
    }
  }

  if (activeDeck.length > 0 && currentPrompt && activeConfig) {
    const isReviewMode = activeConfig.answerMode === "review"
    const isCurrentCardFlipped = isReviewMode ? isCardFlipped : Boolean(currentResult) || isCardFlipped
    const runnerStatusLabel = isReviewMode
      ? "Practice only"
      : canPersistProgress && sessionId
        ? "Progress tracked"
        : "Temporary study"
    const showReviewMarkingActions = isReviewMode && isCurrentCardFlipped && !currentResult

    return (
      <div ref={runnerTopRef} className="-m-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-none border border-border/80 bg-background/70 px-2 py-1 sm:flex sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={resetStudy} className="h-8 shrink-0 rounded-lg px-2 text-xs leading-none [&_svg]:size-3.5">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Setup
          </Button>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-[11px] leading-tight text-muted-foreground sm:gap-x-2 sm:text-xs" aria-live="polite">
            <span className="font-medium text-foreground">Card {currentIndex + 1} of {activeDeck.length}</span>
            <span aria-hidden="true">/</span>
            <span>{answeredCount > 0 ? `${correctCount}/${answeredCount} correct` : "0 correct"}</span>
            <span aria-hidden="true">/</span>
            <span>{runnerStatusLabel}</span>
            <span aria-hidden="true">/</span>
            <span>{activeDeckKindLabels[activeDeckKind]}</span>
            {!canPersistProgress ? (
              <Button asChild variant="link" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
                <Link href="/login?callbackUrl=/education/flashcards">
                  <Lock className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Sign in to save
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Progress value={progress} className="h-1.5 bg-neutral-800 [&>div]:bg-primary" />

        <section className="space-y-2">
          <FlashcardSurface
            prompt={currentPrompt}
            isFlipped={isCurrentCardFlipped}
            isReviewMode={isReviewMode}
            onFlip={() => setIsCardFlipped((flipped) => !flipped)}
            result={currentResult}
          />

          {!isReviewMode ? (
            <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-2 rounded-lg border-0 bg-background/70 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center">
              <Button type="button" variant="outline" onClick={previousPrompt} disabled={currentIndex === 0} className="order-2 w-full sm:order-none sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <div className={cn("order-1 col-span-2 grid min-w-0 gap-2 sm:order-none sm:col-span-1", currentPrompt.answerFields.length > 1 && "sm:grid-cols-2")}>
                {currentPrompt.answerFields.map((field) => (
                  <div key={field.id} className="min-w-0">
                    <Label htmlFor={`answer-${field.id}`} className="sr-only">{field.label}</Label>
                    <Input
                      id={`answer-${field.id}`}
                      value={answers[field.id] ?? ""}
                      onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
                      disabled={Boolean(currentResult)}
                      autoComplete="off"
                      placeholder={field.label}
                    />
                  </div>
                ))}
              </div>
              <Button type="button" onClick={() => checkCurrentAnswer()} disabled={Boolean(currentResult)} className="order-4 col-span-2 w-full sm:order-none sm:col-span-1 sm:w-auto">
                {currentResult ? "Checked" : "Check Answer"}
              </Button>
              {currentIndex >= activeDeck.length - 1 ? (
                <Button type="button" variant="outline" onClick={completeStudy} className="order-3 w-full sm:order-none sm:w-auto">
                  Save Results
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={nextPrompt} className="order-3 w-full sm:order-none sm:w-auto">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          ) : (
            <div className={cn(
              "mx-auto grid w-full max-w-4xl items-center gap-2 rounded-lg border-0 bg-background/75 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
              showReviewMarkingActions
                ? "grid-cols-2 min-[560px]:grid-cols-[auto_minmax(0,1fr)_auto]"
                : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
            )}>
              <Button
                type="button"
                variant="outline"
                onClick={previousPrompt}
                disabled={currentIndex === 0}
                aria-label="Previous card"
                className={cn(
                  "w-full min-w-0 px-2 text-xs min-[360px]:px-3 min-[360px]:text-sm min-[560px]:w-auto",
                  showReviewMarkingActions && "order-1 min-[560px]:order-none",
                )}
              >
                <ArrowLeft className="h-4 w-4 min-[360px]:mr-2" aria-hidden="true" />
                <span className="hidden min-[360px]:inline">Previous</span>
              </Button>
              <div className={cn(
                "min-w-0 gap-2",
                showReviewMarkingActions
                  ? "order-3 col-span-2 grid grid-cols-3 min-[560px]:order-none min-[560px]:col-span-1 min-[560px]:flex min-[560px]:flex-wrap min-[560px]:justify-center"
                  : "flex flex-wrap justify-center",
              )}>
                <Button type="button" onClick={() => setIsCardFlipped((flipped) => !flipped)} className="min-w-0 whitespace-normal px-2 text-xs min-[360px]:text-sm sm:px-4">
                  {isCurrentCardFlipped ? "Show Prompt" : "Reveal Answer"}
                </Button>
                {isCurrentCardFlipped && !currentResult ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => checkCurrentAnswer(false)} className="min-w-0 px-2 text-xs min-[360px]:text-sm">Missed</Button>
                    <Button type="button" onClick={() => checkCurrentAnswer(true)} className="min-w-0 px-2 text-xs min-[360px]:text-sm">Correct</Button>
                  </>
                ) : null}
                {currentResult ? (
                  <Badge variant="outline">{currentResult.correct ? "Marked correct" : "Marked missed"}</Badge>
                ) : null}
              </div>
              {currentIndex >= activeDeck.length - 1 ? (
                <Button type="button" variant="outline" onClick={completeStudy} aria-label="Finish practice" className={cn(
                  "w-full min-w-0 px-2 text-xs min-[420px]:px-3 min-[420px]:text-sm min-[560px]:w-auto",
                  showReviewMarkingActions && "order-2 min-[560px]:order-none",
                )}>
                  <CheckCircle2 className="h-4 w-4 min-[420px]:mr-2" aria-hidden="true" />
                  <span className="hidden min-[420px]:inline">Finish Practice</span>
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={nextPrompt} aria-label="Next card" className={cn(
                  "w-full min-w-0 px-2 text-xs min-[360px]:px-3 min-[360px]:text-sm min-[560px]:w-auto",
                  showReviewMarkingActions && "order-2 min-[560px]:order-none",
                )}>
                  <span className="hidden min-[360px]:inline">Next</span>
                  <ArrowRight className="h-4 w-4 min-[360px]:ml-2" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
          {saveMessage ? (
            <div className="mx-auto flex w-full max-w-4xl justify-end text-xs text-muted-foreground">
              <p className="text-sm text-muted-foreground">{saveMessage}</p>
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Layers3 className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Flashcards</h1>
            <Badge variant="outline" className="border-primary/50 text-primary">Public alpha</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Sourced anatomy prompts for self-study.</p>
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-md border border-primary/40 bg-primary/10 p-4">
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
              <Button type="button" className="mt-4 h-auto min-h-10 w-full min-w-0 whitespace-normal text-center sm:w-auto" onClick={() => showSetupSection("community")}>
                <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                Browse Premade Decks
              </Button>
            ) : null}
          </div>

          <div className="min-w-0 overflow-hidden rounded-md border border-border/80 bg-background/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-border/80 bg-card/70 p-2 text-primary">
                <Layers3 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="text-lg font-semibold">Create Your Own</h2>
                <p className="text-sm text-muted-foreground">Choose the anatomy, prompt types, and review style before seeing cards.</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-4 h-auto min-h-10 w-full min-w-0 whitespace-normal text-center sm:w-auto" onClick={() => showSetupSection("custom")}>
              <Layers3 className="mr-2 h-4 w-4" aria-hidden="true" />
              Configure Custom Deck
            </Button>
          </div>
        </div>

        <div ref={communityDecksRef} className="min-w-0 scroll-mt-6 rounded-md border border-border/80 bg-background/70 p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/education/flashcards/decks" className="flex items-center gap-2 transition hover:text-primary">
              <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Community Decks</h2>
            </Link>
            <Badge variant="outline" className="w-fit">{communityDecks.length} available</Badge>
          </div>
          {sortedCommunityDecks.length > 0 ? (
            <div
              className="group/community-carousel relative"
              onTouchStart={(event) => startCommunitySwipe(event.touches[0]?.clientX ?? 0)}
              onTouchMove={(event) => updateCommunitySwipe(event.touches[0]?.clientX ?? 0)}
              onTouchEnd={finishCommunitySwipe}
              onTouchCancel={finishCommunitySwipe}
            >
              <div
                className="ml-flashcard-carousel min-h-[14rem] overflow-hidden sm:min-h-[13rem]"
              >
                <div
                  data-slide={communitySlide?.direction === 1 ? "next" : communitySlide?.direction === -1 ? "previous" : undefined}
                  className="ml-flashcard-carousel-track -mx-1.5 flex min-h-[14rem] sm:min-h-[13rem]"
                >
                {visibleCommunityDecks.map((deck) => (
                  <div key={deck.slug} className="flex min-w-full px-1.5 md:min-w-[50%]">
                    <article className="flex min-h-[13.5rem] w-full flex-col rounded-md border border-border/80 bg-card/60 p-4 transition hover:border-primary/60 sm:min-h-[12.5rem]">
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
                      <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-2">
                        <Button type="button" size="sm" onClick={() => startFromDeck(deck)} disabled={isStartingDeck} className="min-w-0 whitespace-normal">
                          <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                          {isStartingDeck ? "Starting..." : "Study"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => viewDeckSetup(deck)} className="min-w-0 whitespace-normal">
                          View
                        </Button>
                      </div>
                    </article>
                  </div>
                ))}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => moveCommunityCarousel(-1)}
                disabled={sortedCommunityDecks.length <= 2 || Boolean(communitySlide)}
                aria-label="Previous community decks"
                className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 opacity-100 shadow-lg transition hover:bg-background md:-left-5 md:opacity-0 md:group-hover/community-carousel:opacity-100 md:group-focus-within/community-carousel:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => moveCommunityCarousel(1)}
                disabled={sortedCommunityDecks.length <= 2 || Boolean(communitySlide)}
                aria-label="Next community decks"
                className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 opacity-100 shadow-lg transition hover:bg-background md:-right-5 md:opacity-0 md:group-hover/community-carousel:opacity-100 md:group-focus-within/community-carousel:opacity-100"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Button>
              <span className="sr-only">{carouselPositionLabel}</span>
            </div>
          ) : (
            <div className="rounded-md border border-border/80 bg-card/60 p-4 text-sm text-muted-foreground">
              No public decks are available yet.
            </div>
          )}
        </div>

        <div ref={customDeckBuilderRef} className="scroll-mt-6 rounded-md border border-border/80 bg-background/70 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Build A Deck</h2>
            </div>
            <Badge variant="outline">{eligiblePromptCount} eligible</Badge>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">Category</h3>
                <Badge variant="outline">{selectedCategories.length}/{categories.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectionButton
                  selected={allCategoriesSelected}
                  icon={Layers3}
                  label="All categories"
                  detail={`${categories.length} groups`}
                  onClick={() => {
                    setSelectedCategories([...allCategoryIds])
                    setSelectedPromptIds([])
                  }}
                />
                {categories.map((option) => {
                  const Icon = categoryIconById[option.id] ?? CircleHelp
                  return (
                    <SelectionButton
                      key={option.id}
                      selected={selectedCategories.includes(option.id as NormalizedFlashcardDeckConfig["categories"][number])}
                      icon={Icon}
                      label={option.label}
                      detail={typeof option.termCount === "number" ? `${option.termCount} items` : undefined}
                      onClick={() => toggleCategory(option.id as NormalizedFlashcardDeckConfig["categories"][number])}
                    />
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">Region</h3>
                <Badge variant="outline">{selectedRegions.length}/{regions.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectionButton
                  selected={allRegionsSelected}
                  icon={MapPin}
                  label="All regions"
                  detail={`${regions.length} regions`}
                  onClick={() => {
                    setSelectedRegions([...allRegionIds])
                    setSelectedPromptIds([])
                  }}
                />
                {regions.map((option) => {
                  const Icon = regionIconById[option.id] ?? CircleHelp
                  return (
                    <SelectionButton
                      key={option.id}
                      selected={selectedRegions.includes(option.id as NormalizedFlashcardDeckConfig["regions"][number])}
                      icon={Icon}
                      label={option.label}
                      detail={typeof option.termCount === "number" ? `${option.termCount} items` : undefined}
                      onClick={() => toggleRegion(option.id as NormalizedFlashcardDeckConfig["regions"][number])}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Depth</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.entries(difficultyLabels).map(([id, label]) => (
                  <SelectionButton
                    key={id}
                    selected={difficulty === id}
                    icon={id === "easy" ? Target : id === "medium" ? Layers3 : Trophy}
                    label={label}
                    onClick={() => {
                      setDifficulty(id as AnatomyStudyDifficulty)
                      setSelectedPromptIds([])
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="flashcard-deck-size">Deck Size</Label>
              <div className="flex gap-2">
                <Input
                  id="flashcard-deck-size"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={deckSize}
                  onChange={(event) => {
                    const nextCount = Number(event.target.value)
                    setDeckSize(Number.isFinite(nextCount) ? Math.max(1, Math.trunc(nextCount)) : 1)
                  }}
                />
                <Button type="button" variant="outline" onClick={() => setDeckSize(Math.max(1, eligiblePromptCount))} disabled={eligiblePromptCount === 0}>
                  All
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{displayedDeckSize} will be used from {eligiblePromptCount} eligible prompts.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {promptTypeCounts.map((type) => {
              const selected = promptTypes.includes(type.id)
              const disabled = !selected && type.promptCount === 0
              const Icon = promptTypeIconById[type.id] ?? CircleHelp
              const selectedInType = selectedUsablePromptIds.filter((promptId) => promptTypeByPromptId.get(promptId) === type.id).length
              const isExpanded = expandedPromptType === type.id
              const expandedPromptSummaries = isExpanded
                ? promptSummaries.filter((prompt) => prompt.type === type.id)
                : []
              const selectedExpandedPromptCount = expandedPromptSummaries.filter((prompt) => selectedPromptIdSet.has(prompt.id)).length

              return (
                <div key={type.id} className={cn(
                  "rounded-md border border-border/80 bg-card/60 p-3 transition",
                  selected && "border-primary/60 bg-primary/10",
                  disabled && "opacity-55",
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => togglePromptType(type.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                    >
                      <span className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/70 text-muted-foreground",
                        selected && "border-primary/50 text-primary",
                      )}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium">{type.label}</span>
                        {exactPromptSelectionActive && selected ? <span className="block text-xs text-muted-foreground">{selectedInType} selected</span> : null}
                      </span>
                    </button>
                    <Badge variant="outline">{type.promptCount}</Badge>
                  </div>
                  {type.promptCount > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedPromptType(isExpanded ? null : type.id)}
                    >
                      {isExpanded ? "Close items" : "Choose items"}
                    </Button>
                  ) : null}

                  {isExpanded ? (
                    <div className="mt-3 rounded-md border border-border/80 bg-background/70 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-medium">{type.label}</h3>
                          <p className="text-xs text-muted-foreground">
                            {exactPromptSelectionActive
                              ? `${selectedExpandedPromptCount}/${expandedPromptSummaries.length} selected in this group`
                              : "All matching items are included"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={activateExactPromptSelection} disabled={promptSummaries.length === 0}>
                            Select exact items
                          </Button>
                          {exactPromptSelectionActive ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPromptIds([])}>
                              Use all eligible
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
                        {expandedPromptSummaries.map((prompt) => {
                          const promptSelected = !exactPromptSelectionActive || selectedPromptIdSet.has(prompt.id)
                          return (
                            <button
                              key={prompt.id}
                              type="button"
                              aria-pressed={promptSelected}
                              onClick={() => togglePromptId(prompt.id)}
                              className={cn(
                                "rounded-md border border-border/80 bg-card/70 px-3 py-2 text-left text-sm transition hover:border-primary/60",
                                promptSelected && "border-primary/60 bg-primary/10",
                              )}
                            >
                              <span className="block truncate font-medium">{prompt.name}</span>
                              <span className="mt-1 block truncate text-xs text-muted-foreground">{prompt.categoryLabel} - {prompt.regionLabels.join(", ")} - {difficultyLabels[prompt.difficulty]}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
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

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Answer Mode</h3>
              <div className="grid gap-2 xl:grid-cols-2">
                <SelectionButton
                  selected={answerMode === "typed"}
                  icon={Keyboard}
                  label={answerModeLabels.typed}
                  detail="Progress and badges"
                  onClick={() => setAnswerMode("typed")}
                />
                <SelectionButton
                  selected={answerMode === "review"}
                  icon={Eye}
                  label={answerModeLabels.review}
                  detail="Practice only"
                  onClick={() => setAnswerMode("review")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-title">Deck Title</Label>
              <Input id="deck-title" value={deckTitle} onChange={(event) => setDeckTitle(event.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => startDeck()} disabled={eligiblePromptCount === 0 || isStartingDeck} className="w-full md:w-auto">
                <Shuffle className="mr-2 h-4 w-4" aria-hidden="true" />
                {isStartingDeck ? "Starting..." : `Start ${displayedDeckSize}`}
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
        <h2 className="text-lg font-semibold">Current Deck</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-border/80 p-3">
            <Timer className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <div className="text-muted-foreground">Cards selected</div>
            <div className="font-medium">{displayedDeckSize}</div>
          </div>
          <div className="rounded-md border border-border/80 p-3">
            <Shuffle className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <div className="text-muted-foreground">Prompt types</div>
            <div className="font-medium">{promptTypes.length} selected</div>
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => {
          setPromptTypes([...FLASHCARD_STATIC_PROMPT_TYPES])
          setSelectedCategories([...allCategoryIds])
          setSelectedRegions([...allRegionIds])
          setDifficulty("hard")
          setDeckSize(Math.max(1, eligiblePromptCount))
          setSelectedPromptIds([])
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
                <div className="space-y-3 rounded-md border border-border/80 bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">Round {progressDashboard.progress.currentRound}</div>
                      <div className="text-xs text-muted-foreground">
                        {progressDashboard.progress.masteredPromptCount}/{progressRoundTarget} prompts mastered
                      </div>
                    </div>
                    <Badge variant={progressDashboard.progress.canStartNextRound ? "default" : "outline"}>
                      {progressRoundPercent}%
                    </Badge>
                  </div>
                  <Progress value={progressRoundPercent} className="h-2 bg-neutral-800 [&>div]:bg-primary" />
                  {progressDashboard.progress.canStartNextRound ? (
                    <Button type="button" className="w-full" onClick={startNextMasteryRound} disabled={isStartingNextRound}>
                      <Trophy className="mr-2 h-4 w-4" aria-hidden="true" />
                      {isStartingNextRound ? "Starting..." : "Claim round and start next"}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Master every sourced prompt in this round to earn a completion badge and begin a fresh round.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Active</div>
                    <div className="font-semibold">{progressDashboard.progress.activePromptCount}</div>
                  </div>
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Accuracy</div>
                    <div className="font-semibold">{progressDashboard.progress.accuracyPercent}%</div>
                  </div>
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Lifetime Correct</div>
                    <div className="font-semibold">{progressDashboard.progress.totalCorrect}</div>
                  </div>
                  <div className="rounded-md border border-border/80 p-2">
                    <div className="text-muted-foreground">Best Time</div>
                    <div className="font-semibold">{formatDuration(progressDashboard.progress.bestDurationMs)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{progressDashboard.progress.completedSessionCount} sessions</Badge>
                  <Badge variant="outline">{progressDashboard.progress.completedRoundCount} round badges</Badge>
                  <Badge variant="outline">{progressDashboard.progress.achievementCount} total badges</Badge>
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
                        <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                          <span>Round {item.masteryRound}</span>
                          <span>{item.lifetimeCorrectCount} lifetime correct</span>
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
