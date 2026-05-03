"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, CheckCircle2, Play, RotateCcw, SkipForward, Trophy, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { MovingBackground } from "@/components/moving-background"
import {
  ANATOMY_DIFFICULTIES,
  createAnatomimeDeck,
  getAnatomyRegions,
  getAnatomySources,
  getAnatomyTerms,
} from "@/lib/anatomy"
import {
  canEndGameAfterCurrentTurn,
  getNextTeamIndex,
  getNextTurnState,
  getPromptVisibility,
  getRoundLabel,
  getWinnerNames,
  isScheduledGameComplete,
  normalizeTeamNames,
  normalizeRoundLimit,
  updateScore,
} from "@/lib/anatomime-game"
import "./styles.css"

type AnatomyKind = "bone" | "muscle"
type AnatomyDifficulty = "easy" | "medium" | "hard"

type AnatomyTerm = {
  id: string
  name: string
  kind: AnatomyKind
  regions: string[]
  difficulty: AnatomyDifficulty
  aliases: string[]
  definition?: string
  sourceRefs: string[]
}

type GamePhase = "onboarding" | "selection" | "setup" | "playing" | "roundEnd" | "end"

const TERM_COUNT = 4
const ROUND_SECONDS = 30
const TEAM_OPTIONS = [2, 3, 4]

const kindOptions: Array<{ id: AnatomyKind; label: string }> = [
  { id: "bone", label: "Bones" },
  { id: "muscle", label: "Muscles" },
]

const difficultyLabels: Record<AnatomyDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const anatomyRegions = getAnatomyRegions()
const anatomySources = getAnatomySources()

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

function formatTermKind(kind: AnatomyKind) {
  return kind === "bone" ? "Bone" : "Muscle"
}

function regionLabel(regionId: string) {
  return anatomyRegions.find((region) => region.id === regionId)?.label ?? regionId
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
  const [selectedKinds, setSelectedKinds] = useState<AnatomyKind[]>(["bone", "muscle"])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<AnatomyDifficulty>("easy")
  const [currentDeck, setCurrentDeck] = useState<AnatomyTerm[]>([])
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([])
  const [currentTermIndex, setCurrentTermIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(ROUND_SECONDS)
  const [bonusTime, setBonusTime] = useState(0)
  const [message, setMessage] = useState("")

  useEffect(() => {
    setTeamNames((current) => normalizeTeamNames(current, teamCount))
    setScores((current) => Array.from({ length: teamCount }, (_, index) => current[index] ?? 0))
  }, [teamCount])

  const matchingTerms = useMemo(() => (
    getAnatomyTerms({
      kinds: selectedKinds,
      regions: selectedRegions,
      difficulty,
    }) as AnatomyTerm[]
  ), [difficulty, selectedKinds, selectedRegions])

  const orderedTerms = useMemo(() => (
    selectedTermIds
      .map((termId) => currentDeck.find((term) => term.id === termId))
      .filter((term): term is AnatomyTerm => Boolean(term))
  ), [currentDeck, selectedTermIds])

  const currentTerm = orderedTerms[currentTermIndex]
  const currentTeamName = teamNames[currentTeam] ?? `Team ${currentTeam + 1}`
  const winnerNames = getWinnerNames(scores, teamNames)
  const canEndGame = canEndGameAfterCurrentTurn(scores, currentTeam, TERM_COUNT)
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

  const buildTurnDeck = useCallback(() => {
    const deck = createAnatomimeDeck({
      kinds: selectedKinds,
      regions: selectedRegions,
      difficulty,
      count: TERM_COUNT,
    }) as AnatomyTerm[]

    setCurrentDeck(deck)
    setSelectedTermIds([])
    setCurrentTermIndex(0)
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
    setMessage("")
    setGamePhase("setup")
  }, [difficulty, selectedKinds, selectedRegions])

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
      setMessage("Choose bones, muscles, or both.")
      return
    }
    if (selectedRegions.length === 0) {
      setMessage("Choose at least one body region.")
      return
    }
    if (matchingTerms.length < TERM_COUNT) {
      setMessage(`This selection has ${matchingTerms.length} matching terms. Choose at least ${TERM_COUNT} terms by adding regions, categories, or difficulty.`)
      return
    }

    buildTurnDeck()
  }

  const addTerm = (termId: string) => {
    setSelectedTermIds((current) => {
      if (current.includes(termId) || current.length >= TERM_COUNT) return current
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
    if (selectedTermIds.length !== TERM_COUNT) {
      setMessage(`Select all ${TERM_COUNT} terms in the order this team wants to present them.`)
      return
    }

    setCurrentTermIndex(0)
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
    setMessage("")
    setGamePhase("playing")
  }

  const endTurn = useCallback(() => {
    setGamePhase("roundEnd")
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
  }, [])

  const handleTimeExpired = useCallback(() => {
    if (gamePhase !== "playing") return

    if (currentTermIndex < orderedTerms.length - 1) {
      setCurrentTermIndex((current) => current + 1)
      setTimeRemaining(ROUND_SECONDS)
      setBonusTime(0)
      return
    }

    endTurn()
  }, [currentTermIndex, endTurn, gamePhase, orderedTerms.length])

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
    const earnedBonus = timeRemaining
    setScores((current) => updateScore(current, currentTeam))
    setBonusTime(earnedBonus)

    if (currentTermIndex < orderedTerms.length - 1) {
      setCurrentTermIndex((current) => current + 1)
      setTimeRemaining(ROUND_SECONDS + earnedBonus)
      return
    }

    endTurn()
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
    setSelectedKinds(["bone", "muscle"])
    setSelectedRegions([])
    setDifficulty("easy")
    setCurrentDeck([])
    setSelectedTermIds([])
    setCurrentTermIndex(0)
    setTimeRemaining(ROUND_SECONDS)
    setBonusTime(0)
    setMessage("")
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
              Classroom anatomy practice for teams. Choose bones, muscles, regions, and difficulty, then race the timer.
            </p>
          </div>
          <div className="anatomime-status">
            <span>{roundLabel}</span>
            <span>{matchingTerms.length} matching terms</span>
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
                <Label>Term types</Label>
                <div className="anatomime-segmented" role="group" aria-label="Term types">
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
                  {ANATOMY_DIFFICULTIES.map((option) => (
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

            <div className="anatomime-section-heading compact">
              <h3>Regions</h3>
              <button
                type="button"
                className="anatomime-secondary-button"
                onClick={() => setSelectedRegions(allRegionsSelected ? [] : anatomyRegions.map((region) => region.id))}
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
            </div>
          </section>
        ) : null}

        {gamePhase === "setup" ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <div>
                <h2>{currentTeamName}&apos;s terms</h2>
                <p>{roundLabel}. Select the {TERM_COUNT} terms in presentation order.</p>
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
                disabled={selectedTermIds.length !== TERM_COUNT}
              >
                <Play className="h-4 w-4" />
                Start Turn
              </button>
            </div>
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
              <button type="button" className="anatomime-secondary-button" onClick={endTurn}>
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
