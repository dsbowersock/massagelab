"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useTransition } from "react"
import { Download, Save, Trash2 } from "lucide-react"
import {
  createClientWellnessEntryAction,
  deleteClientWellnessEntryAction,
  exportClientWellnessEntriesAction,
} from "@/app/wellness/actions"
import { BodyRegionSelector, BODY_REGION_OPTIONS } from "@/components/wellness/body-region-selector"
import { RomMeasurementPanel, type RomMeasurementDraft } from "@/components/wellness/rom-measurement-panel"
import {
  WellnessCalendarCompanion,
  type ClientWellnessReminderSchedule,
  type WellnessAppointmentSummary,
} from "@/components/wellness/wellness-calendar-companion"
import { WellnessPatternReport } from "@/components/wellness/wellness-pattern-report"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CLIENT_WELLNESS_CATEGORIES } from "@/lib/client-wellness"
import { cn } from "@/lib/utils"

export type WellnessTimelineEntry = {
  id: string
  category: string
  occurredAt: string
  timezone: string
  summary: string | null
  intensity: number | null
  regions: string[]
  sensations: string[]
  contexts: string[]
  source: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  persisted: boolean
}

type ActionData = {
  entry?: WellnessTimelineEntry
  entries?: WellnessTimelineEntry[]
  filename?: string
  exportedAt?: string
}

const categoryLabels: Record<string, string> = {
  body_sensation: "Body sensation",
  emotion: "Feeling",
  rom: "Range of motion",
  sleep: "Sleep",
  activity: "Activity",
  work_context: "Work context",
  home_care: "Home care",
  incident: "Incident",
}

const contextOptions = ["desk", "sleep", "work", "movement", "exercise", "stress", "commute", "home care"]
const sensationOptions = ["tight", "achy", "sharp", "dull", "warm", "tingly", "numb", "tired", "burning", "pins and needles", "heavy", "tender"]
const bodyPositionOptions = ["sitting", "standing", "lying down", "walking", "working", "exercising", "unsure"]
const movementEffectOptions = [
  { value: "unsure", label: "Unsure" },
  { value: "better", label: "Better" },
  { value: "worse", label: "Worse" },
  { value: "unchanged", label: "Unchanged" },
]

