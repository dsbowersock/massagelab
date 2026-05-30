"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import { Download, FileText, FolderOpen, Plus, Printer, Save, ShieldCheck } from "lucide-react"
import { AppPageShell, appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createEditableDocumentHtml,
  createLocalDocumentExport,
  createLocalDocumentFilename,
  parseLocalDocumentJson,
} from "@/lib/local-documents"

const JOURNAL_STORAGE_KEY = "massagelab-client-journal-draft"

type JournalEntryKind = "pain" | "sensation" | "incident"

type JournalEntry = {
  id: string
  date: string
  kind: JournalEntryKind
  region: string
  intensity: number
  description: string
  triggers: string
  relief: string
  notes: string
}

type JournalDocument = {
  schemaVersion: number
  documentType: "client-journal"
  clientName: string
  entries: JournalEntry[]
}

const emptyEntry: JournalEntry = {
  id: "",
  date: "",
  kind: "pain",
  region: "",
  intensity: 0,
  description: "",
  triggers: "",
  relief: "",
  notes: "",
}

const emptyJournal: JournalDocument = {
  schemaVersion: 1,
  documentType: "client-journal",
  clientName: "",
  entries: [],
}

function localId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `journal-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function openPrintDocument(html: string) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer")
  if (!printWindow) {
    return false
  }

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}

function formatEntryKind(kind: JournalEntryKind) {
  if (kind === "pain") return "Pain"
  if (kind === "sensation") return "Sensation"
  return "Incident"
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function generateJournalText(data: JournalDocument) {
  const entries = data.entries.length > 0
    ? data.entries.map((entry, index) => [
        `Entry ${index + 1}`,
        `Date: ${entry.date}`,
        `Type: ${formatEntryKind(entry.kind)}`,
        `Region: ${entry.region}`,
        `Intensity: ${entry.intensity}/10`,
        `Description: ${entry.description}`,
        `Triggers: ${entry.triggers}`,
        `Relief: ${entry.relief}`,
        `Notes: ${entry.notes}`,
      ].join("\n")).join("\n\n")
    : "No entries recorded."

  return [
    "MassageLab Pain / Sensation / Incident Journal",
    "Local-first export. User is responsible for sensitive health data storage and sharing.",
    "",
    `Client: ${data.clientName}`,
    "",
    entries,
  ].join("\n")
}

export default function JournalPage() {
  const [journal, setJournal] = useState<JournalDocument>(emptyJournal)
  const [entry, setEntry] = useState<JournalEntry>({ ...emptyEntry, date: formatLocalDate() })
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const draft = window.localStorage.getItem(JOURNAL_STORAGE_KEY)
    if (draft) {
      try {
        setJournal(parseLocalDocumentJson(draft, emptyJournal, {
          discriminatorKey: "documentType",
          discriminatorValue: "client-journal",
        }))
      } catch {
        window.localStorage.removeItem(JOURNAL_STORAGE_KEY)
      }
    }
  }, [])

  const updateEntry = <Key extends keyof JournalEntry>(key: Key, value: JournalEntry[Key]) => {
    setMessage(null)
    setEntry((current) => ({ ...current, [key]: value }))
  }

  const addEntry = () => {
    if (!entry.description.trim() && !entry.region.trim()) {
      setMessage("Add a region or description before saving an entry.")
      return
    }

    setJournal((current) => ({
      ...current,
      entries: [{ ...entry, id: localId(), intensity: Number(entry.intensity) || 0 }, ...current.entries],
    }))
    setEntry({ ...emptyEntry, date: formatLocalDate() })
    setMessage("Entry added to the local journal.")
  }

  const saveDraft = () => {
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journal))
    setMessage("Journal saved locally on this device.")
  }

  const exportJson = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-journal",
      subject: journal.clientName,
      extension: "json",
    })
    downloadFile(filename, JSON.stringify(createLocalDocumentExport(journal), null, 2), "application/json")
    setMessage("Exported a structured JSON file. MassageLab did not upload this journal.")
  }

  const exportDoc = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-journal",
      subject: journal.clientName,
      extension: "doc",
    })
    downloadFile(
      filename,
      createEditableDocumentHtml({ title: "MassageLab Journal", body: generateJournalText(journal) }),
      "application/msword",
    )
    setMessage("Exported an editable document. MassageLab did not upload this journal.")
  }

  const printPdf = () => {
    const opened = openPrintDocument(createEditableDocumentHtml({ title: "MassageLab Journal", body: generateJournalText(journal) }))
    setMessage(opened ? "Opened a print view. Choose Save as PDF in your browser to export a PDF." : "Could not open the print view.")
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = parseLocalDocumentJson(await file.text(), emptyJournal, {
        discriminatorKey: "documentType",
        discriminatorValue: "client-journal",
      })
      setJournal(imported)
      setMessage("Imported journal. Review it before saving or exporting.")
    } catch {
      setMessage("Could not import that file. Choose a MassageLab journal JSON export.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <AppPageShell title="Client Journal" width="standard">
        <Card className={appCalloutClassName}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-brand-orange" />
            <div>
              <CardTitle>Local-first sensitive health data</CardTitle>
              <CardDescription>
                Journal data stays in this browser unless exported. Future account sync will remain disabled until compliant hosting is funded and reviewed.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className={appSurfaceClassName}>
          <CardHeader>
            <CardTitle>New Entry</CardTitle>
            <CardDescription>Pain, sensation, and incident entries share one local export file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client name</Label>
                <Input id="clientName" value={journal.clientName} onChange={(event) => setJournal((current) => ({ ...current, clientName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryDate">Date</Label>
                <Input id="entryDate" type="date" value={entry.date} onChange={(event) => updateEntry("date", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind">Entry type</Label>
                <select
                  id="kind"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={entry.kind}
                  onChange={(event) => updateEntry("kind", event.target.value as JournalEntryKind)}
                >
                  <option value="pain">Pain</option>
                  <option value="sensation">Sensation</option>
                  <option value="incident">Incident</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input id="region" value={entry.region} onChange={(event) => updateEntry("region", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intensity">Intensity</Label>
                <Input
                  id="intensity"
                  type="number"
                  min={0}
                  max={10}
                  value={entry.intensity}
                  onChange={(event) => updateEntry("intensity", Number(event.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={entry.description} onChange={(event) => updateEntry("description", event.target.value)} />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="triggers">Triggers</Label>
                  <Textarea id="triggers" value={entry.triggers} onChange={(event) => updateEntry("triggers", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relief">Relief</Label>
                  <Textarea id="relief" value={entry.relief} onChange={(event) => updateEntry("relief", event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={entry.notes} onChange={(event) => updateEntry("notes", event.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t pt-5">
              <Button type="button" onClick={addEntry} className="bg-primary hover:bg-brand-orange-glow">
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft}>
                <Save className="mr-2 h-4 w-4" />
                Save Local Draft
              </Button>
              <Button type="button" variant="outline" onClick={exportDoc}>
                <FileText className="mr-2 h-4 w-4" />
                Export DOC
              </Button>
              <Button type="button" variant="outline" onClick={printPdf}>
                <Printer className="mr-2 h-4 w-4" />
                Save PDF
              </Button>
              <Button type="button" className="bg-primary hover:bg-brand-orange-glow" onClick={exportJson}>
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
            {message && <p className="text-sm text-brand-orange">{message}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {journal.entries.map((savedEntry) => (
            <Card key={savedEntry.id} className="border-border/80 bg-background/85">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{formatEntryKind(savedEntry.kind)} - {savedEntry.region || "Unspecified region"}</CardTitle>
                  <span className="rounded-sm border border-neutral-700 px-2 py-1 text-xs text-muted-foreground">
                    {savedEntry.date || "No date"} - {savedEntry.intensity}/10
                  </span>
                </div>
                <CardDescription>{savedEntry.description || "No description"}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
    </AppPageShell>
  )
}
