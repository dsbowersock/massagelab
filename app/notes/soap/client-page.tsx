"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, FileText, Printer, Save, ShieldCheck } from "lucide-react"
import { Assessment } from "./components/assessment"
import { BodyDiagram } from "./components/body-diagram"
import { IdentifyingInfo } from "./components/identifying-info"
import { InformedConsent } from "./components/informed-consent"
import { ObjectiveInfo } from "./components/objective-info"
import { Plan } from "./components/plan"
import { Review } from "./components/review"
import { SubjectiveInfo } from "./components/subjective-info"
import { TranscriptReview } from "./components/transcript-review"
import type { SoapNoteData } from "./types"
import { AppPageShell, appCalloutClassName, appSurfaceClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createEditableDocumentHtml,
  createLocalDocumentFilename,
} from "@/lib/local-documents"
import {
  PlaintextOutputWarningAction,
  ProfessionalRecordVaultGate,
  ProfessionalRecordVaultToolbar,
  ProfessionalRecordVaultTransferControls,
  useProfessionalRecordVault,
} from "../professional-record-vault-provider"

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

/**
 * Normalizes partial or legacy SOAP draft data into the current local form state.
 *
 * The encrypted vault may contain older drafts, so this pins the v2 SOAP
 * contract, reapplies defaults for missing sections, and coerces repeatable
 * fields back to arrays before any section component renders or saves them.
 */
function normalizeSoapNoteData(data: Partial<SoapNoteData> | null | undefined): SoapNoteData {
  return {
    ...emptySoapNote,
    ...(data ?? {}),
    schemaVersion: 2,
    noteType: "soap",
    subjectiveEntries: Array.isArray(data?.subjectiveEntries) ? data.subjectiveEntries : [],
    objectiveEntries: Array.isArray(data?.objectiveEntries) ? data.objectiveEntries : [],
    assessment: {
      ...emptySoapNote.assessment,
      ...(data?.assessment ?? {}),
      techniques: Array.isArray(data?.assessment?.techniques) ? data.assessment.techniques : [],
    },
    treatmentPlan: {
      ...emptySoapNote.treatmentPlan,
      ...(data?.treatmentPlan ?? {}),
    },
    bodyDiagram: {
      ...emptySoapNote.bodyDiagram,
      ...(data?.bodyDiagram ?? {}),
      painMapSelections: Array.isArray(data?.bodyDiagram?.painMapSelections) ? data.bodyDiagram.painMapSelections : [],
    },
    transcriptSegments: Array.isArray(data?.transcriptSegments) ? data.transcriptSegments : [],
  }
}

export default function SoapNotesPage() {
  const vault = useProfessionalRecordVault()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<SoapNoteData>(emptySoapNote)
  const [message, setMessage] = useState<string | null>(null)
  const loadedRevisionRef = useRef(-1)

  const CurrentStepComponent = steps.find((step) => step.id === currentStep)?.component
  const progress = (currentStep / steps.length) * 100

  useEffect(() => {
    if (vault.status !== "unlocked" || loadedRevisionRef.current === vault.revision) {
      return
    }

    loadedRevisionRef.current = vault.revision
    setFormData(normalizeSoapNoteData(vault.payload.records?.soap?.draft ?? emptySoapNote))
  }, [vault.status, vault.revision, vault.payload])

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

  const saveEncryptedDraft = async () => {
    const saved = await vault.saveDraft("soap", formData, "SOAP draft saved in the encrypted professional-record vault.")
    if (saved) {
      loadedRevisionRef.current = vault.revision + 1
      setMessage("SOAP draft saved in the encrypted professional-record vault.")
    }
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
    setMessage("Created a plaintext DOC file from the unlocked vault. Store and share it carefully.")
  }

  const printPdf = () => {
    const opened = openPrintDocument(
      createEditableDocumentHtml({ title: "MassageLab SOAP Note", body: generateSoapText(formData) }),
    )
    setMessage(opened ? "Opened a plaintext print view. Choose Save as PDF in your browser dialog." : "Could not open the print view.")
  }

  return (
    <ProfessionalRecordVaultGate>
      <AppPageShell title="S.O.A.P. Notes" width="standard">
        <Card className={appCalloutClassName}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-brand-orange" />
            <div>
              <CardTitle>Encrypted professional-record vault</CardTitle>
              <CardDescription>
                SOAP notes are stored in the unlocked browser vault. MassageLab does not upload this note or import plaintext clinical JSON.
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
                <Button variant="outline" type="button" onClick={saveEncryptedDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  Save encrypted draft
                </Button>
                {currentStep === steps.length ? (
                  <>
                    <PlaintextOutputWarningAction
                      label="Export DOC"
                      description="This creates an unencrypted editable clinical document outside the vault. Use encrypted vault bundles for normal transfer."
                      icon={<FileText className="mr-2 h-4 w-4" />}
                      onConfirm={exportDoc}
                    />
                    <PlaintextOutputWarningAction
                      label="Save PDF"
                      description="This opens an unencrypted print view outside the vault. Use encrypted vault bundles for normal transfer."
                      icon={<Printer className="mr-2 h-4 w-4" />}
                      onConfirm={printPdf}
                    />
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
        <Card className={appSurfaceClassName}>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Encrypted vault transfer</CardTitle>
              <CardDescription>Export or import the full professional-record vault as an encrypted `.mlab` bundle.</CardDescription>
            </div>
            <ProfessionalRecordVaultToolbar />
          </CardHeader>
          <div className="px-6 pb-6">
            <ProfessionalRecordVaultTransferControls idPrefix="soapVault" />
          </div>
        </Card>
      </AppPageShell>
    </ProfessionalRecordVaultGate>
  )
}
