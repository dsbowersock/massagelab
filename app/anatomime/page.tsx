"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import { GraduationCap, LogIn, Play, ShieldCheck, UsersRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { MovingBackground } from "@/components/moving-background"
import { AnatomimeActionButton } from "./anatomime-action-button"
import "./styles.css"

const AnatomimeGameClient = dynamic(
  () => import("./anatomime-game-client").then((module) => module.AnatomimeGameClient),
  {
    loading: () => (
      <div className="anatomime-page">
        <MovingBackground className="anatomime-background" testId="anatomime-moving-background-loading" />
        <div className="anatomime-shell">
          <div className="anatomime-message" role="status">
            Loading anatomy deck...
          </div>
        </div>
      </div>
    ),
    ssr: false,
  },
)

const TEAM_OPTIONS = [2, 3, 4]

const anatomimeProofs = [
  {
    title: "Massage anatomy classroom game",
    description: "Teams act out or answer sourced anatomy terms with body-region and clue-level controls.",
    icon: GraduationCap,
  },
  {
    title: "Shared room-code play",
    description: "Use the join route for classroom devices, team steals, host judging, and same-code next games.",
    icon: UsersRound,
  },
  {
    title: "Reviewed study adapter",
    description: "Anatomime uses the same reviewed anatomy foundation as MassageLab flashcards.",
    icon: ShieldCheck,
  },
] as const

function normalizeTeamNames(names: string[], count: number) {
  return Array.from({ length: count }, (_, index) => {
    const name = names[index]?.trim()
    return name || `Team ${index + 1}`
  })
}

function normalizeRoundLimit(value: string | number, fallback = 3) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(12, Math.max(1, Math.round(numeric)))
}

/**
 * Keeps the initial Anatomime route shell free of the sourced anatomy catalog.
 * The full game client renders only after setup needs deck data, while an idle
 * online warmup lets the service worker cache the lazy chunks for offline play.
 */
export default function AnatomimePage() {
  const [gameLoaded, setGameLoaded] = useState(false)
  const [teamCount, setTeamCount] = useState(2)
  const [teamNames, setTeamNames] = useState(["Team 1", "Team 2"])
  const [roundLimit, setRoundLimit] = useState(3)
  const [hardcoreMode, setHardcoreMode] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    setTeamNames((current) => normalizeTeamNames(current, teamCount))
  }, [teamCount])

  useEffect(() => {
    if (!window.navigator.onLine) return

    const loadGameClient = () => {
      void import("./anatomime-game-client")
    }

    if (typeof window.requestIdleCallback === "function") {
      const idleHandle = window.requestIdleCallback(loadGameClient, { timeout: 3000 })
      return () => window.cancelIdleCallback(idleHandle)
    }

    const timeoutHandle = window.setTimeout(loadGameClient, 1500)
    return () => window.clearTimeout(timeoutHandle)
  }, [])

  const startGameSetup = () => {
    const trimmedNames = teamNames.slice(0, teamCount).map((name) => name.trim())
    if (trimmedNames.some((name) => !name)) {
      setMessage("Enter names for all teams before choosing anatomy terms.")
      return
    }

    setTeamNames(trimmedNames)
    setMessage("")
    setGameLoaded(true)
  }

  if (gameLoaded) {
    return (
      <AnatomimeGameClient
        initialTeamCount={teamCount}
        initialTeamNames={teamNames}
        initialRoundLimit={roundLimit}
        initialHardcoreMode={hardcoreMode}
        initialPhase="selection"
      />
    )
  }

  return (
    <div className="anatomime-page">
      <MovingBackground className="anatomime-background" testId="anatomime-moving-background" />
      <div className="anatomime-shell">
        <header className="anatomime-header">
          <div>
            <PageHeading>Anatomime</PageHeading>
            <p className="anatomime-subtitle">
              A massage anatomy classroom game for teams, study groups, and solo review. Choose anatomy categories, body regions, and clue level, then race the timer.
            </p>
          </div>
        </header>

        <section className="anatomime-landing-proof" aria-label="Anatomime product proof">
          {anatomimeProofs.map((proof) => {
            const Icon = proof.icon
            return (
              <article key={proof.title} className="anatomime-proof-card">
                <Icon className="h-5 w-5" aria-hidden="true" />
                <div>
                  <h2>{proof.title}</h2>
                  <p>{proof.description}</p>
                </div>
              </article>
            )
          })}
        </section>

        {message ? (
          <div className="anatomime-message" role="status">
            {message}
          </div>
        ) : null}

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
                  className="anatomime-round-slider ml-native-compact-range"
                />
              </div>
            </div>
          </div>

          <div className="anatomime-actions">
            <AnatomimeActionButton type="button" intent="primary" onClick={startGameSetup}>
              <Play className="h-4 w-4" />
              Choose Anatomy Terms
            </AnatomimeActionButton>
            <AnatomimeActionButton asChild intent="secondary">
              <Link href="/anatomime/join">
                <LogIn className="h-4 w-4" />
                Join Shared Game
              </Link>
            </AnatomimeActionButton>
          </div>
        </section>

        <details className="anatomime-game-info" suppressHydrationWarning>
          <summary>Game info</summary>
          <dl>
            <div>
              <dt>Mode</dt>
              <dd>Team anatomy review</dd>
            </div>
            <div>
              <dt>Terms per round</dt>
              <dd>4 terms</dd>
            </div>
            <div>
              <dt>Turns</dt>
              <dd>30s turns</dd>
            </div>
            <div>
              <dt>Teams</dt>
              <dd>{teamCount}</dd>
            </div>
            <div>
              <dt>Rounds</dt>
              <dd>{hardcoreMode ? "Hardcore" : roundLimit}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>Reviewed anatomy prompts</dd>
            </div>
          </dl>
        </details>
      </div>
    </div>
  )
}
