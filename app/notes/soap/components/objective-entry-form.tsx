"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { ObjectiveEntryType } from "../types"

interface ObjectiveEntryFormProps {
  type: ObjectiveEntryType
  onSave: (entry: any) => void
  onCancel: () => void
}

export function ObjectiveEntryForm({ type, onSave, onCancel }: ObjectiveEntryFormProps) {
  const [formData, setFormData] = useState<any>({ type })

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const renderPalpationForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Area Palpated</Label>
          <Input
            value={formData.area || ""}
            onChange={(e) => handleChange("area", e.target.value)}
            placeholder="Enter the area palpated"
          />
        </div>

        <div className="space-y-2">
          <Label>Tissue Quality</Label>
          <Select
            value={formData.tissueQuality || ""}
            onValueChange={(value) => handleChange("tissueQuality", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tissue quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="supple">Supple</SelectItem>
              <SelectItem value="boggy">Boggy</SelectItem>
              <SelectItem value="ropy">Ropy</SelectItem>
              <SelectItem value="dense">Dense</SelectItem>
              <SelectItem value="fibrotic">Fibrotic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Temperature</Label>
          <Select
            value={formData.temperature || ""}
            onValueChange={(value) => handleChange("temperature", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select temperature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="cool">Cool</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tenderness (0-10)</Label>
          <div className="flex gap-2 flex-wrap">
            {[...Array(11)].map((_, i) => (
              <Button
                key={i}
                type="button"
                variant={formData.tenderness === i ? "default" : "outline"}
                className="h-10 w-10"
                onClick={() => handleChange("tenderness", i)}
              >
                {i}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Additional Notes</Label>
          <Textarea
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Enter any additional observations..."
          />
        </div>
      </div>
    </>
  )

  const renderROMForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Joint/Region</Label>
          <Input
            value={formData.joint || ""}
            onChange={(e) => handleChange("joint", e.target.value)}
            placeholder="Enter joint or region"
          />
        </div>

        <div className="space-y-2">
          <Label>Movement</Label>
          <Input
            value={formData.movement || ""}
            onChange={(e) => handleChange("movement", e.target.value)}
            placeholder="Enter movement (e.g., flexion, extension)"
          />
        </div>

        <div className="space-y-2">
          <Label>Active ROM</Label>
          <Input
            value={formData.activeROM || ""}
            onChange={(e) => handleChange("activeROM", e.target.value)}
            placeholder="Enter active range of motion"
          />
        </div>

        <div className="space-y-2">
          <Label>Passive ROM</Label>
          <Input
            value={formData.passiveROM || ""}
            onChange={(e) => handleChange("passiveROM", e.target.value)}
            placeholder="Enter passive range of motion"
          />
        </div>

        <div className="space-y-2">
          <Label>Active Assistive ROM</Label>
          <Input
            value={formData.activeAssistiveROM || ""}
            onChange={(e) => handleChange("activeAssistiveROM", e.target.value)}
            placeholder="Enter active assistive range of motion"
          />
        </div>

        <div className="space-y-2">
          <Label>Resisted ROM</Label>
          <Input
            value={formData.resistedROM || ""}
            onChange={(e) => handleChange("resistedROM", e.target.value)}
            placeholder="Enter resisted range of motion"
          />
        </div>

        <div className="space-y-2">
          <Label>ROM Measurement (degrees)</Label>
          <Input
            type="number"
            min="0"
            max="360"
            value={formData.romDegrees || ""}
            onChange={(e) => handleChange("romDegrees", e.target.value)}
            placeholder="Enter ROM in degrees"
          />
        </div>

        <div className="space-y-2">
          <Label>End Feel</Label>
          <Select
            value={formData.endFeel || ""}
            onValueChange={(value) => handleChange("endFeel", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select end feel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="soft">Soft tissue approximation</SelectItem>
              <SelectItem value="hard">Hard/Bony</SelectItem>
              <SelectItem value="springy">Springy</SelectItem>
              <SelectItem value="empty">Empty</SelectItem>
              <SelectItem value="spasm">Muscle spasm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="pain"
            checked={formData.pain || false}
            onCheckedChange={(checked) => handleChange("pain", checked)}
          />
          <Label htmlFor="pain">Pain during movement</Label>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Enter any additional observations..."
          />
        </div>
      </div>
    </>
  )

  const renderPosturalForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>View</Label>
          <Select
            value={formData.view || ""}
            onValueChange={(value) => handleChange("view", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anterior">Anterior</SelectItem>
              <SelectItem value="posterior">Posterior</SelectItem>
              <SelectItem value="lateral-left">Lateral Left</SelectItem>
              <SelectItem value="lateral-right">Lateral Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Findings</Label>
          <Textarea
            value={formData.findings || ""}
            onChange={(e) => handleChange("findings", e.target.value)}
            placeholder="Enter postural findings..."
          />
        </div>

        <div className="space-y-2">
          <Label>Compensations</Label>
          <Textarea
            value={formData.compensations || ""}
            onChange={(e) => handleChange("compensations", e.target.value)}
            placeholder="Enter observed compensations..."
          />
        </div>
      </div>
    </>
  )

  const renderGaitForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Gait Phase</Label>
          <Select
            value={formData.phase || ""}
            onValueChange={(value) => handleChange("phase", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select gait phase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="initial-contact">Initial Contact</SelectItem>
              <SelectItem value="loading-response">Loading Response</SelectItem>
              <SelectItem value="mid-stance">Mid Stance</SelectItem>
              <SelectItem value="terminal-stance">Terminal Stance</SelectItem>
              <SelectItem value="pre-swing">Pre-swing</SelectItem>
              <SelectItem value="initial-swing">Initial Swing</SelectItem>
              <SelectItem value="mid-swing">Mid Swing</SelectItem>
              <SelectItem value="terminal-swing">Terminal Swing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Observations</Label>
          <Textarea
            value={formData.observations || ""}
            onChange={(e) => handleChange("observations", e.target.value)}
            placeholder="Enter gait observations..."
          />
        </div>

        <div className="space-y-2">
          <Label>Deviations</Label>
          <Textarea
            value={formData.deviations || ""}
            onChange={(e) => handleChange("deviations", e.target.value)}
            placeholder="Enter observed deviations..."
          />
        </div>
      </div>
    </>
  )

  const renderSpecialTestForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Test Name</Label>
          <Input
            value={formData.testName || ""}
            onChange={(e) => handleChange("testName", e.target.value)}
            placeholder="Enter test name"
          />
        </div>

        <div className="space-y-2">
          <Label>Result</Label>
          <RadioGroup
            value={formData.result || ""}
            onValueChange={(value) => handleChange("result", value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="positive" id="positive" />
              <Label htmlFor="positive">Positive</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="negative" id="negative" />
              <Label htmlFor="negative">Negative</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="inconclusive" id="inconclusive" />
              <Label htmlFor="inconclusive">Inconclusive</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Enter any additional notes..."
          />
        </div>
      </div>
    </>
  )

  const renderTissueForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Area</Label>
          <Input
            value={formData.area || ""}
            onChange={(e) => handleChange("area", e.target.value)}
            placeholder="Enter area assessed"
          />
        </div>

        <div className="space-y-2">
          <Label>Texture</Label>
          <Select
            value={formData.texture || ""}
            onValueChange={(value) => handleChange("texture", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select texture" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smooth">Smooth</SelectItem>
              <SelectItem value="rough">Rough</SelectItem>
              <SelectItem value="nodular">Nodular</SelectItem>
              <SelectItem value="stringy">Stringy</SelectItem>
              <SelectItem value="grainy">Grainy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Mobility</Label>
          <Select
            value={formData.mobility || ""}
            onValueChange={(value) => handleChange("mobility", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select mobility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="freely-mobile">Freely Mobile</SelectItem>
              <SelectItem value="restricted">Restricted</SelectItem>
              <SelectItem value="bound">Bound</SelectItem>
              <SelectItem value="adhered">Adhered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Findings</Label>
          <Textarea
            value={formData.findings || ""}
            onChange={(e) => handleChange("findings", e.target.value)}
            placeholder="Enter tissue assessment findings..."
          />
        </div>
      </div>
    </>
  )

  const renderOtherForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={formData.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Enter observation title"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Enter observation details..."
          />
        </div>
      </div>
    </>
  )

  const getTitle = () => {
    switch (type) {
      case "palpation":
        return "Add Palpation Findings"
      case "rom":
        return "Add Range of Motion"
      case "postural":
        return "Add Postural Observation"
      case "gait":
        return "Add Gait Analysis"
      case "special-test":
        return "Add Special Test"
      case "tissue":
        return "Add Tissue Assessment"
      case "other":
        return "Add Other Observation"
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          {type === "palpation" && renderPalpationForm()}
          {type === "rom" && renderROMForm()}
          {type === "postural" && renderPosturalForm()}
          {type === "gait" && renderGaitForm()}
          {type === "special-test" && renderSpecialTestForm()}
          {type === "tissue" && renderTissueForm()}
          {type === "other" && renderOtherForm()}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </CardFooter>
      </Card>
    </form>
  )
}

