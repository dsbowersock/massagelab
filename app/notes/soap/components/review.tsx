"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ObjectiveEntry, SubjectiveEntry } from "../types"

interface ReviewProps {
  formData: any
}

function formatDate(dateString: string) {
  if (!dateString) return ""
  return new Date(`${dateString}T00:00:00`).toLocaleDateString()
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

export function Review({ formData }: ReviewProps) {
  const subjectiveEntries = formData.subjectiveEntries || []
  const objectiveEntries = formData.objectiveEntries || []
  const techniques = formData.assessment?.techniques || []
  const painMapSelections = formData.bodyDiagram?.painMapSelections || []
  const transcriptSegments = formData.transcriptSegments || []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identifying Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><strong>Client Name:</strong> {formData.clientName}</div>
          <div><strong>Date of Birth:</strong> {formatDate(formData.dateOfBirth)}</div>
          <div><strong>Session Date:</strong> {formatDate(formData.date)}</div>
          <div><strong>Session Time:</strong> {formData.time}</div>
          <div><strong>Therapist:</strong> {formData.therapistName}</div>
          <div><strong>Location:</strong> {formData.location}</div>
          <div><strong>License Number:</strong> {formData.licenseNumber}</div>
          <div><strong>License Org:</strong> {formData.licenseOrganization}</div>
          <div><strong>NPI Number:</strong> {formData.npiNumber}</div>
          <div><strong>Client Number:</strong> {formData.clientNumber}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subjective</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.generalNotes ? <p className="whitespace-pre-wrap">{formData.generalNotes}</p> : <EmptyLine>No general subjective notes entered.</EmptyLine>}
          {subjectiveEntries.length > 0 ? (
            subjectiveEntries.map((entry: SubjectiveEntry, index: number) => (
              <Card key={index}>
                <CardContent className="space-y-2 pt-4">
                  <p><strong>Type:</strong> {entry.type}</p>
                  <pre className="whitespace-pre-wrap rounded-md bg-black/20 p-3 text-sm">{JSON.stringify(entry, null, 2)}</pre>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyLine>No structured subjective entries entered.</EmptyLine>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objective</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.generalObservations ? <p className="whitespace-pre-wrap">{formData.generalObservations}</p> : <EmptyLine>No general objective observations entered.</EmptyLine>}
          {objectiveEntries.length > 0 ? (
            objectiveEntries.map((entry: ObjectiveEntry, index: number) => (
              <Card key={index}>
                <CardContent className="space-y-2 pt-4">
                  <p><strong>Type:</strong> {entry.type}</p>
                  <pre className="whitespace-pre-wrap rounded-md bg-black/20 p-3 text-sm">{JSON.stringify(entry, null, 2)}</pre>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyLine>No structured objective entries entered.</EmptyLine>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consent</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><strong>Name:</strong> {formData.consentName}</div>
          <div><strong>Date:</strong> {formatDate(formData.consentDate)}</div>
          <div><strong>Initials:</strong> {formData.consentInitials}</div>
          <div><strong>Acknowledged:</strong> {formData.consentAcknowledged ? "Yes" : "No"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap">{formData.assessment?.overallAssessment}</p>
          <p><strong>Findings:</strong> {formData.assessment?.findings}</p>
          <p><strong>Clinical Notes:</strong> {formData.assessment?.clinicalNotes}</p>
          {techniques.length > 0 ? (
            <pre className="whitespace-pre-wrap rounded-md bg-black/20 p-3 text-sm">{JSON.stringify(techniques, null, 2)}</pre>
          ) : (
            <EmptyLine>No techniques entered.</EmptyLine>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Next Session:</strong> {formData.treatmentPlan?.nextSession}</p>
          <p><strong>Frequency:</strong> {formData.treatmentPlan?.frequency}</p>
          <p><strong>Home Care:</strong> {formData.treatmentPlan?.homeCare}</p>
          <p><strong>Referrals:</strong> {formData.treatmentPlan?.referrals}</p>
          <p><strong>Notes:</strong> {formData.treatmentPlan?.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Body Map</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Regions:</strong> {formData.bodyDiagram?.regions}</p>
          <p><strong>Notes:</strong> {formData.bodyDiagram?.notes}</p>
          {painMapSelections.length > 0 ? (
            <pre className="whitespace-pre-wrap rounded-md bg-black/20 p-3 text-sm">{JSON.stringify(painMapSelections, null, 2)}</pre>
          ) : (
            <EmptyLine>No structured pain-map selections entered.</EmptyLine>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcript Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {transcriptSegments.length > 0 ? (
            <pre className="whitespace-pre-wrap rounded-md bg-black/20 p-3 text-sm">{JSON.stringify(transcriptSegments, null, 2)}</pre>
          ) : (
            <EmptyLine>No transcript segments created.</EmptyLine>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
