"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download, FileText, FolderOpen, Save, ShieldCheck } from "lucide-react"
import { Assessment } from "./components/assessment"
import { BodyDiagram } from "./components/body-diagram"
import { IdentifyingInfo } from "./components/identifying-info"
import { InformedConsent } from "./components/informed-consent"
import { ObjectiveInfo } from "./components/objective-info"
import { Plan } from "./components/plan"
import { Review } from "./components/review"
import { SubjectiveInfo } from "./components/subjective-info"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
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
  }
}

const emptySoapNote: SoapNoteData = {
  schemaVersion: 1,
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
  },
}

const steps = [
  { id: 1, title: "Identify", component: IdentifyingInfo },
  { id: 2, title: "Subjective", component: SubjectiveInfo },
  { id: 3, title: "Objective", component: ObjectiveInfo },
  { id: 4, title: "Consent", component: InformedConsent },
  { id: 5, title: "Assessment", component: Assessment },
  { id: 6, title: "Plan", component: Plan },
  { id: 7, title: "Body Map", component: BodyDiagram },
  { id: 8, title: "Review", component: Review },
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
  ].join("\n")
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
        setFormData(parseLocalDocumentJson(draft, emptySoapNote, {
          discriminatorKey: "noteType",
          discriminatorValue: "soap",
        }))
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

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = parseLocalDocumentJson(await file.text(), emptySoapNote, {
        discriminatorKey: "noteType",
        discriminatorValue: "soap",
      })
      setFormData(imported)
      setMessage("Imported SOAP note. Review it before saving or exporting.")
    } catch {
      setMessage("Could not import that file. Choose a MassageLab SOAP JSON export.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeading>S.O.A.P. Notes</PageHeading>

        <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-[#ff7043]" />
            <div>
              <CardTitle>Local-first PHI handling</CardTitle>
              <CardDescription>
                This alpha does not send SOAP notes to a server. Local drafts stay in this browser, and exported files are the user&apos;s responsibility.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-card/90 p-6 backdrop-blur">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="hidden md:block">
                <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(Number(value))}>
                  <TabsList className="grid h-auto w-full grid-cols-8">
                    {steps.map((step) => (
                      <TabsTrigger
                        key={step.id}
                        value={step.id.toString()}
                        className="h-auto whitespace-normal py-2 text-xs data-[state=active]:bg-[#ff7043] data-[state=active]:text-white"
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
                <Progress value={progress} className="h-2 bg-neutral-800 [&>div]:bg-[#ff7043]" />
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
                    <Button className="bg-[#ff7043] hover:bg-[#f4511e]" type="button" onClick={exportJson}>
                      <Download className="mr-2 h-4 w-4" />
                      Export JSON
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleNext} className="bg-[#ff7043] hover:bg-[#f4511e]">
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {message && <p className="text-sm text-[#ffb199]">{message}</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