export function WellnessHubClient({
  isSignedIn,
  displayName,
  initialEntries,
  appointments,
  reminderSchedules,
}: {
  isSignedIn: boolean
  displayName: string | null
  initialEntries: WellnessTimelineEntry[]
  appointments: WellnessAppointmentSummary[]
  reminderSchedules: ClientWellnessReminderSchedule[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [entries, setEntries] = useState(initialEntries)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState("all")
  const [timelineRegionFilter, setTimelineRegionFilter] = useState("all")
  const [timelineSignalFilter, setTimelineSignalFilter] = useState("all")
  const [acknowledged, setAcknowledged] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmExport, setConfirmExport] = useState(false)
  const [isPending, startTransition] = useTransition()

  const entryCounts = useMemo(() => ({
    total: entries.length,
    rom: entries.filter((entry) => entry.category === "rom").length,
    practice: entries.filter((entry) => !entry.persisted).length,
  }), [entries])

  const timelineSignalOptions = useMemo(() => (
    [...new Set(entries.flatMap((entry) => [...entry.sensations, ...entry.contexts]))].sort((a, b) => a.localeCompare(b))
  ), [entries])
  const timelineRegionOptions = useMemo(() => (
    [...new Set([...BODY_REGION_OPTIONS, ...entries.flatMap((entry) => entry.regions)])].sort((a, b) => a.localeCompare(b))
  ), [entries])

  const filteredEntries = useMemo(() => entries.filter((entry) => (
    matchesTimelineFilter(entry, timelineCategoryFilter, timelineRegionFilter, timelineSignalFilter)
  )), [entries, timelineCategoryFilter, timelineRegionFilter, timelineSignalFilter])

  const saveQuickLog = () => {
    const form = formRef.current

    if (!form) {
      return
    }

    const formData = wellnessFormData(form)

    if (!isSignedIn) {
      const entry = localEntryFromFormData(formData)
      setEntries((current) => [entry, ...current])
      setStatus("Practice entry added for this page session. Sign in before saving anything permanently.")
      setError(null)
      form.reset()
      setSelectedRegions([])
      return
    }

    if (!acknowledged) {
      setError("Acknowledge the self-tracking privacy boundary before saving.")
      return
    }

    startTransition(async () => {
      setError(null)
      const result = await createClientWellnessEntryAction(formData)

      if (!result.ok) {
        setError(actionReason(result.reason, "Could not save this entry."))
        return
      }

      const data = actionData(result.data)
      const entry = normalizeTimelineEntry(data.entry, true)
      if (entry) {
        setEntries((current) => [entry, ...current])
      }
      setStatus("Saved to your client-owned wellness timeline.")
      form.reset()
      setSelectedRegions([])
    })
  }

  const saveRomMeasurement = (draft: RomMeasurementDraft) => {
    const formData = romFormData(draft)

    if (!isSignedIn) {
      const entry = localEntryFromFormData(formData)
      setEntries((current) => [entry, ...current])
      setStatus("Practice ROM measurement added for this page session. Sign in to keep measurements over time.")
      setError(null)
      return
    }

    if (!acknowledged) {
      setError("Acknowledge the self-tracking privacy boundary before saving a ROM measurement.")
      return
    }

    startTransition(async () => {
      setError(null)
      const result = await createClientWellnessEntryAction(formData)

      if (!result.ok) {
        setError(actionReason(result.reason, "Could not save this ROM measurement."))
        return
      }

      const data = actionData(result.data)
      const entry = normalizeTimelineEntry(data.entry, true)
      if (entry) {
        setEntries((current) => [entry, ...current])
      }
      setStatus("ROM measurement saved to your wellness timeline.")
    })
  }

  const deleteEntry = (entry: WellnessTimelineEntry) => {
    if (!entry.persisted) {
      setEntries((current) => current.filter((candidate) => candidate.id !== entry.id))
      setConfirmDeleteId(null)
      setStatus("Removed the practice entry from this page session.")
      return
    }

    if (confirmDeleteId !== entry.id) {
      setConfirmDeleteId(entry.id)
      return
    }

    const formData = new FormData()
    formData.set("id", entry.id)

    startTransition(async () => {
      setError(null)
      const result = await deleteClientWellnessEntryAction(formData)

      if (!result.ok) {
        setError(actionReason(result.reason, "Could not delete this entry."))
        return
      }

      setEntries((current) => current.filter((candidate) => candidate.id !== entry.id))
      setConfirmDeleteId(null)
      setStatus("Entry deleted from your wellness timeline.")
    })
  }

  const exportEntries = () => {
    if (!isSignedIn) {
      setError("Sign in before exporting saved wellness entries.")
      return
    }

    if (!confirmExport) {
      setConfirmExport(true)
      return
    }

    startTransition(async () => {
      setError(null)
      const result = await exportClientWellnessEntriesAction()

      if (!result.ok) {
        setError(actionReason(result.reason, "Could not export wellness entries."))
        return
      }

      const data = actionData(result.data)
      downloadJson(data.filename ?? "massagelab-wellness-export.json", {
        exportedAt: data.exportedAt,
        entries: data.entries ?? [],
      })
      setConfirmExport(false)
      setStatus("Export prepared in your browser.")
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-border/80 bg-background/85 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Client-owned self-tracking</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {isSignedIn
                  ? "Saved entries are private to your account. Therapist viewing and sharing are not enabled."
                  : "You can try the tools here, but nothing saves after you leave this page until you sign in."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{entryCounts.total} entries</Badge>
              <Badge variant="secondary">{entryCounts.rom} ROM</Badge>
              {entryCounts.practice > 0 ? <Badge variant="outline">{entryCounts.practice} practice</Badge> : null}
            </div>
          </div>
          {!isSignedIn ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/register">Create account</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-border/80 bg-card/70 p-3">
              <Checkbox
                id="wellnessPrivacy"
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                aria-describedby="wellnessPrivacyDescription"
              />
              <div className="min-w-0">
                <Label htmlFor="wellnessPrivacy">Save as self-tracking data</Label>
                <p id="wellnessPrivacyDescription" className="mt-1 text-sm text-muted-foreground">
                  These entries are not therapist professional records, diagnosis, emergency monitoring, or a live therapist dashboard.
                </p>
              </div>
            </div>
          )}
        </div>

        <WellnessCalendarCompanion
          isSignedIn={isSignedIn}
          appointments={appointments}
          reminderSchedules={reminderSchedules}
        />

        <WellnessPatternReport entries={entries} isSignedIn={isSignedIn} />

        <form ref={formRef} className="rounded-md border border-border/80 bg-card/95 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Quick log</h2>
              <p className="mt-1 text-sm text-muted-foreground">Capture the smallest useful note now and add detail only when it helps.</p>
            </div>
            <Button type="button" onClick={saveQuickLog} disabled={isPending}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSignedIn ? "Save" : "Practice"}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wellnessCategory">Category</Label>
              <select
                id="wellnessCategory"
                name="category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="body_sensation"
              >
                {CLIENT_WELLNESS_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category] ?? category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wellnessIntensity">How strong is it?</Label>
              <Input id="wellnessIntensity" name="intensity" type="number" min="0" max="10" inputMode="numeric" defaultValue="5" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="wellnessSummary">Short note</Label>
            <Textarea id="wellnessSummary" name="summary" placeholder="What changed, what you noticed, or what happened." />
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Context</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {contextOptions.map((context) => (
                <label
                  key={context}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-3 py-2 text-sm"
                >
                  <input name="contexts" value={context} type="checkbox" className="h-4 w-4" />
                  {context}
                </label>
              ))}
            </div>
          </fieldset>

          <details className="mt-4 rounded-md border border-border/80 bg-background/80 p-3" open>
            <summary className="cursor-pointer text-sm font-medium">Body sensations and timing</summary>
            <div className="mt-4 grid gap-4">
              <BodyRegionSelector selectedRegions={selectedRegions} onChange={setSelectedRegions} />

              <fieldset>
                <legend className="text-sm font-medium">Sensation terms</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sensationOptions.map((sensation) => (
                    <label
                      key={sensation}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 text-sm"
                    >
                      <input name="sensations" value={sensation} type="checkbox" className="h-4 w-4" />
                      {sensation}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wellnessCustomTerm">Custom sensation term</Label>
                  <Input id="wellnessCustomTerm" name="customTerm" placeholder="Your words" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellnessDuration">Duration in minutes</Label>
                  <Input id="wellnessDuration" name="durationMinutes" type="number" min="0" max="10080" inputMode="numeric" placeholder="15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellnessBodyPosition">Body position</Label>
                  <select
                    id="wellnessBodyPosition"
                    name="bodyPosition"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue=""
                  >
                    <option value="">Not selected</option>
                    {bodyPositionOptions.map((position) => (
                      <option key={position} value={position}>{position}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellnessMovementEffect">Movement effect</Label>
                  <select
                    id="wellnessMovementEffect"
                    name="movementEffect"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="unsure"
                  >
                    {movementEffectOptions.map((effect) => (
                      <option key={effect.value} value={effect.value}>{effect.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellnessActivityContext">Activity detail</Label>
                  <Input id="wellnessActivityContext" name="activityContext" placeholder="Typing, driving, lifting, gardening" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellnessOccurredAt">Time</Label>
                  <Input id="wellnessOccurredAt" name="occurredAt" type="datetime-local" />
                </div>
              </div>
            </div>
          </details>
        </form>

        <RomMeasurementPanel isSignedIn={isSignedIn} disabled={isPending} onMeasurement={saveRomMeasurement} />

        {(status || error || isPending) ? (
          <div
            className={cn(
              "rounded-md border p-3 text-sm",
              error ? "border-destructive/40 bg-destructive/10" : "border-primary/50 bg-primary/10",
            )}
            role="status"
          >
            {isPending ? "Working..." : error ?? status}
          </div>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-md border border-border/80 bg-card/95 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Timeline</h2>
              <p className="mt-1 text-sm text-muted-foreground">{displayName ? `${displayName}'s entries` : "Recent entries"}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={exportEntries} disabled={!isSignedIn || isPending}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {confirmExport ? "Confirm" : "Export"}
            </Button>
          </div>

          {entries.length === 0 ? (
            <div className="mt-4 rounded-md border border-border/80 bg-background/80 p-3 text-sm text-muted-foreground">
              No wellness entries yet.
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid gap-2">
                <Label htmlFor="timelineCategoryFilter">Filter timeline</Label>
                <select
                  id="timelineCategoryFilter"
                  value={timelineCategoryFilter}
                  onChange={(event) => setTimelineCategoryFilter(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All categories</option>
                  {CLIENT_WELLNESS_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category] ?? category}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter timeline by body region"
                  value={timelineRegionFilter}
                  onChange={(event) => setTimelineRegionFilter(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All regions</option>
                  {timelineRegionOptions.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter timeline by sensation or context"
                  value={timelineSignalFilter}
                  onChange={(event) => setTimelineSignalFilter(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All sensations and contexts</option>
                  {timelineSignalOptions.map((signal) => (
                    <option key={signal} value={signal}>{signal}</option>
                  ))}
                </select>
              </div>

              {filteredEntries.length === 0 ? (
                <div className="rounded-md border border-border/80 bg-background/80 p-3 text-sm text-muted-foreground">
                  No entries match these filters.
                </div>
              ) : filteredEntries.map((entry) => (
                <TimelineEntry
                  key={entry.id}
                  entry={entry}
                  confirmDelete={confirmDeleteId === entry.id}
                  disabled={isPending}
                  onDelete={() => deleteEntry(entry)}
                />
              ))}
            </div>
          )}

          {confirmExport ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Export downloads a JSON copy of saved self-tracking entries to this browser.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function TimelineEntry({
  entry,
  confirmDelete,
  disabled,
  onDelete,
}: {
  entry: WellnessTimelineEntry
  confirmDelete: boolean
  disabled: boolean
  onDelete: () => void
}) {
  const changeDegrees = typeof entry.metadata.changeDegrees === "number" ? entry.metadata.changeDegrees : null
  const durationMinutes = numberMetadata(entry.metadata.durationMinutes)
  const bodyPosition = stringMetadata(entry.metadata.bodyPosition)
  const activityContext = stringMetadata(entry.metadata.activityContext)
  const movementEffect = stringMetadata(entry.metadata.movementEffect)

  return (
    <div className="rounded-md border border-border/80 bg-background/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{categoryLabels[entry.category] ?? entry.category}</p>
            {!entry.persisted ? <Badge variant="outline">Practice</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(entry.occurredAt)}</p>
        </div>
        <Button type="button" variant={confirmDelete ? "destructive" : "ghost"} size="icon" onClick={onDelete} disabled={disabled} aria-label={confirmDelete ? "Confirm delete entry" : "Delete entry"}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {entry.summary ? <p className="mt-3 text-sm">{entry.summary}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {entry.intensity !== null ? <span>Intensity {entry.intensity}/10</span> : null}
        {changeDegrees !== null ? <span>ROM {changeDegrees} deg</span> : null}
        {durationMinutes !== null ? <span>{formatDuration(durationMinutes)}</span> : null}
        {bodyPosition ? <span>{bodyPosition}</span> : null}
        {movementEffect ? <span>Movement {movementEffect}</span> : null}
        {activityContext ? <span>{activityContext}</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {entry.regions.slice(0, 5).map((region) => <TimelineChip key={`region-${region}`} label={region} />)}
        {entry.sensations.slice(0, 5).map((sensation) => <TimelineChip key={`sensation-${sensation}`} label={sensation} />)}
        {entry.contexts.slice(0, 4).map((context) => <TimelineChip key={`context-${context}`} label={context} muted />)}
      </div>
      {confirmDelete ? <p className="mt-2 text-xs text-destructive">Select delete again to remove this saved entry.</p> : null}
    </div>
  )
}

function TimelineChip({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span className={cn(
      "rounded-md border px-2 py-1 text-xs",
      muted ? "border-border/80 bg-muted/60 text-muted-foreground" : "border-primary/20 bg-primary/10 text-foreground",
    )}>
      {label}
    </span>
  )
}

function wellnessFormData(form: HTMLFormElement) {
  const formData = new FormData(form)
  const customTerm = stringFormValue(formData, "customTerm")
  const occurredAt = stringFormValue(formData, "occurredAt")

  if (customTerm) {
    formData.append("sensations", customTerm)
    formData.append("customSensations", customTerm)
  }
  if (occurredAt) {
    const occurredAtDate = new Date(occurredAt)
    if (Number.isFinite(occurredAtDate.getTime())) {
      formData.set("occurredAt", occurredAtDate.toISOString())
    } else {
      formData.delete("occurredAt")
    }
  }

  formData.set("timezone", browserTimezone())
  formData.set("source", "quick-log")
  formData.set("metadata", JSON.stringify({
    durationMinutes: durationMinutesOrNull(stringFormValue(formData, "durationMinutes")),
    bodyPosition: stringFormValue(formData, "bodyPosition"),
    activityContext: stringFormValue(formData, "activityContext"),
    movementEffect: stringFormValue(formData, "movementEffect"),
  }))
  return formData
}

function romFormData(draft: RomMeasurementDraft) {
  const formData = new FormData()
  formData.set("category", "rom")
  formData.set("occurredAt", new Date().toISOString())
  formData.set("timezone", browserTimezone())
  formData.set("source", draft.source)
  formData.set("summary", draft.note)
  formData.set("metadata", JSON.stringify({
    movement: draft.movement,
    side: draft.side,
    axis: draft.axis,
    baselineAngle: draft.baselineAngle,
    endAngle: draft.endAngle,
    changeDegrees: draft.changeDegrees,
  }))
  return formData
}

function localEntryFromFormData(formData: FormData): WellnessTimelineEntry {
  const now = new Date().toISOString()
  const metadata = parseJsonRecord(stringFormValue(formData, "metadata"))

  return {
    id: `practice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    category: stringFormValue(formData, "category") || "body_sensation",
    occurredAt: stringFormValue(formData, "occurredAt") || now,
    timezone: stringFormValue(formData, "timezone") || browserTimezone(),
    summary: stringFormValue(formData, "summary") || null,
    intensity: numberOrNull(stringFormValue(formData, "intensity")),
    regions: stringList(formData.getAll("regions")),
    sensations: stringList(formData.getAll("sensations")),
    contexts: stringList(formData.getAll("contexts")),
    source: stringFormValue(formData, "source") || "manual",
    metadata,
    createdAt: now,
    updatedAt: now,
    persisted: false,
  }
}

function actionData(value: unknown): ActionData {
  return value && typeof value === "object" ? (value as ActionData) : {}
}

function normalizeTimelineEntry(value: unknown, persisted: boolean): WellnessTimelineEntry | null {
  const entry = value && typeof value === "object" ? value as Partial<WellnessTimelineEntry> : null

  if (!entry || typeof entry.id !== "string" || typeof entry.category !== "string" || typeof entry.occurredAt !== "string") {
    return null
  }

  const now = new Date().toISOString()

  return {
    id: entry.id,
    category: entry.category,
    occurredAt: entry.occurredAt,
    timezone: typeof entry.timezone === "string" ? entry.timezone : browserTimezone(),
    summary: typeof entry.summary === "string" ? entry.summary : null,
    intensity: typeof entry.intensity === "number" ? entry.intensity : null,
    regions: Array.isArray(entry.regions) ? entry.regions.filter((item): item is string => typeof item === "string") : [],
    sensations: Array.isArray(entry.sensations) ? entry.sensations.filter((item): item is string => typeof item === "string") : [],
    contexts: Array.isArray(entry.contexts) ? entry.contexts.filter((item): item is string => typeof item === "string") : [],
    source: typeof entry.source === "string" ? entry.source : "manual",
    metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : {},
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : now,
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : now,
    persisted,
  }
}

function actionReason(reason: string | undefined, fallback: string) {
  if (reason === "sign-in-required") {
    return "Sign in before saving wellness entries."
  }
  return fallback
}

function matchesTimelineFilter(entry: WellnessTimelineEntry, category: string, region: string, signal: string) {
  if (category !== "all" && entry.category !== category) {
    return false
  }

  if (region !== "all" && !entry.regions.includes(region)) {
    return false
  }

  if (signal !== "all" && !entry.sensations.includes(signal) && !entry.contexts.includes(signal)) {
    return false
  }

  return true
}

function stringFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function stringList(values: FormDataEntryValue[]) {
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())
}

function numberOrNull(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(Math.max(Math.trunc(number), 0), 10) : null
}

function durationMinutesOrNull(value: string) {
  if (!value) {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? Math.min(Math.max(Math.trunc(number), 0), 10080) : null
}

function parseJsonRecord(value: string) {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
}

function numberMetadata(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value : ""
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

function formatDateTime(value: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`
}
