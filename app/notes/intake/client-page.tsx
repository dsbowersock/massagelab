"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ClipboardList,
  Copy,
  FileText,
  LayoutDashboard,
  Plus,
  Printer,
  Save,
  TabletSmartphone,
  Trash2,
  UserRound,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AppInset, AppNotice, AppPageShell, AppStatusTile, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  BODY_MAP_PARTS,
  BODY_MAP_SIDES,
  FORM_QUESTION_TYPES,
  createClinicalDocumentFromResponse,
  createClientProfileFromResponse,
  createDefaultIntakeWorkspace,
  createFormResponseExportText,
  normalizeFormResponse,
  normalizeIntakeWorkspace,
  requiredQuestionIssues,
  shouldShowQuestion,
  starterIntakeTemplates,
  validateFormDefinition,
} from "@/lib/local-intake-builder"
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
import {
  createSoapDraftFromIntakeDocument,
  hasMeaningfulSoapDraft,
} from "@/lib/intake-soap-handoff"
import type {
  IntakeAnswerValue,
  IntakeBodyMapAnswer,
  IntakeClientProfile,
  IntakeClinicalDocument,
  IntakeFormResponse,
  IntakeQuestion,
  IntakeTemplate,
  IntakeTemplateKind,
  IntakeTemplateSection,
  IntakeWorkspace,
  ManualClientDraft,
} from "./types"
import {
  intakeStringAnswer,
  intakeStringArrayAnswer,
  isIntakeBodyMapAnswer,
} from "./types"

function nowIso() {
  return new Date().toISOString()
}

function createUiId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

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
  if (!printWindow) return false
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}

function documentFilename(document: IntakeClinicalDocument, client: IntakeClientProfile | undefined, extension = "json") {
  return createLocalDocumentFilename({
    prefix: `massagelab-${document.kind || "intake"}`,
    subject: client?.displayName || document.title || "client",
    extension,
  })
}

function templateOptions(templates: IntakeTemplate[]) {
  return templates.filter((template) => !template.archived)
}

function getTemplate(workspace: IntakeWorkspace, templateId: string) {
  return workspace.templates.find((template) => template.id === templateId) ?? workspace.templates[0]
}

type NormalizeFormTemplates = Parameters<typeof normalizeFormResponse>[1]

function normalizeFormTemplates(templates: IntakeTemplate[]): NormalizeFormTemplates {
  return templates as unknown as NormalizeFormTemplates
}

function blankResponse(templateId: string, templates: IntakeTemplate[], localClientId = ""): IntakeFormResponse {
  return (normalizeFormResponse({
    id: createUiId("response"),
    templateId,
    localClientId,
    answers: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }, normalizeFormTemplates(templates)) ?? {
    id: createUiId("response"),
    schemaVersion: 1,
    templateId,
    templateTitle: "Local form",
    intakeType: "",
    localClientId,
    answers: {},
    completedAt: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }) as IntakeFormResponse
}

function replaceById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item))
}

function bodyMapAnswerFromValue(value: IntakeAnswerValue): IntakeBodyMapAnswer {
  return isIntakeBodyMapAnswer(value) ? value : { selected: {}, notes: "" }
}

type SoapSeedMode = "append" | "replace"

type DashboardPanelProps = {
  workspace: IntakeWorkspace
  selectedClientId: string
  selectedDocumentId: string
  manualClient: ManualClientDraft
  message: string | null
  onSelectClient: (clientId: string) => void
  onSelectDocument: (documentId: string) => void
  onManualClientChange: (next: ManualClientDraft) => void
  onAddManualClient: () => void
  onStartFollowUpIntake: (clientId: string) => void
  onSaveWorkspace: () => void
  onExportSelectedDocumentDoc: () => void
  onPrintSelectedDocumentPdf: () => void
  onUseSelectedDocumentInSoap: (mode: SoapSeedMode) => void
  onClearLocalWorkspace: () => void
  hasExistingSoapDraft: boolean
}

type TabletFillPanelProps = {
  workspace: IntakeWorkspace
  template: IntakeTemplate
  selectedClientId: string
  response: IntakeFormResponse
  message: string | null
  onSelectClient: (clientId: string) => void
  onSelectTemplate: (templateId: string) => void
  onAnswerChange: (questionId: string, value: IntakeAnswerValue) => void
  onBodyMapSelectionChange: (questionId: string, key: string, checked: boolean) => void
  onBodyMapNotesChange: (questionId: string, notes: string) => void
  onSaveCompletedResponse: () => void
  onClearForNextClient: () => void
}

type QuestionFieldProps = {
  field: IntakeQuestion
  value: IntakeAnswerValue
  onChange: (value: IntakeAnswerValue) => void
  onBodyMapSelectionChange: (key: string, checked: boolean) => void
  onBodyMapNotesChange: (notes: string) => void
}

type FormBuilderPanelProps = {
  workspace: IntakeWorkspace
  template: IntakeTemplate
  issues: string[]
  onSelectTemplate: (templateId: string) => void
  onCreateTemplate: () => void
  onDuplicateTemplate: (template: IntakeTemplate) => void
  onArchiveTemplate: (template: IntakeTemplate) => void
  onUpdateTemplate: (next: Partial<IntakeTemplate>) => void
  onAddSection: (templateId: string) => void
  onUpdateSection: (templateId: string, sectionId: string, next: Partial<Pick<IntakeTemplateSection, "title" | "description">>) => void
  onAddQuestion: (templateId: string, sectionId: string) => void
  onUpdateQuestion: (templateId: string, sectionId: string, questionId: string, next: Partial<IntakeQuestion>) => void
  onRemoveQuestion: (templateId: string, sectionId: string, questionId: string) => void
}

