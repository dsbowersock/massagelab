"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X } from 'lucide-react'
import { SubjectiveEntry, SubjectiveEntryType } from "../types"
import { SubjectiveEntryForm } from "./subjective-entry-form"

interface SubjectiveInfoProps {
  formData: any
  setFormData: (data: any) => void
}

export function SubjectiveInfo({ formData, setFormData }: SubjectiveInfoProps) {
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [selectedType, setSelectedType] = useState<SubjectiveEntryType | null>(null)

  const handleAddEntry = (entry: SubjectiveEntry) => {
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

  const renderEntryCard = (entry: SubjectiveEntry, index: number) => {
    const getTitle = () => {
      switch (entry.type) {
        case "pain":
          return "Pain/Discomfort"
        case "goal":
          return "Goal"
        case "medication":
          return "Medication"
        case "physician-info":
          return "Physician Information"
        case "other":
          return "Other Information"
      }
    }

    const getContent = () => {
      switch (entry.type) {
        case "pain":
          return (
            <div className="space-y-2">
              <p><strong>Description:</strong> {entry.description}</p>
              <p><strong>Intensity:</strong> {entry.intensity}/10</p>
              <p><strong>Pattern:</strong> {entry.pattern}</p>
            </div>
          )
        case "goal":
          return (
            <div className="space-y-2">
              <p><strong>Description:</strong> {entry.description}</p>
              <p><strong>Timeframe:</strong> {entry.timeframe}</p>
              <p><strong>Priority:</strong> {entry.priority}</p>
            </div>
          )
        case "medication":
          return (
            <div className="space-y-2">
              <p><strong>Name:</strong> {entry.name}</p>
              <p><strong>Dosage:</strong> {entry.dosage}</p>
              <p><strong>Frequency:</strong> {entry.frequency}</p>
            </div>
          )
        case "physician-info":
          return (
            <div className="space-y-2">
              <p><strong>Physician:</strong> {entry.physicianName}</p>
              <p><strong>Specialty:</strong> {entry.specialty}</p>
              <p><strong>Diagnosis:</strong> {entry.diagnosis}</p>
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.generalNotes || ""}
            onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
            placeholder="Enter any general notes about the client's condition..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("pain")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Pain/Discomfort
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("goal")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("medication")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Medication
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("physician-info")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Physician Info
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType("other")
              setShowEntryForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Other Info
          </Button>
        </div>

        {showEntryForm && selectedType && (
          <SubjectiveEntryForm
            type={selectedType}
            onSave={handleAddEntry}
            onCancel={() => {
              setShowEntryForm(false)
              setSelectedType(null)
            }}
          />
        )}

        <div className="space-y-4">
          {formData.entries?.map((entry: SubjectiveEntry, index: number) => 
            renderEntryCard(entry, index)
          )}
        </div>
      </div>
    </div>
  )
}

