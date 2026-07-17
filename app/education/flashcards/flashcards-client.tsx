"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronLeft, ChevronRight, Layers3, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  FlashcardRunner,
  type ActiveDeckKind,
  type PromptResult,
} from "./flashcard-runner"
import {
  FlashcardSetupBuilder,
  type BuilderSection,
  type FlashcardSetupOption as Option,
} from "./flashcard-setup-builder"
import { FlashcardProgressDashboard } from "./flashcard-progress-dashboard"
import {
  loadFlashcardProgressDashboard,
  loadFlashcardPromptCatalog,
  loadTemporaryFlashcardDeck,
  startFlashcardProgressSession,
  startNextFlashcardMasteryRound,
  type FlashcardProgressPayload,
  type PromptSummary,
  type PromptTypeCount,
} from "./flashcard-api-client"

type FlashcardsClientProps = {
  categories: Option[]
  regions: Option[]
  initialDecks: FlashcardDeckSummary[]
  initialPromptTypeCounts: PromptTypeCount[]
  isSignedIn: boolean
  canManageAnatomyContent: boolean
  initialDeck?: FlashcardDeckSummary | null
}

const draftStorageKey = "massagelab-flashcard-draft-config-v1"
const allCategoryIds = [...FLASHCARD_STATIC_CATEGORY_IDS] as NormalizedFlashcardDeckConfig["categories"]
const allRegionIds = [...FLASHCARD_STATIC_REGION_IDS] as NormalizedFlashcardDeckConfig["regions"]

