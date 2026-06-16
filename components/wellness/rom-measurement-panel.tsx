"use client"

import { useMemo, useState } from "react"
import { Activity, Gauge, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { type MeasurementAxis, useDeviceMotionSensors } from "@/hooks/use-device-motion-sensors"
import { calculateRomAngleDelta } from "@/lib/client-wellness"

export type RomMeasurementDraft = {
  movement: string
  side: string
  axis: MeasurementAxis
  baselineAngle: number
  endAngle: number
  changeDegrees: number
  source: "device-orientation" | "manual"
  note: string
}

type DeviceBaseline = {
  axis: MeasurementAxis
  value: number
}

export function RomMeasurementPanel({
  isSignedIn,
  disabled,
  onMeasurement,
}: {
  isSignedIn: boolean
  disabled: boolean
  onMeasurement: (draft: RomMeasurementDraft) => void
}) {
  const [movement, setMovement] = useState("Cervical rotation")
  const [side, setSide] = useState("Left")
  const [axis, setAxis] = useState<MeasurementAxis>("beta")
  const [manualStart, setManualStart] = useState("0")
  const [manualEnd, setManualEnd] = useState("0")
  const [note, setNote] = useState("")
  const [baseline, setBaseline] = useState<DeviceBaseline | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { orientation, requestAccess, state, message: sensorMessage, support } = useDeviceMotionSensors()

  const currentAngle = orientation[axis]
  const baselineForAxis = baseline?.axis === axis ? baseline : null
  const deviceChange = useMemo(() => {
    if (!baselineForAxis || currentAngle === null) {
      return null
    }

    return calculateRomAngleDelta(axis, currentAngle, baselineForAxis.value)
  }, [axis, baselineForAxis, currentAngle])

  const enableSensors = async () => {
    const result = await requestAccess()
    setMessage(result.message)
  }

  const captureBaseline = () => {
    if (currentAngle === null) {
      setMessage("No device angle is available yet. Use manual entry or try enabling sensor access.")
      return
    }

    setBaseline({ axis, value: currentAngle })
    setMessage("Baseline captured.")
  }

  const saveDeviceMeasurement = () => {
    if (!baselineForAxis || currentAngle === null || deviceChange === null) {
      setMessage("Capture a baseline and current angle before saving a sensor measurement.")
      return
    }

    saveMeasurement({
      baselineAngle: baselineForAxis.value,
      endAngle: currentAngle,
      changeDegrees: deviceChange,
      source: "device-orientation",
    })
  }

  const saveManualMeasurement = () => {
    const baselineAngle = normalizeDegrees(Number(manualStart))
    const endAngle = normalizeDegrees(Number(manualEnd))

    saveMeasurement({
      baselineAngle,
      endAngle,
      changeDegrees: calculateRomAngleDelta(axis, endAngle, baselineAngle),
      source: "manual",
    })
  }

  const saveMeasurement = (measurement: Pick<RomMeasurementDraft, "baselineAngle" | "endAngle" | "changeDegrees" | "source">) => {
    const movementName = movement.trim()

    if (!movementName) {
      setMessage("Add a movement name before recording ROM.")
      return
    }

    onMeasurement({
      movement: movementName,
      side: side.trim(),
      axis,
      note: note.trim(),
      ...measurement,
    })
    setMessage(isSignedIn ? "ROM measurement ready to save." : "Practice ROM measurement recorded for this page session.")
  }

  return (
    <section className="rounded-md border border-border/80 bg-card/95 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Range of motion</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Phone orientation is a tracking reference for comparing your own entries over time, not a calibrated medical device.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={enableSensors} disabled={disabled || state === "active"}>
          <Activity className="h-4 w-4" aria-hidden="true" />
          {state === "active" ? "Sensor active" : "Enable sensor"}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="romMovement">Movement</Label>
          <Input id="romMovement" value={movement} onChange={(event) => setMovement(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="romSide">Side</Label>
          <Input id="romSide" value={side} onChange={(event) => setSide(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="romAxis">Device axis</Label>
          <select
            id="romAxis"
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

      <div className="mt-4 grid gap-3 rounded-md border border-border/80 bg-background/80 p-3 sm:grid-cols-3">
        <RomStatus label="Current angle" value={currentAngle === null ? "No reading" : `${currentAngle} deg`} />
        <RomStatus label="Baseline" value={baselineForAxis ? `${baselineForAxis.value} deg` : "Not set"} />
        <RomStatus label="Change" value={deviceChange === null ? "Not ready" : `${deviceChange} deg`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={captureBaseline} disabled={disabled}>
          <Gauge className="h-4 w-4" aria-hidden="true" />
          Capture baseline
        </Button>
        <Button type="button" onClick={saveDeviceMeasurement} disabled={disabled}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Save sensor ROM
        </Button>
        <Button type="button" variant="ghost" onClick={() => setBaseline(null)} disabled={disabled}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border/80 pt-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="romManualStart">Manual start degrees</Label>
          <Input id="romManualStart" type="number" value={manualStart} onChange={(event) => setManualStart(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="romManualEnd">Manual end degrees</Label>
          <Input id="romManualEnd" type="number" value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="romNote">Note</Label>
        <Textarea id="romNote" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context for this measurement." />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={saveManualMeasurement} disabled={disabled}>
          Save manual ROM
        </Button>
        <p className="text-sm text-muted-foreground">
          {!support.secureContext || !support.deviceOrientation || state === "unsupported" || state === "denied"
            ? "Manual entry works with a digital angle finder or goniometer when sensors are unavailable."
            : sensorMessage}
        </p>
      </div>

      {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
    </section>
  )
}

function RomStatus({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function normalizeDegrees(value: number) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0
}