export default function IntakePage() {
  const router = useRouter()
  const vault = useProfessionalRecordVault()
  const [workspace, setWorkspace] = useState<IntakeWorkspace>(() => createDefaultIntakeWorkspace() as IntakeWorkspace)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [selectedTemplateId, setSelectedTemplateId] = useState(starterIntakeTemplates[0].id)
  const [builderTemplateId, setBuilderTemplateId] = useState(starterIntakeTemplates[0].id)
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedDocumentId, setSelectedDocumentId] = useState("")
  const [activeResponse, setActiveResponse] = useState<IntakeFormResponse>(() => blankResponse(starterIntakeTemplates[0].id, starterIntakeTemplates as IntakeTemplate[]))
  const [message, setMessage] = useState<string | null>(null)
  const [manualClient, setManualClient] = useState({ displayName: "", email: "", phone: "" })
  const loadedRevisionRef = useRef(-1)

  const hydrateWorkspace = (nextWorkspace: unknown) => {
    const normalized = normalizeIntakeWorkspace(nextWorkspace) as IntakeWorkspace
    setWorkspace(normalized)
    setSelectedTemplateId(normalized.activeTemplateId)
    setBuilderTemplateId(normalized.activeTemplateId)
    setSelectedClientId("")
    setSelectedDocumentId("")
    setActiveResponse(blankResponse(normalized.activeTemplateId, normalized.templates))
    return normalized
  }

  useEffect(() => {
    if (vault.status !== "unlocked" || loadedRevisionRef.current === vault.revision) {
      return
    }

    loadedRevisionRef.current = vault.revision
    hydrateWorkspace(vault.payload.records?.intake?.workspace ?? createDefaultIntakeWorkspace())
  }, [vault.status, vault.revision, vault.payload])

  const activeTemplate = useMemo(() => getTemplate(workspace, selectedTemplateId), [workspace, selectedTemplateId])
  const builderTemplate = useMemo(() => getTemplate(workspace, builderTemplateId), [workspace, builderTemplateId])
  const selectedClient = workspace.clients.find((client) => client.id === selectedClientId)
  const selectedDocument = selectedDocumentId
    ? workspace.documents.find((document) => document.id === selectedDocumentId)
    : undefined
  const selectedDocumentClient = selectedDocument
    ? workspace.clients.find((client) => client.id === selectedDocument.localClientId)
    : undefined
  const selectedDocumentTemplate = selectedDocument ? getTemplate(workspace, selectedDocument.templateId) : undefined
  const builderIssues = validateFormDefinition(builderTemplate)
  const hasExistingSoapDraft = hasMeaningfulSoapDraft(vault.payload.records?.soap?.draft)

  const persistWorkspace = async (nextWorkspace = workspace, successMessage = "Intake workspace saved in the encrypted professional-record vault.") => {
    const normalized = normalizeIntakeWorkspace({ ...nextWorkspace, updatedAt: nowIso() }) as IntakeWorkspace
    const saved = await vault.saveIntakeWorkspace(normalized, successMessage)
    if (saved) {
      loadedRevisionRef.current = vault.revision + 1
      setWorkspace(normalized)
      setMessage(successMessage)
      return normalized
    }
    setMessage("Could not save the intake workspace. Unlock the professional-record vault and try again.")
    return null
  }

  const updateWorkspace = (updater: (current: IntakeWorkspace) => IntakeWorkspace) => {
    setMessage(null)
    setWorkspace((current) => normalizeIntakeWorkspace({ ...updater(current), updatedAt: nowIso() }) as IntakeWorkspace)
  }

  const chooseTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setWorkspace((current) => normalizeIntakeWorkspace({ ...current, activeTemplateId: templateId, updatedAt: nowIso() }) as IntakeWorkspace)
    setActiveResponse(blankResponse(templateId, workspace.templates, selectedClientId))
    setMessage(null)
  }

  const updateAnswer = (questionId: string, value: IntakeAnswerValue) => {
    setMessage(null)
    setActiveResponse((current) => (normalizeFormResponse({
      ...current,
      templateId: activeTemplate.id,
      answers: { ...current.answers, [questionId]: value },
      updatedAt: nowIso(),
    }, normalizeFormTemplates(workspace.templates)) ?? current) as IntakeFormResponse)
  }

  const updateBodyMapSelection = (questionId: string, key: string, checked: boolean) => {
    const currentAnswer = bodyMapAnswerFromValue(activeResponse.answers[questionId])
    const nextSelected = { ...(currentAnswer.selected ?? {}) }
    if (checked) {
      nextSelected[key] = "Selected"
    } else {
      delete nextSelected[key]
    }
    updateAnswer(questionId, { ...currentAnswer, selected: nextSelected })
  }

  const updateBodyMapNotes = (questionId: string, notes: string) => {
    const currentAnswer = bodyMapAnswerFromValue(activeResponse.answers[questionId])
    updateAnswer(questionId, { ...currentAnswer, notes })
  }

  const saveCompletedResponse = async () => {
    const issues = requiredQuestionIssues(activeTemplate, activeResponse.answers)
    if (issues.length > 0) {
      setMessage(issues[0])
      return
    }

    const now = nowIso()
    const existingClient = workspace.clients.find((client) => client.id === selectedClientId)
    const client = (existingClient ?? createClientProfileFromResponse(activeResponse, activeTemplate, new Date(now))) as IntakeClientProfile
    const response = normalizeFormResponse({
      ...activeResponse,
      localClientId: client.id,
      completedAt: now,
      updatedAt: now,
    }, normalizeFormTemplates(workspace.templates)) as IntakeFormResponse | null
    if (!response) {
      setMessage("Could not normalize the local form response.")
      return
    }
    const document = createClinicalDocumentFromResponse(response, client, activeTemplate, new Date(now)) as IntakeClinicalDocument | null
    if (!document) {
      setMessage("Could not create the local clinical document.")
      return
    }
    const nextClients = existingClient ? replaceById(workspace.clients, client) : [...workspace.clients, client]
    const nextWorkspace = normalizeIntakeWorkspace({
      ...workspace,
      clients: nextClients,
      documents: [document, ...workspace.documents],
      activeTemplateId: activeTemplate.id,
      updatedAt: now,
    }) as IntakeWorkspace

    const savedWorkspace = await persistWorkspace(nextWorkspace, "Form response saved in the encrypted professional-record vault and linked to the local client.")
    if (!savedWorkspace) return
    setSelectedClientId(client.id)
    setSelectedDocumentId(document.id)
    setActiveTab("dashboard")
  }

  const clearForNextClient = () => {
    setSelectedClientId("")
    setActiveResponse(blankResponse(activeTemplate.id, workspace.templates))
    setMessage("Tablet fill mode cleared for the next client.")
  }

  const addManualClient = () => {
    if (!manualClient.displayName.trim() && !manualClient.email.trim() && !manualClient.phone.trim()) {
      setMessage("Enter a local client name, email, or phone.")
      return
    }

    const now = nowIso()
    const client = {
      id: createUiId("client"),
      schemaVersion: 1,
      displayName: manualClient.displayName.trim(),
      email: manualClient.email.trim().toLowerCase(),
      phone: manualClient.phone.trim(),
      notes: "",
      createdAt: now,
      updatedAt: now,
    }
    updateWorkspace((current) => ({ ...current, clients: [client, ...current.clients] }))
    setSelectedClientId(client.id)
    setManualClient({ displayName: "", email: "", phone: "" })
    setMessage("Local client profile added. Save the workspace to keep it in this browser.")
  }

  const startFollowUpIntake = (clientId = selectedClientId) => {
    const client = workspace.clients.find((item) => item.id === clientId)
    const followUpTemplate = workspace.templates.find((template) => template.id === "template-follow-up-intake-v1")
    if (!client) {
      setMessage("Select or add a local client before starting a follow-up intake.")
      return
    }
    if (!followUpTemplate) {
      setMessage("The built-in follow-up intake template is missing from this local workspace.")
      return
    }

    setSelectedClientId(client.id)
    setSelectedTemplateId(followUpTemplate.id)
    setWorkspace((current) => normalizeIntakeWorkspace({ ...current, activeTemplateId: followUpTemplate.id, updatedAt: nowIso() }) as IntakeWorkspace)
    setActiveResponse(blankResponse(followUpTemplate.id, workspace.templates, client.id))
    setActiveTab("fill")
    setMessage(`Start follow-up intake for ${client.displayName || "this local client"}.`)
  }

  const updateTemplate = (templateId: string, updater: (template: IntakeTemplate) => IntakeTemplate) => {
    updateWorkspace((current) => ({
      ...current,
      templates: current.templates.map((template) => (
        template.id === templateId && !template.builtIn ? updater(template) : template
      )),
    }))
  }

  const duplicateTemplate = (template: IntakeTemplate) => {
    const copy = {
      ...JSON.parse(JSON.stringify(template)),
      id: createUiId("template"),
      title: `${template.title} copy`,
      builtIn: false,
      archived: false,
    }
    updateWorkspace((current) => ({ ...current, templates: [copy, ...current.templates] }))
    setBuilderTemplateId(copy.id)
    setSelectedTemplateId(copy.id)
    setActiveResponse(blankResponse(copy.id, [copy, ...workspace.templates]))
    setMessage("Template duplicated. You can edit the copy now.")
  }

  const createCustomTemplate = () => {
    const template: IntakeTemplate = {
      id: createUiId("template"),
      schemaVersion: 1,
      title: "Custom intake template",
      description: "",
      kind: "custom",
      builtIn: false,
      archived: false,
      sections: [
        {
          id: createUiId("section"),
          title: "Client details",
          description: "",
          questions: [
            {
              id: createUiId("question"),
              type: "short_text",
              label: "Client name",
              required: true,
              options: [],
              helpText: "",
              showIf: null,
            },
          ],
        },
      ],
    }
    updateWorkspace((current) => ({ ...current, templates: [template, ...current.templates] }))
    setBuilderTemplateId(template.id)
    setSelectedTemplateId(template.id)
    setActiveResponse(blankResponse(template.id, [template, ...workspace.templates]))
    setMessage("Custom form template created.")
  }

  const archiveTemplate = (template: IntakeTemplate) => {
    if (template.builtIn) {
      setMessage("Built-in starter templates cannot be archived. Duplicate one to customize it.")
      return
    }
    const fallbackTemplateId = starterIntakeTemplates[0].id
    updateTemplate(template.id, (current) => ({ ...current, archived: true }))
    setBuilderTemplateId(fallbackTemplateId)
    setSelectedTemplateId(fallbackTemplateId)
    setActiveResponse(blankResponse(fallbackTemplateId, workspace.templates))
    setMessage("Template archived locally.")
  }

  const addSection = (templateId: string) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: [
        ...template.sections,
        { id: createUiId("section"), title: "New section", description: "", questions: [] },
      ],
    }))
  }

  const updateSection = (templateId: string, sectionId: string, next: Partial<Pick<IntakeTemplateSection, "title" | "description">>) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: template.sections.map((section) => (
        section.id === sectionId ? { ...section, ...next } : section
      )),
    }))
  }

  const addQuestion = (templateId: string, sectionId: string) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: template.sections.map((section) => (
        section.id === sectionId
          ? {
            ...section,
            questions: [
              ...section.questions,
              {
                id: createUiId("question"),
                type: "short_text",
                label: "New question",
                required: false,
                options: [],
                helpText: "",
                showIf: null,
              },
            ],
          }
          : section
      )),
    }))
  }

  const updateQuestion = (templateId: string, sectionId: string, questionId: string, next: Partial<IntakeQuestion>) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: template.sections.map((section) => (
        section.id === sectionId
          ? {
            ...section,
            questions: section.questions.map((question) => (
              question.id === questionId ? { ...question, ...next } : question
            )),
          }
          : section
      )),
    }))
  }

  const removeQuestion = (templateId: string, sectionId: string, questionId: string) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: template.sections.map((section) => (
        section.id === sectionId
          ? { ...section, questions: section.questions.filter((question) => question.id !== questionId) }
          : section
      )),
    }))
  }

  const exportSelectedDocumentDoc = () => {
    if (!selectedDocument || !selectedDocumentTemplate) {
      setMessage("Save a form response before exporting a document.")
      return
    }
    const body = createFormResponseExportText({
      response: selectedDocument.response,
      template: selectedDocumentTemplate,
      client: selectedDocumentClient,
    })
    downloadFile(
      documentFilename(selectedDocument, selectedDocumentClient, "doc"),
      createEditableDocumentHtml({ title: selectedDocument.title, body }),
      "application/msword",
    )
    setMessage("Created a plaintext DOC file from the unlocked vault. Store and share it carefully.")
  }

  const printSelectedDocumentPdf = () => {
    if (!selectedDocument || !selectedDocumentTemplate) {
      setMessage("Save a form response before printing a document.")
      return
    }
    const body = createFormResponseExportText({
      response: selectedDocument.response,
      template: selectedDocumentTemplate,
      client: selectedDocumentClient,
    })
    const opened = openPrintDocument(createEditableDocumentHtml({ title: selectedDocument.title, body }))
    setMessage(opened ? "Opened a plaintext print view. Choose Save as PDF in your browser dialog." : "Could not open print view.")
  }

  const useSelectedDocumentInSoap = async (mode: "append" | "replace") => {
    if (!selectedDocument || !selectedDocumentTemplate) {
      setMessage("Select a saved intake document before starting SOAP.")
      return
    }

    try {
      const draft = createSoapDraftFromIntakeDocument({
        document: selectedDocument,
        client: selectedDocumentClient,
        template: selectedDocumentTemplate,
        existingDraft: vault.payload.records?.soap?.draft ?? null,
        mode,
      })
      const saved = await vault.saveDraft("soap", draft, "SOAP draft seeded from the selected local intake response.")
      if (!saved) {
        setMessage("Could not save the SOAP draft. Unlock the professional-record vault and try again.")
        return
      }
      setMessage("SOAP draft seeded from the selected local intake response.")
      router.push("/notes/soap")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not seed SOAP from this intake response.")
    }
  }

  const clearLocalWorkspace = async () => {
    const nextWorkspace = createDefaultIntakeWorkspace()
    const savedWorkspace = await persistWorkspace(nextWorkspace, "Intake workspace cleared in the encrypted professional-record vault.")
    if (!savedWorkspace) return
    setSelectedClientId("")
    setSelectedDocumentId("")
    setActiveResponse(blankResponse(savedWorkspace.activeTemplateId, savedWorkspace.templates))
  }

  return (
    <ProfessionalRecordVaultGate>
      <AppPageShell width="full">
      <AppSurface
        title="Intake Form Builder"
        description="Build, fill, review, and export local-first intake documents inside the encrypted professional-record vault."
        icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <AppStatusTile label="Storage" value="Professional-record vault" description="Unlocked for this browser session; no clinical API upload." />
          <AppStatusTile label="Templates" value={`${workspace.templates.filter((template) => !template.archived).length}`} description="Built-in and local custom forms." />
          <AppStatusTile label="Documents" value={`${workspace.documents.length}`} description="Linked local form responses." />
        </div>
        <ProfessionalRecordVaultToolbar className="mt-4" />
      </AppSurface>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="fill">
            <TabletSmartphone className="mr-2 h-4 w-4" />
            Tablet fill mode
          </TabsTrigger>
          <TabsTrigger value="builder">
            <ClipboardList className="mr-2 h-4 w-4" />
            Form builder
          </TabsTrigger>
          <TabsTrigger value="client-account">
            <UserRound className="mr-2 h-4 w-4" />
            Client account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-5">
          <DashboardPanel
            workspace={workspace}
            selectedClientId={selectedClientId}
            selectedDocumentId={selectedDocument?.id ?? ""}
            manualClient={manualClient}
            message={message}
            onSelectClient={setSelectedClientId}
            onSelectDocument={setSelectedDocumentId}
            onManualClientChange={setManualClient}
            onAddManualClient={addManualClient}
            onStartFollowUpIntake={startFollowUpIntake}
            onSaveWorkspace={() => persistWorkspace()}
            onExportSelectedDocumentDoc={exportSelectedDocumentDoc}
            onPrintSelectedDocumentPdf={printSelectedDocumentPdf}
            onUseSelectedDocumentInSoap={useSelectedDocumentInSoap}
            onClearLocalWorkspace={clearLocalWorkspace}
            hasExistingSoapDraft={hasExistingSoapDraft}
          />
        </TabsContent>

        <TabsContent value="fill" className="space-y-5">
          <TabletFillPanel
            workspace={workspace}
            template={activeTemplate}
            selectedClientId={selectedClientId}
            response={activeResponse}
            message={message}
            onSelectClient={setSelectedClientId}
            onSelectTemplate={chooseTemplate}
            onAnswerChange={updateAnswer}
            onBodyMapSelectionChange={updateBodyMapSelection}
            onBodyMapNotesChange={updateBodyMapNotes}
            onSaveCompletedResponse={saveCompletedResponse}
            onClearForNextClient={clearForNextClient}
          />
        </TabsContent>

        <TabsContent value="builder" className="space-y-5">
          <FormBuilderPanel
            workspace={workspace}
            template={builderTemplate}
            issues={builderIssues}
            onSelectTemplate={setBuilderTemplateId}
            onCreateTemplate={createCustomTemplate}
            onDuplicateTemplate={duplicateTemplate}
            onArchiveTemplate={archiveTemplate}
            onUpdateTemplate={(next: Partial<IntakeTemplate>) => updateTemplate(builderTemplate.id, (template) => ({ ...template, ...next }))}
            onAddSection={addSection}
            onUpdateSection={updateSection}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onRemoveQuestion={removeQuestion}
          />
        </TabsContent>

        <TabsContent value="client-account" className="space-y-5">
          <ClientAccountPanel client={selectedClient} />
        </TabsContent>
      </Tabs>
      </AppPageShell>
    </ProfessionalRecordVaultGate>
  )
}

