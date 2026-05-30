"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download, FileText, FolderOpen, Printer, Save, ShieldCheck } from "lucide-react"
import { Assessment } from "./components/assessment"
import { BodyDiagram } from "./components/body-diagram"
import { IdentifyingInfo } from "./components/identifying-info"
import { InformedConsent } from "./components/informed-consent"
import { ObjectiveInfo } from "./components/objective-info"
import { Plan } from "./components/plan"
import { Review } from "./components/review"
import { SubjectiveInfo } from "./components/subjective-info"
import { TranscriptReview } from "./components/transcript-review"
import type { PainMapSelection, TranscriptSegment } from "./types"
import { AppPageShell, appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createEditableDocumentHtml,
  createLocalDocumentExport,
  createLocalDocumentFilename,
  parseLocalDocumentJson,
} from "@/lib/local-documents"

const SOAP_STORAGE_KEY = "massagelab-soap-draft"

interface SoapNoteData {
  schemaVersion: number
  noteType: "soap"
  clientName: string
  dateOfBirth: string
  date: string
  time: string
  therapistName: string
  location: string
  licenseNumber: string
  licenseOrganization: string
  npiNumber: string
  clientNumber: string
  generalNotes: string
  subjectiveEntries: unknown[]
  generalObservations: string
  objectiveEntries: unknown[]
  consentName: string
  consentDate: string
  consentInitials: string
  consentAcknowledged: boolean
  assessment: {
    overallAssessment: string
    techniques: unknown[]
    findings: string
    clinicalNotes: string
  }
  treatmentPlan: {
    nextSession: string
    frequency: string
    homeCare: string
    referrals: string
    notes: string
  }
  bodyDiagram: {
    regions: string
    notes: string
    painMapSelections: PainMapSelection[]
    googleImportNotes: string
  }
  transcriptSegments: TranscriptSegment[]
}

const emptySoapNote: SoapNoteData = {
  schemaVersion: 2,
  noteType: "soap",
  clientName: "",
  dateOfBirth: "",
  date: "",
  time: "",
  therapistName: "",
  location: "",
  licenseNumber: "",
  licenseOrganization: "",
  npiNumber: "",
  clientNumber: "",
  generalNotes: "",
  subjectiveEntries: [],
  generalObservations: "",
  objectiveEntries: [],
  consentName: "",
  consentDate: "",
  consentInitials: "",
  consentAcknowledged: false,
  assessment: {
    overallAssessment: "",
    techniques: [],
    findings: "",
    clinicalNotes: "",
  },
  treatmentPlan: {
    nextSession: "",
    frequency: "",
    homeCare: "",
    referrals: "",
    notes: "",
  },
  bodyDiagram: {
    regions: "",
    notes: "",
    painMapSelections: [],
    googleImportNotes: "",
  },
  transcriptSegments: [],
}

const steps = [
  { id: 1, title: "Identify", component: IdentifyingInfo },
  { id: 2, title: "Subjective", component: SubjectiveInfo },
  { id: 3, title: "Objective", component: ObjectiveInfo },
  { id: 4, title: "Consent", component: InformedConsent },
  { id: 5, title: "Assessment", component: Assessment },
  { id: 6, title: "Plan", component: Plan },
  { id: 7, title: "Body Map", component: BodyDiagram },
  { id: 8, title: "Transcript", component: TranscriptReview },
  { id: 9, title: "Review", component: Review },
]

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

function formatLine(label: string, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return `${label}:`
  }
  return `${label}: ${value}`
}

