"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { LogIn, RotateCcw, Send, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { MovingBackground } from "@/components/moving-background"
import { AnatomimeActionButton } from "./anatomime-action-button"
import {
  anatomimeRetryAfterSeconds,
  fetchAnatomimeRoomSnapshot,
  nextAnatomimePollSchedule,
  nextAnatomimeVisibilitySchedule,
  type AnatomimeRoomFetchResult,
} from "./anatomime-polling"
import type { AnatomimeRoomSummary } from "./shared-session-types"
import "./styles.css"

type StoredPlayer = {
  playerId: string
  playerToken: string
  teamId: string | null
}

type StoredPlayerRecord = {
  code: string
  player: StoredPlayer | null
}

type TermAttemptState = {
  typedAttempts: number
  choiceAttempts: number
  correct: boolean
  outOfTypedGuesses: boolean
  feedback: string
}

type AblyRealtimeClient = {
  channels: {
    get: (name: string) => {
      subscribe: (callback: () => void) => void
      unsubscribe: () => void
    }
  }
  close: () => void
}

declare global {
  interface Window {
    Ably?: {
      Realtime: new (options: {
        authCallback: (tokenParams: unknown, callback: (error: unknown, tokenRequest?: unknown) => void) => void
      }) => AblyRealtimeClient
    }
  }
}

const feedbackCopy: Record<string, string> = {
  incorrect: "Incorrect. Try another guess.",
  "active-correct": "Correct. Your team scored.",
  "opposing-correct-held": "Correct. Your team can score if the active team misses.",
  "opposing-team-already-held": "Someone on your team found it. You can still guess for practice.",
  "practice-correct": "Correct for practice.",
}

/** Keeps every browser-side room identity aligned with the server's canonical room code. */
export function normalizeAnatomimeClientRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
}

function storageKey(code: string) {
  return `massagelab-anatomime-player:${normalizeAnatomimeClientRoomCode(code)}`
}

function readStoredPlayer(code: string): StoredPlayer | null {
  if (typeof window === "undefined" || !code) return null

  try {
    const raw = window.localStorage.getItem(storageKey(code))
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.playerId !== "string" || typeof parsed.playerToken !== "string") return null

    return {
      playerId: parsed.playerId,
      playerToken: parsed.playerToken,
      teamId: typeof parsed.teamId === "string" ? parsed.teamId : null,
    }
  } catch {
    return null
  }
}

function writeStoredPlayer(code: string, player: StoredPlayer) {
  window.localStorage.setItem(storageKey(code), JSON.stringify(player))
}

function removeStoredPlayer(code: string) {
  window.localStorage.removeItem(storageKey(code))
}

function secondsLeft(value: string | null, now: number) {
  if (!value) return 0
  return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000))
}

function activeTermKey(session: AnatomimeRoomSummary | null) {
  if (!session?.activeItem) return ""
  return `${session.code}:${session.phaseEndsAt ?? "no-deadline"}:${session.activeItem.index}:${session.activeItem.prompt.id}`
}

function emptyAttempt(): TermAttemptState {
  return {
    typedAttempts: 0,
    choiceAttempts: 0,
    correct: false,
    outOfTypedGuesses: false,
    feedback: "",
  }
}

function currentPlayer(session: AnatomimeRoomSummary | null) {
  return session?.players.find((player) => player.id === session.viewer.playerId) ?? null
}

function playerName(session: AnatomimeRoomSummary, playerId: string) {
  return session.players.find((player) => player.id === playerId)?.displayName ?? "Player"
}

/**
 * Loads the browser Ably SDK once for shared-session updates. It falls back to
 * polling when the script or realtime token is unavailable.
 */
function ablyScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Ably) {
      resolve()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-anatomime-ably]")
    if (existing) {
      const status = existing.getAttribute("data-anatomime-ably-status")
      if (status === "loaded") {
        resolve()
        return
      }
      if (status === "error") {
        existing.remove()
      } else {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", reject, { once: true })
        return
      }
    }

    const script = document.createElement("script")
    script.src = "https://cdn.ably.com/lib/ably.min-2.js"
    script.async = true
    script.dataset.anatomimeAbly = "true"
    script.onload = () => {
      script.setAttribute("data-anatomime-ably-status", "loaded")
      resolve()
    }
    script.onerror = (event) => {
      script.setAttribute("data-anatomime-ably-status", "error")
      reject(event)
    }
    document.head.appendChild(script)
  })
}

