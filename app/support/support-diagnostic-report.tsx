"use client"

import * as React from "react"
import { Bug, Clipboard, MailCheck, Send } from "lucide-react"
import { AppNotice, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  problemReportAreaById,
  problemReportCategoryById,
} from "@/lib/problem-report"
import { buildSupportMailtoUrl } from "@/lib/support-contact"

type DiagnosticResponse = {
  eventId?: string
  area?: string
  privacyLevel?: string
}

type SupportDiagnosticReportProps = {
  linkedEventId?: string
}

export function SupportDiagnosticReport({ linkedEventId = "" }: SupportDiagnosticReportProps) {
  const [category, setCategory] = React.useState("action-failed")
  const [area, setArea] = React.useState("not-sure")
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "failed">("idle")
  const [result, setResult] = React.useState<DiagnosticResponse | null>(null)
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "failed">("idle")

  const selectedCategory = problemReportCategoryById(category)
  const selectedArea = problemReportAreaById(area)
  const diagnosticId = result?.eventId ?? ""
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("sending")
    setResult(null)
    setCopyState("idle")

    const displayMode = window.matchMedia("(display-mode: standalone)").matches
      ? "standalone"
      : "browser"

    try {
      const response = await fetch("/api/support/problem-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          area,
          route: window.location.pathname,
          linkedEventId,
          clientContext: {
            displayMode,
            online: navigator.onLine,
            viewportWidth: window.innerWidth,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Problem report request failed.")
      }

      const body = await response.json() as DiagnosticResponse
      setResult(body)
      setStatus("sent")
    } catch {
      setStatus("failed")
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
      <form onSubmit={handleSubmit} className="grid gap-5">
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
          <Button type="submit" disabled={status === "sending"} className="bg-primary hover:bg-brand-orange-glow">
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {status === "sending" ? "Sending..." : "Send Diagnostic"}
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

        {status === "sent" && diagnosticId ? (
          <AppNotice
            title="Diagnostic report sent"
            description={`Sentry reference: ${diagnosticId}. Include this ID if you send a support email.`}
          />
        ) : null}

        {status === "failed" ? (
          <AppNotice
            title="Diagnostic report was not sent"
            description="The email support form still works without a diagnostic ID."
            tone="destructive"
          />
        ) : null}

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
