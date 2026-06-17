"use client"

import { useMemo } from "react"
import { BarChart3, Download } from "lucide-react"
import type { WellnessTimelineEntry } from "@/components/wellness/wellness-hub-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  buildClientWellnessPatternReport,
  clientWellnessReportFilename,
} from "@/lib/client-wellness-patterns"

type CountRow = {
  label: string
  count: number
}

type ReportWindow = {
  id: string
  label: string
  entryCount: number
  categoryCounts: CountRow[]
}

type PatternPrompt = {
  id: string
  title: string
  detail: string
  confidence: string
  supportingEntryCount: number
}

type RomMovementSummary = {
  movement: string
  entryCount: number
  latestDegrees: number
  previousDegrees: number
  changeSincePrevious: number
}

type WellnessPatternReportData = {
  generatedAt: string
  entryCount: number
  windows: ReportWindow[]
  categoryBreakdown: CountRow[]
  topRegions: CountRow[]
  topSensations: CountRow[]
  topContexts: CountRow[]
  averageIntensity: number | null
  romMovements: RomMovementSummary[]
  patternPrompts: PatternPrompt[]
}

export function WellnessPatternReport({
  entries,
  isSignedIn,
}: {
  entries: WellnessTimelineEntry[]
  isSignedIn: boolean
}) {
  const report = useMemo(() => (
    buildClientWellnessPatternReport(entries) as WellnessPatternReportData
  ), [entries])
  const hasEntries = report.entryCount > 0

  const downloadReport = () => {
    if (!hasEntries) {
      return
    }

    downloadJson(clientWellnessReportFilename(new Date()), {
      ...report,
      note: isSignedIn
        ? "This report uses saved self-tracking entries loaded into this browser."
        : "This report uses practice entries from this page session only.",
    })
  }

  return (
    <section className="rounded-md border border-border/80 bg-card/95 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            Pattern review
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {isSignedIn
              ? "This report uses your saved self-tracking entries only."
              : "This report uses practice entries in this page session only."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadReport} disabled={!hasEntries}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download report
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {report.windows.map((window) => (
          <Badge key={window.id} variant="outline">
            {window.label}: {window.entryCount}
          </Badge>
        ))}
        {report.averageIntensity !== null ? (
          <Badge variant="secondary">Avg intensity {report.averageIntensity}/10</Badge>
        ) : null}
      </div>

      {!hasEntries ? (
        <p className="mt-4 rounded-md border border-border/80 bg-background/80 p-3 text-sm text-muted-foreground">
          Add a few entries to see trend rows and reflection prompts.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TrendRows title="Categories" rows={report.categoryBreakdown} />
            <TrendRows title="Regions" rows={report.topRegions} />
            <TrendRows title="Sensations" rows={report.topSensations} />
            <TrendRows title="Contexts" rows={report.topContexts} />
          </div>

          <PatternPrompts prompts={report.patternPrompts} />
          <RomReferences movements={report.romMovements} />
        </div>
      )}
    </section>
  )
}

function TrendRows({ title, rows }: { title: string; rows: CountRow[] }) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count))

  return (
    <div className="rounded-md border border-border/80 bg-background/85 p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {rows.map((row) => (
            <div key={`${title}-${row.label}`} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{formatLabel(row.label)}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-orange"
                  style={{ width: `${Math.max(8, Math.round((row.count / maxCount) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PatternPrompts({ prompts }: { prompts: PatternPrompt[] }) {
  return (
    <div className="rounded-md border border-border/80 bg-background/85 p-3">
      <h3 className="text-sm font-medium">Tracking prompts</h3>
      {prompts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          More repeated signals will unlock confidence-labeled reflection prompts.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="rounded-md border border-border/80 bg-card/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{prompt.title}</p>
                <Badge variant="outline">{prompt.confidence}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{prompt.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {prompt.supportingEntryCount} supporting entries
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RomReferences({ movements }: { movements: RomMovementSummary[] }) {
  if (movements.length === 0) {
    return null
  }

  return (
    <div className="rounded-md border border-border/80 bg-background/85 p-3">
      <h3 className="text-sm font-medium">ROM references</h3>
      <div className="mt-3 grid gap-2">
        {movements.map((movement) => (
          <div key={movement.movement} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/80 bg-card/80 p-3 text-sm">
            <div>
              <p className="font-medium">{formatLabel(movement.movement)}</p>
              <p className="text-xs text-muted-foreground">{movement.entryCount} measurements</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Latest {movement.latestDegrees} deg</p>
              <p>Previous {movement.previousDegrees} deg</p>
              <p>Change {formatSignedDegrees(movement.changeSincePrevious)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

function formatSignedDegrees(value: number) {
  return `${value > 0 ? "+" : ""}${value} deg`
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
