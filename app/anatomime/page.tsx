"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, CheckCircle2, Copy, Play, RefreshCw, RotateCcw, SkipForward, Trophy, Users, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { MovingBackground } from "@/components/moving-background"
import {
  ANATOMY_STUDY_DIFFICULTIES,
  type AnatomyStudyCategory,
  type AnatomyStudyDifficulty,
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
import "./styles.css"

type AnatomyKind = AnatomyStudyCategory
type AnatomyDifficulty = AnatomyStudyDifficulty

type AnatomyTerm = {
  id: string
  name: string
  kind: AnatomyKind
  category: AnatomyKind
  categoryLabel: string
  regions: string[]
  regionLabels: string[]
  difficulty: AnatomyDifficulty
  aliases: string[]
  definition?: string
  sourceRefs: string[]
}

type GamePhase = "onboarding" | "selection" | "setup" | "playing" | "roundEnd" | "end" | "sharedHost"
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

const TERM_COUNT = 4
const ROUND_SECONDS = 30
const TEAM_OPTIONS = [2, 3, 4]

const setupOptions = getAnatomimeSetupOptions()
const kindOptions = setupOptions.categories as Array<{ id: AnatomyKind; label: string; termCount: number }>
const anatomyRegions = setupOptions.regions
const anatomySources = setupOptions.sources
const defaultCategories = kindOptions.map((option) => option.id)
const defaultRegions = anatomyRegions.map((region) => region.id)

const difficultyLabels: Record<AnatomyDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const answerModeLabels: Record<AnatomimeAnswerMode, string> = {
  typed: "Typed",
  "multiple-choice": "Multiple Choice",
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

export default function AnatomimePage() {
  const [gamePhase, setGamePhase] = useState<GamePhase>("onboarding")
  const [teamCount, setTeamCount] = useState(2)
  const [teamNames, setTeamNames] = useState(["Team 1", "Team 2"])
  const [roundLimit, setRoundLimit] = useState(3)
  const [hardcoreMode, setHardcoreMode] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [scores, setScores] = useState([0, 0])
  const [currentTeam, setCurrentTeam] = useState(0)
  const [selectedKinds, setSelectedKinds] = useState<AnatomyKind[]>(defaultCategories)
  const [selectedRegions, setSelectedRegions] = useState<string[]>(defaultRegions)
  const [difficulty, setDifficulty] = useState<AnatomyDifficulty>("easy")
  const [termCount, setTermCount] = useState(TERM_COUNT)
  const [answerMode, setAnswerMode] = useState<AnatomimeAnswerMode>("typed")
  const [currentDeck, setCurrentDeck] = useState<AnatomyTerm[]>([])
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([])
  const [currentTermIndex, setCurrentTermIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(ROUND_SECONDS)
  const [bonusTime, setBonusTime] = useState(0)
  const [message, setMessage] = useState("")
  const [termOutcomes, setTermOutcomes] = useState<Record<string, TermOutcome>>({})
  const [lastTurnReview, setLastTurnReview] = useState<TurnHistoryEntry | null>(null)
  const [turnHistory, setTurnHistory] = useState<TurnHistoryEntry[]>([])
  const [sharedSession, setSharedSession] = useState<any | null>(null)
  const [hostCredentials, setHostCredentials] = useState<{ playerId: string; token: string } | null>(null)
  const [creatingSharedGame, setCreatingSharedGame] = useState(false)
  const [startingSharedGame, setStartingSharedGame] = useState(false)
  const sharedRefreshInFlightRef = useRef(false)
  const sharedRefreshRequestIdRef = useRef(0)

  useEffect(() => {
    setTeamNames((current) => normalizeTeamNames(current, teamCount))
    setScores((current) => Array.from({ length: teamCount }, (_, index) => current[index] ?? 0))
  }, [teamCount])

  const matchingTerms = useMemo(() => (
    getAnatomimeCandidateCards(normalizeAnatomimeSessionConfig({
      categories: selectedKinds,
      regions: selectedRegions,
      difficulty,
      termCount,
    })).map(anatomimeTermFromCard) as AnatomyTerm[]
  ), [difficulty, selectedKinds, selectedRegions, termCount])

  const orderedTerms = useMemo(() => (
    selectedTermIds
      .map((termId) => currentDeck.find((term) => term.id === termId))
      .filter((term): term is AnatomyTerm => Boolean(term))
  ), [currentDeck, selectedTermIds])

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
  const promptVisibility = getPromptVisibility(difficulty)
  const roundLabel = getRoundLabel({ hardcoreMode, currentRound, roundLimit })
  const learningRecap = useMemo(() => getGameLearningRecap(turnHistory) as LearningRecapItem[], [turnHistory])

  const buildTurnDeck = useCallback(() => {
    const deck = createAnatomimeSessionDeck({
      categories: selectedKinds,
      regions: selectedRegions,
      difficulty,
      termCount,
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
  }, [difficulty, selectedKinds, selectedRegions, termCount])

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
    setMessage("")
    setGamePhase("selection")
  }

  const continueToSetup = () => {
    if (selectedKinds.length === 0) {
      setMessage("Choose at least one anatomy category.")
      return
    }
    if (selectedRegions.length === 0) {
      setMessage("Choose at least one body region.")
      return
    }
    if (matchingTerms.length < termCount) {
      setMessage(`This selection has ${matchingTerms.length} matching terms. Choose at least ${termCount} terms by adding regions, categories, or difficulty.`)
      return
    }

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
    setSelectedRegions(defaultRegions)
    setDifficulty("easy")
    setTermCount(TERM_COUNT)
    setAnswerMode("typed")
    setCurrentDeck([])
    setSelectedTermIds([])
    setCurrentTermIndex(0)
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
    setTermOutcomes({})
    setLastTurnReview(null)
    setTurnHistory([])
    setSharedSession(null)
    setHostCredentials(null)
    setStartingSharedGame(false)
    setMessage("")
  }

  const sharedViewerHeaders = useMemo(() => (
    hostCredentials
      ? {
        "x-anatomime-player-id": hostCredentials.playerId,
        "x-anatomime-player-token": hostCredentials.token,
      }
      : undefined
  ), [hostCredentials])

  const refreshSharedSession = useCallback(async () => {
    if (!sharedSession || sharedRefreshInFlightRef.current) return

    const requestId = sharedRefreshRequestIdRef.current + 1
    sharedRefreshRequestIdRef.current = requestId
    sharedRefreshInFlightRef.current = true

    try {
      const response = await fetch(`/api/anatomime/sessions/${sharedSession.code}`, {
        cache: "no-store",
        headers: sharedViewerHeaders,
      })
      const payload = await response.json().catch(() => ({}))
      if (requestId !== sharedRefreshRequestIdRef.current) return
      if (response.ok) {
        setSharedSession(payload.session)
      } else {
        setMessage(payload.error ?? "Could not refresh shared game.")
      }
    } catch {
      if (requestId === sharedRefreshRequestIdRef.current) {
        setMessage("Could not refresh shared game.")
      }
    } finally {
      sharedRefreshInFlightRef.current = false
    }
  }, [sharedSession, sharedViewerHeaders])

  useEffect(() => {
    if (gamePhase !== "sharedHost" || !sharedSession) return
    const timer = window.setInterval(() => {
      void refreshSharedSession()
    }, 1500)

    return () => window.clearInterval(timer)
  }, [gamePhase, refreshSharedSession, sharedSession])

  const createSharedGame = async () => {
    const trimmedNames = teamNames.slice(0, teamCount).map((name) => name.trim())
    if (trimmedNames.some((name) => !name)) {
      setMessage("Enter names for all teams before creating a shared game.")
      return
    }
    if (selectedKinds.length === 0 || selectedRegions.length === 0) {
      setMessage("Choose at least one category and one region before creating a shared game.")
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
            difficulty,
            answerMode,
            termCount,
            roundSeconds: ROUND_SECONDS,
            stealSeconds: 8,
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
      window.localStorage.setItem(`massagelab-anatomime-host:${payload.session.code}`, JSON.stringify(payload.host))
      setGamePhase("sharedHost")
    } catch {
      setMessage("Could not create shared game.")
    } finally {
      setCreatingSharedGame(false)
    }
  }

  const startSharedGame = async () => {
    if (!sharedSession || !hostCredentials) return

    setStartingSharedGame(true)
    setMessage("Starting shared game...")

    try {
      const response = await fetch(`/api/anatomime/sessions/${sharedSession.code}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anatomime-player-id": hostCredentials.playerId,
          "x-anatomime-player-token": hostCredentials.token,
        },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? "Could not start shared game.")
        return
      }

      setSharedSession(payload.session)
      setMessage("")
    } catch {
      setMessage("Could not start shared game.")
    } finally {
      setStartingSharedGame(false)
    }
  }

  const copyJoinLink = async () => {
    if (!sharedSession) return
    const href = `${window.location.origin}/anatomime/play/${sharedSession.code}`
    if (!window.navigator.clipboard) {
      setMessage("Failed to copy join link.")
      return
    }

    try {
      await window.navigator.clipboard.writeText(href)
      setMessage("Join link copied.")
    } catch {
      setMessage("Failed to copy join link.")
    }
  }

  const allRegionsSelected = selectedRegions.length === anatomyRegions.length

  return (
    <div className="anatomime-page">
      <MovingBackground className="anatomime-background" testId="anatomime-moving-background" />
      <div className="anatomime-shell">
        <header className="anatomime-header">
          <div>
            <PageHeading>Anatomime</PageHeading>
            <p className="anatomime-subtitle">
              Classroom anatomy practice for teams. Choose anatomy categories, regions, and difficulty, then race the timer.
            </p>
          </div>
          <div className="anatomime-status">
            <span>{roundLabel}</span>
            <span>{matchingTerms.length} matching terms</span>
            <span>{termCount} per game</span>
            <span>{difficultyLabels[difficulty]}</span>
          </div>
        </header>

        {message ? (
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

            <button type="button" className="anatomime-primary-button" onClick={startGameSetup}>
              <Play className="h-4 w-4" />
              Choose Anatomy Terms
            </button>
          </section>
        ) : null}

        {gamePhase === "selection" ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <h2>Deck</h2>
              <p>Term difficulty controls which terms are eligible for the round.</p>
            </div>

            <div className="anatomime-grid-2">
              <div className="anatomime-control-group">
                <Label>Categories</Label>
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

              <div className="anatomime-control-group">
                <Label>Difficulty</Label>
                <div className="anatomime-segmented" role="group" aria-label="Difficulty">
                  {ANATOMY_STUDY_DIFFICULTIES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="anatomime-choice-button"
                      data-selected={difficulty === option}
                      aria-pressed={difficulty === option}
                      onClick={() => setDifficulty(option)}
                    >
                      {difficultyLabels[option]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="anatomime-grid-2">
              <div className="anatomime-control-group">
                <Label htmlFor="term-count">Deck size</Label>
                <div className="anatomime-round-control">
                  <output className="anatomime-round-dial" htmlFor="term-count">{termCount}</output>
                  <input
                    id="term-count"
                    type="range"
                    min="4"
                    max="24"
                    value={termCount}
                    onChange={(event) => setTermCount(Number(event.target.value))}
                    className="anatomime-round-slider"
                  />
                </div>
              </div>

              <div className="anatomime-control-group">
                <Label>Shared answer mode</Label>
                <div className="anatomime-segmented" role="group" aria-label="Shared answer mode">
                  {(["typed", "multiple-choice"] as AnatomimeAnswerMode[]).map((option) => (
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
              <h3>Regions</h3>
              <button
                type="button"
                className="anatomime-secondary-button"
                onClick={() => setSelectedRegions(allRegionsSelected ? [] : defaultRegions)}
              >
                {allRegionsSelected ? "Clear All" : "Select All"}
              </button>
            </div>

            <div className="anatomime-region-grid">
              {anatomyRegions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  className="anatomime-region-button"
                  data-selected={selectedRegions.includes(region.id)}
                  aria-pressed={selectedRegions.includes(region.id)}
                  onClick={() => setSelectedRegions((current) => toggleValue(current, region.id))}
                >
                  <span>{region.label}</span>
                  <small>{region.termCount} terms</small>
                </button>
              ))}
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
          </section>
        ) : null}

        {gamePhase === "setup" ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <div>
                <h2>{currentTeamName}&apos;s terms</h2>
                <p>{roundLabel}. Select the {termCount} terms in presentation order.</p>
              </div>
              <button type="button" className="anatomime-secondary-button" onClick={buildTurnDeck}>
                <RotateCcw className="h-4 w-4" />
                Reshuffle
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
                        <small>{formatTermKind(term.kind)} · {term.difficulty}</small>
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

        {gamePhase === "sharedHost" && sharedSession ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <div>
                <h2>Shared game {sharedSession.code}</h2>
                <p>Players join at /anatomime/play/{sharedSession.code} and pick a team from their own device.</p>
              </div>
              <div className="anatomime-status">
                <span>{sharedSession.status}</span>
                <span>{sharedSession.phase}</span>
                <span>{sharedSession.players.filter((player: any) => player.role === "PLAYER").length} players</span>
              </div>
            </div>

            <div className="anatomime-actions">
              <a className="anatomime-secondary-button" href={`/anatomime/play/${sharedSession.code}`}>
                Join Page
              </a>
              <button type="button" className="anatomime-secondary-button" onClick={copyJoinLink}>
                <Copy className="h-4 w-4" />
                Copy Link
              </button>
              <button type="button" className="anatomime-secondary-button" onClick={() => refreshSharedSession()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              {sharedSession.status === "LOBBY" ? (
                <button type="button" className="anatomime-primary-button" onClick={startSharedGame} disabled={startingSharedGame}>
                  <Play className="h-4 w-4" />
                  {startingSharedGame ? "Starting..." : "Start Shared Game"}
                </button>
              ) : null}
            </div>

            <div className="anatomime-score-grid">
              {sharedSession.teams.map((team: any) => (
                <div key={team.id} className="anatomime-score" data-active={sharedSession.activeTeam?.id === team.id}>
                  <span>{team.name}</span>
                  <strong>{team.score}</strong>
                </div>
              ))}
            </div>

            {sharedSession.status === "LOBBY" ? (
              <div className="anatomime-setup-grid">
                {sharedSession.teams.map((team: any) => (
                  <div key={team.id} className="anatomime-list-column">
                    <h3>{team.name}</h3>
                    <div className="anatomime-review-list">
                      {sharedSession.players
                        .filter((player: any) => player.role === "PLAYER" && player.teamId === team.id)
                        .map((player: any) => (
                          <article key={player.id} className="anatomime-review-card">
                            <strong>{player.displayName}</strong>
                            <p className="anatomime-review-meta">{player.signedIn ? "Signed in" : "Guest"}</p>
                          </article>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {sharedSession.status === "PLAYING" && sharedSession.activeItem ? (
              <div className="anatomime-current-term">
                <span>
                  {sharedSession.activeItem.index + 1} of {sharedSession.activeItem.total} · {sharedSession.activeTeam?.name}
                </span>
                <h2>{sharedSession.activeItem.prompt.name}</h2>
                <p>
                  {sharedSession.activeItem.prompt.categoryLabel} · {sharedSession.activeItem.prompt.regionLabels?.join(", ")} · {sharedSession.activeItem.prompt.difficulty}
                </p>
                {sharedSession.activeItem.prompt.definition ? <small>{sharedSession.activeItem.prompt.definition}</small> : null}
              </div>
            ) : null}

            {sharedSession.status === "COMPLETED" ? (
              <div className="anatomime-current-term">
                <h2>Game complete</h2>
                <p>Final scores are ready. Signed-in correct guesses have been counted toward learning progress.</p>
              </div>
            ) : null}
          </section>
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
