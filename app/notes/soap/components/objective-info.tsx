"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Plus, X, FileText, Activity, Ruler, FootprintsIcon, ClipboardList } from 'lucide-react'
import { ObjectiveEntry, ObjectiveEntryType } from "../types"
import { ObjectiveEntryForm } from "./objective-entry-form"

interface ObjectiveInfoProps {
  formData: any
  setFormData: (data: any) => void
}

export function ObjectiveInfo({ formData, setFormData }: ObjectiveInfoProps) {
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [selectedType, setSelectedType] = useState<ObjectiveEntryType | null>(null)

  const handleAddEntry = (entry: ObjectiveEntry) => {
    setFormData({
      ...formData,
      entries: [...(formData.entries || []), entry]
    })
    setShowEntryForm(false)
    setSelectedType(null)
  }

  const handleRemoveEntry = (index: number) => {
    setFormData({
      ...formData,
      entries: formData.entries.filter((_: any, i: number) => i !== index)
    })
  }

  const renderEntryCard = (entry: ObjectiveEntry, index: number) => {
    const getTitle = () => {
      switch (entry.type) {
        case "palpation":
          return "Palpation Findings"
        case "rom":
          return "Range of Motion"
        case "postural":
          return "Postural Observation"
        case "gait":
          return "Gait Analysis"
        case "special-test":
          return "Special Test"
        case "tissue":
          return "Tissue Assessment"
        case "other":
          return "Other Observation"
      }
    }

    const getContent = () => {
      switch (entry.type) {
        case "palpation":
          return (
            <div className="space-y-2">
              <p><strong>Area:</strong> {entry.area}</p>
              <p><strong>Tissue Quality:</strong> {entry.tissueQuality}</p>
              <p><strong>Temperature:</strong> {entry.temperature}</p>
              <p><strong>Tenderness:</strong> {entry.tenderness}/10</p>
              <p><strong>Notes:</strong> {entry.notes}</p>
            </div>
          )
        case "rom":
          return (
            <div className="space-y-2">
              <p><strong>Joint/Region:</strong> {entry.joint}</p>
              <p><strong>Movement:</strong> {entry.movement}</p>
              <p><strong>Active ROM:</strong> {entry.activeROM}</p>
              <p><strong>Passive ROM:</strong> {entry.passiveROM}</p>
              <p><strong>End Feel:</strong> {entry.endFeel}</p>
              <p><strong>Pain:</strong> {entry.pain ? "Yes" : "No"}</p>
              {entry.notes && <p><strong>Notes:</strong> {entry.notes}</p>}
            </div>
          )
        case "postural":
          return (
            <div className="space-y-2">
              <p><strong>View:</strong> {entry.view}</p>
              <p><strong>Findings:</strong> {entry.findings}</p>
              <p><strong>Compensations:</strong> {entry.compensations}</p>
            </div>
          )
        case "gait":
          return (
            <div className="space-y-2">
              <p><strong>Phase:</strong> {entry.phase}</p>
              <p><strong>Observations:</strong> {entry.observations}</p>
              <p><strong>Deviations:</strong> {entry.deviations}</p>
            </div>
          )
        case "special-test":
          return (
            <div className="space-y-2">
              <p><strong>Test Name:</strong> {entry.testName}</p>
              <p><strong>Result:</strong> {entry.result}</p>
              <p><strong>Notes:</strong> {entry.notes}</p>
            </div>
          )
        case "tissue":
          return (
            <div className="space-y-2">
              <p><strong>Area:</strong> {entry.area}</p>
              <p><strong>Texture:</strong> {entry.texture}</p>
              <p><strong>Mobility:</strong> {entry.mobility}</p>
              <p><strong>Findings:</strong> {entry.findings}</p>
            </div>
          )
        case "other":
          return (
            <div className="space-y-2">
              <p><strong>{entry.title}</strong></p>
              <p>{entry.description}</p>
            </div>
          )
      }
    }

    return (
      <Card key={index} className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={() => handleRemoveEntry(index)}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader>
          <CardTitle className="text-lg">{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          {getContent()}
        </CardContent>
      </Card>
    )
  }

  const renderAssessmentLinks = () => {
    const assessments = [
      { 
        title: "Postural Assessment",
        icon: ClipboardList,
        href: "/notes/posture",
        available: false
      },
      { 
        title: "Muscle Testing",
        icon: Activity,
        href: "/notes/muscle-testing",
        available: false
      },
      { 
        title: "ROM Testing",
        icon: Ruler,
        href: "/notes/rom",
        available: false
      },
      { 
        title: "Gait Assessment",
        icon: FootprintsIcon,
        href: "/notes/gait",
        available: false
      }
    ]

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {assessments.map((assessment) => (
          <Card key={assessment.title} className={assessment.available ? "hover:bg-accent cursor-pointer" : "opacity-50"}>
            <CardContent className="flex items-center gap-4 p-4">
              <assessment.icon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <h4 className="text-sm font-medium">{assessment.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {assessment.available ? "Click to view" : "Coming soon"}
                </p>
              </div>
              {assessment.available && (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Observations</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.generalObservations || ""}
            onChange={(e) => setFormData({ ...formData, generalObservations: e.target.value })}
            placeholder="Enter general observations about the client's presentation..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {renderAssessmentLinks()}

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("palpation")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Palpation Findings
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("rom")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add ROM Observation
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("postural")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Postural Observation
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("gait")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Gait Observation
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("special-test")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Special Test
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("tissue")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tissue Assessment
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("other")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Other Observation
          </Button>
        </div>

        {showEntryForm && selectedType && (
          <ObjectiveEntryForm
            type={selectedType}
            onSave={handleAddEntry}
            onCancel={() => {
              setShowEntryForm(false)
              setSelectedType(null)
            }}
          />
        )}

        <div className="space-y-4">
          {formData.entries?.map((entry: ObjectiveEntry, index: number) => 
            renderEntryCard(entry, index)
          )}
        </div>
      </div>
    </div>
  )
}

