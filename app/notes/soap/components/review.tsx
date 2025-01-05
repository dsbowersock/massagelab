"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubjectiveEntry } from "../types"

interface ReviewProps {
  formData: any
}

export function Review({ formData }: ReviewProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identifying Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Client Name:</strong> {formData.clientName}
            </div>
            <div>
              <strong>Date of Birth:</strong> {formatDate(formData.dateOfBirth)}
            </div>
            <div>
              <strong>Session Date:</strong> {formatDate(formData.date)}
            </div>
            <div>
              <strong>Session Time:</strong> {formData.time}
            </div>
            <div>
              <strong>Therapist:</strong> {formData.therapistName}
            </div>
            <div>
              <strong>Location:</strong> {formData.location}
            </div>
            <div>
              <strong>License Number:</strong> {formData.licenseNumber}
            </div>
            <div>
              <strong>License Org:</strong> {formData.licenseOrganization}
            </div>
            <div>
              <strong>NPI Number:</strong> {formData.npiNumber}
            </div>
            <div>
              <strong>Client Number:</strong> {formData.clientNumber}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subjective Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <strong>General Notes:</strong>
            <p className="whitespace-pre-wrap">{formData.generalNotes}</p>
          </div>

          {formData.entries?.length > 0 && (
            <div className="space-y-4">
              <strong>Additional Information:</strong>
              {formData.entries.map((entry: SubjectiveEntry, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {entry.type === "pain" && "Pain/Discomfort"}
                      {entry.type === "goal" && "Goal"}
                      {entry.type === "medication" && "Medication"}
                      {entry.type === "physician-info" && "Physician Information"}
                      {entry.type === "other" && entry.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {entry.type === "pain" && (
                      <div className="space-y-2">
                        <p><strong>Description:</strong> {entry.description}</p>
                        <p><strong>Intensity:</strong> {entry.intensity}/10</p>
                        <p><strong>Pattern:</strong> {entry.pattern}</p>
                      </div>
                    )}
                    {entry.type === "goal" && (
                      <div className="space-y-2">
                        <p><strong>Description:</strong> {entry.description}</p>
                        <p><strong>Timeframe:</strong> {entry.timeframe}</p>
                        <p><strong>Priority:</strong> {entry.priority}</p>
                        <p><strong>Related Activities:</strong> {entry.relatedActivities}</p>
                      </div>
                    )}
                    {entry.type === "medication" && (
                      <div className="space-y-2">
                        <p><strong>Name:</strong> {entry.name}</p>
                        <p><strong>Dosage:</strong> {entry.dosage}</p>
                        <p><strong>Frequency:</strong> {entry.frequency}</p>
                        <p><strong>Purpose:</strong> {entry.purpose}</p>
                      </div>
                    )}
                    {entry.type === "physician-info" && (
                      <div className="space-y-2">
                        <p><strong>Physician:</strong> {entry.physicianName}</p>
                        <p><strong>Specialty:</strong> {entry.specialty}</p>
                        <p><strong>Diagnosis:</strong> {entry.diagnosis}</p>
                        <p><strong>Recommendations:</strong> {entry.recommendations}</p>
                      </div>
                    )}
                    {entry.type === "other" && (
                      <div className="space-y-2">
                        <p>{entry.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add other sections (Objective, Assessment, Plan) as they are implemented */}
    </div>
  )
}

