"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Activity, FileText, Gauge, Printer, Save, ShieldCheck } from "lucide-react"
import { AppPageShell, appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { type MeasurementAxis, useDeviceMotionSensors } from "@/hooks/use-device-motion-sensors"
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

type DeviceBaseline = { axis: MeasurementAxis; value: number }

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

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
  const vault = useProfessionalRecordVault()
  const [documentData, setDocumentData] = useState<RomDocument>(emptyRomDocument)
  const [movement, setMovement] = useState("")
  const [side, setSide] = useState("")
  const [axis, setAxis] = useState<MeasurementAxis>("beta")
  const [manualStart, setManualStart] = useState("0")
  const [manualEnd, setManualEnd] = useState("0")
  const [notes, setNotes] = useState("")
  const [baseline, setBaseline] = useState<DeviceBaseline | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const loadedRevisionRef = useRef(-1)
  const { orientation, requestAccess } = useDeviceMotionSensors()

  const currentDegrees = orientation[axis]
  const baselineForAxis = baseline?.axis === axis ? baseline : null
  const deviceChange = useMemo(() => {
    if (!baselineForAxis || currentDegrees === null) return null
    return normalizeDegrees(currentDegrees - baselineForAxis.value)
  }, [baselineForAxis, currentDegrees])

  useEffect(() => {
    if (vault.status !== "unlocked" || loadedRevisionRef.current === vault.revision) {
      return
    }

    loadedRevisionRef.current = vault.revision
    setDocumentData(normalizeRomDocument(vault.payload.records?.rom?.draft ?? emptyRomDocument))
  }, [vault.status, vault.revision, vault.payload])

  const enableSensors = async () => {
    const result = await requestAccess()
    setMessage(result.message)
  }

  const saveBaseline = () => {
    if (currentDegrees === null) {
      setMessage("No device angle is available yet.")
      return
    }

    setBaseline({ axis, value: currentDegrees })
    setMessage("Baseline captured.")
  }

  const addManualMeasurement = () => {
    const start = normalizeDegrees(Number(manualStart))
    const end = normalizeDegrees(Number(manualEnd))
    addMeasurement(start, end, "manual")
  }

  const addDeviceMeasurement = () => {
    if (!baselineForAxis || currentDegrees === null) {
      setMessage("Capture a baseline and current device angle first.")
      return
    }

    addMeasurement(baselineForAxis.value, currentDegrees, "device-orientation")
  }

  const addMeasurement = (start: number, end: number, source: RomEntry["source"]) => {
    if (!movement.trim()) {
      setMessage("Add a movement name before saving a measurement.")
      return
    }

    const entry: RomEntry = {
      id: localId(),
      date: formatLocalDate(),
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

  const saveEncryptedDraft = async () => {
    const saved = await vault.saveDraft("rom", documentData, "ROM session saved in the encrypted professional-record vault.")
    if (saved) {
      loadedRevisionRef.current = vault.revision + 1
      setMessage("ROM session saved in the encrypted professional-record vault.")
    }
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
    setMessage("Created a plaintext DOC file from the unlocked vault. Store and share it carefully.")
  }

  const printPdf = () => {
    const opened = openPrintDocument(
      createEditableDocumentHtml({ title: "MassageLab Range of Motion Session", body: generateRomText(documentData) }),
    )
    setMessage(opened ? "Opened a plaintext print view. Choose Save as PDF in your browser dialog." : "Could not open the print view.")
  }

  return (
    <ProfessionalRecordVaultGate>
      <AppPageShell title="Range of Motion" width="standard">
        <Card className={appCalloutClassName}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-brand-orange" />
            <div>
              <CardTitle>Encrypted professional-record vault</CardTitle>
              <CardDescription>
                ROM measurements are stored in the unlocked browser vault. Sensor readings are captured only in the active page session.
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
                <StatusTile label="Baseline" value={baselineForAxis === null ? "Not set" : `${baselineForAxis.value} deg`} />
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
        <Card className={appSurfaceClassName}>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Encrypted vault transfer</CardTitle>
              <CardDescription>Export or import the full professional-record vault as an encrypted `.mlab` bundle.</CardDescription>
            </div>
            <ProfessionalRecordVaultToolbar />
          </CardHeader>
          <CardContent>
            <ProfessionalRecordVaultTransferControls idPrefix="romVault" />
          </CardContent>
        </Card>
      </AppPageShell>
    </ProfessionalRecordVaultGate>
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

function normalizeRomDocument(value: Partial<RomDocument> | null | undefined): RomDocument {
  return {
    ...emptyRomDocument,
    ...(value ?? {}),
    entries: Array.isArray(value?.entries) ? value.entries : [],
  }
}
