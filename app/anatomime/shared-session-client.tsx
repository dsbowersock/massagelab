"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LogIn, Send, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { MovingBackground } from "@/components/moving-background"
import "./styles.css"

type AnatomimeTeamSummary = {
  id: string
  name: string
  sortOrder: number
  score: number
}

type AnatomimePlayerSummary = {
  id: string
  teamId: string | null
  displayName: string
  role: string
  signedIn: boolean
}

type AnatomimeSessionSummary = {
  code: string
  status: string
  phase: string
  phaseEndsAt: string | null
  config: {
    answerMode: "typed" | "multiple-choice"
  }
  teams: AnatomimeTeamSummary[]
  players: AnatomimePlayerSummary[]
  viewer: {
    playerId: string | null
    teamId: string | null
    isHost: boolean
  }
  activeTeam: {
    id: string
    name: string
    sortOrder: number
  } | null
  activeItem: {
    index: number
    total: number
    prompt: {
      categoryLabel?: string
      regionLabels?: string[]
      difficulty?: string
    }
    choices: Array<{ id: string; label: string }>
  } | null
  recentGuesses: Array<{
    id: string
    teamId: string
    playerId: string | null
    correct: boolean
    scoreAwarded: number
  }>
}

type StoredPlayer = {
  playerId: string
  playerToken: string
  teamId: string | null
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
      }) => {
        channels: {
          get: (name: string) => {
            subscribe: (callback: () => void) => void
            unsubscribe: () => void
          }
        }
        close: () => void
      }
    }
  }
}

function storageKey(code: string) {
  return `massagelab-anatomime-player:${code.toUpperCase()}`
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

function secondsLeft(value: string | null) {
  if (!value) return 0
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000))
}