function DashboardPanel({
  workspace,
  selectedClientId,
  selectedDocumentId,
  manualClient,
  message,
  onSelectClient,
  onSelectDocument,
  onManualClientChange,
  onAddManualClient,
  onStartFollowUpIntake,
  onSaveWorkspace,
  onExportSelectedDocumentDoc,
  onPrintSelectedDocumentPdf,
  onUseSelectedDocumentInSoap,
  onClearLocalWorkspace,
  hasExistingSoapDraft,
}: DashboardPanelProps) {
  const selectedClient = workspace.clients.find((client) => client.id === selectedClientId)
  const clientDocuments = selectedClient
    ? workspace.documents.filter((document) => document.localClientId === selectedClient.id)
    : workspace.documents
  const selectedDocument = selectedDocumentId
    ? workspace.documents.find((document) => document.id === selectedDocumentId)
    : undefined
  const selectedDocumentTemplate = selectedDocument
    ? workspace.templates.find((template) => template.id === selectedDocument.templateId)
    : undefined
  const selectedDocumentClient = selectedDocument
    ? workspace.clients.find((client) => client.id === selectedDocument.localClientId)
    : undefined
  const selectedDocumentPreview = selectedDocument && selectedDocumentTemplate
    ? createFormResponseExportText({
      response: selectedDocument.response,
      template: selectedDocumentTemplate,
      client: selectedDocumentClient,
    })
    : ""

  return (
    <>
      <AppSurface
        title="Therapist local dashboard"
        description="Review local clients and linked clinical documents stored in the encrypted browser vault."
        icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onSaveWorkspace}>
            <Save className="mr-2 h-4 w-4" />
            Save encrypted workspace
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear local workspace
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this browser&apos;s intake workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes local clients, templates, and intake documents from the encrypted vault in this browser.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearLocalWorkspace}>Clear local workspace</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <AppInset className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Local clients</h2>
              <span className="text-sm text-muted-foreground">{workspace.clients.length}</span>
            </div>
            <div className="mt-4 grid gap-2">
              {workspace.clients.length > 0 ? workspace.clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelectClient(client.id)}
                  className={`rounded-md border p-3 text-left text-sm transition ${
                    selectedClientId === client.id ? "border-primary bg-primary/10" : "border-border/80 bg-background/70 hover:border-primary/60"
                  }`}
                >
                  <span className="block font-medium">{client.displayName || "Unnamed local client"}</span>
                  <span className="mt-1 block text-muted-foreground">{[client.email, client.phone].filter(Boolean).join(" / ") || "No contact details"}</span>
                </button>
              )) : (
                <p className="rounded-md border border-dashed border-border/80 p-4 text-sm text-muted-foreground">No local clients yet.</p>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              <Input aria-label="Local client name" placeholder="Local client name" value={manualClient.displayName} onChange={(event) => onManualClientChange({ ...manualClient, displayName: event.target.value })} />
              <Input aria-label="Local client email" type="email" placeholder="Email" value={manualClient.email} onChange={(event) => onManualClientChange({ ...manualClient, email: event.target.value })} />
              <Input aria-label="Local client phone" type="tel" placeholder="Phone" value={manualClient.phone} onChange={(event) => onManualClientChange({ ...manualClient, phone: event.target.value })} />
              <Button type="button" variant="outline" onClick={onAddManualClient}>
                <Plus className="mr-2 h-4 w-4" />
                Add local client
              </Button>
            </div>
          </AppInset>

          <AppInset className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Client detail view</h2>
              <span className="text-sm text-muted-foreground">{clientDocuments.length} documents</span>
            </div>
            {selectedClient ? (
              <div className="mt-3 grid gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm">
                <div>
                  <p className="font-medium">{selectedClient.displayName || "Unnamed local client"}</p>
                  <p className="mt-1 text-muted-foreground">{[selectedClient.email, selectedClient.phone].filter(Boolean).join(" / ") || "No contact details"}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => onStartFollowUpIntake(selectedClient.id)} className="justify-self-start">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Start follow-up intake
                </Button>
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              {clientDocuments.length > 0 ? clientDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => onSelectDocument(document.id)}
                  className={`rounded-md border p-3 text-left text-sm transition ${
                    selectedDocumentId === document.id ? "border-primary bg-primary/10" : "border-border/80 bg-background/70 hover:border-primary/60"
                  }`}
                >
                  <span className="block font-medium">{document.title}</span>
                  <span className="mt-1 block text-muted-foreground">
                    {[document.intakeType, document.kind].filter(Boolean).join(" ")} / {new Date(document.createdAt).toLocaleString()}
                  </span>
                </button>
              )) : (
                <p className="rounded-md border border-dashed border-border/80 p-4 text-sm text-muted-foreground">No local documents linked yet.</p>
              )}
            </div>
            {selectedDocumentPreview ? (
              <AppInset className="mt-4 grid max-h-80 gap-2 overflow-auto p-3">
                <h3 className="text-sm font-semibold">Selected document preview</h3>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{selectedDocumentPreview}</pre>
              </AppInset>
            ) : null}
          </AppInset>
        </div>
      </AppSurface>

      <AppSurface
        title="Document output and vault transfer"
        description="Encrypted `.mlab` vault bundles are the normal transfer format. DOC and PDF outputs are plaintext and require confirmation."
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={!selectedDocument}>
                <FileText className="mr-2 h-4 w-4" />
                Use in SOAP
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{hasExistingSoapDraft ? "Use this intake in the existing SOAP draft?" : "Start SOAP from this intake?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  MassageLab will save the SOAP seed inside the unlocked encrypted vault, then open the SOAP editor for therapist review.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                {hasExistingSoapDraft ? (
                  <>
                    <AlertDialogAction onClick={() => onUseSelectedDocumentInSoap("append")}>Append to SOAP</AlertDialogAction>
                    <AlertDialogAction onClick={() => onUseSelectedDocumentInSoap("replace")}>Replace SOAP</AlertDialogAction>
                  </>
                ) : (
                  <AlertDialogAction onClick={() => onUseSelectedDocumentInSoap("replace")}>Start SOAP note</AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <PlaintextOutputWarningAction
            label="Export DOC"
            description="This creates an unencrypted editable clinical document outside the vault. Use encrypted vault bundles for normal transfer."
            icon={<FileText className="mr-2 h-4 w-4" />}
            onConfirm={onExportSelectedDocumentDoc}
          />
          <PlaintextOutputWarningAction
            label="Save PDF"
            description="This opens an unencrypted print view outside the vault. Use encrypted vault bundles for normal transfer."
            icon={<Printer className="mr-2 h-4 w-4" />}
            onConfirm={onPrintSelectedDocumentPdf}
          />
        </div>
        <ProfessionalRecordVaultTransferControls idPrefix="intakeVault" />
        {message ? <p className="text-sm text-brand-orange">{message}</p> : null}
      </AppSurface>
    </>
  )
}

