"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SubjectiveEntryType } from "../types"

interface SubjectiveEntryFormProps {
  type: SubjectiveEntryType
  onSave: (entry: any) => void
  onCancel: () => void
}

const painSensations = [
  { id: "dull", label: "Dull" },
  { id: "sharp", label: "Sharp" },
  { id: "tender", label: "Tender" },
  { id: "itching", label: "Itching" },
  { id: "cramping", label: "Cramping" },
  { id: "throbbing", label: "Throbbing" },
  { id: "tingling", label: "Tingling" },
  { id: "stiff", label: "Stiff" },
  { id: "cold", label: "Cold" },
  { id: "burning", label: "Burning" },
  { id: "aching", label: "Aching" },
  { id: "sensitive", label: "Sensitive" },
  { id: "radiating", label: "Radiating" },
  { id: "shooting", label: "Shooting" },
  { id: "pressure", label: "Pressure" }
]

const painAreas = [
  { id: "adhesion", label: "Adhesion", symbol: "X" },
  { id: "rotation", label: "Rotation", symbol: "↻" },
  { id: "pain", label: "Pain", symbol: "○" },
  { id: "tenderPoint", label: "Tender Point", symbol: "•" },
  { id: "hypertonicity", label: "Hypertonicity", symbol: "≡" },
  { id: "spasm", label: "Spasm", symbol: "≈" },
  { id: "inflammation", label: "Inflammation", symbol: "☼" },
  { id: "triggerPoint", label: "Trigger point", symbol: "↝" },
  { id: "elevation", label: "Elevation", symbol: "/" }
]

const timePatterns = [
  { id: "constant", label: "Constant (pain does not change)" },
  { id: "intermittent", label: "Intermittent (intensity doesn't change but comes & goes)" },
  { id: "variable", label: "Variable (intensity changes throughout the day)" }
]

const incidents = [
  { id: "motorVehicle", label: "Motor vehicle accident" },
  { id: "fall", label: "Fall" },
  { id: "sleptFunny", label: "Slept funny" },
  { id: "workRelated", label: "Work related" },
  { id: "sportsExercise", label: "Sports/exercise" }
]

const preventedActivities = [
  { id: "work", label: "Work" },
  { id: "sportsExercise", label: "Sports/exercise" },
  { id: "leisureActivities", label: "Leisure activities" },
  { id: "sleep", label: "Sleep" }
]

const practitioners = [
  { id: "massageTherapist", label: "Massage therapist" },
  { id: "physicalTherapist", label: "Physical therapist" },
  { id: "chiropractor", label: "Chiropractor" },
  { id: "physician", label: "Physician" }
]

