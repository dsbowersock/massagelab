"use client"

import { ChangeEvent, useRef, useState } from "react"
import { FileText, Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { TranscriptSegment, TranscriptTargetSoapSection } from "../types"

interface TranscriptReviewProps {
  formData: any
  setFormData: (data: any) => void
}

const targetSections: Array<{ value: TranscriptTargetSoapSection; label: string }> = [
  { value: "generalNotes", label: "Subjective notes" },
  { value: "generalObservations", label: "Objective observations" },
  { value: "assessment.findings", label: "Assessment findings" },
  { value: "assessment.clinicalNotes", label: "Assessment clinical notes" },
  { value: "treatmentPlan.notes", label: "Plan notes" },
]

function segmentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `segment-${Date.now()}-${Math.random()}`
}

function createSegments(text: string, source: TranscriptSegment["source"]) {
  return text
    .split(/\n{2,}|\r?\n(?=\S)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => ({
      id: segmentId(),
      text: part,
      source,
      timestampRange: "",
      selected: index === 0,
      targetSoapSection: "generalNotes" as TranscriptTargetSoapSection,
    }))
}

function appendText(current: string | undefined, next: string) {
  return [current?.trim(), next.trim()].filter(Boolean).join("\n\n")
}

export function TranscriptReview({ formData, setFormData }: TranscriptReviewProps) {
  const [draft, setDraft] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const segments: TranscriptSegment[] = Array.isArray(formData.transcriptSegments) ? formData.transcriptSegments : []

  const updateSegments = (nextSegments: TranscriptSegment[]) => {
    setFormData({
      ...formData,
      transcriptSegments: nextSegments,
    })
  }

  const addDraftSegments = () => {
    const nextSegments = createSegments(draft, "paste")
    if (nextSegments.length === 0) {
      return
    }
    updateSegments([...segments, ...nextSegments])
    setDraft("")
  }

  const importTranscript = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const nextSegments = createSegments(text, "import")
    updateSegments([...segments, ...nextSegments])
    event.target.value = ""
  }

  const updateSegment = (segmentIdValue: string, next: Partial<TranscriptSegment>) => {
    updateSegments(segments.map((segment) => (
      segment.id === segmentIdValue ? { ...segment, ...next } : segment
    )))
  }

  const insertSelected = () => {
    const selected = segments.filter((segment) => segment.selected && segment.text.trim())
    if (selected.length === 0) {
      return
    }

    const nextData = {
      ...formData,
      assessment: {
        ...(formData.assessment ?? {}),
      },
      treatmentPlan: {
        ...(formData.treatmentPlan ?? {}),
      },
      transcriptSegments: segments.map((segment) => ({ ...segment, selected: false })),
    }

    selected.forEach((segment) => {
      if (segment.targetSoapSection === "generalNotes") {
        nextData.generalNotes = appendText(nextData.generalNotes, segment.text)
      } else if (segment.targetSoapSection === "generalObservations") {
        nextData.generalObservations = appendText(nextData.generalObservations, segment.text)
      } else if (segment.targetSoapSection === "assessment.findings") {
        nextData.assessment.findings = appendText(nextData.assessment.findings, segment.text)
      } else if (segment.targetSoapSection === "assessment.clinicalNotes") {
        nextData.assessment.clinicalNotes = appendText(nextData.assessment.clinicalNotes, segment.text)
      } else if (segment.targetSoapSection === "treatmentPlan.notes") {
        nextData.treatmentPlan.notes = appendText(nextData.treatmentPlan.notes, segment.text)
      }
    })

    setFormData(nextData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript Review</CardTitle>
        <CardDescription>
          Paste or import transcript text, select useful segments, then explicitly insert them into SOAP fields.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border border-[#ff7043]/40 bg-[#ff7043]/10 p-4 text-sm text-[#ffd5c8]">
          Transcript content is local to this browser note. MassageLab does not automatically add transcript text to clinical documentation.
        </div>

        <div className="space-y-3">
          <Label htmlFor="transcriptDraft">Transcript text</Label>
          <Textarea
            id="transcriptDraft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste intake, session, or post-session transcript text here..."
            className="min-h-[160px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={addDraftSegments} className="bg-[#ff7043] hover:bg-[#f4511e]">
              <Plus className="mr-2 h-4 w-4" />
              Create Segments
            </Button>
            <input ref={fileInputRef} type="file" accept="text/plain,.txt,.md" className="hidden" onChange={importTranscript} />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import Text
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {segments.length > 0 ? segments.map((segment) => (
            <div key={segment.id} className="rounded-md border border-neutral-800 bg-background/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={segment.selected} onCheckedChange={(checked) => updateSegment(segment.id, { selected: Boolean(checked) })} />
                  Use this segment
                </label>
                <div className="w-full sm:w-64">
                  <Select value={segment.targetSoapSection} onValueChange={(value) => updateSegment(segment.id, { targetSoapSection: value as TranscriptTargetSoapSection })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {targetSections.map((target) => (
                        <SelectItem key={target.value} value={target.value}>{target.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                value={segment.text}
                onChange={(event) => updateSegment(segment.id, { text: event.target.value })}
                className="min-h-[90px]"
              />
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`timestamp-${segment.id}`}>Timestamp range</Label>
                  <input
                    id={`timestamp-${segment.id}`}
                    value={segment.timestampRange}
                    onChange={(event) => updateSegment(segment.id, { timestampRange: event.target.value })}
                    placeholder="00:12-00:45"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <div className="flex h-10 items-center rounded-md border border-neutral-800 bg-black/20 px-3 text-sm text-muted-foreground">
                    {segment.source}
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-md border border-dashed border-neutral-700 p-6 text-sm text-muted-foreground">
              <FileText className="mb-3 h-5 w-5 text-[#ff7043]" />
              No transcript segments yet.
            </div>
          )}
        </div>

        <Button type="button" onClick={insertSelected} disabled={!segments.some((segment) => segment.selected)} className="bg-[#ff7043] hover:bg-[#f4511e]">
          Insert Selected Into SOAP
        </Button>
      </CardContent>
    </Card>
  )
}