export function AnatomimeSharedSessionClient({ initialCode = "" }: { initialCode?: string }) {
  const normalizedInitialCode = normalizeAnatomimeClientRoomCode(initialCode)
  const [code, setCode] = useState(normalizedInitialCode)
  const [lookupCode, setLookupCode] = useState(normalizedInitialCode)
  const [displayName, setDisplayName] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [answer, setAnswer] = useState("")
  const [storedPlayerRecord, setStoredPlayerRecord] = useState<StoredPlayerRecord>({ code: "", player: null })
  const [session, setSession] = useState<AnatomimeRoomSummary | null>(null)
  const [message, setMessage] = useState("")
  const [pollStatus, setPollStatus] = useState("")
  const [initialLookupPending, setInitialLookupPending] = useState(Boolean(normalizedInitialCode))
  const [pollTerminal, setPollTerminal] = useState<"ROOM_ENDED" | "REJOIN_REQUIRED" | null>(null)
  const [joiningGame, setJoiningGame] = useState(false)
  const [joinRetryUntil, setJoinRetryUntil] = useState(0)
  const [attemptsByTerm, setAttemptsByTerm] = useState<Record<string, TermAttemptState>>({})
  const [rankedPlayerIds, setRankedPlayerIds] = useState<string[]>([])
  const [now, setNow] = useState(Date.now())
  const joinInFlightRef = useRef(false)
  const pollWakeRef = useRef<() => void>(() => {})
  const storedPlayerReady = !lookupCode || storedPlayerRecord.code === lookupCode
  const storedPlayer = storedPlayerReady ? storedPlayerRecord.player : null

  useEffect(() => {
    setStoredPlayerRecord({
      code: lookupCode,
      player: lookupCode ? readStoredPlayer(lookupCode) : null,
    })
  }, [lookupCode])

  const visibleRankedPlayerIds = useMemo(() => {
    const allowed = new Set(session?.hostElection?.candidatePlayerIds ?? [])
    return rankedPlayerIds.filter((playerId) => allowed.has(playerId))
  }, [rankedPlayerIds, session?.hostElection?.candidatePlayerIds])

  useEffect(() => {
    if (!lookupCode || !storedPlayerReady) return
    let cancelled = false
    let stopped = false
    let inFlight = false
    let timer: number | null = null
    let controller: AbortController | null = null
    let consecutiveFailures = 0
    let latestScheduledResult: AnatomimeRoomFetchResult | null = null
    const credentials = storedPlayer
      ? { playerId: storedPlayer.playerId, token: storedPlayer.playerToken }
      : undefined

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
        code: lookupCode,
        credentials,
        signal: controller.signal,
      })
      inFlight = false
      if (cancelled || controller.signal.aborted) return

      // Only the first lookup owns visible loading UI; scheduled background polls stay quiet.
      setInitialLookupPending(false)
      if (result.kind === "SUCCESS") {
        setSession(result.session)
        setSelectedTeamId((current) => (
          current || result.session.viewer.teamId || result.session.teams[0]?.id || ""
        ))
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
        stopped = true
        setPollTerminal(schedule.reason)
        setPollStatus(schedule.reason === "ROOM_ENDED"
          ? "This shared game has ended or is no longer available."
          : "Your saved player pass is no longer valid. Rejoin to continue.")
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
      if (cancelled || stopped || inFlight || timer === null || !latestScheduledResult || latestScheduledResult.kind === "RATE_LIMITED") return
      window.clearTimeout(timer)
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
    void poll()

    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (pollWakeRef.current === wakePoll) pollWakeRef.current = () => {}
    }
  }, [lookupCode, storedPlayer, storedPlayerReady])

  useEffect(() => {
    if (!lookupCode || !storedPlayer || pollTerminal) return
    const realtimePlayer = storedPlayer
    let cancelled = false
    let ablyClient: AblyRealtimeClient | null = null

    async function connectRealtime() {
      try {
        const tokenResponse = await fetch(`/api/anatomime/sessions/${encodeURIComponent(lookupCode)}/realtime-token`, {
          method: "POST",
          headers: {
            "x-anatomime-player-id": realtimePlayer.playerId,
            "x-anatomime-player-token": realtimePlayer.playerToken,
          },
        })
        if (!tokenResponse.ok) throw new Error("Realtime unavailable")
        const tokenRequest = await tokenResponse.json()
        await ablyScript()
        if (cancelled || !window.Ably) return

        ablyClient = new window.Ably.Realtime({
          authCallback(_tokenParams, callback) {
            callback(null, tokenRequest)
          },
        })
        const channel = ablyClient.channels.get(`anatomime:${lookupCode}`)
        channel.subscribe(() => {
          pollWakeRef.current()
        })
      } catch {
        if (!cancelled) setPollStatus((current) => current || "Live updates are unavailable. Automatic refresh is active.")
      }
    }

    void connectRealtime()

    return () => {
      cancelled = true
      ablyClient?.close()
    }
  }, [lookupCode, pollTerminal, storedPlayer])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])

  const termKey = activeTermKey(session)
  const attempt = attemptsByTerm[termKey] ?? emptyAttempt()
  const joined = Boolean(storedPlayer && session?.viewer.playerId)
  const showCodeEntry = !lookupCode || (!initialLookupPending && !session && !pollTerminal)
  const joinRetrySeconds = Math.max(0, Math.ceil((joinRetryUntil - now) / 1_000))
  const joinLocked = joiningGame || joinRetrySeconds > 0
  const activeTeamName = session?.activeTeam?.name ?? ""
  const myTeam = session?.teams.find((team) => team.id === session.viewer.teamId || team.id === storedPlayer?.teamId)
  const me = currentPlayer(session)
  const choicesUnlocked = Boolean(
    session?.config.answerMode === "multiple-choice" &&
    session.activeItem?.multipleChoiceUnlocksAt &&
    new Date(session.activeItem.multipleChoiceUnlocksAt).getTime() <= now,
  )
  // Classroom turn messaging mirrors server room rules without changing them.
  // A stored player can require rejoin when localStorage has a device pass but
  // the server did not recognize this viewer; active-team ownership determines
  // whether the UI frames answers as scoring now or as steal/practice help.
  // Pending-steal state overrides both roles once another team has already
  // found the term and is waiting to see whether the active team misses.
  const storedPlayerNeedsRejoin = Boolean(storedPlayer && session && !session.viewer.playerId)
  const isMyTeamActive = Boolean(session?.activeTeam?.id && session.viewer.teamId === session.activeTeam.id)
  const visibleActiveTeamName = activeTeamName || "the active team"
  const activeTurnHeading = isMyTeamActive ? "Your team's turn" : `${visibleActiveTeamName}'s turn`
  const activeTurnHelp = isMyTeamActive
    ? session?.activeItem?.pendingSteal
      ? "Another team has a steal ready. Answer before time runs out to keep the point."
      : session?.config.answerMode === "host-judged"
        ? "The host is judging this turn. Watch the host screen for the call."
        : choicesUnlocked
          ? "Pick an answer choice before time runs out."
          : session?.config.answerMode === "multiple-choice"
            ? "Type a guess now; answer choices unlock near the end."
            : "Submit a typed answer before time runs out."
    : session?.activeItem?.pendingSteal
      ? "A steal is already queued. Keep guessing for practice."
      : session?.config.answerMode === "host-judged"
        ? "The host is judging this turn. Follow along for practice."
        : choicesUnlocked
          ? `Pick an answer choice first to queue a steal if ${visibleActiveTeamName} misses.`
          : `Type the answer first to queue a steal if ${visibleActiveTeamName} misses.`
  const isAnonymousComplete = Boolean(joined && me && !me.signedIn && (session?.status === "GAME_COMPLETE" || session?.status === "REVIEW"))
  const showTypedInput = Boolean(
    session?.activeItem &&
    !attempt.correct &&
    !attempt.outOfTypedGuesses &&
    (session.config.answerMode === "typed" || (session.config.answerMode === "multiple-choice" && !choicesUnlocked)),
  )
  const showChoices = Boolean(
    session?.activeItem &&
    choicesUnlocked &&
    !attempt.correct &&
    attempt.choiceAttempts === 0 &&
    session.activeItem.choices.length === 4,
  )
  const joinGame = async () => {
    if (joinInFlightRef.current || joiningGame || Date.now() < joinRetryUntil) return
    const nextLookupCode = lookupCode || normalizeAnatomimeClientRoomCode(code)
    if (!nextLookupCode) {
      setLookupCode(normalizeAnatomimeClientRoomCode(code))
      return
    }
    if (!displayName.trim()) {
      setMessage("Enter a display name.")
      return
    }

    joinInFlightRef.current = true
    setJoiningGame(true)
    try {
      const response = await fetch(`/api/anatomime/sessions/${encodeURIComponent(nextLookupCode)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          teamId: selectedTeamId || session?.teams[0]?.id,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 429) {
          const retrySeconds = anatomimeRetryAfterSeconds(response)
          if (retrySeconds > 0) setJoinRetryUntil(Date.now() + retrySeconds * 1_000)
        }
        setMessage(payload.error ?? "Could not join game.")
        return
      }

      const player = {
        playerId: payload.player.id,
        playerToken: payload.player.token,
        teamId: payload.player.teamId,
      }

      writeStoredPlayer(nextLookupCode, player)
      setLookupCode(nextLookupCode)
      setStoredPlayerRecord({ code: nextLookupCode, player })
      setSession(payload.session)
      setJoinRetryUntil(0)
      setPollTerminal(null)
      setPollStatus("")
      setMessage("")
    } catch {
      setMessage("Could not join game.")
    } finally {
      joinInFlightRef.current = false
      setJoiningGame(false)
    }
  }

  const changeTeam = async (teamId: string) => {
    if (!storedPlayer || !session || session.status !== "LOBBY") return

    try {
      const response = await fetch(`/api/anatomime/sessions/${encodeURIComponent(session.code)}/team`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anatomime-player-id": storedPlayer.playerId,
          "x-anatomime-player-token": storedPlayer.playerToken,
        },
        body: JSON.stringify({ teamId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? "Could not change teams.")
        return
      }

      const nextPlayer = { ...storedPlayer, teamId }
      writeStoredPlayer(session.code, nextPlayer)
      setStoredPlayerRecord({ code: session.code, player: nextPlayer })
      setSelectedTeamId(teamId)
      setSession(payload.session)
      setMessage("Team updated.")
    } catch {
      setMessage("Could not change teams.")
    }
  }

  const submitGuess = async (choiceId?: string) => {
    if (!storedPlayer || !session?.activeItem || !termKey) return
    const answerKind = choiceId ? "choice" : "typed"
    if (answerKind === "typed" && !answer.trim()) return

    try {
      const response = await fetch(`/api/anatomime/sessions/${encodeURIComponent(lookupCode)}/guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anatomime-player-id": storedPlayer.playerId,
          "x-anatomime-player-token": storedPlayer.playerToken,
        },
        body: JSON.stringify({
          playerId: storedPlayer.playerId,
          answer,
          choiceId,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? "Could not submit guess.")
        return
      }

      const feedbackKind = String(payload.result?.feedbackKind ?? (payload.result?.correct ? "practice-correct" : "incorrect"))
      const typedAttempts = answerKind === "typed" ? attempt.typedAttempts + 1 : attempt.typedAttempts
      const choiceAttempts = answerKind === "choice" ? attempt.choiceAttempts + 1 : attempt.choiceAttempts
      const locksInput = ["active-correct", "opposing-correct-held", "practice-correct"].includes(feedbackKind)
      const nextFeedback = feedbackCopy[feedbackKind] ?? (payload.result?.correct ? "Correct." : "Incorrect. Try another guess.")

      setAttemptsByTerm((current) => ({
        ...current,
        [termKey]: {
          typedAttempts,
          choiceAttempts,
          correct: locksInput,
          outOfTypedGuesses: typedAttempts >= 5 && !payload.result?.correct,
          feedback: typedAttempts >= 5 && !payload.result?.correct ? "Out of guesses for this term." : nextFeedback,
        },
      }))
      setSession(payload.session)
      setAnswer("")
      setMessage(typedAttempts >= 5 && !payload.result?.correct ? "Out of guesses for this term." : nextFeedback)
    } catch {
      setMessage("Could not submit guess.")
    }
  }

  const requestHostVote = async () => {
    if (!storedPlayer || !session) return

    try {
      const response = await fetch(`/api/anatomime/sessions/${encodeURIComponent(session.code)}/host-election`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anatomime-player-id": storedPlayer.playerId,
          "x-anatomime-player-token": storedPlayer.playerToken,
        },
        body: JSON.stringify({ action: "request" }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? "Could not request host vote.")
        return
      }
      setSession(payload.session)
      setMessage("Host vote requested.")
    } catch {
      setMessage("Could not request host vote.")
    }
  }

  const submitHostVote = async (action: "vote" | "resolve") => {
    if (!storedPlayer || !session) return

    try {
      const response = await fetch(`/api/anatomime/sessions/${encodeURIComponent(session.code)}/host-election`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anatomime-player-id": storedPlayer.playerId,
          "x-anatomime-player-token": storedPlayer.playerToken,
        },
        body: JSON.stringify(action === "vote" ? { action, rankedPlayerIds: visibleRankedPlayerIds } : { action }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? "Could not update host vote.")
        return
      }
      setSession(payload.session)
      setMessage(action === "vote" ? "Vote submitted." : "Host vote resolved.")
    } catch {
      setMessage("Could not update host vote.")
    }
  }

  const toggleRankedCandidate = (playerId: string) => {
    setRankedPlayerIds((current) => (
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId]
    ))
  }

  const clearStoredPlayer = () => {
    if (lookupCode) removeStoredPlayer(lookupCode)
    setStoredPlayerRecord({ code: lookupCode, player: null })
    setSelectedTeamId(session?.teams[0]?.id ?? "")
    setPollTerminal(null)
    setPollStatus("")
    setMessage("")
  }

  const findGame = () => {
    const nextLookupCode = normalizeAnatomimeClientRoomCode(code)
    setPollTerminal(null)
    setPollStatus("")
    setInitialLookupPending(Boolean(nextLookupCode))
    setLookupCode(nextLookupCode)
  }

  const leaveEndedRoom = () => {
    setLookupCode("")
    setCode("")
    setSession(null)
    setPollTerminal(null)
    setPollStatus("")
    setInitialLookupPending(false)
  }

  return (
    <div className="anatomime-page">
      <MovingBackground className="anatomime-background" testId="anatomime-moving-background" />
      <div className="anatomime-shell">
        <header className="anatomime-header">
          <div>
            <PageHeading>Anatomime</PageHeading>
            <p className="anatomime-subtitle">Join a shared classroom game and submit guesses from your device.</p>
          </div>
          <div className="anatomime-status">
            {lookupCode ? <span>Code {lookupCode}</span> : null}
            {session ? <span>{session.phase}</span> : null}
            {joined && myTeam ? <span>{myTeam.name}</span> : null}
          </div>
        </header>

        {message ? <div className="anatomime-message" role="status" aria-live="polite">{message}</div> : null}
        <div className={pollStatus ? "anatomime-message" : "anatomime-poll-status"} role="status" aria-live="polite">
          {pollStatus}
        </div>

        {lookupCode && initialLookupPending && !session && !pollTerminal ? (
          <section className="anatomime-panel" aria-busy="true">
            <div className="anatomime-message" role="status" aria-live="polite">
              Loading shared game…
            </div>
          </section>
        ) : null}

        {lookupCode && pollTerminal ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <div>
                <h2>{pollTerminal === "ROOM_ENDED" ? "Shared game ended" : "Rejoin required"}</h2>
                <p>{pollTerminal === "ROOM_ENDED"
                  ? "This room is no longer available. Enter another code when you are ready."
                  : "Clear the saved player pass, then rejoin this room with your display name."}</p>
              </div>
            </div>
            {pollTerminal === "ROOM_ENDED" ? (
              <AnatomimeActionButton type="button" intent="secondary" onClick={leaveEndedRoom}>
                <RotateCcw className="h-4 w-4" />
                Find Another Game
              </AnatomimeActionButton>
            ) : (
              <AnatomimeActionButton type="button" intent="secondary" onClick={clearStoredPlayer}>
                <RotateCcw className="h-4 w-4" />
                Clear Saved Player
              </AnatomimeActionButton>
            )}
          </section>
        ) : null}

        {showCodeEntry ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <h2>Game Code</h2>
            </div>
            <div className="anatomime-control-group">
              <Label htmlFor="anatomime-code">Code</Label>
              <Input id="anatomime-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="anatomime-input" />
            </div>
            <AnatomimeActionButton type="button" intent="primary" onClick={findGame}>
              <LogIn className="h-4 w-4" />
              Find Game
            </AnatomimeActionButton>
          </section>
        ) : null}

        {lookupCode && session && !joined && !pollTerminal ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <div>
                <h2>Join {lookupCode}</h2>
                <p>{session.players.filter((player) => !player.isHost).length} players in lobby.</p>
              </div>
            </div>
            {storedPlayerNeedsRejoin ? (
              <div className="anatomime-rejoin-notice">
                <div>
                  <strong>Rejoin needed on this device</strong>
                  <p>Your saved player pass no longer matches this room. Rejoin with your name below, or clear the saved pass first.</p>
                </div>
                <AnatomimeActionButton type="button" intent="secondary" onClick={clearStoredPlayer}>
                  <RotateCcw className="h-4 w-4" />
                  Clear Saved Player
                </AnatomimeActionButton>
              </div>
            ) : null}
            <div className="anatomime-grid-2">
              <div className="anatomime-control-group">
                <Label htmlFor="display-name">Display name</Label>
                <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="anatomime-input" />
              </div>
              <div className="anatomime-control-group">
                <Label>Team</Label>
                <div className="anatomime-segmented">
                  {session.teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className="anatomime-choice-button"
                      data-selected={(selectedTeamId || session.teams[0]?.id) === team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <AnatomimeActionButton type="button" intent="primary" onClick={joinGame} disabled={joinLocked}>
              <Users className="h-4 w-4" />
              {joiningGame ? "Joining..." : joinRetrySeconds > 0 ? `Try again in ${joinRetrySeconds}s` : "Join Team"}
            </AnatomimeActionButton>
            <div className="anatomime-poll-status" role="status" aria-live="polite">
              {joinRetrySeconds > 0
                ? `Joining is paused for ${joinRetrySeconds} more second${joinRetrySeconds === 1 ? "" : "s"}. You can retry when the countdown ends.`
                : ""}
            </div>
          </section>
        ) : null}

        {joined && session && !pollTerminal ? (
          <section className="anatomime-panel anatomime-play-panel">
            <div className="anatomime-score-grid">
              {session.teams.map((team) => (
                <div key={team.id} className="anatomime-score" data-active={session.activeTeam?.id === team.id}>
                  <span>{team.name}</span>
                  <strong>{team.score}</strong>
                </div>
              ))}
            </div>

            {session.status === "LOBBY" ? (
              <div className="anatomime-current-term">
                <h2>Lobby</h2>
                <p>Waiting for the host to start.</p>
                <div className="anatomime-segmented" role="group" aria-label="Choose team">
                  {session.teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className="anatomime-choice-button"
                      data-selected={session.viewer.teamId === team.id}
                      aria-pressed={session.viewer.teamId === team.id}
                      onClick={() => changeTeam(team.id)}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {session.status === "PLAYING" && session.activeItem ? (
              <>
                <div className="anatomime-timer">{secondsLeft(session.phaseEndsAt, now)}s</div>
                <div className="anatomime-current-term">
                  <span>{session.activeItem.index + 1} of {session.activeItem.total}</span>
                  <h2>{activeTurnHeading}</h2>
                  <p>{visibleActiveTeamName} is guessing now.</p>
                  <div className="anatomime-role-callout" data-active={isMyTeamActive}>
                    <strong>{isMyTeamActive ? "Active team" : "Steal/practice mode"}</strong>
                    <span>{activeTurnHelp}</span>
                  </div>
                </div>

                {attempt.feedback ? <div className="anatomime-message" role="status">{attempt.feedback}</div> : null}

                {showTypedInput ? (
                  <div className="anatomime-control-group">
                    <Label htmlFor="guess">Guess</Label>
                    <Input
                      id="guess"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void submitGuess()
                      }}
                      className="anatomime-input"
                    />
                    <AnatomimeActionButton type="button" intent="primary" onClick={() => submitGuess()}>
                      <Send className="h-4 w-4" />
                      Submit Guess
                    </AnatomimeActionButton>
                    <p className="anatomime-review-meta">{Math.max(0, 5 - attempt.typedAttempts)} typed guesses left.</p>
                  </div>
                ) : null}

                {showChoices && session.activeItem ? (
                  <div className="anatomime-region-grid" role="group" aria-label="Multiple choice answers">
                    {session.activeItem.choices.map((choice) => (
                      <button key={choice.id} type="button" className="anatomime-region-button" onClick={() => submitGuess(choice.id)}>
                        <span>{choice.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {session.config.answerMode === "multiple-choice" && !choicesUnlocked && !attempt.correct ? (
                  <p className="anatomime-review-meta">Multiple choice unlocks near the end of the term.</p>
                ) : null}
              </>
            ) : null}

            {session.phase === "TURN_REVIEW" ? (
              <div className="anatomime-current-term">
                <h2>Turn Review</h2>
                <p>The host is setting up the next team.</p>
              </div>
            ) : null}

            {session.status === "GAME_COMPLETE" || session.status === "REVIEW" ? (
              <div className="anatomime-learning-review">
                <div className="anatomime-section-heading compact centered">
                  <div>
                    <h3>Game recap</h3>
                    {session.status === "REVIEW" ? <p>Review ends in {secondsLeft(session.reviewExpiresAt, now)}s.</p> : null}
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
                {isAnonymousComplete ? <p className="anatomime-message">Sign in next time to save your Anatomime progress.</p> : null}
              </div>
            ) : null}

            {joined && session.hostCanBeChallenged && !session.hostElection ? (
              <AnatomimeActionButton type="button" intent="secondary" onClick={requestHostVote}>
                Request Host Vote
              </AnatomimeActionButton>
            ) : null}

            {joined && session.hostElection ? (
              <div className="anatomime-learning-review">
                <div className="anatomime-section-heading compact">
                  <div>
                    <h3>Host vote</h3>
                    <p>Rank players in your preferred host order.</p>
                  </div>
                </div>
                <div className="anatomime-selection-toolbar">
                  {session.hostElection.candidatePlayerIds.map((playerId) => (
                    <button
                      key={playerId}
                      type="button"
                      className="anatomime-choice-button"
                      data-selected={rankedPlayerIds.includes(playerId)}
                      onClick={() => toggleRankedCandidate(playerId)}
                    >
                      {rankedPlayerIds.includes(playerId) ? `${rankedPlayerIds.indexOf(playerId) + 1}. ` : ""}
                      {playerName(session, playerId)}
                    </button>
                  ))}
                </div>
                <div className="anatomime-actions">
                  <AnatomimeActionButton type="button" intent="primary" onClick={() => submitHostVote("vote")} disabled={visibleRankedPlayerIds.length === 0}>
                    Submit Vote
                  </AnatomimeActionButton>
                  {new Date(session.hostElection.closesAt).getTime() <= now ? (
                    <AnatomimeActionButton type="button" intent="secondary" onClick={() => submitHostVote("resolve")}>
                      Resolve Vote
                    </AnatomimeActionButton>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
