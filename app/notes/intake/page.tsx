"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import { Download, FolderOpen, Save, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { Textarea } from "@/components/ui/textarea"
import {
  createLocalDocumentExport,
  createLocalDocumentFilename,
  parseLocalDocumentJson,
} from "@/lib/local-documents"

const INTAKE_STORAGE_KEY = "massagelab-intake-draft"

const emptyIntakeForm = {
  schemaVersion: 1,
  formType: "intake",
  clientName: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  emergencyContact: "",
  physician: "",
  currentConditions: "",
  medications: "",
  contraindications: "",
  goals: "",
  notes: "",
}

type IntakeFormData = typeof emptyIntakeForm

function downloadJson(filename: string, data: IntakeFormData) {
  const blob = new Blob([JSON.stringify(createLocalDocumentExport(data), null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function filenameForIntake(data: IntakeFormData) {
  return createLocalDocumentFilename({
    prefix: "massagelab-intake",
    subject: data.clientName,
    extension: "json",
  })
}

export default function IntakePage() {
  const [formData, setFormData] = useState<IntakeFormData>(emptyIntakeForm)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const draft = window.localStorage.getItem(INTAKE_STORAGE_KEY)
    if (draft) {
      try {
        setFormData(parseLocalDocumentJson(draft, emptyIntakeForm, {
          discriminatorKey: "formType",
          discriminatorValue: "intake",
        }))
      } catch {
        window.localStorage.removeItem(INTAKE_STORAGE_KEY)
      }
    }
  }, [])

  const updateField = (field: keyof IntakeFormData, value: string) => {
    setMessage(null)
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const saveDraft = () => {
    window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(formData))
    setMessage("Draft saved locally on this device.")
  }

  const exportForm = () => {
    downloadJson(filenameForIntake(formData), formData)
    setMessage("Exported a user-controlled JSON file. MassageLab did not upload this form.")
  }

  const importForm = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = parseLocalDocumentJson(await file.text(), emptyIntakeForm, {
        discriminatorKey: "formType",
        discriminatorValue: "intake",
      })
      setFormData(imported)
      setMessage("Imported intake form. Review it before saving or exporting.")
    } catch {
      setMessage("Could not import that file. Choose a MassageLab intake JSON export.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeading>Intake Form</PageHeading>

        <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-[#ff7043]" />
            <div>
              <CardTitle>Local-first PHI handling</CardTitle>
              <CardDescription>
                This form is saved in this browser only when you choose Save Local Draft. Exported files are controlled by the user.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
            <CardDescription>Use only the fields you need for your practice workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input id="clientName" value={formData.clientName} onChange={(event) => updateField("clientName", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={(event) => updateField("phone", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(event) => updateField("email", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input id="emergencyContact" value={formData.emergencyContact} onChange={(event) => updateField("emergencyContact", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="physician">Physician</Label>
                <Input id="physician" value={formData.physician} onChange={(event) => updateField("physician", event.target.value)} />
              </div>
            </div>

            <div className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="currentConditions">Current Conditions</Label>
                <Textarea id="currentConditions" value={formData.currentConditions} onChange={(event) => updateField("currentConditions", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medications">Medications</Label>
                <Textarea id="medications" value={formData.medications} onChange={(event) => updateField("medications", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contraindications">Contraindications / Precautions</Label>
                <Textarea id="contraindications" value={formData.contraindications} onChange={(event) => updateField("contraindications", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goals">Session Goals</Label>
                <Textarea id="goals" value={formData.goals} onChange={(event) => updateField("goals", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea id="notes" value={formData.notes} onChange={(event) => updateField("notes", event.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t pt-5">
              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importForm} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft}>
                <Save className="mr-2 h-4 w-4" />
                Save Local Draft
              </Button>
              <Button type="button" className="bg-[#ff7043] hover:bg-[#f4511e]" onClick={exportForm}>
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
            {message && <p className="text-sm text-[#ffb199]">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
