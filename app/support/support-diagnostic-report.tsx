"use client"

import * as React from "react"
import { Bug, Clipboard, MailCheck, Send } from "lucide-react"
import { AppNotice, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader } from "@/components/ui/loader"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PROBLEM_REPORT_AREAS,
  PROBLEM_REPORT_CATEGORIES,
  PROBLEM_REPORT_REQUEST_TIMEOUT_MS,
  normalizeLinkedSentryEventId,
  problemReportAreaById,
  problemReportCategoryById,
  problemReportRetryAnnouncement,
} from "@/lib/problem-report"
import { buildSupportMailtoUrl } from "@/lib/support-contact"
import { fetchJsonWithTimeout } from "@/lib/client-fetch"

type DiagnosticResponse = {
  eventId?: unknown
}

type DiagnosticStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | {
      kind: "sent"
      result: { eventId: string }
      submission: { category: string; area: string }
    }
  | { kind: "rate-limited"; retryAt: number }
  | { kind: "unavailable" }
  | { kind: "ambiguous" }

type SupportDiagnosticReportProps = {
  linkedEventId?: string
}

export function SupportDiagnosticReport({ linkedEventId = "" }: SupportDiagnosticReportProps) {
  const [category, setCategory] = React.useState("action-failed")
  const [area, setArea] = React.useState("not-sure")
  const [status, setStatus] = React.useState<DiagnosticStatus>({ kind: "idle" })
  const [now, setNow] = React.useState(() => Date.now())
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "failed">("idle")
  const retryTimerRef = React.useRef<number | null>(null)
  const retryDeadlineTimerRef = React.useRef<number | null>(null)
  const mountedRef = React.useRef(false)
  const requestGenerationRef = React.useRef(0)
  const requestAbortRef = React.useRef<AbortController | null>(null)

  const sentSubmission = status.kind === "sent" ? status.submission : { category, area }
  const selectedCategory = problemReportCategoryById(sentSubmission.category)
  const selectedArea = problemReportAreaById(sentSubmission.area)
  const diagnosticId = status.kind === "sent" ? status.result.eventId ?? "" : ""
  const canUseDiagnosticId = Boolean(diagnosticId)
  const emailUrl = canUseDiagnosticId
    ? buildSupportMailtoUrl({
        topic: "Problem report",
        diagnosticId,
        message: [
          `Diagnostic report ID: ${diagnosticId}`,
          `Tool area: ${selectedArea.label}`,
          `Issue type: ${selectedCategory.label}`,
          "",
          "Please describe what happened. Do not include client names, contact details, symptoms, notes, diagnoses, treatment details, or other sensitive health information.",
        ].join("\n"),
      })
    : ""

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestGenerationRef.current += 1
      requestAbortRef.current?.abort()
      requestAbortRef.current = null
      if (retryTimerRef.current !== null) {
        window.clearInterval(retryTimerRef.current)
      }
      if (retryDeadlineTimerRef.current !== null) {
        window.clearTimeout(retryDeadlineTimerRef.current)
      }
    }
  }, [])

  const retrySeconds = status.kind === "rate-limited"
    ? Math.max(0, Math.ceil((status.retryAt - now) / 1_000))
    : 0
  const retryBlocked = status.kind === "rate-limited" && retrySeconds > 0
  const isSending = status.kind === "sending"
  const isRetry = ["rate-limited", "unavailable", "ambiguous"].includes(status.kind)
  const statusAnnouncement = status.kind === "sent" && diagnosticId
    ? `Diagnostic report sent. Sentry reference: ${diagnosticId}.`
    : status.kind === "rate-limited"
      ? problemReportRetryAnnouncement(retrySeconds)
      : status.kind === "unavailable"
        ? "Diagnostic report temporarily unavailable. Try again manually when you are ready."
        : status.kind === "ambiguous"
          ? "MassageLab could not confirm whether the diagnostic report was sent. This page will not resend it automatically."
          : ""

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (retryBlocked || isSending) return

    requestAbortRef.current?.abort()
    const requestGeneration = requestGenerationRef.current + 1
    requestGenerationRef.current = requestGeneration
    const requestAbort = new AbortController()
    requestAbortRef.current = requestAbort
    if (retryTimerRef.current !== null) {
      window.clearInterval(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (retryDeadlineTimerRef.current !== null) {
      window.clearTimeout(retryDeadlineTimerRef.current)
      retryDeadlineTimerRef.current = null
    }
    setStatus({ kind: "sending" })
    setCopyState("idle")
    const submission = { category, area }

    const displayMode = window.matchMedia("(display-mode: standalone)").matches
      ? "standalone"
      : "browser"

    try {
      const { response, json: body } = await fetchJsonWithTimeout<DiagnosticResponse | null>(
        "/api/support/problem-report",
        {
          method: "POST",
          signal: requestAbort.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: submission.category,
            area: submission.area,
            route: window.location.pathname,
            linkedEventId,
            clientContext: {
              displayMode,
              online: navigator.onLine,
              viewportWidth: window.innerWidth,
            },
          }),
        },
        PROBLEM_REPORT_REQUEST_TIMEOUT_MS,
      )

      if (!mountedRef.current || requestGenerationRef.current !== requestGeneration) return

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After")
        if (retryAfter && /^[1-9]\d*$/.test(retryAfter)) {
          const observedAt = Date.now()
          const retryAt = observedAt + (Number(retryAfter) * 1_000)
          setNow(observedAt)
          setStatus({
            kind: "rate-limited",
            retryAt,
          })
          // Register immediately rather than waiting for a passive effect, so
          // the deadline remains owned even when the browser clock is paused.
          retryTimerRef.current = window.setInterval(() => {
            const tick = Date.now()
            setNow(tick)
            if (tick >= retryAt && retryTimerRef.current !== null) {
              window.clearInterval(retryTimerRef.current)
              retryTimerRef.current = null
            }
          }, 250)
          retryDeadlineTimerRef.current = window.setTimeout(() => {
            setNow(retryAt)
            if (retryTimerRef.current !== null) {
              window.clearInterval(retryTimerRef.current)
              retryTimerRef.current = null
            }
            retryDeadlineTimerRef.current = null
          }, retryAt - observedAt)
        } else {
          setStatus({ kind: "unavailable" })
        }
        return
      }

      if (response.status === 503) {
        setStatus({ kind: "unavailable" })
        return
      }

      if (!response.ok) {
        setStatus({ kind: "ambiguous" })
        return
      }

      const confirmedEventId = normalizeLinkedSentryEventId(body?.eventId)
      if (!confirmedEventId) {
        setStatus({ kind: "ambiguous" })
        return
      }

      if (!mountedRef.current || requestGenerationRef.current !== requestGeneration) return
      setStatus({ kind: "sent", result: { eventId: confirmedEventId }, submission })
    } catch {
      if (
        requestAbort.signal.aborted
        || !mountedRef.current
        || requestGenerationRef.current !== requestGeneration
      ) return
      setStatus({ kind: "ambiguous" })
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
        requestAbortRef.current = null
      }
    }
  }

  async function copyDiagnosticId() {
    if (!diagnosticId) {
      return
    }

    try {
      await navigator.clipboard.writeText(diagnosticId)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  return (
    <AppSurface
      title="Send a diagnostic report"
      description="This sends a privacy-safe Sentry event with the selected tool area, issue type, browser category, and display state. It does not upload screenshots, typed form text, local vault contents, or full URLs."
      icon={<Bug className="h-5 w-5" aria-hidden="true" />}
    >
      <form onSubmit={handleSubmit} aria-busy={isSending} className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="diagnostic-area">Tool area</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger id="diagnostic-area">
                <SelectValue placeholder="Choose a tool area" />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_REPORT_AREAS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="diagnostic-category">Issue type</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="diagnostic-category">
                <SelectValue placeholder="Choose an issue type" />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_REPORT_CATEGORIES.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AppNotice
          title="No clinical details in this report"
          description="For notes, intake, journal, ROM, and wellness tools, MassageLab only sends a coarse product area so Sentry can alert on the problem without receiving PHI-capable content."
          tone="accent"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSending || retryBlocked}>
            {isSending ? (
              <Loader aria-hidden="true" label="Sending diagnostic" size={18} color="currentColor" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {isSending ? "Sending..." : isRetry ? "Try Diagnostic Again" : "Send Diagnostic"}
          </Button>

          {canUseDiagnosticId ? (
            <>
              <Button type="button" variant="outline" onClick={copyDiagnosticId}>
                <Clipboard className="mr-2 h-4 w-4" aria-hidden="true" />
                {copyState === "copied" ? "Copied" : "Copy ID"}
              </Button>
              <Button asChild type="button" variant="outline">
                <a href={emailUrl}>
                  <MailCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  Open Email
                </a>
              </Button>
            </>
          ) : null}
        </div>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {statusAnnouncement}
        </p>

        <div>
          {status.kind === "sent" && diagnosticId ? (
            <AppNotice
              title="Diagnostic report sent"
              description={`Sentry reference: ${diagnosticId}. Include this ID if you send a support email.`}
            />
          ) : null}

          {status.kind === "rate-limited" ? (
            <AppNotice
              title="Diagnostic reports temporarily paused"
              description={retrySeconds > 0
                ? `Please wait ${retrySeconds} ${retrySeconds === 1 ? "second" : "seconds"} before trying again. This page will not resend the report automatically.`
                : "You can try again now. This page will not resend the report automatically."}
              tone="accent"
            />
          ) : null}

          {status.kind === "unavailable" ? (
            <AppNotice
              title="Diagnostic report temporarily unavailable"
              description="Try again manually when you are ready. The email support form still works without a diagnostic ID."
              tone="accent"
            />
          ) : null}

          {status.kind === "ambiguous" ? (
            <AppNotice
              title="Diagnostic report delivery uncertain"
              description="MassageLab could not confirm whether it was sent. Try again manually only if you still need to; this page will not resend it automatically. The email support form still works without a diagnostic ID."
              tone="destructive"
            />
          ) : null}
        </div>

        {copyState === "failed" ? (
          <AppNotice
            title="Copy failed"
            description="Select and copy the Sentry reference from the message above."
            tone="destructive"
          />
        ) : null}
      </form>
    </AppSurface>
  )
}
