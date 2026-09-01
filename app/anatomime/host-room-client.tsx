"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Copy, LogIn, Play, QrCode, RefreshCw, RotateCcw, SkipForward, Timer, UserCog, X } from "lucide-react"
import { AnatomimeActionButton } from "./anatomime-action-button"
import {
  fetchAnatomimeRoomSnapshot,
  nextAnatomimePollSchedule,
  nextAnatomimeVisibilitySchedule,
  type AnatomimeRoomFetchResult,
} from "./anatomime-polling"
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
  const [pollStatus, setPollStatus] = useState("")
  const [pollTerminal, setPollTerminal] = useState<"ROOM_ENDED" | "REJOIN_REQUIRED" | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [joinUrl, setJoinUrl] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [qrGenerationFailed, setQrGenerationFailed] = useState(false)
  const sessionRef = useRef(initialSession)
  const timeoutKeyRef = useRef("")
  const pollWakeRef = useRef<() => void>(() => {})
  const joinPath = `/anatomime/join?code=${encodeURIComponent(session.code)}`

  useEffect(() => {
    setSession(initialSession)
    sessionRef.current = initialSession
  }, [initialSession])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setJoinUrl(`${window.location.origin}${joinPath}`)
  }, [joinPath])

  useEffect(() => {
    if (!joinUrl) {
      setQrDataUrl("")
      return
    }

    let cancelled = false
    setQrDataUrl("")
    setQrGenerationFailed(false)

    // The host screen builds the absolute invite URL in-browser so local,
    // preview, and production domains encode the origin students should open.
    void import("qrcode")
      .then(({ toDataURL }) => toDataURL(joinUrl, {
        color: {
          dark: "#111827",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
        margin: 1,
        width: 220,
      }))
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl("")
          setQrGenerationFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [joinUrl])

  const setSyncedSession = useCallback((nextSession: AnatomimeRoomSummary) => {
    sessionRef.current = nextSession
    setSession(nextSession)
    onSessionChange(nextSession)
  }, [onSessionChange])

  useEffect(() => {
    let cancelled = false
    let stopped = false
    let inFlight = false
    let timer: number | null = null
    let controller: AbortController | null = null
    let consecutiveFailures = 0
    let latestScheduledResult: AnatomimeRoomFetchResult | null = null

    const stopPolling = (reason: "ROOM_ENDED" | "REJOIN_REQUIRED") => {
      stopped = true
      setPollTerminal(reason)
      setPollStatus(reason === "ROOM_ENDED"
        ? "This shared game has ended or is no longer available."
        : "The host credentials are no longer valid for this shared game.")
    }

    function armPoll(delayMs: number) {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        void poll()
      }, delayMs)
    }

    async function poll() {
      if (cancelled || stopped || inFlight) return
      inFlight = true
      controller = new AbortController()
      const result = await fetchAnatomimeRoomSnapshot({
        code: sessionRef.current.code,
        credentials: { playerId: credentials.playerId, token: credentials.token },
        signal: controller.signal,
      })
      inFlight = false
      if (cancelled || controller.signal.aborted) return

      if (result.kind === "SUCCESS") {
        setSyncedSession(result.session)
        setPollStatus("")
        setPollTerminal(null)
      }
      const schedule = nextAnatomimePollSchedule({
        result,
        roomStatus: result.kind === "SUCCESS" ? result.session.status : undefined,
        roomPhase: result.kind === "SUCCESS" ? result.session.phase : undefined,
        documentHidden: document.visibilityState === "hidden",
        consecutiveFailures,
      })
      if (schedule.action === "STOP") {
        stopPolling(schedule.reason)
        return
      }

      consecutiveFailures = schedule.consecutiveFailures
      latestScheduledResult = result
      if (result.kind === "RATE_LIMITED") {
        setPollStatus(`Updates are paused. Trying again in ${Math.ceil(schedule.delayMs / 1_000)} seconds.`)
      } else if (result.kind === "FAILED") {
        setPollStatus("Connection interrupted. Updates will retry automatically.")
      }
      armPoll(schedule.delayMs)
    }

    const wakePoll = () => {
      if (cancelled || stopped || inFlight) return
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      void poll()
    }
    const onVisibilityChange = () => {
      if (cancelled || stopped || inFlight || timer === null) return
      const schedule = nextAnatomimeVisibilitySchedule({
        result: latestScheduledResult,
        documentHidden: document.visibilityState === "hidden",
      })
      if (!schedule || schedule.action !== "SCHEDULE") return
      armPoll(schedule.delayMs)
    }
    pollWakeRef.current = wakePoll
    document.addEventListener("visibilitychange", onVisibilityChange)
    const currentSession = sessionRef.current
    const initialResult = { kind: "SUCCESS", session: currentSession } as const
    const firstSchedule = nextAnatomimePollSchedule({
      result: initialResult,
      roomStatus: currentSession.status,
      roomPhase: currentSession.phase,
      documentHidden: document.visibilityState === "hidden",
      consecutiveFailures: 0,
    })
    if (firstSchedule.action === "SCHEDULE") {
      latestScheduledResult = initialResult
      armPoll(firstSchedule.delayMs)
    } else {
      stopPolling(firstSchedule.reason)
    }
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (pollWakeRef.current === wakePoll) pollWakeRef.current = () => {}
    }
  }, [
    credentials.playerId,
    credentials.token,
    initialSession.code,
    initialSession.phase,
    initialSession.status,
    setSyncedSession,
  ])

  const performAction = useCallback(async (label: string, path: string, body: Record<string, unknown> = {}) => {
    setBusyAction(label)
    setMessage("")
    try {
      const nextSession = await postHostAction(path, credentials, body)
      setSyncedSession(nextSession)
    } catch (error) {
      if (label === "timeout") timeoutKeyRef.current = ""
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
    if (pollTerminal || session.status !== "PLAYING" || session.phase !== "ACTIVE_TERM" || !session.activeItem || termSeconds !== 0) return
    const key = `${session.code}:${session.activeItem.index}:${session.phaseEndsAt ?? "none"}`
    if (timeoutKeyRef.current === key) return
    timeoutKeyRef.current = key
    void performAction("timeout", `/api/anatomime/sessions/${session.code}/timeout`)
  }, [performAction, pollTerminal, session, termSeconds])

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

      <div className="anatomime-room-invite" role="group" aria-label={`Shared game invite for room ${session.code}`}>
        <div className="anatomime-qr-frame" aria-live="polite">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- QRCode returns a data URL for an on-screen invite code.
            <img src={qrDataUrl} alt={`QR code for Anatomime room ${session.code}`} />
          ) : (
            <div className="anatomime-qr-placeholder">
              <QrCode className="h-10 w-10" />
              <span>{qrGenerationFailed ? "QR unavailable" : "Preparing QR"}</span>
            </div>
          )}
        </div>
        <div className="anatomime-join-code-card">
          <span>Join code</span>
          <strong>{session.code}</strong>
          <small>{qrGenerationFailed ? "Use the code or copied link to join." : "Scan the QR or use the code."}</small>
          <code className="anatomime-invite-link">{joinUrl || joinPath}</code>
        </div>
      </div>

      <div className="anatomime-actions">
        <AnatomimeActionButton asChild intent="secondary">
          <Link href={joinPath}>
            <LogIn className="h-4 w-4" />
            Join Shared Game
          </Link>
        </AnatomimeActionButton>
        <AnatomimeActionButton type="button" intent="secondary" onClick={() => copyText(session.code, "Join code copied.")}>
          <Copy className="h-4 w-4" />
          Copy Code
        </AnatomimeActionButton>
        <AnatomimeActionButton type="button" intent="secondary" onClick={() => copyText(joinUrl || `${window.location.origin}${joinPath}`, "Join link copied.")}>
          <Copy className="h-4 w-4" />
          Copy Join Link
        </AnatomimeActionButton>
        <AnatomimeActionButton type="button" intent="secondary" onClick={() => pollWakeRef.current()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </AnatomimeActionButton>
      </div>

      {message ? <div className="anatomime-message" role="status" aria-live="polite">{message}</div> : null}
      <div className={pollStatus ? "anatomime-message" : "anatomime-poll-status"} role="status" aria-live="polite">
        {pollStatus}
      </div>
      {pollTerminal ? (
        <div className="anatomime-rejoin-notice">
          <div>
            <strong>{pollTerminal === "ROOM_ENDED" ? "Shared game ended" : "Host access needs to be restored"}</strong>
            <p>{pollTerminal === "ROOM_ENDED"
              ? "This room is no longer available. Start a new shared game when you are ready."
              : "These host credentials no longer match the room. Start a new shared game to continue safely."}</p>
          </div>
          <AnatomimeActionButton type="button" intent="secondary" onClick={onResetLocalGame}>
            <RotateCcw className="h-4 w-4" />
            Start New Game
          </AnatomimeActionButton>
        </div>
      ) : null}

      <div className="anatomime-score-grid">
        {session.teams.map((team) => (
          <div key={team.id} className="anatomime-score" data-active={session.activeTeam?.id === team.id}>
            <span>{team.name}</span>
            <strong>{team.score}</strong>
          </div>
        ))}
      </div>

      {!pollTerminal && session.status === "LOBBY" ? (
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
            <AnatomimeActionButton
              type="button" intent="primary"
              onClick={() => performAction("start", `/api/anatomime/sessions/${session.code}/start`)}
              disabled={busyAction === "start"}
            >
              <Play className="h-4 w-4" />
              {busyAction === "start" ? "Starting..." : "Start Shared Game"}
            </AnatomimeActionButton>
          </div>
        </>
      ) : null}

      {!pollTerminal && session.status === "PLAYING" && session.activeItem ? (
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

      {!pollTerminal && session.status === "PLAYING" && session.phase === "ACTIVE_TERM" && session.config.answerMode === "host-judged" ? (
        <div className="anatomime-actions">
          <AnatomimeActionButton
            type="button" intent="primary"
            onClick={() => performAction("got-it", `/api/anatomime/sessions/${session.code}/host-judged`)}
            disabled={busyAction === "got-it"}
          >
            <CheckCircle2 className="h-4 w-4" />
            Got It
          </AnatomimeActionButton>
        </div>
      ) : null}

      {!pollTerminal && session.phase === "TURN_REVIEW" ? (
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
            <AnatomimeActionButton
              type="button" intent="primary"
              onClick={() => performAction("next-team", `/api/anatomime/sessions/${session.code}/next-team`)}
              disabled={busyAction === "next-team"}
            >
              <SkipForward className="h-4 w-4" />
              Next Team
            </AnatomimeActionButton>
          </div>
        </div>
      ) : null}

      {!pollTerminal && (session.status === "GAME_COMPLETE" || session.status === "REVIEW") ? (
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
              <AnatomimeActionButton
                type="button" intent="primary"
                onClick={() => performAction("next-game", `/api/anatomime/sessions/${session.code}/next-game`)}
                disabled={busyAction === "next-game"}
              >
                <RotateCcw className="h-4 w-4" />
                Start New Game
              </AnatomimeActionButton>
            ) : (
              <AnatomimeActionButton type="button" intent="secondary" onClick={onResetLocalGame}>
                Back to Setup
              </AnatomimeActionButton>
            )}
          </div>
        </div>
      ) : null}

      {!pollTerminal && hostTransferTargets.length > 0 && session.status !== "REVIEW" && session.status !== "EXPIRED" ? (
        <div className="anatomime-host-transfer">
          <h3>Transfer host</h3>
          <div className="anatomime-selection-toolbar">
            {hostTransferTargets.map((player) => (
              <AnatomimeActionButton
                key={player.id}
                type="button" intent="secondary"
                onClick={() => performAction("transfer", `/api/anatomime/sessions/${session.code}/host/transfer`, { playerId: player.id })}
                disabled={busyAction === "transfer"}
              >
                <UserCog className="h-4 w-4" />
                {playerLabel(player)}
              </AnatomimeActionButton>
            ))}
          </div>
        </div>
      ) : null}

      {!pollTerminal && session.status !== "REVIEW" && session.status !== "EXPIRED" ? (
        <div className="anatomime-actions">
          <AnatomimeActionButton
            type="button" intent="danger"
            onClick={() => performAction("end", `/api/anatomime/sessions/${session.code}/end`)}
            disabled={busyAction === "end"}
          >
            <X className="h-4 w-4" />
            End Session
          </AnatomimeActionButton>
        </div>
      ) : null}
    </section>
  )
}