function generateSoapText(data: SoapNoteData) {
  return [
    "MassageLab SOAP Note",
    "Local-first export. User is responsible for PHI storage and sharing.",
    "",
    "Identifying Information",
    formatLine("Client", data.clientName),
    formatLine("Date of birth", data.dateOfBirth),
    formatLine("Session date", data.date),
    formatLine("Session time", data.time),
    formatLine("Therapist", data.therapistName),
    formatLine("Location", data.location),
    formatLine("License", data.licenseNumber),
    formatLine("License organization", data.licenseOrganization),
    formatLine("NPI", data.npiNumber),
    formatLine("Client number", data.clientNumber),
    "",
    "Subjective",
    data.generalNotes || "",
    JSON.stringify(data.subjectiveEntries, null, 2),
    "",
    "Objective",
    data.generalObservations || "",
    JSON.stringify(data.objectiveEntries, null, 2),
    "",
    "Consent",
    formatLine("Consent name", data.consentName),
    formatLine("Consent date", data.consentDate),
    formatLine("Initials", data.consentInitials),
    formatLine("Acknowledged", data.consentAcknowledged ? "Yes" : "No"),
    "",
    "Assessment",
    data.assessment.overallAssessment || "",
    formatLine("Key findings", data.assessment.findings),
    formatLine("Clinical notes", data.assessment.clinicalNotes),
    JSON.stringify(data.assessment.techniques, null, 2),
    "",
    "Plan",
    formatLine("Next session", data.treatmentPlan.nextSession),
    formatLine("Frequency", data.treatmentPlan.frequency),
    formatLine("Home care", data.treatmentPlan.homeCare),
    formatLine("Referrals", data.treatmentPlan.referrals),
    formatLine("Notes", data.treatmentPlan.notes),
    "",
    "Body Map",
    formatLine("Regions", data.bodyDiagram.regions),
    formatLine("Notes", data.bodyDiagram.notes),
    JSON.stringify(data.bodyDiagram.painMapSelections, null, 2),
    "",
    "Transcript Review",
    JSON.stringify(data.transcriptSegments, null, 2),
  ].join("\n")
}

const researchTextKeys = new Set([
  "type",
  "intensity",
  "priority",
  "pattern",
  "timePattern",
  "bodyRegion",
  "regionId",
  "side",
  "view",
  "source",
  "timestampRange",
  "targetSoapSection",
])

function anonymizeStructuredValue(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => anonymizeStructuredValue(item))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, anonymizeStructuredValue(entryValue, entryKey)]),
    )
  }

  if (typeof value === "string") {
    return researchTextKeys.has(key) ? value : ""
  }

  return value
}

function createResearchExport(data: SoapNoteData) {
  return {
    schemaVersion: 2,
    noteType: "soap",
    researchExport: true,
    anonymizedAt: new Date().toISOString(),
    sessionMonth: data.date ? data.date.slice(0, 7) : "",
    subjectiveEntries: anonymizeStructuredValue(data.subjectiveEntries),
    objectiveEntries: anonymizeStructuredValue(data.objectiveEntries),
    painMapSelections: anonymizeStructuredValue(data.bodyDiagram.painMapSelections),
    assessmentTechniques: anonymizeStructuredValue(data.assessment.techniques),
    transcriptSegmentCount: data.transcriptSegments.length,
  }
}

function normalizeSoapNoteData(data: SoapNoteData): SoapNoteData {
  return {
    ...emptySoapNote,
    ...data,
    schemaVersion: 2,
    subjectiveEntries: Array.isArray(data.subjectiveEntries) ? data.subjectiveEntries : [],
    objectiveEntries: Array.isArray(data.objectiveEntries) ? data.objectiveEntries : [],
    assessment: {
      ...emptySoapNote.assessment,
      ...(data.assessment ?? {}),
      techniques: Array.isArray(data.assessment?.techniques) ? data.assessment.techniques : [],
    },
    treatmentPlan: {
      ...emptySoapNote.treatmentPlan,
      ...(data.treatmentPlan ?? {}),
    },
    bodyDiagram: {
      ...emptySoapNote.bodyDiagram,
      ...(data.bodyDiagram ?? {}),
      painMapSelections: Array.isArray(data.bodyDiagram?.painMapSelections) ? data.bodyDiagram.painMapSelections : [],
    },
    transcriptSegments: Array.isArray(data.transcriptSegments) ? data.transcriptSegments : [],
  }
}