function TabletFillPanel({
  workspace,
  template,
  selectedClientId,
  response,
  message,
  onSelectClient,
  onSelectTemplate,
  onAnswerChange,
  onBodyMapSelectionChange,
  onBodyMapNotesChange,
  onSaveCompletedResponse,
  onClearForNextClient,
}: TabletFillPanelProps) {
  return (
    <AppSurface
      title="Tablet fill mode"
      description="Client-facing local form runner for intake and recurring pain/discomfort maps."
      icon={<TabletSmartphone className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Form template</Label>
          <Select value={template.id} onValueChange={onSelectTemplate}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {templateOptions(workspace.templates).map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Link to local client</Label>
          <Select value={selectedClientId || "__new__"} onValueChange={(value) => onSelectClient(value === "__new__" ? "" : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__new__">Create from this response</SelectItem>
              {workspace.clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>{client.displayName || client.email || client.phone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5">
        {template.sections.map((section) => (
          <AppInset key={section.id} className="p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.description ? <p className="mt-1 text-sm text-muted-foreground">{section.description}</p> : null}
            </div>
            <div className="grid gap-4">
              {section.questions.filter((field) => shouldShowQuestion(field, response.answers)).map((field) => (
                <QuestionField
                  key={field.id}
                  field={field}
                  value={response.answers[field.id]}
                  onChange={(value) => onAnswerChange(field.id, value)}
                  onBodyMapSelectionChange={(key: string, checked: boolean) => onBodyMapSelectionChange(field.id, key, checked)}
                  onBodyMapNotesChange={(notes: string) => onBodyMapNotesChange(field.id, notes)}
                />
              ))}
            </div>
          </AppInset>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onSaveCompletedResponse} className="bg-primary hover:bg-brand-orange-glow">
          <Save className="mr-2 h-4 w-4" />
          Save local response
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear for next client
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear the current tablet form?</AlertDialogTitle>
              <AlertDialogDescription>This clears the active form fields, not saved local documents.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onClearForNextClient}>Clear intake form</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {message ? <p className="text-sm text-brand-orange">{message}</p> : null}
    </AppSurface>
  )
}

function QuestionField({
  field,
  value,
  onChange,
  onBodyMapSelectionChange,
  onBodyMapNotesChange,
}: QuestionFieldProps) {
  const inputId = `intake-${field.id}`

  if (field.type === "instruction") {
    return <AppNotice title={field.label} description={field.helpText} />
  }

  if (field.type === "long_text") {
    return (
      <div className="space-y-2">
        <Label htmlFor={inputId}>{field.label}{field.required ? " *" : ""}</Label>
        <Textarea id={inputId} value={intakeStringAnswer(value)} onChange={(event) => onChange(event.target.value)} className="min-h-28" />
      </div>
    )
  }

  if (field.type === "single_choice") {
    return (
      <div className="space-y-2">
        <Label>{field.label}{field.required ? " *" : ""}</Label>
        <Select value={intakeStringAnswer(value)} onValueChange={onChange}>
          <SelectTrigger aria-label={field.label}><SelectValue placeholder="Choose one" /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option: string) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.type === "multiple_choice") {
    const values = intakeStringArrayAnswer(value)
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(field.options ?? []).map((option: string) => (
            <label key={option} className="flex min-h-10 items-center gap-2 rounded-md border border-border/80 bg-background/70 p-2 text-sm">
              <Checkbox
                checked={values.includes(option)}
                onCheckedChange={(checked) => onChange(checked ? [...new Set([...values, option])] : values.filter((item: string) => item !== option))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex min-h-12 items-center gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm font-medium">
        <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
        <span>{field.label}{field.required ? " *" : ""}</span>
      </label>
    )
  }

  if (field.type === "body_map") {
    const answer = bodyMapAnswerFromValue(value)
    const selected = answer.selected
    return (
      <div className="space-y-3">
        <Label>{field.label}{field.required ? " *" : ""}</Label>
        <div className="overflow-x-auto rounded-md border border-border/80">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="p-2 text-left font-medium">Body area</th>
                {BODY_MAP_SIDES.map((side: string) => <th key={side} className="w-28 p-2 text-center font-medium">{side}</th>)}
              </tr>
            </thead>
            <tbody>
              {BODY_MAP_PARTS.map((part: string) => (
                <tr key={part} className="border-t border-border/60">
                  <td className="p-2 font-medium">{part}</td>
                  {BODY_MAP_SIDES.map((side: string) => {
                    const key = `${side} [${part}]`
                    return (
                      <td key={key} className="p-2 text-center">
                        <Checkbox
                          aria-label={`${side} ${part}`}
                          checked={Boolean(selected[key])}
                          onCheckedChange={(checked) => onBodyMapSelectionChange(key, checked === true)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Textarea
          aria-label={`${field.label} notes`}
          value={answer.notes || ""}
          onChange={(event) => onBodyMapNotesChange(event.target.value)}
          placeholder="Optional notes"
          className="min-h-24"
        />
      </div>
    )
  }

  const inputType = field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{field.label}{field.required ? " *" : ""}</Label>
      <Input id={inputId} type={inputType} value={intakeStringAnswer(value)} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function FormBuilderPanel({
  workspace,
  template,
  issues,
  onSelectTemplate,
  onCreateTemplate,
  onDuplicateTemplate,
  onArchiveTemplate,
  onUpdateTemplate,
  onAddSection,
  onUpdateSection,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
}: FormBuilderPanelProps) {
  const readOnly = template.builtIn
  const allQuestions = template.sections.flatMap((section) => section.questions)

  return (
    <AppSurface
      title="Form builder"
      description="Create therapist-owned local templates with sections, question types, required fields, and simple show-if rules."
      icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div className="space-y-2">
          <Label>Template</Label>
          <Select value={template.id} onValueChange={onSelectTemplate}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {workspace.templates.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.archived ? `${item.title} (archived)` : item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={onCreateTemplate}>
          <Plus className="mr-2 h-4 w-4" />
          New template
        </Button>
        <Button type="button" variant="outline" onClick={() => onDuplicateTemplate(template)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </Button>
      </div>

      {readOnly ? <AppNotice title="Built-in starter template" description="Duplicate this template before changing fields, sections, or logic." /> : null}
      {issues.length > 0 ? <AppNotice tone="destructive" title="Template issues" description={issues.join(" ")} /> : null}

      <AppInset className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="templateTitle">Template title</Label>
          <Input id="templateTitle" value={template.title} disabled={readOnly} onChange={(event) => onUpdateTemplate({ title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Template kind</Label>
          <Select value={template.kind} disabled={readOnly} onValueChange={(value) => onUpdateTemplate({ kind: value as IntakeTemplateKind })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="intake">Intake</SelectItem>
              <SelectItem value="pain-map">Pain map</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="templateDescription">Description</Label>
          <Textarea id="templateDescription" value={template.description || ""} disabled={readOnly} onChange={(event) => onUpdateTemplate({ description: event.target.value })} />
        </div>
      </AppInset>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={readOnly} onClick={() => onAddSection(template.id)}>
          <Plus className="mr-2 h-4 w-4" />
          Add section
        </Button>
        <Button type="button" variant="outline" disabled={readOnly} onClick={() => onArchiveTemplate(template)}>
          <Archive className="mr-2 h-4 w-4" />
          Archive template
        </Button>
      </div>

      <div className="grid gap-4">
        {template.sections.map((section) => (
          <AppInset key={section.id} className="grid gap-4 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Section title</Label>
                <Input value={section.title} disabled={readOnly} onChange={(event) => onUpdateSection(template.id, section.id, { title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Section description</Label>
                <Input value={section.description || ""} disabled={readOnly} onChange={(event) => onUpdateSection(template.id, section.id, { description: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-3">
              {section.questions.map((field) => (
                <AppInset key={field.id} className="grid gap-3 p-3">
                  <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr_auto]">
                    <div className="space-y-2">
                      <Label>Question label</Label>
                      <Input value={field.label} disabled={readOnly} onChange={(event) => onUpdateQuestion(template.id, section.id, field.id, { label: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={field.type} disabled={readOnly} onValueChange={(value) => onUpdateQuestion(template.id, section.id, field.id, { type: value as IntakeQuestion["type"], options: value.includes("choice") ? field.options : [] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FORM_QUESTION_TYPES.map((type: string) => <SelectItem key={type} value={type}>{type.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-end gap-2 pb-2 text-sm">
                      <Checkbox checked={field.required} disabled={readOnly} onCheckedChange={(checked) => onUpdateQuestion(template.id, section.id, field.id, { required: checked === true })} />
                      <span>Required</span>
                    </label>
                  </div>
                  {field.type === "single_choice" || field.type === "multiple_choice" ? (
                    <div className="space-y-2">
                      <Label>Options</Label>
                      <Input
                        value={(field.options ?? []).join(", ")}
                        disabled={readOnly}
                        onChange={(event) => onUpdateQuestion(template.id, section.id, field.id, {
                          options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean),
                        })}
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Show if question</Label>
                      <Select
                        value={field.showIf?.questionId || "__always__"}
                        disabled={readOnly}
                        onValueChange={(value) => onUpdateQuestion(template.id, section.id, field.id, {
                          showIf: value === "__always__" ? null : { questionId: value, equals: field.showIf?.equals ?? "Yes" },
                        })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__always__">Always show</SelectItem>
                          {allQuestions.filter((question) => question.id !== field.id).map((question) => (
                            <SelectItem key={question.id} value={question.id}>{question.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Show if answer equals</Label>
                      <Input
                        value={field.showIf?.equals ?? ""}
                        disabled={readOnly || !field.showIf?.questionId}
                        onChange={(event) => onUpdateQuestion(template.id, section.id, field.id, {
                          showIf: field.showIf?.questionId ? { ...field.showIf, equals: event.target.value } : null,
                        })}
                      />
                    </div>
                  </div>
                  <Button type="button" variant="ghost" disabled={readOnly} onClick={() => onRemoveQuestion(template.id, section.id, field.id)} className="justify-self-start">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove question
                  </Button>
                </AppInset>
              ))}
            </div>
            <Button type="button" variant="outline" disabled={readOnly} onClick={() => onAddQuestion(template.id, section.id)} className="justify-self-start">
              <Plus className="mr-2 h-4 w-4" />
              Add question
            </Button>
          </AppInset>
        ))}
      </div>
    </AppSurface>
  )
}

function ClientAccountPanel({ client }: { client?: IntakeClientProfile }) {
  return (
    <AppSurface
      title="Client account contact page"
      description="Remote client accounts stay limited to contact, profile, and booking status until compliant hosted PHI storage is implemented."
      icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
    >
      <AppNotice
        title="No remote clinical document access in this alpha"
        description="Intake forms, signatures, health history, pain maps, SOAP notes, journals, and ROM records remain local to the therapist device."
      />
      {client ? (
        <AppInset className="grid gap-2 p-4 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {client.displayName || "Not set"}</p>
          <p><span className="text-muted-foreground">Email:</span> {client.email || "Not set"}</p>
          <p><span className="text-muted-foreground">Phone:</span> {client.phone || "Not set"}</p>
          <p><span className="text-muted-foreground">Booking status:</span> Contact/account status only</p>
        </AppInset>
      ) : (
        <p className="text-sm text-muted-foreground">Select a local client on the dashboard to preview contact-only account information.</p>
      )}
      <AppNotice
        tone="accent"
        title="Security boundary"
        description="Local transfer methods such as Bluetooth, local Wi-Fi, mesh, and browser peer-to-peer transfer require a separate security risk model before implementation."
      />
    </AppSurface>
  )
}