export function SubjectiveEntryForm({ type, onSave, onCancel }: SubjectiveEntryFormProps) {
  const [formData, setFormData] = useState<any>({ 
    type,
    sensations: {},
    areas: {},
    preventedActivities: {},
    practitioners: {}
  })
  const [markingDetails, setMarkingDetails] = useState<Record<string, string>>({})

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      markingDetails
    })
  }

  const renderPainForm = () => (
    <>
      <div className="space-y-2">
        <Label>Brief Description of Issue</Label>
        <Textarea
          value={formData.briefDescription || ""}
          onChange={(e) => handleChange("briefDescription", e.target.value)}
          placeholder="Briefly describe the client's primary complaint or issue..."
          className="min-h-[100px]"
        />
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Pain Intensity (1-10)</Label>
          <div className="flex gap-2 flex-wrap">
            {[...Array(10)].map((_, i) => (
              <Button
                key={i + 1}
                type="button"
                variant={formData.intensity === String(i + 1) ? "default" : "outline"}
                className="h-10 w-10"
                onClick={() => handleChange("intensity", String(i + 1))}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sensation of Pain (select all that apply)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {painSensations.map((sensation) => (
              <div key={sensation.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`sensation-${sensation.id}`}
                  checked={formData.sensations?.[sensation.id] || false}
                  onCheckedChange={(checked) => {
                    handleChange("sensations", {
                      ...formData.sensations,
                      [sensation.id]: checked
                    })
                  }}
                />
                <Label htmlFor={`sensation-${sensation.id}`}>{sensation.label}</Label>
              </div>
            ))}
            <div className="flex items-center space-x-2 col-span-2">
              <Checkbox
                id="sensation-other"
                checked={formData.sensations?.other || false}
                onCheckedChange={(checked) => {
                  handleChange("sensations", {
                    ...formData.sensations,
                    other: checked
                  })
                }}
              />
              <Input
                placeholder="Other sensation"
                value={formData.otherSensation || ""}
                onChange={(e) => handleChange("otherSensation", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label>Location of Symptoms</Label>
          <div className="grid gap-4">
            {/* Body Region Selection */}
            <div className="space-y-2">
              <Label>Body Region</Label>
              <Select
                value={formData.bodyRegion || ""}
                onValueChange={(value) => handleChange("bodyRegion", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select body region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="head-anterior">Head (Front)</SelectItem>
                  <SelectItem value="head-posterior">Head (Back)</SelectItem>
                  <SelectItem value="neck-anterior">Neck (Front)</SelectItem>
                  <SelectItem value="neck-posterior">Neck (Back)</SelectItem>
                  <SelectItem value="shoulder-left">Left Shoulder</SelectItem>
                  <SelectItem value="shoulder-right">Right Shoulder</SelectItem>
                  <SelectItem value="arm-left">Left Arm</SelectItem>
                  <SelectItem value="arm-right">Right Arm</SelectItem>
                  <SelectItem value="hand-left">Left Hand</SelectItem>
                  <SelectItem value="hand-right">Right Hand</SelectItem>
                  <SelectItem value="chest">Chest</SelectItem>
                  <SelectItem value="upper-back">Upper Back</SelectItem>
                  <SelectItem value="middle-back">Middle Back</SelectItem>
                  <SelectItem value="lower-back">Lower Back</SelectItem>
                  <SelectItem value="abdomen">Abdomen</SelectItem>
                  <SelectItem value="hip-left">Left Hip</SelectItem>
                  <SelectItem value="hip-right">Right Hip</SelectItem>
                  <SelectItem value="leg-left">Left Leg</SelectItem>
                  <SelectItem value="leg-right">Right Leg</SelectItem>
                  <SelectItem value="foot-left">Left Foot</SelectItem>
                  <SelectItem value="foot-right">Right Foot</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specific Location Description */}
            <div className="space-y-2">
              <Label>Specific Location</Label>
              <Textarea
                value={formData.specificLocation || ""}
                onChange={(e) => handleChange("specificLocation", e.target.value)}
                placeholder="Describe the specific location (e.g., '2 inches inferior to the superior angle of the scapula')"
              />
            </div>

            {/* Symptom Markings */}
            <div className="space-y-2">
              <Label>Markings (select all that apply)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {painAreas.map((area) => (
                  <div key={area.id} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`area-${area.id}`}
                        checked={formData.areas?.[area.id] || false}
                        onCheckedChange={(checked) => {
                          handleChange("areas", {
                            ...formData.areas,
                            [area.id]: checked
                          })
                          if (!checked) {
                            const newDetails = { ...markingDetails }
                            delete newDetails[area.id]
                            setMarkingDetails(newDetails)
                          }
                        }}
                      />
                      <Label htmlFor={`area-${area.id}`}>
                        {area.label} ({area.symbol})
                      </Label>
                    </div>
                    {formData.areas?.[area.id] && (
                      <Textarea
                        value={markingDetails[area.id] || ""}
                        onChange={(e) => setMarkingDetails(prev => ({
                          ...prev,
                          [area.id]: e.target.value
                        }))}
                        placeholder={`Provide details about the ${area.label.toLowerCase()}`}
                        className="mt-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Time Pattern of Pain</Label>
          <RadioGroup
            value={formData.timePattern || ""}
            onValueChange={(value) => handleChange("timePattern", value)}
          >
            {timePatterns.map((pattern) => (
              <div key={pattern.id} className="flex items-center space-x-2">
                <RadioGroupItem value={pattern.id} id={`pattern-${pattern.id}`} />
                <Label htmlFor={`pattern-${pattern.id}`}>{pattern.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>When did the pain start?</Label>
          <Input
            value={formData.painStart || ""}
            onChange={(e) => handleChange("painStart", e.target.value)}
            placeholder="e.g., 2 weeks ago, after gardening"
          />
        </div>

        <div className="space-y-2">
          <Label>Was there a specific incident that caused this pain?</Label>
          <div className="grid grid-cols-2 gap-4">
            {incidents.map((incident) => (
              <div key={incident.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`incident-${incident.id}`}
                  checked={formData.incidents?.[incident.id] || false}
                  onCheckedChange={(checked) => {
                    handleChange("incidents", {
                      ...formData.incidents,
                      [incident.id]: checked
                    })
                  }}
                />
                <Label htmlFor={`incident-${incident.id}`}>{incident.label}</Label>
              </div>
            ))}
            <div className="flex items-center space-x-2 col-span-2">
              <Checkbox
                id="incident-other"
                checked={formData.incidents?.other || false}
                onCheckedChange={(checked) => {
                  handleChange("incidents", {
                    ...formData.incidents,
                    other: checked
                  })
                }}
              />
              <Input
                placeholder="Other incident"
                value={formData.otherIncident || ""}
                onChange={(e) => handleChange("otherIncident", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Pain/discomfort is brought on or made worse by...</Label>
          <Textarea
            value={formData.painTriggers || ""}
            onChange={(e) => handleChange("painTriggers", e.target.value)}
            placeholder="Describe what makes the pain/discomfort worse..."
          />
        </div>

        <div className="space-y-2">
          <Label>Pain/discomfort feels better with...</Label>
          <Textarea
            value={formData.painRelief || ""}
            onChange={(e) => handleChange("painRelief", e.target.value)}
            placeholder="Describe what helps relieve the pain/discomfort..."
          />
        </div>

        <div className="space-y-2">
          <Label>Does this pain prevent you from participating in:</Label>
          <div className="grid grid-cols-2 gap-4">
            {preventedActivities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`prevented-${activity.id}`}
                  checked={formData.preventedActivities?.[activity.id] || false}
                  onCheckedChange={(checked) => {
                    handleChange("preventedActivities", {
                      ...formData.preventedActivities,
                      [activity.id]: checked
                    })
                  }}
                />
                <Label htmlFor={`prevented-${activity.id}`}>{activity.label}</Label>
              </div>
            ))}
            <div className="flex items-center space-x-2 col-span-2">
              <Checkbox
                id="prevented-other"
                checked={formData.preventedActivities?.other || false}
                onCheckedChange={(checked) => {
                  handleChange("preventedActivities", {
                    ...formData.preventedActivities,
                    other: checked
                  })
                }}
              />
              <Input
                placeholder="Other activity"
                value={formData.otherPreventedActivity || ""}
                onChange={(e) => handleChange("otherPreventedActivity", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Have you seen other practitioners about this issue?</Label>
          <div className="grid grid-cols-2 gap-4">
            {practitioners.map((practitioner) => (
              <div key={practitioner.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`practitioner-${practitioner.id}`}
                  checked={formData.practitioners?.[practitioner.id] || false}
                  onCheckedChange={(checked) => {
                    handleChange("practitioners", {
                      ...formData.practitioners,
                      [practitioner.id]: checked
                    })
                  }}
                />
                <Label htmlFor={`practitioner-${practitioner.id}`}>{practitioner.label}</Label>
              </div>
            ))}
            <div className="flex items-center space-x-2 col-span-2">
              <Checkbox
                id="practitioner-other"
                checked={formData.practitioners?.other || false}
                onCheckedChange={(checked) => {
                  handleChange("practitioners", {
                    ...formData.practitioners,
                    other: checked
                  })
                }}
              />
              <Input
                placeholder="Other practitioner"
                value={formData.otherPractitioner || ""}
                onChange={(e) => handleChange("otherPractitioner", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )

  const renderGoalForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Goal Description</Label>
          <Textarea
            value={formData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Describe the goal..."
          />
        </div>

        <div className="space-y-2">
          <Label>Timeframe</Label>
          <Input
            value={formData.timeframe || ""}
            onChange={(e) => handleChange("timeframe", e.target.value)}
            placeholder="e.g., 2 weeks, 3 months"
          />
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={formData.priority || ""}
            onValueChange={(value) => handleChange("priority", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Related Activities</Label>
          <Textarea
            value={formData.relatedActivities || ""}
            onChange={(e) => handleChange("relatedActivities", e.target.value)}
            placeholder="List activities related to this goal..."
          />
        </div>
      </div>
    </>
  )

  const renderMedicationForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Medication Name</Label>
          <Input
            value={formData.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Enter medication name"
          />
        </div>

        <div className="space-y-2">
          <Label>Dosage</Label>
          <Input
            value={formData.dosage || ""}
            onChange={(e) => handleChange("dosage", e.target.value)}
            placeholder="e.g., 500mg"
          />
        </div>

        <div className="space-y-2">
          <Label>Frequency</Label>
          <Input
            value={formData.frequency || ""}
            onChange={(e) => handleChange("frequency", e.target.value)}
            placeholder="e.g., twice daily"
          />
        </div>

        <div className="space-y-2">
          <Label>Purpose</Label>
          <Input
            value={formData.purpose || ""}
            onChange={(e) => handleChange("purpose", e.target.value)}
            placeholder="What is this medication for?"
          />
        </div>
      </div>
    </>
  )

  const renderPhysicianForm = () => (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Physician Name</Label>
          <Input
            value={formData.physicianName || ""}
            onChange={(e) => handleChange("physicianName", e.target.value)}
            placeholder="Enter physician's name"
          />
        </div>

        <div className="space-y-2">
          <Label>Specialty</Label>
          <Input
            value={formData.specialty || ""}
            onChange={(e) => handleChange("specialty", e.target.value)}
            placeholder="Enter physician's specialty"
          />
        </div>

        <div className="space-y-2">
          <Label>Diagnosis</Label>
          <Input
            value={formData.diagnosis || ""}
            onChange={(e) => handleChange("diagnosis", e.target.value)}
            placeholder="Enter diagnosis"
          />
        </div>

        <div className="space-y-2">
          <Label>Treatment Recommendations</Label>
          <Textarea
            value={formData.recommendations || ""}
            onChange={(e) => handleChange("recommendations", e.target.value)}
            placeholder="Enter treatment recommendations"
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
            placeholder="Enter a title for this information"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Enter additional information..."
          />
        </div>
      </div>
    </>
  )

  const getTitle = () => {
    switch (type) {
      case "pain":
        return "Add Pain/Discomfort"
      case "goal":
        return "Add Goal"
      case "medication":
        return "Add Medication"
      case "physician-info":
        return "Add Physician Information"
      case "other":
        return "Add Other Information"
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          {type === "pain" && renderPainForm()}
          {type === "goal" && renderGoalForm()}
          {type === "medication" && renderMedicationForm()}
          {type === "physician-info" && renderPhysicianForm()}
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

