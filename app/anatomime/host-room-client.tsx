"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Copy, LogIn, Play, RefreshCw, RotateCcw, SkipForward, Timer, UserCog, X } from "lucide-react"
import type { AnatomimePlayerSummary, AnatomimeRoomSummary } from "./shared-session-types"

type HostCredentials = { playerId: string; token: string }

function hostHeaders(credentials: HostCredentials) {
  return {
    "Content-Type": "application/json",
    "x-anatomime-player-id": credentials.playerId,
    "x-anatomime-player-token": credentials.token,
  }
}

async function postHostAction(path: string, credentials: HostCredentials, body: Record<string, unknown> = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: hostHeaders(credentials),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? "Anatomime action failed.")
  return payload.session as AnatomimeRoomSummary
}

function secondsUntil(value: string | null, now: number) {
  if (!value) return null
  return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000))
}

function formatCountdown(seconds: number | null) {
  if (seconds === null) return "--"
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${remaining.toString().padStart(2, "0")}`
}

function playerLabel(player: AnatomimePlayerSummary) {
  return `${player.displayName}${player.signedIn ? " · signed in" : " · guest"}`
}

export function HostRoomClient({
  initialSession,
  credentials,
  onSessionChange,
  onResetLocalGame,
}: {
  initialSession: AnatomimeRoomSummary
  credentials: HostCredentials
  onSessionChange: (session: AnatomimeRoomSummary) => void
  onResetLocalGame: () => void
}) {
  const [session, setSession] = useState(initialSession)
  const [message, setMessage] = useState("")
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const timeoutKeyRef = useRef("")

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const setSyncedSession = useCallback((nextSession: AnatomimeRoomSummary) => {
    setSession(nextSession)
    onSessionChange(nextSession)
  }, [onSessionChange])

  const refreshSession = useCallback(async () => {
    const response = await fetch(`/api/anatomime/sessions/${session.code}`, {
      cache: "no-store",
      headers: hostHeaders(credentials),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error ?? "Could not refresh shared game.")
    setSyncedSession(payload.session as AnatomimeRoomSummary)
  }, [credentials, session.code, setSyncedSession])

  useEffect(() => {
    if (session.status === "REVIEW" || session.status === "EXPIRED") return
    const timer = window.setInterval(() => {
      void refreshSession().catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [refreshSession, session.status])

  const performAction = useCallback(async (label: string, path: string, body: Record<string, unknown> = {}) => {
    setBusyAction(label)
    setMessage("")
    try {
      const nextSession = await postHostAction(path, credentials, body)
      setSyncedSession(nextSession)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anatomime action failed.")
    } finally {
      setBusyAction(null)
    }
  }, [credentials, setSyncedSession])

  const termSeconds = secondsUntil(session.phaseEndsAt, now)
  const reviewSeconds = secondsUntil(session.reviewExpiresAt, now)
  const activeMedia = session.activeItem?.prompt.media?.find((media) => media.url)
  const showMedia = Boolean(activeMedia && (session.config.clueLevel === "easy" || session.config.clueLevel === "medium"))
  const showMeta = session.config.clueLevel === "easy"
  const showDefinition = Boolean(session.activeItem?.prompt.definition && (session.config.clueLevel === "easy" || session.config.clueLevel === "hard"))
  const joinedPlayers = session.players.filter((player) => !player.isHost)
  const hostTransferTargets = joinedPlayers.filter((player) => player.id !== session.viewer.playerId)
  const playerCount = joinedPlayers.length

  useEffect(() => {
    if (session.status !== "PLAYING" || session.phase !== "ACTIVE_TERM" || !session.activeItem || termSeconds !== 0) return
    const key = `${session.code}:${session.activeItem.index}:${session.phaseEndsAt ?? "none"}`
    if (timeoutKeyRef.current === key) return
    timeoutKeyRef.current = key
    void performAction("timeout", `/api/anatomime/sessions/${session.code}/timeout`)
  }, [performAction, session, termSeconds])

  const copyText = async (value: string, success: string) => {
    if (!window.navigator.clipboard) {
      setMessage("Clipboard is unavailable.")
      return
    }
    try {
      await window.navigator.clipboard.writeText(value)
      setMessage(success)
    } catch {
      setMessage("Copy failed.")
    }
  }

  return (
    <section className="anatomime-panel anatomime-host-room">
      <div className="anatomime-section-heading">
        <div>
          <h2>Shared game</h2>
          <p>{session.status === "LOBBY" ? "Players can join before the first turn starts." : "Keep the code visible for late joins."}</p>
        </div>
        <div className="anatomime-status">
          <span>{session.status}</span>
          <span>{session.phase}</span>
          <span>{playerCount} players</span>
        </div>
      </div>

      <div className="anatomime-join-code-card" role="group" aria-label={`Shared game code ${session.code}`}>
        <span>Join code</span>
        <strong>{session.code}</strong>
        <small>Use Join Shared Game on the Anatomime page.</small>
      </div>

      <div className="anatomime-actions">
        <Link className="anatomime-secondary-button" href="/anatomime/join">
          <LogIn className="h-4 w-4" />
          Join Shared Game
        </Link>
        <button type="button" className="anatomime-secondary-button" onClick={() => copyText(session.code, "Join code copied.")}>
          <Copy className="h-4 w-4" />
          Copy Code
        </button>
        <button type="button" className="anatomime-secondary-button" onClick={() => copyText(`${window.location.origin}/anatomime/join`, "Join page copied.")}>
          <Copy className="h-4 w-4" />
          Copy Join Page
        </button>
        <button type="button" className="anatomime-secondary-button" onClick={() => refreshSession().catch((error) => setMessage(error.message))}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {message ? <div className="anatomime-message" role="status">{message}</div> : null}

      <div className="anatomime-score-grid">
        {session.teams.map((team) => (
          <div key={team.id} className="anatomime-score" data-active={session.activeTeam?.id === team.id}>
            <span>{team.name}</span>
            <strong>{team.score}</strong>
          </div>
        ))}
      </div>

      {session.status === "LOBBY" ? (
        <>
          <div className="anatomime-setup-grid">
            {session.teams.map((team) => (
              <div key={team.id} className="anatomime-list-column">
                <h3>{team.name}</h3>
                <div className="anatomime-review-list">
                  {joinedPlayers.filter((player) => player.teamId === team.id).map((player) => (
                    <article key={player.id} className="anatomime-review-card">
                      <strong>{player.displayName}</strong>
                      <p className="anatomime-review-meta">{player.signedIn ? "Signed in" : "Guest"}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="anatomime-actions">
            <button
              type="button"
              className="anatomime-primary-button"
              onClick={() => performAction("start", `/api/anatomime/sessions/${session.code}/start`)}
              disabled={busyAction === "start"}
            >
              <Play className="h-4 w-4" />
              {busyAction === "start" ? "Starting..." : "Start Shared Game"}
            </button>
          </div>
        </>
      ) : null}

      {session.status === "PLAYING" && session.activeItem ? (
        <div className="anatomime-current-term">
          <span>{session.activeItem.index + 1} of {session.activeItem.total} · {session.activeTeam?.name}</span>
          <div className="anatomime-host-timer">
            <Timer className="h-5 w-5" />
            {formatCountdown(termSeconds)}
          </div>
          <h2>{session.activeItem.prompt.name ?? "Current term"}</h2>
          {showMedia && activeMedia ? (
            <figure className="anatomime-current-media">
              {/* eslint-disable-next-line @next/next/no-img-element -- Anatomy media URLs are sourced study assets. */}
              <img src={activeMedia.url} alt={activeMedia.title} loading="lazy" referrerPolicy="no-referrer" />
            </figure>
          ) : null}
          {showMeta ? (
            <p>
              {[session.activeItem.prompt.categoryLabel, session.activeItem.prompt.regionLabels?.join(", "), session.activeItem.prompt.difficulty]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {showDefinition ? <small>{session.activeItem.prompt.definition}</small> : null}
          {session.activeItem.pendingSteal ? <em>A steal is ready. Your team can still claim it.</em> : null}
          {session.config.answerMode !== "host-judged" ? <small>Device answers are open for players.</small> : null}
        </div>
      ) : null}

      {session.status === "PLAYING" && session.phase === "ACTIVE_TERM" && session.config.answerMode === "host-judged" ? (
        <div className="anatomime-actions">
          <button
            type="button"
            className="anatomime-primary-button"
            onClick={() => performAction("got-it", `/api/anatomime/sessions/${session.code}/host-judged`)}
            disabled={busyAction === "got-it"}
          >
            <CheckCircle2 className="h-4 w-4" />
            Got It
          </button>
        </div>
      ) : null}

      {session.phase === "TURN_REVIEW" ? (
        <div className="anatomime-learning-review">
          <div className="anatomime-section-heading compact">
            <div>
              <h3>Turn review</h3>
              <p>Review the last four terms, then bring up the next team.</p>
            </div>
          </div>
          <div className="anatomime-review-list">
            {session.turnReview.map((item) => (
              <article key={item.cardId ?? item.id ?? item.name} className="anatomime-review-card" data-outcome={item.outcome === "got" ? "correct" : "missed"}>
                <span className="anatomime-outcome-pill" data-outcome={item.outcome === "got" ? "correct" : "missed"}>{item.outcome}</span>
                <strong>{item.name}</strong>
              </article>
            ))}
          </div>
          <div className="anatomime-actions">
            <button
              type="button"
              className="anatomime-primary-button"
              onClick={() => performAction("next-team", `/api/anatomime/sessions/${session.code}/next-team`)}
              disabled={busyAction === "next-team"}
            >
              <SkipForward className="h-4 w-4" />
              Next Team
            </button>
          </div>
        </div>
      ) : null}

      {session.status === "GAME_COMPLETE" || session.status === "REVIEW" ? (
        <div className="anatomime-learning-review">
          <div className="anatomime-section-heading compact">
            <div>
              <h3>Game recap</h3>
              {session.status === "REVIEW" ? <p>Review ends in {formatCountdown(reviewSeconds)}.</p> : null}
            </div>
          </div>
          <div className="anatomime-recap-grid">
            {session.recap.map((row) => {
              const team = session.teams.find((candidate) => candidate.id === row.teamId)
              return (
                <article key={row.teamId} className="anatomime-recap-card">
                  <strong>{team?.name ?? "Team"}</strong>
                  <span>{row.got} got · {row.missed} missed · {row.stolen} stolen</span>
                </article>
              )
            })}
          </div>
          <div className="anatomime-actions">
            {session.status === "GAME_COMPLETE" ? (
              <button
                type="button"
                className="anatomime-primary-button"
                onClick={() => performAction("next-game", `/api/anatomime/sessions/${session.code}/next-game`)}
                disabled={busyAction === "next-game"}
              >
                <RotateCcw className="h-4 w-4" />
                Start New Game
              </button>
            ) : (
              <button type="button" className="anatomime-secondary-button" onClick={onResetLocalGame}>
                Back to Setup
              </button>
            )}
          </div>
        </div>
      ) : null}

      {hostTransferTargets.length > 0 && session.status !== "REVIEW" && session.status !== "EXPIRED" ? (
        <div className="anatomime-host-transfer">
          <h3>Transfer host</h3>
          <div className="anatomime-selection-toolbar">
            {hostTransferTargets.map((player) => (
              <button
                key={player.id}
                type="button"
                className="anatomime-secondary-button"
                onClick={() => performAction("transfer", `/api/anatomime/sessions/${session.code}/host/transfer`, { playerId: player.id })}
                disabled={busyAction === "transfer"}
              >
                <UserCog className="h-4 w-4" />
                {playerLabel(player)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {session.status !== "REVIEW" && session.status !== "EXPIRED" ? (
        <div className="anatomime-actions">
          <button
            type="button"
            className="anatomime-danger-button"
            onClick={() => performAction("end", `/api/anatomime/sessions/${session.code}/end`)}
            disabled={busyAction === "end"}
          >
            <X className="h-4 w-4" />
            End Session
          </button>
        </div>
      ) : null}
    </section>
  )
}
