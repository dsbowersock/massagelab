"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, LogIn, Play, RotateCcw, SkipForward, Trophy, Users, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { MovingBackground } from "@/components/moving-background"
import {
  type AnatomyStudyBodySystem,
  type AnatomyStudyCategory,
  type AnatomyStudyDifficulty,
  type AnatomyStudyMedia,
} from "@/lib/anatomy-study"
import {
  anatomimeTermFromCard,
  createAnatomimeSessionDeck,
  getAnatomimeCandidateCards,
  getAnatomimeSetupOptions,
  normalizeAnatomimeSessionConfig,
  type AnatomimeAnswerMode,
} from "@/lib/anatomime-shared"
import {
  buildTurnReview,
  canEndGameAfterCurrentTurn,
  getGameLearningRecap,
  getNextTeamIndex,
  getNextTurnState,
  getPromptVisibility,
  getRoundLabel,
  getWinnerNames,
  isScheduledGameComplete,
  normalizeTeamNames,
  normalizeRoundLimit,
  summarizeTurnReview,
  updateScore,
} from "@/lib/anatomime-game"
import { HostRoomClient } from "./host-room-client"
import type { AnatomimeRoomSummary } from "./shared-session-types"
import "./styles.css"

type AnatomyKind = AnatomyStudyCategory
type PresenterClueLevel = "easy" | "medium" | "hard" | "expert"
type AnatomyBodySystem = AnatomyStudyBodySystem

type AnatomyTerm = {
  id: string
  name: string
  kind: AnatomyKind
  category: AnatomyKind
  categoryLabel: string
  regions: string[]
  regionLabels: string[]
  bodySystems: AnatomyBodySystem[]
  bodySystemLabels: string[]
  difficulty: AnatomyStudyDifficulty
  aliases: string[]
  definition?: string
  media: AnatomyStudyMedia[]
  sourceRefs: string[]
}

type GamePhase = "onboarding" | "selection" | "setup" | "playing" | "roundEnd" | "end" | "sharedHost"
type AnatomimeInitialPhase = Extract<GamePhase, "onboarding" | "selection">
type TermOutcome = "correct" | "missed" | "skipped"
type TurnReviewItem = {
  term: AnatomyTerm
  outcome: TermOutcome
}
type TurnReviewSummary = Record<TermOutcome, number>
type TurnHistoryEntry = {
  id: string
  teamName: string
  roundLabel: string
  review: TurnReviewItem[]
  summary: TurnReviewSummary
}
type LearningRecapItem = {
  term: AnatomyTerm
  correct: number
  missed: number
  skipped: number
}
export type AnatomimeGameClientProps = {
  initialTeamCount?: number
  initialTeamNames?: string[]
  initialRoundLimit?: number
  initialHardcoreMode?: boolean
  initialPhase?: AnatomimeInitialPhase
}

const TERM_COUNT = 4
const ROUND_SECONDS = 30
const TEAM_OPTIONS = [2, 3, 4]
const CLUE_LEVELS: PresenterClueLevel[] = ["easy", "medium", "hard", "expert"]

const setupOptions = getAnatomimeSetupOptions()
const kindOptions = setupOptions.categories as Array<{ id: AnatomyKind; label: string; termCount: number }>
const bodySystemOptions = setupOptions.bodySystems as Array<{ id: AnatomyBodySystem; label: string; termCount: number }>
const anatomyRegions = setupOptions.regions
const anatomySources = setupOptions.sources
const defaultCategories = kindOptions.map((option) => option.id)
const defaultBodySystems = bodySystemOptions.map((option) => option.id)
const defaultRegions = anatomyRegions.map((region) => region.id)

const difficultyLabels: Record<AnatomyStudyDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const clueLevelLabels: Record<PresenterClueLevel, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
}

const answerModeLabels: Record<AnatomimeAnswerMode, string> = {
  "host-judged": "Host Judged",
  typed: "Device Typed",
  "multiple-choice": "Device Multiple Choice",
}

const setupAnswerModes: AnatomimeAnswerMode[] = ["host-judged", "typed", "multiple-choice"]