function normalizeAnswer(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

function fieldMatches(value: string, acceptedAnswers: string[]) {
  const normalized = normalizeAnswer(value)
  if (!normalized) return false

  return acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalized)
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

function toggleRequiredSelection<T extends string>(current: T[], value: T) {
  if (current.includes(value)) {
    return current.length > 1 ? current.filter((item) => item !== value) : current
  }

  return [...current, value]
}

export function FlashcardsClient({ categories, regions, initialDecks, initialPromptTypeCounts, isSignedIn, canManageAnatomyContent, initialDeck }: FlashcardsClientProps) {
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
  const [expandedBuilderSections, setExpandedBuilderSections] = useState<Record<BuilderSection, boolean>>({
    category: false,
    region: false,
    promptTypes: false,
  })
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
  const [isFlaggingMedia, setIsFlaggingMedia] = useState(false)
  const [communityDeckIndex, setCommunityDeckIndex] = useState(0)
  const [communitySlide, setCommunitySlide] = useState<{ direction: 1 | -1 } | null>(null)
  const [activeDeckActivation, setActiveDeckActivation] = useState(0)
  const studyStartedAtRef = useRef<number | null>(null)
  const isStartingNextRoundRef = useRef(false)

  const refreshProgressDashboard = useCallback(async () => {
    if (!canPersistProgress) {
      setProgressDashboard(null)
      return
    }

    setIsLoadingProgressDashboard(true)
    try {
      const payload = await loadFlashcardProgressDashboard()
      if (payload) {
        setProgressDashboard(isStartingNextRoundRef.current && payload.progress.canStartNextRound
          ? {
            ...payload,
            progress: {
              ...payload.progress,
              canStartNextRound: false,
            },
          }
          : payload)
      } else {
        setProgressDashboard(null)
      }
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
        const { promptTypeCounts: counts, promptSummaries: summaries } = await loadFlashcardPromptCatalog(countConfig)
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
  const allCategoriesSelected = selectedCategories.length === allCategoryIds.length
  const allRegionsSelected = selectedRegions.length === allRegionIds.length
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

  const toggleBuilderSection = useCallback((section: BuilderSection) => {
    if (section === "promptTypes" && expandedBuilderSections.promptTypes) setExpandedPromptType(null)

    setExpandedBuilderSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }, [expandedBuilderSections.promptTypes])

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

  const resetStudyFilters = () => {
    setSelectedCategories([...allCategoryIds])
    setSelectedRegions([...allRegionIds])
    setPromptTypes([...FLASHCARD_STATIC_PROMPT_TYPES])
    setSelectedPromptIds([])
    setExpandedPromptType(null)
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
          const prompts = await loadTemporaryFlashcardDeck(config)
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

      if (canPersistProgress && config.answerMode === "typed") {
        let fallbackMessage = ""

        try {
          const result = await startFlashcardProgressSession({ config, deckSlug, skipMastered: skipMasteredPrompts })

          if (!result.ok) {
            if (skipMasteredPrompts && result.status === 409) {
              setSaveMessage(result.errorMessage || "All selected prompts are already mastered.")
              return
            }

            fallbackMessage = "Studying temporarily; progress tracking could not be started."
            await startTemporaryDeck(fallbackMessage)
            return
          }

          const session = result.session

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
    setSaveMessage("")
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

  const flagCurrentMedia = async (reason: "bad_match" | "bad_view") => {
    if (!currentPrompt?.front.media || isFlaggingMedia) return

    const promptId = currentPrompt.id
    const promptType = currentPrompt.type
    const media = currentPrompt.front.media
    setIsFlaggingMedia(true)
    setSaveMessage("")

    try {
      const response = await fetch("/api/admin/anatomy/media-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: currentPrompt.entityType,
          entitySlug: currentPrompt.entitySlug,
          mediaSlug: media.id,
          role: media.role,
          reason,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setSaveMessage(typeof payload?.error === "string" ? payload.error : "Image could not be flagged.")
        return
      }

      setActiveDeck((current) => {
        const next = current.filter((prompt) => prompt.id !== promptId)
        setCurrentIndex((index) => next.length === 0 ? 0 : Math.min(index, next.length - 1))
        return next
      })
      setResults((current) => current.filter((result) => result.promptId !== promptId))
      setPromptSummaries((current) => current.filter((prompt) => prompt.id !== promptId))
      setSelectedPromptIds((current) => current.filter((selectedPromptId) => selectedPromptId !== promptId))
      setPromptTypeCounts((current) => current.map((type) => (
        type.id === promptType
          ? { ...type, promptCount: Math.max(0, type.promptCount - 1) }
          : type
      )))
      setCheckedResult(null)
      setAnswers({})
      setIsCardFlipped(false)
      setSaveMessage("Image flagged and removed from this study run.")
    } catch (error) {
      console.error("Failed to flag flashcard media", error)
      setSaveMessage("Image could not be flagged.")
    } finally {
      setIsFlaggingMedia(false)
    }
  }

  const startNextMasteryRound = async () => {
    if (
      !canPersistProgress
      || !progressDashboard?.progress.canStartNextRound
      || isStartingNextRound
      || isStartingNextRoundRef.current
      || isLoadingProgressDashboard
    ) return

    isStartingNextRoundRef.current = true
    setIsStartingNextRound(true)
    setSaveMessage("")

    try {
      const result = await startNextFlashcardMasteryRound()

      if (!result.ok) {
        setSaveMessage(result.errorMessage)
        return
      }

      setSkipMasteredPrompts(false)
      setSaveMessage(result.completedRound && result.nextRound
        ? `Round ${result.completedRound} complete. Round ${result.nextRound} is ready.`
        : "Next mastery round is ready.")
      setProgressDashboard((current) => current
        ? {
          ...current,
          progress: {
            ...current.progress,
            canStartNextRound: false,
          },
        }
        : current)
      await refreshProgressDashboard()
    } catch (error) {
      console.error("Failed to start next flashcard mastery round", error)
      setSaveMessage("Next mastery round could not be started.")
    } finally {
      isStartingNextRoundRef.current = false
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
      <FlashcardRunner
        runnerTopRef={runnerTopRef}
        currentPrompt={currentPrompt}
        currentIndex={currentIndex}
        deckLength={activeDeck.length}
        answeredCount={answeredCount}
        correctCount={correctCount}
        runnerStatusLabel={runnerStatusLabel}
        activeDeckKind={activeDeckKind}
        canPersistProgress={canPersistProgress}
        progress={progress}
        isCurrentCardFlipped={isCurrentCardFlipped}
        isReviewMode={isReviewMode}
        onFlipCard={() => setIsCardFlipped((flipped) => !flipped)}
        currentResult={currentResult}
        canManageAnatomyContent={canManageAnatomyContent}
        isFlaggingMedia={isFlaggingMedia}
        onFlagMedia={flagCurrentMedia}
        onPreviousPrompt={previousPrompt}
        answers={answers}
        onAnswerChange={(fieldId, value) => setAnswers((current) => ({ ...current, [fieldId]: value }))}
        onCheckAnswer={checkCurrentAnswer}
        onCompleteStudy={completeStudy}
        onNextPrompt={nextPrompt}
        showReviewMarkingActions={showReviewMarkingActions}
        saveMessage={saveMessage}
        onResetStudy={resetStudy}
      />
    )
  }
  return (
    <div className={cn("grid min-w-0 gap-5", canPersistProgress && "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
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
            <Button type="button" variant="secondary" className="mt-4 h-auto min-h-10 w-full min-w-0 whitespace-normal text-center sm:w-auto" onClick={() => showSetupSection("custom")}>
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
              className="group/community-carousel relative overflow-hidden"
              onTouchStart={(event) => startCommunitySwipe(event.touches[0]?.clientX ?? 0)}
              onTouchMove={(event) => updateCommunitySwipe(event.touches[0]?.clientX ?? 0)}
              onTouchEnd={finishCommunitySwipe}
              onTouchCancel={finishCommunitySwipe}
            >
              <div
                className="ml-flashcard-carousel h-[17rem] overflow-hidden sm:h-[15rem] md:h-[13.5rem]"
              >
                <div
                  data-slide={communitySlide?.direction === 1 ? "next" : communitySlide?.direction === -1 ? "previous" : undefined}
                  className="ml-flashcard-carousel-track flex h-full sm:-mx-1.5"
                >
                {visibleCommunityDecks.map((deck) => (
                  <div key={deck.slug} className="flex h-full min-w-full sm:px-1.5 md:min-w-[50%]">
                    <article className="flex h-full w-full flex-col rounded-md border border-border/80 bg-card/60 p-3 transition hover:border-primary/60 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 break-words font-medium">{deck.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{deck.description || deck.ownerName}</p>
                        </div>
                        <Badge variant="outline">{deck.isStarter ? "Starter" : deck.visibility}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground sm:mt-3">
                        <span>{deck.promptCount} prompts</span>
                        <span>{deck.completionCount} completions</span>
                        <span>{deck.accuracyPercent}% accuracy</span>
                      </div>
                      <div className="mt-auto grid grid-cols-2 gap-2 pt-3 sm:pt-4">
                        <Button type="button" size="sm" onClick={() => startFromDeck(deck)} disabled={isStartingDeck} className="min-w-0 whitespace-normal">
                          <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                          {isStartingDeck ? "Starting..." : "Study"}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => viewDeckSetup(deck)} className="min-w-0 whitespace-normal">
                          View
                        </Button>
                      </div>
                    </article>
                  </div>
                ))}
                </div>
              </div>
              {sortedCommunityDecks.length > 2 ? (
                <div className="pointer-events-none absolute left-2 right-2 top-24 z-20 flex items-center justify-between md:-left-5 md:-right-5 md:top-1/2 md:-translate-y-1/2">
                <Button
                  type="button"
                  variant="ctaBlue"
                  size="icon"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => moveCommunityCarousel(-1)}
                  disabled={sortedCommunityDecks.length <= 2 || Boolean(communitySlide)}
                  aria-label="Previous community decks"
                  className="pointer-events-auto h-10 w-10 rounded-full opacity-100 shadow-lg transition md:opacity-0 md:group-hover/community-carousel:opacity-100 md:group-focus-within/community-carousel:opacity-100"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ctaBlue"
                  size="icon"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => moveCommunityCarousel(1)}
                  disabled={sortedCommunityDecks.length <= 2 || Boolean(communitySlide)}
                  aria-label="Next community decks"
                  className="pointer-events-auto h-10 w-10 rounded-full opacity-100 shadow-lg transition md:opacity-0 md:group-hover/community-carousel:opacity-100 md:group-focus-within/community-carousel:opacity-100"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Button>
                </div>
              ) : null}
              <span className="sr-only">{carouselPositionLabel}</span>
            </div>
          ) : (
            <div className="rounded-md border border-border/80 bg-card/60 p-4 text-sm text-muted-foreground">
              No public decks are available yet.
            </div>
          )}
        </div>

        <FlashcardSetupBuilder
          builderRef={customDeckBuilderRef}
          categories={categories}
          regions={regions}
          selectedCategories={selectedCategories}
          selectedRegions={selectedRegions}
          difficulty={difficulty}
          promptTypes={promptTypes}
          answerMode={answerMode}
          deckSize={deckSize}
          selectedPromptIds={selectedPromptIds}
          deckTitle={deckTitle}
          deckDescription={deckDescription}
          visibility={visibility}
          expandedPromptType={expandedPromptType}
          expandedBuilderSections={expandedBuilderSections}
          promptTypeCounts={promptTypeCounts}
          promptSummaries={promptSummaries}
          selectedUsablePromptIds={selectedUsablePromptIds}
          allCategoriesSelected={allCategoriesSelected}
          allRegionsSelected={allRegionsSelected}
          eligiblePromptCount={eligiblePromptCount}
          canPersistProgress={canPersistProgress}
          masteryThreshold={progressDashboard?.progress.masteryThreshold ?? 10}
          skipMasteredPrompts={skipMasteredPrompts}
          isStartingDeck={isStartingDeck}
          isLoadingPromptCounts={isLoadingPromptCounts}
          saveMessage={saveMessage}
          onSelectAllCategories={() => {
            setSelectedCategories([...allCategoryIds])
            setSelectedPromptIds([])
          }}
          onToggleCategory={toggleCategory}
          onSelectAllRegions={() => {
            setSelectedRegions([...allRegionIds])
            setSelectedPromptIds([])
          }}
          onToggleRegion={toggleRegion}
          onDifficultyChange={(nextDifficulty) => {
            setDifficulty(nextDifficulty)
            setSelectedPromptIds([])
          }}
          onDeckSizeChange={setDeckSize}
          onToggleBuilderSection={toggleBuilderSection}
          onTogglePromptType={togglePromptType}
          onExpandedPromptTypeChange={setExpandedPromptType}
          onActivateExactPromptSelection={activateExactPromptSelection}
          onClearExactPromptSelection={() => setSelectedPromptIds([])}
          onTogglePromptId={togglePromptId}
          onSkipMasteredPromptsChange={setSkipMasteredPrompts}
          onAnswerModeChange={setAnswerMode}
          onDeckTitleChange={setDeckTitle}
          onDeckDescriptionChange={setDeckDescription}
          onVisibilityChange={setVisibility}
          onStartDeck={() => { void startDeck() }}
          onSaveDeck={saveDeck}
          onPersistDraftAndPromptSignIn={persistDraftAndPromptSignIn}
          onResetStudyFilters={resetStudyFilters}
        />
      </section>

      {canPersistProgress ? (
        <FlashcardProgressDashboard
          progressDashboard={progressDashboard}
          isLoading={isLoadingProgressDashboard}
          isStartingNextRound={isStartingNextRound}
          onStartNextMasteryRound={startNextMasteryRound}
        />
      ) : null}    </div>
  )
}
