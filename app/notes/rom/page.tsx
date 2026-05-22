"use client"

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { Activity, Download, FileText, FolderOpen, Gauge, Printer, Save, ShieldCheck } from "lucide-react"
import { AppPageShell, appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { type MeasurementAxis, useDeviceMotionSensors } from "@/hooks/use-device-motion-sensors"
import {
  createEditableDocumentHtml,
  createLocalDocumentExport,
  createLocalDocumentFilename,
  parseLocalDocumentJson,
} from "@/lib/local-documents"

const ROM_STORAGE_KEY = "massagelab-rom-session-draft"

type RomEntry = {
  id: string
  date: string
  movement: string
  side: string
  axis: MeasurementAxis
  startDegrees: number
  endDegrees: number
  changeDegrees: number
  source: "device-orientation" | "manual"
  notes: string
}

type RomDocument = {
  schemaVersion: number
  documentType: "rom-session"
  clientName: string
  entries: RomEntry[]
}

const emptyRomDocument: RomDocument = {
  schemaVersion: 1,
  documentType: "rom-session",
  clientName: "",
  entries: [],
}

function localId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `rom-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

function normalizeDegrees(value: number) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0
}

function axisLabel(axis: MeasurementAxis) {
  if (axis === "alpha") return "Rotation"
  if (axis === "beta") return "Front/back tilt"
  return "Left/right tilt"
}

function generateRomText(data: RomDocument) {
  const entries = data.entries.length > 0
    ? data.entries.map((entry, index) => [
        `Measurement ${index + 1}`,
        `Date: ${entry.date}`,
        `Movement: ${entry.movement}`,
        `Side: ${entry.side}`,
        `Axis: ${axisLabel(entry.axis)}`,
        `Start: ${entry.startDegrees} degrees`,
        `End: ${entry.endDegrees} degrees`,
        `Change: ${entry.changeDegrees} degrees`,
        `Source: ${entry.source}`,
        `Notes: ${entry.notes}`,
      ].join("\n")).join("\n\n")
    : "No measurements recorded."

  return [
    "MassageLab Range of Motion Session",
    "Local-first export. User is responsible for sensitive health data storage and sharing.",
    "",
    `Client: ${data.clientName}`,
    "",
    entries,
  ].join("\n")
}

export default function RomPage() {
  const [documentData, setDocumentData] = useState<RomDocument>(emptyRomDocument)
  const [movement, setMovement] = useState("")
  const [side, setSide] = useState("")
  const [axis, setAxis] = useState<MeasurementAxis>("beta")
  const [manualStart, setManualStart] = useState("0")
  const [manualEnd, setManualEnd] = useState("0")
  const [notes, setNotes] = useState("")
  const [baseline, setBaseline] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { orientation, requestAccess } = useDeviceMotionSensors()

  const currentDegrees = orientation[axis]
  const deviceChange = useMemo(() => {
    if (baseline === null || currentDegrees === null) return null
    return normalizeDegrees(currentDegrees - baseline)
  }, [baseline, currentDegrees])

  useEffect(() => {
    const draft = window.localStorage.getItem(ROM_STORAGE_KEY)
    if (draft) {
      try {
        setDocumentData(parseLocalDocumentJson(draft, emptyRomDocument, {
          discriminatorKey: "documentType",
          discriminatorValue: "rom-session",
        }))
      } catch {
        window.localStorage.removeItem(ROM_STORAGE_KEY)
      }
    }
  }, [])

  const enableSensors = async () => {
    const result = await requestAccess()
    setMessage(result.message)
  }

  const saveBaseline = () => {
    if (currentDegrees === null) {
      setMessage("No device angle is available yet.")
      return
    }

    setBaseline(currentDegrees)
    setMessage("Baseline captured.")
  }

  const addManualMeasurement = () => {
    const start = normalizeDegrees(Number(manualStart))
    const end = normalizeDegrees(Number(manualEnd))
    addMeasurement(start, end, "manual")
  }

  const addDeviceMeasurement = () => {
    if (baseline === null || currentDegrees === null) {
      setMessage("Capture a baseline and current device angle first.")
      return
    }

    addMeasurement(baseline, currentDegrees, "device-orientation")
  }

  const addMeasurement = (start: number, end: number, source: RomEntry["source"]) => {
    if (!movement.trim()) {
      setMessage("Add a movement name before saving a measurement.")
      return
    }

    const entry: RomEntry = {
      id: localId(),
      date: new Date().toISOString().slice(0, 10),
      movement,
      side,
      axis,
      startDegrees: normalizeDegrees(start),
      endDegrees: normalizeDegrees(end),
      changeDegrees: normalizeDegrees(end - start),
      source,
      notes,
    }

    setDocumentData((current) => ({ ...current, entries: [entry, ...current.entries] }))
    setMessage("Measurement added locally.")
  }

  const saveDraft = () => {
    window.localStorage.setItem(ROM_STORAGE_KEY, JSON.stringify(documentData))
    setMessage("ROM session saved locally on this device.")
  }

  const exportJson = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-rom",
      subject: documentData.clientName,
      extension: "json",
    })
    downloadFile(filename, JSON.stringify(createLocalDocumentExport(documentData), null, 2), "application/json")
    setMessage("Exported a structured JSON file. MassageLab did not upload this ROM session.")
  }

  const exportDoc = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-rom",
      subject: documentData.clientName,
      extension: "doc",
    })
    downloadFile(
      filename,
      createEditableDocumentHtml({ title: "MassageLab Range of Motion Session", body: generateRomText(documentData) }),
      "application/msword",
    )
    setMessage("Exported an editable document. MassageLab did not upload this ROM session.")
  }

  const printPdf = () => {
    const opened = openPrintDocument(
      createEditableDocumentHtml({ title: "MassageLab Range of Motion Session", body: generateRomText(documentData) }),
    )
    setMessage(opened ? "Opened a print view. Choose Save as PDF in your browser to export a PDF." : "Could not open the print view.")
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = parseLocalDocumentJson(await file.text(), emptyRomDocument, {
        discriminatorKey: "documentType",
        discriminatorValue: "rom-session",
      })
      setDocumentData(imported)
      setMessage("Imported ROM session. Review it before saving or exporting.")
    } catch {
      setMessage("Could not import that file. Choose a MassageLab ROM JSON export.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <AppPageShell title="Range of Motion" width="standard">
        <Card className={appCalloutClassName}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-brand-orange" />
            <div>
              <CardTitle>Local-first movement data</CardTitle>
              <CardDescription>
                ROM measurements stay in this browser unless exported. Sensor readings are captured only in the active page session.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className={appSurfaceClassName}>
            <CardHeader>
              <CardTitle>Measurement</CardTitle>
              <CardDescription>Use device orientation when available or enter degrees manually.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client name</Label>
                  <Input id="clientName" value={documentData.clientName} onChange={(event) => setDocumentData((current) => ({ ...current, clientName: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement">Movement</Label>
                  <Input id="movement" value={movement} onChange={(event) => setMovement(event.target.value)} placeholder="Cervical rotation" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="side">Side</Label>
                  <Input id="side" value={side} onChange={(event) => setSide(event.target.value)} placeholder="Left, right, bilateral" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="axis">Device axis</Label>
                  <select
                    id="axis"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={axis}
                    onChange={(event) => setAxis(event.target.value as MeasurementAxis)}
                  >
                    <option value="beta">Front/back tilt</option>
                    <option value="gamma">Left/right tilt</option>
                    <option value="alpha">Rotation</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 rounded-md border border-neutral-800 bg-background/70 p-4 md:grid-cols-3">
                <StatusTile label="Current" value={currentDegrees === null ? "No sensor" : `${currentDegrees} deg`} />
                <StatusTile label="Baseline" value={baseline === null ? "Not set" : `${baseline} deg`} />
                <StatusTile label="Change" value={deviceChange === null ? "Not ready" : `${deviceChange} deg`} />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={enableSensors}>
                  <Activity className="mr-2 h-4 w-4" />
                  Enable Sensor
                </Button>
                <Button type="button" variant="outline" onClick={saveBaseline}>
                  <Gauge className="mr-2 h-4 w-4" />
                  Capture Baseline
                </Button>
                <Button type="button" className="bg-primary hover:bg-brand-orange-glow" onClick={addDeviceMeasurement}>
                  Add Sensor Measurement
                </Button>
              </div>

              <div className="grid gap-5 border-t pt-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manualStart">Manual start degrees</Label>
                  <Input id="manualStart" type="number" value={manualStart} onChange={(event) => setManualStart(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualEnd">Manual end degrees</Label>
                  <Input id="manualEnd" type="number" value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" className="bg-primary hover:bg-brand-orange-glow" onClick={addManualMeasurement}>
                  Add Manual Measurement
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

          <Card className={appSurfaceClassName}>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>{documentData.entries.length} measurements saved locally.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {documentData.entries.map((entry) => (
                <div key={entry.id} className="rounded-md border border-neutral-800 bg-background/70 p-3">
                  <p className="text-sm font-medium">{entry.movement || "ROM measurement"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.side || "No side"} - {axisLabel(entry.axis)} - {entry.changeDegrees} deg
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
    </AppPageShell>
  )
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