function normalizeInitialTeamCount(value: number) {
  return TEAM_OPTIONS.includes(value) ? value : 2
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

function formatTermKind(kind: AnatomyKind) {
  return kindOptions.find((option) => option.id === kind)?.label ?? kind
}

function regionLabel(regionId: string) {
  return anatomyRegions.find((region) => region.id === regionId)?.label ?? regionId
}

function outcomeLabel(outcome: TermOutcome) {
  if (outcome === "correct") return "Got it"
  if (outcome === "missed") return "Missed"
  return "Skipped"
}

function formatAliases(term: AnatomyTerm) {
  return term.aliases.filter((alias) => alias.toLowerCase() !== term.name.toLowerCase()).slice(0, 3)
}

function LearningReviewList({ review }: { review: TurnReviewItem[] }) {
  return (
    <div className="anatomime-review-list">
      {review.map(({ term, outcome }) => {
        const aliases = formatAliases(term)

        return (
          <article key={term.id} className="anatomime-review-card" data-outcome={outcome}>
            <div className="anatomime-review-card-header">
              <span className="anatomime-outcome-pill" data-outcome={outcome}>{outcomeLabel(outcome)}</span>
              <strong>{term.name}</strong>
            </div>
            <p className="anatomime-review-meta">
              {formatTermKind(term.kind)} · {term.regions.map(regionLabel).join(", ")} · {difficultyLabels[term.difficulty]}
            </p>
            {term.definition ? <p className="anatomime-review-definition">{term.definition}</p> : null}
            {aliases.length > 0 ? <p className="anatomime-review-aliases">Also: {aliases.join(", ")}</p> : null}
          </article>
        )
      })}
    </div>
  )
}

export function AnatomimeGameClient({
  initialTeamCount = 2,
  initialTeamNames = ["Team 1", "Team 2"],
  initialRoundLimit = 3,
  initialHardcoreMode = false,
  initialPhase = "onboarding",
}: AnatomimeGameClientProps) {
  const normalizedInitialTeamCount = normalizeInitialTeamCount(initialTeamCount)
  const [gamePhase, setGamePhase] = useState<GamePhase>(initialPhase)
  const [teamCount, setTeamCount] = useState(normalizedInitialTeamCount)
  const [teamNames, setTeamNames] = useState(() => normalizeTeamNames(initialTeamNames, normalizedInitialTeamCount))
  const [roundLimit, setRoundLimit] = useState(() => normalizeRoundLimit(initialRoundLimit))
  const [hardcoreMode, setHardcoreMode] = useState(initialHardcoreMode)
  const [currentRound, setCurrentRound] = useState(1)
  const [scores, setScores] = useState(() => new Array(normalizedInitialTeamCount).fill(0))
  const [currentTeam, setCurrentTeam] = useState(0)
  const [selectedKinds, setSelectedKinds] = useState<AnatomyKind[]>(defaultCategories)
  const [selectedBodySystems, setSelectedBodySystems] = useState<AnatomyBodySystem[]>(defaultBodySystems)
  const [selectedRegions, setSelectedRegions] = useState<string[]>(defaultRegions)
  const [clueLevel, setClueLevel] = useState<PresenterClueLevel>("easy")
  const [answerMode, setAnswerMode] = useState<AnatomimeAnswerMode>("host-judged")
  const [currentDeck, setCurrentDeck] = useState<AnatomyTerm[]>([])
  const [selectedSetupTermIds, setSelectedSetupTermIds] = useState<string[]>([])
  const [expandedRegionIds, setExpandedRegionIds] = useState<string[]>([])
  const [usedReshuffleKeys, setUsedReshuffleKeys] = useState<string[]>([])
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([])
  const [currentTermIndex, setCurrentTermIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(ROUND_SECONDS)
  const [bonusTime, setBonusTime] = useState(0)
  const [message, setMessage] = useState("")
  const [termOutcomes, setTermOutcomes] = useState<Record<string, TermOutcome>>({})
  const [lastTurnReview, setLastTurnReview] = useState<TurnHistoryEntry | null>(null)
  const [turnHistory, setTurnHistory] = useState<TurnHistoryEntry[]>([])
  const [sharedSession, setSharedSession] = useState<AnatomimeRoomSummary | null>(null)
  const [hostCredentials, setHostCredentials] = useState<{ playerId: string; token: string } | null>(null)
  const [creatingSharedGame, setCreatingSharedGame] = useState(false)
  const selectedSetupTermIdsRef = useRef(selectedSetupTermIds)
  const termCount = TERM_COUNT

  useEffect(() => {
    selectedSetupTermIdsRef.current = selectedSetupTermIds
  }, [selectedSetupTermIds])

  useEffect(() => {
    setTeamNames((current) => normalizeTeamNames(current, teamCount))
    setScores((current) => Array.from({ length: teamCount }, (_, index) => current[index] ?? 0))
  }, [teamCount])

  const eligibleTerms = useMemo(() => {
    if (selectedKinds.length === 0 || selectedBodySystems.length === 0) return []

    return getAnatomimeCandidateCards(normalizeAnatomimeSessionConfig({
      categories: selectedKinds,
      bodySystems: selectedBodySystems,
      regions: defaultRegions,
      difficulty: "hard",
      termCount,
    })).map(anatomimeTermFromCard) as AnatomyTerm[]
  }, [selectedBodySystems, selectedKinds, termCount])

  const matchingTerms = useMemo(() => {
    if (selectedKinds.length === 0 || selectedBodySystems.length === 0 || selectedRegions.length === 0) return []

    const selectedRegionSet = new Set(selectedRegions)
    return eligibleTerms.filter((term) => term.regions.some((region) => selectedRegionSet.has(region)))
  }, [eligibleTerms, selectedBodySystems.length, selectedKinds.length, selectedRegions])

  const termsByRegion = useMemo(() => {
    const grouped = new Map<string, AnatomyTerm[]>()
    for (const region of anatomyRegions) {
      grouped.set(region.id, eligibleTerms.filter((term) => term.regions.includes(region.id)))
    }

    return grouped
  }, [eligibleTerms])

  const matchingTermIds = useMemo(() => new Set(matchingTerms.map((term) => term.id)), [matchingTerms])

  const selectedSetupTerms = useMemo(() => (
    selectedSetupTermIds
      .map((termId) => eligibleTerms.find((term) => term.id === termId))
      .filter((term): term is AnatomyTerm => Boolean(term))
  ), [eligibleTerms, selectedSetupTermIds])

  const orderedTerms = useMemo(() => (
    selectedTermIds
      .map((termId) => currentDeck.find((term) => term.id === termId))
      .filter((term): term is AnatomyTerm => Boolean(term))
  ), [currentDeck, selectedTermIds])

  // Filter changes can remove terms from the selected setup pool; keep
  // selectedSetupTermIds inside matchingTermIds, while termCount is enforced
  // when starting or creating the game and when the deck draws from that pool.
  useEffect(() => {
    setSelectedSetupTermIds((current) => current.filter((termId) => matchingTermIds.has(termId)))
  }, [matchingTermIds])

  const currentTerm = orderedTerms[currentTermIndex]
  const currentTeamName = teamNames[currentTeam] ?? `Team ${currentTeam + 1}`
  const winnerNames = getWinnerNames(scores, teamNames)
  const canEndGame = canEndGameAfterCurrentTurn(scores, currentTeam, termCount)
  const isFinalScheduledTurn = isScheduledGameComplete({
    hardcoreMode,
    currentTeam,
    teamCount,
    currentRound,
    roundLimit,
  })
  const showManualEndGame = hardcoreMode || canEndGame || isFinalScheduledTurn
  const promptVisibility = getPromptVisibility(clueLevel)
  const roundLabel = getRoundLabel({ hardcoreMode, currentRound, roundLimit })
  const reshuffleKey = `${currentRound}:${currentTeam}`
  const reshuffleUsed = usedReshuffleKeys.includes(reshuffleKey)
  const currentTermMedia = currentTerm?.media.find((media) => ["image", "diagram"].includes(media.mediaType))
  const learningRecap = useMemo(() => getGameLearningRecap(turnHistory) as LearningRecapItem[], [turnHistory])

  const buildTurnDeck = useCallback(() => {
    const deck = createAnatomimeSessionDeck({
      categories: selectedKinds,
      regions: selectedRegions,
      bodySystems: selectedBodySystems,
      difficulty: "hard",
      termCount,
      selectedCardIds: selectedSetupTermIds,
      seed: `local-${Date.now().toString(36)}`,
    }).map(anatomimeTermFromCard) as AnatomyTerm[]

    setCurrentDeck(deck)
    setSelectedTermIds([])
    setCurrentTermIndex(0)
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
    setTermOutcomes({})
    setLastTurnReview(null)
    setMessage("")
    setGamePhase("setup")
  }, [selectedBodySystems, selectedKinds, selectedRegions, selectedSetupTermIds, termCount])

  const startGameSetup = () => {
    const trimmedNames = teamNames.slice(0, teamCount).map((name) => name.trim())
    if (trimmedNames.some((name) => !name)) {
      setMessage("Enter names for all teams before choosing anatomy terms.")
      return
    }

    setTeamNames(trimmedNames)
    setScores(new Array(teamCount).fill(0))
    setCurrentTeam(0)
    setCurrentRound(1)
    setUsedReshuffleKeys([])
    setMessage("")
    setGamePhase("selection")
  }

  const continueToSetup = () => {
    if (selectedKinds.length === 0) {
      setMessage("Choose at least one anatomy category.")
      return
    }
    if (selectedBodySystems.length === 0) {
      setMessage("Choose at least one body system.")
      return
    }
    if (selectedRegions.length === 0) {
      setMessage("Choose at least one body region.")
      return
    }
    if (selectedSetupTermIds.length > 0 && selectedSetupTermIds.length < termCount) {
      setMessage(`Choose at least ${termCount} specific terms, or clear them to use the region pool.`)
      return
    }
    if (matchingTerms.length < termCount) {
      setMessage(`This selection has ${matchingTerms.length} matching terms. Choose at least ${termCount} terms by adding regions, categories, or body systems.`)
      return
    }

    buildTurnDeck()
  }

  const toggleSetupTerm = (term: AnatomyTerm) => {
    setSelectedSetupTermIds((current) => {
      if (current.includes(term.id)) return current.filter((termId) => termId !== term.id)

      return [...current, term.id]
    })
    setSelectedRegions((current) => {
      const next = new Set(current)
      term.regions.forEach((region) => next.add(region))
      return [...next]
    })
    setMessage("")
  }

  const toggleExpandedRegion = (regionId: string) => {
    setExpandedRegionIds((current) => toggleValue(current, regionId))
  }

  const toggleRegionTermPool = (regionId: string, regionTerms: AnatomyTerm[]) => {
    const regionTermIds = regionTerms.map((term) => term.id)
    const regionTermIdSet = new Set(regionTermIds)
    const currentTermIds = selectedSetupTermIdsRef.current
    const allRegionTermsSelected = regionTermIds.length > 0 && regionTermIds.every((termId) => currentTermIds.includes(termId))
    const nextTermIds = allRegionTermsSelected
      ? currentTermIds.filter((termId) => !regionTermIdSet.has(termId))
      : [...new Set([...currentTermIds, ...regionTermIds])]

    selectedSetupTermIdsRef.current = nextTermIds
    setSelectedSetupTermIds(nextTermIds)
    setSelectedRegions((current) => (
      allRegionTermsSelected
        ? current.filter((selectedRegionId) => selectedRegionId !== regionId)
        : current.includes(regionId)
          ? current
          : [...current, regionId]
    ))
    setMessage("")
  }

  const reshuffleCurrentTurn = () => {
    if (reshuffleUsed) return

    setUsedReshuffleKeys((current) => (
      current.includes(reshuffleKey) ? current : [...current, reshuffleKey]
    ))
    buildTurnDeck()
  }

  const addTerm = (termId: string) => {
    setSelectedTermIds((current) => {
      if (current.includes(termId) || current.length >= termCount) return current
      return [...current, termId]
    })
    setMessage("")
  }

  const removeTerm = (termId: string) => {
    setSelectedTermIds((current) => current.filter((id) => id !== termId))
  }

  const moveTerm = (termId: string, direction: -1 | 1) => {
    setSelectedTermIds((current) => {
      const index = current.indexOf(termId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current

      const next = [...current]
      const [term] = next.splice(index, 1)
      next.splice(nextIndex, 0, term)
      return next
    })
  }

  const startTurn = () => {
    if (selectedTermIds.length !== termCount) {
      setMessage(`Select all ${termCount} terms in the order this team wants to present them.`)
      return
    }

    setCurrentTermIndex(0)
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
    setTermOutcomes({})
    setMessage("")
    setGamePhase("playing")
  }

  const completeTurn = useCallback((resolvedOutcomes: Record<string, TermOutcome> = termOutcomes) => {
    const review = buildTurnReview(orderedTerms, resolvedOutcomes) as TurnReviewItem[]
    const summary = summarizeTurnReview(review) as TurnReviewSummary
    const entry: TurnHistoryEntry = {
      id: `round-${currentRound}-team-${currentTeam}`,
      teamName: currentTeamName,
      roundLabel,
      review,
      summary,
    }

    setLastTurnReview(entry)
    setTurnHistory((current) => [...current, entry])
    setTermOutcomes({})
    setGamePhase("roundEnd")
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
  }, [currentRound, currentTeam, currentTeamName, orderedTerms, roundLabel, termOutcomes])

  const handleTimeExpired = useCallback(() => {
    if (gamePhase !== "playing") return

    const missedTerm = orderedTerms[currentTermIndex]
    const nextOutcomes = missedTerm
      ? { ...termOutcomes, [missedTerm.id]: "missed" as const }
      : termOutcomes

    if (currentTermIndex < orderedTerms.length - 1) {
      setTermOutcomes(nextOutcomes)
      setCurrentTermIndex((current) => current + 1)
      setTimeRemaining(ROUND_SECONDS)
      setBonusTime(0)
      return
    }

    completeTurn(nextOutcomes)
  }, [completeTurn, currentTermIndex, gamePhase, orderedTerms, termOutcomes])

  useEffect(() => {
    if (gamePhase !== "playing") return

    if (timeRemaining <= 0) {
      handleTimeExpired()
      return
    }

    const timeoutId = window.setTimeout(() => {
      setTimeRemaining((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [gamePhase, handleTimeExpired, timeRemaining])

  const handleCorrectAnswer = () => {
    if (!currentTerm) return

    const earnedBonus = timeRemaining
    const nextOutcomes = { ...termOutcomes, [currentTerm.id]: "correct" as const }

    setScores((current) => updateScore(current, currentTeam))
    setBonusTime(earnedBonus)

    if (currentTermIndex < orderedTerms.length - 1) {
      setTermOutcomes(nextOutcomes)
      setCurrentTermIndex((current) => current + 1)
      setTimeRemaining(ROUND_SECONDS + earnedBonus)
      return
    }

    completeTurn(nextOutcomes)
  }

  const continueToNextTeam = () => {
    if (isFinalScheduledTurn) {
      setGamePhase("end")
      return
    }

    const nextTurn = getNextTurnState({ currentTeam, teamCount, currentRound })
    setCurrentTeam(nextTurn.currentTeam)
    setCurrentRound(nextTurn.currentRound)
    buildTurnDeck()
  }

  const startNewGame = () => {
    setGamePhase("onboarding")
    setTeamCount(2)
    setTeamNames(["Team 1", "Team 2"])
    setRoundLimit(3)
    setHardcoreMode(false)
    setCurrentRound(1)
    setScores([0, 0])
    setCurrentTeam(0)
    setSelectedKinds(defaultCategories)
    setSelectedBodySystems(defaultBodySystems)
    setSelectedRegions(defaultRegions)
    setClueLevel("easy")
    setAnswerMode("host-judged")
    setCurrentDeck([])
    setSelectedSetupTermIds([])
    setExpandedRegionIds([])
    setUsedReshuffleKeys([])
    setSelectedTermIds([])
    setCurrentTermIndex(0)
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
    setTermOutcomes({})
    setLastTurnReview(null)
    setTurnHistory([])
    setSharedSession(null)
    setHostCredentials(null)
    setMessage("")
  }

  const createSharedGame = async () => {
    const trimmedNames = teamNames.slice(0, teamCount).map((name) => name.trim())
    if (trimmedNames.some((name) => !name)) {
      setMessage("Enter names for all teams before creating a shared game.")
      return
    }
    if (selectedKinds.length === 0 || selectedBodySystems.length === 0 || selectedRegions.length === 0) {
      setMessage("Choose at least one category, body system, and region before creating a shared game.")
      return
    }
    if (selectedSetupTermIds.length > 0 && selectedSetupTermIds.length < termCount) {
      setMessage(`Choose at least ${termCount} specific terms, or clear them to use the region pool.`)
      return
    }
    if (matchingTerms.length < termCount) {
      setMessage(`This selection has ${matchingTerms.length} matching terms. Choose at least ${termCount} terms before creating a shared game.`)
      return
    }

    setCreatingSharedGame(true)
    setMessage("")

    try {
      const response = await fetch("/api/anatomime/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            categories: selectedKinds,
            regions: selectedRegions,
            bodySystems: selectedBodySystems,
            clueLevel,
            answerMode,
            termCount,
            roundLimit,
            hardcoreMode,
            selectedCardIds: selectedSetupTermIds,
            roundSeconds: ROUND_SECONDS,
            teamNames: trimmedNames,
          },
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setMessage(payload.error ?? "Could not create shared game.")
        return
      }

      setTeamNames(trimmedNames)
      setSharedSession(payload.session)
      setHostCredentials({ playerId: payload.host.playerId, token: payload.host.token })
      setGamePhase("sharedHost")
      try {
        window.localStorage.setItem(`massagelab-anatomime-host:${payload.session.code}`, JSON.stringify(payload.host))
      } catch {
        // Hosting can continue even when browser storage is unavailable.
      }
    } catch {
      setMessage("Could not create shared game.")
    } finally {
      setCreatingSharedGame(false)
    }
  }

  const allRegionsSelected = selectedRegions.length === anatomyRegions.length
  const allBodySystemsSelected = selectedBodySystems.length === bodySystemOptions.length
  const gameStarted = gamePhase === "playing" || gamePhase === "roundEnd" || gamePhase === "end" || (gamePhase === "sharedHost" && sharedSession?.status !== "LOBBY")

  return (
    <div className="anatomime-page">
      <MovingBackground className="anatomime-background" testId="anatomime-moving-background" />
      <div className="anatomime-shell">
        {gamePhase === "onboarding" ? (
          <header className="anatomime-header">
            <div>
              <PageHeading>Anatomime</PageHeading>
              <p className="anatomime-subtitle">
                Classroom anatomy practice for teams. Choose anatomy categories, regions, and clue level, then race the timer.
              </p>
            </div>
          </header>
        ) : null}

        {message && gamePhase !== "selection" ? (
          <div className="anatomime-message" role="status">
            {message}
          </div>
        ) : null}

        {gamePhase === "onboarding" ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <h2>Teams</h2>
              <p>Set up the teams before choosing the anatomy deck.</p>
            </div>

            <div className="anatomime-control-group">
              <Label>Number of teams</Label>
              <div className="anatomime-segmented" role="group" aria-label="Number of teams">
                {TEAM_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="anatomime-choice-button"
                    data-selected={teamCount === option}
                    aria-pressed={teamCount === option}
                    onClick={() => setTeamCount(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="anatomime-team-grid">
              {teamNames.map((name, index) => (
                <div key={index} className="anatomime-control-group">
                  <Label htmlFor={`team-${index + 1}`}>Team {index + 1}</Label>
                  <Input
                    id={`team-${index + 1}`}
                    value={name}
                    onChange={(event) => {
                      const nextName = event.target.value
                      setTeamNames((current) => current.map((teamName, teamIndex) => (
                        teamIndex === index ? nextName : teamName
                      )))
                    }}
                    className="anatomime-input"
                  />
                </div>
              ))}
            </div>

            <div className="anatomime-round-panel">
              <div className="anatomime-section-heading compact">
                <div>
                  <h3>Rounds</h3>
                  <p>Pick a fixed number of full team cycles, or keep the game open-ended.</p>
                </div>
                <button
                  type="button"
                  className="anatomime-hardcore-button"
                  data-selected={hardcoreMode}
                  aria-pressed={hardcoreMode}
                  onClick={() => setHardcoreMode((current) => !current)}
                >
                  Hardcore Mode
                </button>
              </div>

              <div className="anatomime-round-control" data-disabled={hardcoreMode}>
                <output className="anatomime-round-dial" htmlFor="round-limit">
                  {hardcoreMode ? "HC" : roundLimit}
                </output>
                <div className="anatomime-control-group">
                  <Label htmlFor="round-limit">Number of rounds</Label>
                  <input
                    id="round-limit"
                    type="range"
                    min="1"
                    max="12"
                    value={roundLimit}
                    disabled={hardcoreMode}
                    onChange={(event) => setRoundLimit(normalizeRoundLimit(event.target.value))}
                    className="anatomime-round-slider"
                  />
                </div>
              </div>
            </div>

            <div className="anatomime-actions">
              <button type="button" className="anatomime-primary-button" onClick={startGameSetup}>
                <Play className="h-4 w-4" />
                Choose Anatomy Terms
              </button>
              <Link className="anatomime-secondary-button" href="/anatomime/join">
                <LogIn className="h-4 w-4" />
                Join Shared Game
              </Link>
            </div>
          </section>
        ) : null}

        {gamePhase === "selection" ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <h2>Deck</h2>
              <p>{matchingTerms.length} matching terms. Each round uses {termCount} terms.</p>
            </div>

            <div className="anatomime-grid-2">
              <div className="anatomime-control-group anatomime-filter-group">
                <Label>Anatomy filters</Label>
                <div className="anatomime-filter-columns">
                  <div className="anatomime-filter-column">
                    <span className="anatomime-filter-label">Categories</span>
                    <div className="anatomime-segmented" role="group" aria-label="Categories">
                      {kindOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="anatomime-choice-button"
                          data-selected={selectedKinds.includes(option.id)}
                          aria-pressed={selectedKinds.includes(option.id)}
                          onClick={() => setSelectedKinds((current) => toggleValue(current, option.id))}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="anatomime-filter-column">
                    <div className="anatomime-filter-toolbar">
                      <span className="anatomime-filter-label">Body systems</span>
                      <button
                        type="button"
                        className="anatomime-mini-button"
                        onClick={() => setSelectedBodySystems(allBodySystemsSelected ? [] : defaultBodySystems)}
                      >
                        {allBodySystemsSelected ? "Clear" : "All"}
                      </button>
                    </div>
                    <div className="anatomime-segmented" role="group" aria-label="Body systems">
                      {bodySystemOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="anatomime-choice-button"
                          data-selected={selectedBodySystems.includes(option.id)}
                          aria-pressed={selectedBodySystems.includes(option.id)}
                          onClick={() => setSelectedBodySystems((current) => toggleValue(current, option.id))}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="anatomime-control-group">
                <Label>Difficulty</Label>
                <div className="anatomime-segmented" role="group" aria-label="Difficulty">
                  {CLUE_LEVELS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="anatomime-choice-button"
                      data-selected={clueLevel === option}
                      aria-pressed={clueLevel === option}
                      onClick={() => setClueLevel(option)}
                    >
                      {clueLevelLabels[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="anatomime-control-group">
                <Label>Shared answer mode</Label>
                <div className="anatomime-segmented" role="group" aria-label="Shared answer mode">
                  {setupAnswerModes.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="anatomime-choice-button"
                      data-selected={answerMode === option}
                      aria-pressed={answerMode === option}
                      onClick={() => setAnswerMode(option)}
                    >
                      {answerModeLabels[option]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="anatomime-section-heading compact">
              <div>
                <h3>Regions and terms</h3>
                <p>{selectedSetupTermIds.length > 0 ? `${selectedSetupTermIds.length} terms selected. Each turn uses ${termCount}.` : "Choose regions, or expand a region to pick exact terms."}</p>
              </div>
              <div className="anatomime-selection-toolbar">
                {selectedSetupTermIds.length > 0 ? (
                  <button
                    type="button"
                    className="anatomime-secondary-button"
                    onClick={() => setSelectedSetupTermIds([])}
                  >
                    Clear Terms
                  </button>
                ) : null}
                <button
                  type="button"
                  className="anatomime-secondary-button"
                  onClick={() => setSelectedRegions(allRegionsSelected ? [] : defaultRegions)}
                >
                  {allRegionsSelected ? "Clear Regions" : "Select Regions"}
                </button>
              </div>
            </div>

            <div className="anatomime-region-list">
              {anatomyRegions.map((region) => {
                const regionTerms = termsByRegion.get(region.id) ?? []
                const regionTermIds = regionTerms.map((term) => term.id)
                const selectedRegionTerms = selectedSetupTerms.filter((term) => term.regions.includes(region.id))
                const allRegionTermsSelected = regionTermIds.length > 0 && regionTermIds.every((termId) => selectedSetupTermIds.includes(termId))
                const isRegionSelected = selectedRegions.includes(region.id)
                const isExpanded = expandedRegionIds.includes(region.id)

                return (
                  <article key={region.id} className="anatomime-region-card" data-selected={isRegionSelected}>
                    <div className="anatomime-region-card-header">
                      <button
                        type="button"
                        className="anatomime-region-button"
                        data-selected={allRegionTermsSelected || isRegionSelected}
                        aria-pressed={allRegionTermsSelected}
                        onClick={() => toggleRegionTermPool(region.id, regionTerms)}
                      >
                        <span>{region.label}</span>
                        <small>
                          {regionTerms.length} matching
                          {selectedRegionTerms.length > 0 ? ` · ${selectedRegionTerms.length} selected` : ""}
                        </small>
                      </button>
                      <button
                        type="button"
                        className="anatomime-icon-button"
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${region.label} terms`}
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpandedRegion(region.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="anatomime-region-term-grid">
                        {regionTerms.length > 0 ? regionTerms.map((term) => {
                          const isSelected = selectedSetupTermIds.includes(term.id)

                          return (
                            <button
                              key={term.id}
                              type="button"
                              className="anatomime-term-card"
                              data-selected={isSelected}
                              aria-pressed={isSelected}
                              onClick={() => toggleSetupTerm(term)}
                            >
                              <span>{term.name}</span>
                              <small>{formatTermKind(term.kind)} · {difficultyLabels[term.difficulty]}</small>
                            </button>
                          )
                        }) : (
                          <p className="anatomime-empty-state">No matching terms for this region.</p>
                        )}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>

            <div className="anatomime-actions">
              <button type="button" className="anatomime-secondary-button" onClick={() => setGamePhase("onboarding")}>
                Back
              </button>
              <button type="button" className="anatomime-primary-button" onClick={continueToSetup}>
                Continue
              </button>
              <button type="button" className="anatomime-secondary-button" onClick={createSharedGame} disabled={creatingSharedGame}>
                <Users className="h-4 w-4" />
                {creatingSharedGame ? "Creating..." : "Create Shared Game"}
              </button>
            </div>
            {message ? (
              <div className="anatomime-message" role="status">
                {message}
              </div>
            ) : null}
          </section>
        ) : null}

        {gamePhase === "setup" ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <div>
                <h2>{currentTeamName}&apos;s terms</h2>
                <p>{roundLabel}. Select the {termCount} terms in presentation order.</p>
              </div>
              <button type="button" className="anatomime-secondary-button" onClick={reshuffleCurrentTurn} disabled={reshuffleUsed}>
                <RotateCcw className="h-4 w-4" />
                {reshuffleUsed ? "Reshuffle Used" : "Reshuffle"}
              </button>
            </div>

            <div className="anatomime-setup-grid">
              <div className="anatomime-list-column">
                <h3>Available</h3>
                <div className="anatomime-term-grid">
                  {currentDeck.map((term) => {
                    const isSelected = selectedTermIds.includes(term.id)

                    return (
                      <button
                        key={term.id}
                        type="button"
                        className="anatomime-term-card"
                        data-selected={isSelected}
                        disabled={isSelected}
                        onClick={() => addTerm(term.id)}
                      >
                        <span>{term.name}</span>
                        <small>{formatTermKind(term.kind)} · {difficultyLabels[term.difficulty]}</small>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="anatomime-list-column">
                <h3>Presentation order</h3>
                <ol className="anatomime-ordered-list">
                  {orderedTerms.map((term, index) => (
                    <li key={term.id}>
                      <span className="anatomime-order-number">{index + 1}</span>
                      <span className="anatomime-order-name">{term.name}</span>
                      <div className="anatomime-order-controls">
                        <button type="button" aria-label={`Move ${term.name} up`} onClick={() => moveTerm(term.id, -1)} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label={`Move ${term.name} down`} onClick={() => moveTerm(term.id, 1)} disabled={index === orderedTerms.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label={`Remove ${term.name}`} onClick={() => removeTerm(term.id)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="anatomime-actions">
              <button type="button" className="anatomime-secondary-button" onClick={() => setGamePhase("selection")}>
                Back
              </button>
              <button
                type="button"
                className="anatomime-primary-button"
                onClick={startTurn}
                disabled={selectedTermIds.length !== termCount}
              >
                <Play className="h-4 w-4" />
                Start Turn
              </button>
            </div>
          </section>
        ) : null}

        {gamePhase === "sharedHost" && sharedSession && hostCredentials ? (
          <HostRoomClient
            initialSession={sharedSession}
            credentials={hostCredentials}
            onSessionChange={setSharedSession}
            onResetLocalGame={startNewGame}
          />
        ) : null}

        {gamePhase === "playing" ? (
          <section className="anatomime-panel anatomime-play-panel">
            <div className="anatomime-score-grid">
              {teamNames.map((teamName, index) => (
                <div key={teamName} className="anatomime-score" data-active={currentTeam === index}>
                  <span>{teamName}</span>
                  <strong>{scores[index]}</strong>
                </div>
              ))}
            </div>

            <div className="anatomime-timer">{formatTime(timeRemaining)}</div>

            <div className="anatomime-current-term">
              {promptVisibility.showProgress ? <span>{currentTermIndex + 1} of {orderedTerms.length}</span> : null}
              <h2>{currentTerm?.name}</h2>
              {currentTermMedia && promptVisibility.showMedia ? (
                <figure className="anatomime-current-media">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Reviewed anatomy media URLs are dynamic external study assets. */}
                  <img src={currentTermMedia.url} alt={currentTermMedia.title} loading="lazy" referrerPolicy="no-referrer" />
                </figure>
              ) : null}
              {currentTerm && promptVisibility.showMetadata ? (
                <p>
                  {formatTermKind(currentTerm.kind)} · {currentTerm.regions.map(regionLabel).join(", ")} · {difficultyLabels[currentTerm.difficulty]}
                </p>
              ) : null}
              {currentTerm?.definition && promptVisibility.showHint ? <small>{currentTerm.definition}</small> : null}
              {bonusTime > 0 && promptVisibility.showBonus ? <em>Bonus time applied: {bonusTime}s</em> : null}
            </div>

            <div className="anatomime-actions">
              <button type="button" className="anatomime-primary-button" onClick={handleCorrectAnswer}>
                <CheckCircle2 className="h-4 w-4" />
                Got It
              </button>
              <button type="button" className="anatomime-secondary-button" onClick={() => completeTurn()}>
                <SkipForward className="h-4 w-4" />
                Next Team
              </button>
              {showManualEndGame ? (
                <button type="button" className="anatomime-danger-button" onClick={() => setGamePhase("end")}>
                  End Game
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {gamePhase === "roundEnd" ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading centered">
              <h2>Turn complete</h2>
              <p>{currentTeamName} scored {scores[currentTeam]} total points. {roundLabel}.</p>
            </div>

            <div className="anatomime-score-grid">
              {teamNames.map((teamName, index) => (
                <div key={teamName} className="anatomime-score" data-active={currentTeam === index}>
                  <span>{teamName}</span>
                  <strong>{scores[index]}</strong>
                </div>
              ))}
            </div>

            {lastTurnReview ? (
              <div className="anatomime-learning-review">
                <div className="anatomime-section-heading compact">
                  <div>
                    <h3>Turn review</h3>
                    <p>
                      {lastTurnReview.teamName}: {lastTurnReview.summary.correct} got,{" "}
                      {lastTurnReview.summary.missed} missed, {lastTurnReview.summary.skipped} skipped.
                    </p>
                  </div>
                </div>
                <LearningReviewList review={lastTurnReview.review} />
              </div>
            ) : null}

            <div className="anatomime-actions">
              {!isFinalScheduledTurn && showManualEndGame ? (
                <button type="button" className="anatomime-danger-button" onClick={() => setGamePhase("end")}>
                  End Game
                </button>
              ) : null}
              <button
                type="button"
                className="anatomime-primary-button"
                onClick={isFinalScheduledTurn ? () => setGamePhase("end") : continueToNextTeam}
              >
                {isFinalScheduledTurn
                  ? "View Final Scores"
                  : currentTeam === teamCount - 1
                    ? "Start Next Round"
                    : `${teamNames[getNextTeamIndex(currentTeam, teamCount)]}'s Turn`}
              </button>
            </div>
          </section>
        ) : null}

        {gamePhase === "end" ? (
          <section className="anatomime-panel anatomime-final">
            <Trophy className="h-12 w-12" />
            <h2>{winnerNames.length > 1 ? "Tie Game" : `${winnerNames[0]} Wins`}</h2>
            <div className="anatomime-score-grid">
              {teamNames.map((teamName, index) => (
                <div key={teamName} className="anatomime-score" data-active={winnerNames.includes(teamName)}>
                  <span>{teamName}</span>
                  <strong>{scores[index]}</strong>
                </div>
              ))}
            </div>
            {learningRecap.length > 0 ? (
              <div className="anatomime-learning-review">
                <div className="anatomime-section-heading compact centered">
                  <div>
                    <h3>Learning recap</h3>
                    <p>Review the terms with misses or skips before the next game.</p>
                  </div>
                </div>
                <div className="anatomime-recap-grid">
                  {learningRecap.slice(0, 6).map((entry) => (
                    <article key={entry.term.id} className="anatomime-recap-card">
                      <strong>{entry.term.name}</strong>
                      <span>
                        {entry.correct} got · {entry.missed} missed · {entry.skipped} skipped
                      </span>
                      {entry.term.definition ? <p>{entry.term.definition}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <button type="button" className="anatomime-primary-button" onClick={startNewGame}>
              Play Again
            </button>
          </section>
        ) : null}

        <details className="anatomime-game-info" suppressHydrationWarning>
          <summary>Game info</summary>
          <dl>
            {gameStarted ? (
              <div>
                <dt>Round</dt>
                <dd>{roundLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>Terms per round</dt>
              <dd>{termCount} terms</dd>
            </div>
            <div>
              <dt>Turns</dt>
              <dd>{ROUND_SECONDS}s turns</dd>
            </div>
            {sharedSession ? (
              <>
                <div>
                  <dt>Join code</dt>
                  <dd>{sharedSession.code}</dd>
                </div>
                <div>
                  <dt>Join page</dt>
                  <dd>/anatomime/join</dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>Teams</dt>
              <dd>{teamCount}</dd>
            </div>
            <div>
              <dt>Rounds</dt>
              <dd>{hardcoreMode ? "Hardcore" : roundLimit}</dd>
            </div>
          </dl>
        </details>

        <footer className="anatomime-sources">
          <details>
            <summary>Sources and attribution</summary>
            <ul>
              {anatomySources.map((source) => (
                <li key={source.id}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                  ) : (
                    <span>{source.label}</span>
                  )}
                  {source.license ? <span> · {source.license}</span> : null}
                  <p>{source.attribution}</p>
                </li>
              ))}
            </ul>
          </details>
        </footer>
      </div>
    </div>
  )
}