/**
 * Loads the browser Ably SDK once for shared-session updates. It takes no
 * arguments and returns a Promise that resolves after the script loads or
 * rejects on failure; callers should fall back to polling when it rejects. The
 * loader checks `window.Ably`, reuses `script[data-anatomime-ably]`, records
 * `data-anatomime-ably-status`, and appends a new script to `document.head`
 * only in the browser.
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
  const normalizedInitialCode = initialCode.trim().toUpperCase()
  const [code, setCode] = useState(normalizedInitialCode)
  const [lookupCode, setLookupCode] = useState(normalizedInitialCode)
  const [displayName, setDisplayName] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [answer, setAnswer] = useState("")
  const [storedPlayer, setStoredPlayer] = useState<StoredPlayer | null>(null)
  const [session, setSession] = useState<AnatomimeSessionSummary | null>(null)
  const [message, setMessage] = useState("")
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!lookupCode) return
    setStoredPlayer(readStoredPlayer(lookupCode))
  }, [lookupCode])

  const playerQuery = useMemo(() => {
    if (!storedPlayer) return ""
    return `?playerId=${encodeURIComponent(storedPlayer.playerId)}`
  }, [storedPlayer])

  const playerHeaders = useMemo(() => (
    storedPlayer
      ? {
        "x-anatomime-player-id": storedPlayer.playerId,
        "x-anatomime-player-token": storedPlayer.playerToken,
      }
      : undefined
  ), [storedPlayer])

  const refreshSession = useCallback(async () => {
    if (!lookupCode) return

    try {
      const response = await fetch(`/api/anatomime/sessions/${encodeURIComponent(lookupCode)}${playerQuery}`, {
        cache: "no-store",
        headers: playerHeaders,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? "Game not found.")
        setSession(null)
        return
      }

      setSession(payload.session)
      setSelectedTeamId((current) => current || payload.session?.teams?.[0]?.id || "")
      setTimeLeft(secondsLeft(payload.session?.phaseEndsAt ?? null))
      setMessage("")
    } catch {
      setMessage("Could not refresh game.")
      setSession(null)
    }
  }, [lookupCode, playerHeaders, playerQuery])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  useEffect(() => {
    if (!lookupCode || !storedPlayer) return
    const realtimePlayer = storedPlayer
    let cancelled = false
    let ablyClient: AblyRealtimeClient | null = null
    let fallbackTimer: number | null = null

    async function connectRealtime() {
      try {
        const tokenResponse = await fetch(`/api/anatomime/sessions/${encodeURIComponent(lookupCode)}/realtime-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: realtimePlayer.playerId }),
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
          void refreshSession()
        })
      } catch {
        fallbackTimer = window.setInterval(() => {
          void refreshSession()
        }, 1500)
      }
    }

    void connectRealtime()

    return () => {
      cancelled = true
      if (fallbackTimer) window.clearInterval(fallbackTimer)
      ablyClient?.close()
    }
  }, [lookupCode, refreshSession, storedPlayer])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(secondsLeft(session?.phaseEndsAt ?? null))
    }, 500)

    return () => window.clearInterval(timer)
  }, [session?.phaseEndsAt])

  const joinGame = async () => {
    if (!lookupCode) {
      setLookupCode(code.trim().toUpperCase())
      return
    }
    if (!displayName.trim()) {
      setMessage("Enter a display name.")
      return
    }

    try {
      const response = await fetch(`/api/anatomime/sessions/${encodeURIComponent(lookupCode)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          teamId: selectedTeamId || session?.teams[0]?.id,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? "Could not join game.")
        return
      }

      const player = {
        playerId: payload.player.id,
        playerToken: payload.player.token,
        teamId: payload.player.teamId,
      }

      writeStoredPlayer(lookupCode, player)
      setStoredPlayer(player)
      setSession(payload.session)
      setMessage("")
    } catch {
      setMessage("Could not join game.")
    }
  }

  const submitGuess = async (choiceId?: string) => {
    if (!storedPlayer || !session?.activeItem) return

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

      setSession(payload.session)
      setAnswer("")
      setMessage(payload.result.correct
        ? payload.result.scoreAwarded > 0 ? "Correct. Point awarded." : "Correct. Saved for steal if needed."
        : "Not quite.")
    } catch {
      setMessage("Could not submit guess.")
    }
  }

  const joined = Boolean(storedPlayer && session?.viewer.playerId)
  const activeTeamName = session?.activeTeam?.name ?? ""
  const myTeam = session?.teams.find((team) => team.id === storedPlayer?.teamId)

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

        {message ? <div className="anatomime-message" role="status">{message}</div> : null}

        {!lookupCode ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <h2>Game Code</h2>
            </div>
            <div className="anatomime-control-group">
              <Label htmlFor="anatomime-code">Code</Label>
              <Input id="anatomime-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="anatomime-input" />
            </div>
            <button type="button" className="anatomime-primary-button" onClick={() => setLookupCode(code.trim().toUpperCase())}>
              <LogIn className="h-4 w-4" />
              Find Game
            </button>
          </section>
        ) : null}

        {lookupCode && session && !joined ? (
          <section className="anatomime-panel">
            <div className="anatomime-section-heading">
              <div>
                <h2>Join {lookupCode}</h2>
                <p>{session.players.filter((player) => player.role === "PLAYER").length} players in lobby.</p>
              </div>
            </div>
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
            <button type="button" className="anatomime-primary-button" onClick={joinGame}>
              <Users className="h-4 w-4" />
              Join Team
            </button>
          </section>
        ) : null}

        {joined && session ? (
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
              </div>
            ) : null}

            {session.status === "PLAYING" && session.activeItem ? (
              <>
                <div className="anatomime-timer">{timeLeft}s</div>
                <div className="anatomime-current-term">
                  <span>{session.activeItem.index + 1} of {session.activeItem.total}</span>
                  <h2>{session.phase === "STEAL" ? "Steal Window" : activeTeamName}</h2>
                  <p>
                    {session.phase === "ACTIVE"
                      ? `${activeTeamName} has the main point window.`
                      : "Opposing teams can claim the missed point."}
                  </p>
                  {session.activeItem.prompt.categoryLabel ? (
                    <small>
                      {session.activeItem.prompt.categoryLabel} · {session.activeItem.prompt.regionLabels?.join(", ")} · {session.activeItem.prompt.difficulty}
                    </small>
                  ) : null}
                </div>

                {session.config.answerMode === "multiple-choice" ? (
                  <div className="anatomime-region-grid">
                    {session.activeItem.choices.map((choice) => (
                      <button key={choice.id} type="button" className="anatomime-region-button" onClick={() => submitGuess(choice.id)}>
                        <span>{choice.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
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
                    <button type="button" className="anatomime-primary-button" onClick={() => submitGuess()}>
                      <Send className="h-4 w-4" />
                      Submit Guess
                    </button>
                  </div>
                )}
              </>
            ) : null}

            {session.status === "COMPLETED" ? (
              <div className="anatomime-current-term">
                <h2>Game Complete</h2>
                <p>Final scores are posted.</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