export default function SoapNotesPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<SoapNoteData>(emptySoapNote)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const CurrentStepComponent = steps.find((step) => step.id === currentStep)?.component
  const progress = (currentStep / steps.length) * 100

  useEffect(() => {
    const draft = window.localStorage.getItem(SOAP_STORAGE_KEY)
    if (draft) {
      try {
        setFormData(normalizeSoapNoteData(parseLocalDocumentJson(draft, emptySoapNote, {
          discriminatorKey: "noteType",
          discriminatorValue: "soap",
        })))
      } catch {
        window.localStorage.removeItem(SOAP_STORAGE_KEY)
      }
    }
  }, [])

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep((current) => current + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((current) => current - 1)
    }
  }

  const saveLocalDraft = () => {
    window.localStorage.setItem(SOAP_STORAGE_KEY, JSON.stringify(formData))
    setMessage("Draft saved locally in this browser.")
  }

  const exportJson = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-soap",
      subject: formData.clientName,
      extension: "json",
    })
    const exported = createLocalDocumentExport(formData)
    downloadFile(filename, JSON.stringify(exported, null, 2), "application/json")
    setMessage("Exported a user-controlled JSON file. MassageLab did not upload this note.")
  }

  const exportText = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-soap",
      subject: formData.clientName,
      extension: "txt",
    })
    downloadFile(filename, generateSoapText(formData), "text/plain")
    setMessage("Exported a user-controlled text file. MassageLab did not upload this note.")
  }

  const exportDoc = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-soap",
      subject: formData.clientName,
      extension: "doc",
    })
    downloadFile(
      filename,
      createEditableDocumentHtml({ title: "MassageLab SOAP Note", body: generateSoapText(formData) }),
      "application/msword",
    )
    setMessage("Exported an editable document. MassageLab did not upload this note.")
  }

  const printPdf = () => {
    const opened = openPrintDocument(
      createEditableDocumentHtml({ title: "MassageLab SOAP Note", body: generateSoapText(formData) }),
    )
    setMessage(opened ? "Opened a print view. Choose Save as PDF in your browser to export a PDF." : "Could not open the print view.")
  }

  const exportResearchJson = () => {
    const filename = createLocalDocumentFilename({
      prefix: "massagelab-soap-research",
      subject: "anonymous",
      extension: "json",
      fallbackSubject: "anonymous",
    })
    downloadFile(filename, JSON.stringify(createResearchExport(formData), null, 2), "application/json")
    setMessage("Exported an anonymized local research JSON file. Review before sharing outside your device.")
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = normalizeSoapNoteData(parseLocalDocumentJson(await file.text(), emptySoapNote, {
        discriminatorKey: "noteType",
        discriminatorValue: "soap",
      }))
      setFormData(imported)
      setMessage("Imported SOAP note. Review it before saving or exporting.")
    } catch {
      setMessage("Could not import that file. Choose a MassageLab SOAP JSON export.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <AppPageShell title="S.O.A.P. Notes" width="standard">
        <Card className={appCalloutClassName}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-brand-orange" />
            <div>
              <CardTitle>Local-first PHI handling</CardTitle>
              <CardDescription>
                This alpha does not send SOAP notes to a server. Local drafts stay in this browser, and exported files are the user&apos;s responsibility.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className={`${appSurfaceClassName} p-6`}>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="hidden md:block">
                <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(Number(value))}>
                  <TabsList className="grid h-auto w-full grid-cols-9">
                    {steps.map((step) => (
                      <TabsTrigger
                        key={step.id}
                        value={step.id.toString()}
                        className="h-auto whitespace-normal py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        {step.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              <div className="md:hidden">
                <Select value={currentStep.toString()} onValueChange={(value) => setCurrentStep(Number(value))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select step" />
                  </SelectTrigger>
                  <SelectContent>
                    {steps.map((step) => (
                      <SelectItem key={step.id} value={step.id.toString()}>
                        {step.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md bg-black/20 px-4 py-5">
                <Progress value={progress} className="h-2 bg-neutral-800 [&>div]:bg-primary" />
              </div>
            </div>

            <div className="min-h-[400px]">
              {CurrentStepComponent && <CurrentStepComponent formData={formData} setFormData={setFormData} />}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
              <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              <div className="flex flex-wrap gap-2">
                <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
                <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <Button variant="outline" type="button" onClick={saveLocalDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Local Draft
                </Button>
                {currentStep === steps.length ? (
                  <>
                    <Button variant="outline" type="button" onClick={exportText}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export Text
                    </Button>
                    <Button variant="outline" type="button" onClick={exportDoc}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export DOC
                    </Button>
                    <Button variant="outline" type="button" onClick={printPdf}>
                      <Printer className="mr-2 h-4 w-4" />
                      Save PDF
                    </Button>
                    <Button variant="outline" type="button" onClick={exportResearchJson}>
                      <Download className="mr-2 h-4 w-4" />
                      Research JSON
                    </Button>
                    <Button className="bg-primary hover:bg-brand-orange-glow" type="button" onClick={exportJson}>
                      <Download className="mr-2 h-4 w-4" />
                      Export JSON
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleNext} className="bg-primary hover:bg-brand-orange-glow">
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {message && <p className="text-sm text-brand-orange">{message}</p>}
          </div>
        </Card>
    </AppPageShell>
  )
}
