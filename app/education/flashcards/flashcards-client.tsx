"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Layers3, Lock, RotateCcw, Save, Shuffle, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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

export function FlashcardsClient({ categories, regions, sources, initialDecks, initialPromptTypeCounts, isSignedIn, initialDeck }: FlashcardsClientProps) {
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
  const [activeDeckSlug, setActiveDeckSlug] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checkedResult, setCheckedResult] = useState<PromptResult | null>(null)
  const [results, setResults] = useState<PromptResult[]>([])
  const [saveMessage, setSaveMessage] = useState("")
  const [promptTypeCounts, setPromptTypeCounts] = useState(initialPromptTypeCounts)
  const [isLoadingPromptCounts, setIsLoadingPromptCounts] = useState(false)
  const [canPersistProgress, setCanPersistProgress] = useState(isSignedIn)

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

    fetch("/api/education/flashcards/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: countConfig }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.promptTypeCounts)) {
          setPromptTypeCounts(payload.promptTypeCounts)
        }
      })
      .catch(() => undefined)
      .finally(() => {
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

  const togglePromptType = (type: FlashcardPromptType) => {
    setPromptTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((item) => item !== type)
      }

      return [...current, type]
    })
  }

  const startDeck = async (config = setupConfig, deckSlug = "") => {
    setSaveMessage("")

    const activateDeck = (nextDeck: FlashcardPrompt[], nextSessionId = "") => {
      setActiveConfig(config)
      setActiveDeck(nextDeck)
      setActiveDeckSlug(deckSlug)
      setSessionId(nextSessionId)
      setCurrentIndex(0)
      setAnswers({})
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
          setSaveMessage("Deck could not be started.")
          return
        }

        const prompts = promptDeckPayload(await response.json())
        if (prompts.length === 0) {
          setSaveMessage("Deck could not be started.")
          return
        }

        activateDeck(prompts)
        if (message) setSaveMessage(message)
      } catch (error) {
        console.error("Failed to start temporary flashcard deck", error)
        setSaveMessage("Deck could not be started.")
      }
    }

    if (canPersistProgress) {
      let fallbackMessage = ""

      try {
        const response = await fetch("/api/education/flashcards/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deckSlug ? { deckSlug } : { config }),
        })

        if (!response.ok) {
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
    void startDeck(deck.config, deck.isStarter ? "" : deck.slug)
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
    setCurrentIndex((index) => Math.min(activeDeck.length - 1, index + 1))
  }

  const previousPrompt = () => {
    setCheckedResult(null)
    setAnswers({})
    setCurrentIndex((index) => Math.max(0, index - 1))
  }

  const resetStudy = () => {
    setActiveDeck([])
    setActiveConfig(null)
    setSessionId("")
    setCurrentIndex(0)
    setResults([])
    setCheckedResult(null)
    setAnswers({})
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
        body: JSON.stringify({ results: finalResults }),
      })

      if (!response.ok) {
        setSaveMessage("Progress could not be saved.")
        return
      }

      setSaveMessage("Progress saved.")
    } catch (error) {
      console.error("Failed to complete flashcard study session", error)
      setSaveMessage("Progress could not be saved.")
    }
  }

  if (activeDeck.length > 0 && currentPrompt && activeConfig) {
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
            {activeDeckSlug ? <Badge variant="outline">Community Deck</Badge> : <Badge variant="outline">Temporary Deck</Badge>}
          </div>
        </div>

        <Progress value={progress} className="h-2 bg-neutral-800 [&>div]:bg-primary" />

        <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="min-h-[34rem] rounded-md border border-border/80 bg-background/80 p-5 shadow-inner shadow-black/10">
            <div className="flex min-h-[30rem] flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{currentPrompt.typeLabel}</Badge>
                  <Badge variant="outline">{currentPrompt.categoryLabel}</Badge>
                  {currentPrompt.regionLabels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
                  <Badge variant="outline">{difficultyLabels[currentPrompt.difficulty]}</Badge>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{currentPrompt.front.instruction}</p>
                  {currentPrompt.front.mode === "media" && currentPrompt.front.media ? (
                    <figure className="overflow-hidden rounded-md border border-border/80 bg-card/70">
                      {/* eslint-disable-next-line @next/next/no-img-element -- reviewed source media can come from multiple external hosts not configured for next/image. */}
                      <img src={currentPrompt.front.media.url} alt={currentPrompt.front.media.title} className="max-h-[24rem] w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                      <figcaption className="border-t border-border/80 p-2 text-xs text-muted-foreground">{currentPrompt.front.media.title}</figcaption>
                    </figure>
                  ) : (
                    <h2 className="break-words text-3xl font-semibold tracking-normal sm:text-4xl">{currentPrompt.front.title}</h2>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
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

                {currentResult ? (
                  <div className={`rounded-md border p-4 ${currentResult.correct ? "border-emerald-500/50 bg-emerald-500/10" : "border-destructive/50 bg-destructive/10"}`}>
                    <div className="flex items-center gap-2 font-medium">
                      {currentResult.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                      {currentResult.correct ? "Correct" : "Check the sourced answer"}
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      {currentPrompt.answerFields.map((field) => (
                        <p key={field.id}><span className="font-medium">{field.label}:</span> {field.answer}</p>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {currentPrompt.sources.map((source) => (
                        source.url ? (
                          <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/80 px-2 py-1 hover:text-foreground">
                            {source.label}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        ) : <span key={source.id} className="rounded-md border border-border/80 px-2 py-1">{source.label}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={previousPrompt} disabled={currentIndex === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <div className="flex flex-wrap gap-2">
                  {activeConfig.answerMode === "review" ? (
                    <>
                      <Button type="button" variant="outline" onClick={() => checkCurrentAnswer(false)} disabled={Boolean(currentResult)}>Missed</Button>
                      <Button type="button" onClick={() => checkCurrentAnswer(true)} disabled={Boolean(currentResult)}>Correct</Button>
                    </>
                  ) : (
                    <Button type="button" onClick={() => checkCurrentAnswer()} disabled={Boolean(currentResult)}>Check</Button>
                  )}
                </div>
                {currentIndex >= activeDeck.length - 1 ? (
                  <Button type="button" variant="outline" onClick={completeStudy}>
                    Save Results
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={nextPrompt}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-3 rounded-md border border-border/80 bg-background/70 p-4">
            <h3 className="text-sm font-medium">Deck Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-border/80 p-3"><div className="text-muted-foreground">Answered</div><div className="text-lg font-semibold">{answeredCount}</div></div>
              <div className="rounded-md border border-border/80 p-3"><div className="text-muted-foreground">Correct</div><div className="text-lg font-semibold">{correctCount}</div></div>
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-5">
        <div className="rounded-md border border-border/80 bg-background/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Build A Deck</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="flashcard-category">Category</Label>
              <select id="flashcard-category" value={category} onChange={(event) => setCategory(event.target.value)} className={selectClassName()}>
                <option value="all">All categories</option>
                {categories.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="flashcard-region">Region</Label>
              <select id="flashcard-region" value={region} onChange={(event) => setRegion(event.target.value)} className={selectClassName()}>
                <option value="all">All regions</option>
                {regions.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="flashcard-difficulty">Depth</Label>
              <select id="flashcard-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as AnatomyStudyDifficulty)} className={selectClassName()}>
                {Object.entries(difficultyLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="flashcard-deck-size">Deck Size</Label>
              <select id="flashcard-deck-size" value={deckSize} onChange={(event) => setDeckSize(Number(event.target.value))} className={selectClassName()}>
                {deckSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {promptTypeCounts.map((type) => (
              <label key={type.id} className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-border/80 bg-card/60 px-3 py-2 text-sm">
                <span className="flex items-center gap-3">
                  <Checkbox checked={promptTypes.includes(type.id)} onCheckedChange={() => togglePromptType(type.id)} disabled={!promptTypes.includes(type.id) && type.promptCount === 0} />
                  <span>{type.label}</span>
                </span>
                <Badge variant="outline">{type.promptCount}</Badge>
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="answer-mode">Answer Mode</Label>
              <select id="answer-mode" value={answerMode} onChange={(event) => setAnswerMode(event.target.value as FlashcardAnswerMode)} className={selectClassName()}>
                {FLASHCARD_STATIC_ANSWER_MODES.map((mode) => <option key={mode} value={mode}>{answerModeLabels[mode]}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-title">Deck Title</Label>
              <Input id="deck-title" value={deckTitle} onChange={(event) => setDeckTitle(event.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => startDeck()} disabled={eligiblePromptCount === 0}>
                <Shuffle className="mr-2 h-4 w-4" aria-hidden="true" />
                Start {Math.min(deckSize, eligiblePromptCount)}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input value={deckDescription} onChange={(event) => setDeckDescription(event.target.value)} placeholder="Deck note" />
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")} className={selectClassName()}>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
            <Button type="button" variant="outline" onClick={saveDeck}>
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

        <div className="rounded-md border border-border/80 bg-background/70 p-4">
          <h2 className="mb-4 text-lg font-semibold">Community Decks</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {communityDecks.map((deck) => (
              <article key={deck.slug} className="rounded-md border border-border/80 bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{deck.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{deck.description || deck.ownerName}</p>
                  </div>
                  <Badge variant="outline">{deck.isStarter ? "Starter" : deck.visibility}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{deck.promptCount} eligible</span>
                  <span>{deck.completionCount} completions</span>
                  <span>{deck.accuracyPercent}% accuracy</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => startFromDeck(deck)}>Study</Button>
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link href={`/education/flashcards/decks/${deck.slug}`}>View</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-4 rounded-md border border-border/80 bg-background/70 p-4">
        <h2 className="text-lg font-semibold">Sources</h2>
        <div className="space-y-2">
          {sources.slice(0, 8).map((source) => (
            source.url ? (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-card/70 px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground">
                <span className="min-w-0 truncate">{source.label}</span>
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            ) : <div key={source.id} className="rounded-md border border-border/80 bg-card/70 px-3 py-2 text-sm text-muted-foreground">{source.label}</div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={() => {
          setPromptTypes([...FLASHCARD_STATIC_PROMPT_TYPES])
          setCategory("all")
          setRegion("all")
          setDifficulty("hard")
          setDeckSize(50)
        }}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Select All
        </Button>
      </aside>
    </div>
  )
}
