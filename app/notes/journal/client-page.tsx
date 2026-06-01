"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Plus, Printer, Save, ShieldCheck } from "lucide-react"
import { AppPageShell, appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createEditableDocumentHtml,
  createLocalDocumentFilename,
} from "@/lib/local-documents"
import {
  PlaintextOutputWarningAction,
  ProfessionalRecordVaultGate,
  ProfessionalRecordVaultToolbar,
  ProfessionalRecordVaultTransferControls,
  useProfessionalRecordVault,
} from "../professional-record-vault-provider"

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
  const vault = useProfessionalRecordVault()
  const [journal, setJournal] = useState<JournalDocument>(emptyJournal)
  const [entry, setEntry] = useState<JournalEntry>({ ...emptyEntry, date: formatLocalDate() })
  const [message, setMessage] = useState<string | null>(null)
  const loadedRevisionRef = useRef(-1)

  useEffect(() => {
    if (vault.status !== "unlocked" || loadedRevisionRef.current === vault.revision) {
      return
    }

    loadedRevisionRef.current = vault.revision
    setJournal(normalizeJournalDocument(vault.payload.records?.journal?.draft ?? emptyJournal))
  }, [vault.status, vault.revision, vault.payload])

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

  const saveEncryptedDraft = async () => {
    const saved = await vault.saveDraft("journal", journal, "Journal saved in the encrypted professional-record vault.")
    if (saved) {
      loadedRevisionRef.current = vault.revision + 1
      setMessage("Journal saved in the encrypted professional-record vault.")
    }
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
    setMessage("Created a plaintext DOC file from the unlocked vault. Store and share it carefully.")
  }

  const printPdf = () => {
    const opened = openPrintDocument(createEditableDocumentHtml({ title: "MassageLab Journal", body: generateJournalText(journal) }))
    setMessage(opened ? "Opened a plaintext print view. Choose Save as PDF in your browser dialog." : "Could not open the print view.")
  }

  return (
    <ProfessionalRecordVaultGate>
      <AppPageShell title="Client Journal" width="standard">
        <Card className={appCalloutClassName}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-brand-orange" />
            <div>
              <CardTitle>Encrypted professional-record vault</CardTitle>
              <CardDescription>
                Journal data is stored in the unlocked browser vault. MassageLab does not upload this journal or import plaintext clinical JSON.
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
              <Button type="button" variant="outline" onClick={saveEncryptedDraft}>
                <Save className="mr-2 h-4 w-4" />
                Save encrypted draft
              </Button>
              <PlaintextOutputWarningAction
                label="Export DOC"
                description="This creates an unencrypted editable clinical document outside the vault. Use encrypted vault bundles for normal transfer."
                icon={<FileText className="mr-2 h-4 w-4" />}
                onConfirm={exportDoc}
              />
              <PlaintextOutputWarningAction
                label="Save PDF"
                description="This opens an unencrypted print view outside the vault. Use encrypted vault bundles for normal transfer."
                icon={<Printer className="mr-2 h-4 w-4" />}
                onConfirm={printPdf}
              />
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
        <Card className={appSurfaceClassName}>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Encrypted vault transfer</CardTitle>
              <CardDescription>Export or import the full professional-record vault as an encrypted `.mlab` bundle.</CardDescription>
            </div>
            <ProfessionalRecordVaultToolbar />
          </CardHeader>
          <CardContent>
            <ProfessionalRecordVaultTransferControls idPrefix="journalVault" />
          </CardContent>
        </Card>
      </AppPageShell>
    </ProfessionalRecordVaultGate>
  )
}

function normalizeJournalDocument(value: Partial<JournalDocument> | null | undefined): JournalDocument {
  return {
    ...emptyJournal,
    ...(value ?? {}),
    entries: Array.isArray(value?.entries) ? value.entries : [],
  }
}
