"use client"

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  Archive,
  ClipboardList,
  Copy,
  Download,
  FileText,
  FolderOpen,
  KeyRound,
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
  INTAKE_WORKSPACE_STORAGE_KEY,
  createClinicalDocumentFromResponse,
  createClientProfileFromResponse,
  createDefaultIntakeWorkspace,
  createEncryptedIntakeBundle,
  createEncryptedIntakeWorkspaceVault,
  createFormResponseExportText,
  createWorkspaceExport,
  decryptEncryptedIntakeWorkspaceVault,
  isEncryptedIntakeWorkspaceVault,
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

type AnyRecord = Record<string, any>
type VaultStatus = "loading" | "setup" | "legacy" | "locked" | "unlocked" | "corrupt"

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

function workspaceFilename(extension = "json") {
  return createLocalDocumentFilename({
    prefix: "massagelab-intake-workspace",
    subject: "local",
    extension,
  })
}

function documentFilename(document: AnyRecord, client: AnyRecord | undefined, extension = "json") {
  return createLocalDocumentFilename({
    prefix: `massagelab-${document.kind || "intake"}`,
    subject: client?.displayName || document.title || "client",
    extension,
  })
}

function templateOptions(templates: AnyRecord[]) {
  return templates.filter((template) => !template.archived)
}

function getTemplate(workspace: AnyRecord, templateId: string) {
  return workspace.templates.find((template: AnyRecord) => template.id === templateId) ?? workspace.templates[0]
}

function blankResponse(templateId: string, templates: AnyRecord[]): AnyRecord {
  return (normalizeFormResponse({
    id: createUiId("response"),
    templateId,
    answers: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }, templates as any) ?? {
    id: createUiId("response"),
    schemaVersion: 1,
    templateId,
    templateTitle: "Local form",
    localClientId: "",
    answers: {},
    completedAt: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }) as AnyRecord
}

function replaceById(items: AnyRecord[], nextItem: AnyRecord) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item))
}

export default function IntakePage() {
  const [workspace, setWorkspace] = useState<AnyRecord>(() => createDefaultIntakeWorkspace())
  const [activeTab, setActiveTab] = useState("dashboard")
  const [selectedTemplateId, setSelectedTemplateId] = useState(starterIntakeTemplates[0].id)
  const [builderTemplateId, setBuilderTemplateId] = useState(starterIntakeTemplates[0].id)
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedDocumentId, setSelectedDocumentId] = useState("")
  const [activeResponse, setActiveResponse] = useState<AnyRecord>(() => blankResponse(starterIntakeTemplates[0].id, starterIntakeTemplates))
  const [message, setMessage] = useState<string | null>(null)
  const [encryptedPassword, setEncryptedPassword] = useState("")
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>("loading")
  const [vaultPassphrase, setVaultPassphrase] = useState("")
  const [vaultPasswordInput, setVaultPasswordInput] = useState("")
  const [vaultConfirmInput, setVaultConfirmInput] = useState("")
  const [legacyWorkspace, setLegacyWorkspace] = useState<AnyRecord | null>(null)
  const [manualClient, setManualClient] = useState({ displayName: "", email: "", phone: "" })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hydrateWorkspace = (nextWorkspace: AnyRecord) => {
    const normalized = normalizeIntakeWorkspace(nextWorkspace)
    setWorkspace(normalized)
    setSelectedTemplateId(normalized.activeTemplateId)
    setBuilderTemplateId(normalized.activeTemplateId)
    setSelectedClientId("")
    setSelectedDocumentId("")
    setActiveResponse(blankResponse(normalized.activeTemplateId, normalized.templates))
    return normalized
  }

  useEffect(() => {
    const raw = window.localStorage.getItem(INTAKE_WORKSPACE_STORAGE_KEY)
    if (!raw) {
      setVaultStatus("setup")
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (isEncryptedIntakeWorkspaceVault(parsed)) {
        setVaultStatus("locked")
        return
      }

      setLegacyWorkspace(normalizeIntakeWorkspace(parsed))
      setVaultStatus("legacy")
      setMessage("Existing plaintext intake workspace found. Create a passphrase to encrypt it before continuing.")
    } catch {
      setVaultStatus("corrupt")
      setMessage("This browser has unreadable intake vault data. Reset the local vault only if you have a backup or do not need this browser's intake data.")
    }
  }, [])

  const activeTemplate = useMemo(() => getTemplate(workspace, selectedTemplateId), [workspace, selectedTemplateId])
  const builderTemplate = useMemo(() => getTemplate(workspace, builderTemplateId), [workspace, builderTemplateId])
  const selectedClient = workspace.clients.find((client: AnyRecord) => client.id === selectedClientId)
  const selectedDocument = workspace.documents.find((document: AnyRecord) => document.id === selectedDocumentId) ?? workspace.documents[0]
  const selectedDocumentClient = selectedDocument
    ? workspace.clients.find((client: AnyRecord) => client.id === selectedDocument.localClientId)
    : undefined
  const selectedDocumentTemplate = selectedDocument ? getTemplate(workspace, selectedDocument.templateId) : undefined
  const builderIssues = validateFormDefinition(builderTemplate)

  const persistWorkspace = async (nextWorkspace = workspace, successMessage = "Encrypted intake workspace saved in this browser.") => {
    if (!vaultPassphrase) {
      setVaultStatus("locked")
      setMessage("Unlock the intake vault before saving local clinical documents.")
      return null
    }

    const normalized = normalizeIntakeWorkspace({ ...nextWorkspace, updatedAt: nowIso() })
    try {
      const vault = await createEncryptedIntakeWorkspaceVault(normalized, vaultPassphrase)
      window.localStorage.setItem(INTAKE_WORKSPACE_STORAGE_KEY, JSON.stringify(vault))
      setWorkspace(normalized)
      setMessage(successMessage)
      return normalized
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the encrypted intake vault.")
      return null
    }
  }

  const updateWorkspace = (updater: (current: AnyRecord) => AnyRecord) => {
    setMessage(null)
    setWorkspace((current) => normalizeIntakeWorkspace({ ...updater(current), updatedAt: nowIso() }))
  }

  const chooseTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setWorkspace((current) => normalizeIntakeWorkspace({ ...current, activeTemplateId: templateId, updatedAt: nowIso() }))
    setActiveResponse(blankResponse(templateId, workspace.templates))
    setMessage(null)
  }

  const updateAnswer = (questionId: string, value: any) => {
    setMessage(null)
    setActiveResponse((current) => (normalizeFormResponse({
      ...current,
      templateId: activeTemplate.id,
      answers: { ...current.answers, [questionId]: value },
      updatedAt: nowIso(),
    }, workspace.templates as any) ?? current) as AnyRecord)
  }

  const updateBodyMapSelection = (questionId: string, key: string, checked: boolean) => {
    const currentAnswer = activeResponse.answers[questionId] ?? { selected: {}, notes: "" }
    const nextSelected = { ...(currentAnswer.selected ?? {}) }
    if (checked) {
      nextSelected[key] = "Selected"
    } else {
      delete nextSelected[key]
    }
    updateAnswer(questionId, { ...currentAnswer, selected: nextSelected })
  }

  const updateBodyMapNotes = (questionId: string, notes: string) => {
    const currentAnswer = activeResponse.answers[questionId] ?? { selected: {}, notes: "" }
    updateAnswer(questionId, { ...currentAnswer, notes })
  }

  const saveCompletedResponse = async () => {
    const issues = requiredQuestionIssues(activeTemplate, activeResponse.answers)
    if (issues.length > 0) {
      setMessage(issues[0])
      return
    }

    const now = nowIso()
    const existingClient = workspace.clients.find((client: AnyRecord) => client.id === selectedClientId)
    const client = existingClient ?? createClientProfileFromResponse(activeResponse, activeTemplate, new Date(now))
    const response = normalizeFormResponse({
      ...activeResponse,
      localClientId: client.id,
      completedAt: now,
      updatedAt: now,
    }, workspace.templates as any)
    const document = createClinicalDocumentFromResponse(response, client, activeTemplate, new Date(now))
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
    })

    const savedWorkspace = await persistWorkspace(nextWorkspace, "Form response saved in the encrypted local vault and linked to the local client.")
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

  const updateTemplate = (templateId: string, updater: (template: AnyRecord) => AnyRecord) => {
    updateWorkspace((current) => ({
      ...current,
      templates: current.templates.map((template: AnyRecord) => (
        template.id === templateId && !template.builtIn ? updater(template) : template
      )),
    }))
  }

  const duplicateTemplate = (template: AnyRecord) => {
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
    setMessage("Template duplicated. You can edit the copy now.")
  }

  const createCustomTemplate = () => {
    const template = {
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
    setMessage("Custom form template created.")
  }

  const archiveTemplate = (template: AnyRecord) => {
    if (template.builtIn) {
      setMessage("Built-in starter templates cannot be archived. Duplicate one to customize it.")
      return
    }
    updateTemplate(template.id, (current) => ({ ...current, archived: true }))
    setBuilderTemplateId(starterIntakeTemplates[0].id)
    setSelectedTemplateId(starterIntakeTemplates[0].id)
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

  const updateSection = (templateId: string, sectionId: string, next: Partial<AnyRecord>) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: template.sections.map((section: AnyRecord) => (
        section.id === sectionId ? { ...section, ...next } : section
      )),
    }))
  }

  const addQuestion = (templateId: string, sectionId: string) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: template.sections.map((section: AnyRecord) => (
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

  const updateQuestion = (templateId: string, sectionId: string, questionId: string, next: Partial<AnyRecord>) => {
    updateTemplate(templateId, (template) => ({
      ...template,
      sections: template.sections.map((section: AnyRecord) => (
        section.id === sectionId
          ? {
            ...section,
            questions: section.questions.map((question: AnyRecord) => (
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
      sections: template.sections.map((section: AnyRecord) => (
        section.id === sectionId
          ? { ...section, questions: section.questions.filter((question: AnyRecord) => question.id !== questionId) }
          : section
      )),
    }))
  }

  const selectedDocumentPayload = () => {
    if (!selectedDocument) return null
    return {
      document: selectedDocument,
      client: selectedDocumentClient,
      template: selectedDocumentTemplate,
      localFirst: true,
      notice: "MassageLab did not upload this local clinical document.",
    }
  }

  const exportWorkspaceJson = () => {
    downloadFile(workspaceFilename("json"), JSON.stringify(createWorkspaceExport(workspace), null, 2), "application/json")
    setMessage("Exported the local intake workspace JSON. MassageLab did not upload it.")
  }

  const exportSelectedDocumentJson = () => {
    const payload = selectedDocumentPayload()
    if (!payload || !selectedDocument) {
      setMessage("Save a form response before exporting a document.")
      return
    }
    downloadFile(documentFilename(selectedDocument, selectedDocumentClient, "json"), JSON.stringify(payload, null, 2), "application/json")
    setMessage("Exported the selected local document JSON.")
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
    setMessage("Exported an editable DOC file. MassageLab did not upload it.")
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
    setMessage(opened ? "Opened print view. Choose Save as PDF in the browser dialog." : "Could not open print view.")
  }

  const exportEncryptedBundle = async () => {
    try {
      const bundle = await createEncryptedIntakeBundle(createWorkspaceExport(workspace), encryptedPassword)
      downloadFile(workspaceFilename("mlab"), JSON.stringify(bundle, null, 2), "application/vnd.massagelab.encrypted+json")
      setMessage("Exported encrypted .mlab bundle. Keep the password separate from the file.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create encrypted export bundle.")
    }
  }

  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text())
      const nextWorkspace = normalizeIntakeWorkspace(parsed)
      setWorkspace(nextWorkspace)
      setSelectedTemplateId(nextWorkspace.activeTemplateId)
      setBuilderTemplateId(nextWorkspace.activeTemplateId)
      setActiveResponse(blankResponse(nextWorkspace.activeTemplateId, nextWorkspace.templates))
      setMessage("Imported a local intake workspace JSON. Review it before saving.")
    } catch {
      setMessage("Could not import that file. Choose a MassageLab intake workspace JSON export.")
    } finally {
      event.target.value = ""
    }
  }

  const clearLocalWorkspace = async () => {
    const nextWorkspace = createDefaultIntakeWorkspace()
    const savedWorkspace = await persistWorkspace(nextWorkspace, "Encrypted intake workspace cleared. The empty vault remains locked to this passphrase.")
    if (!savedWorkspace) return
    setSelectedClientId("")
    setSelectedDocumentId("")
    setActiveResponse(blankResponse(savedWorkspace.activeTemplateId, savedWorkspace.templates))
  }

  const createVaultFromWorkspace = async (sourceWorkspace: AnyRecord, successMessage: string) => {
    const passphrase = vaultPasswordInput.trim()
    const confirmation = vaultConfirmInput.trim()

    if (passphrase.length < 8) {
      setMessage("Intake vault passphrase must be at least 8 characters.")
      return
    }
    if (passphrase !== confirmation) {
      setMessage("Passphrase confirmation does not match.")
      return
    }

    try {
      const normalized = normalizeIntakeWorkspace(sourceWorkspace)
      const vault = await createEncryptedIntakeWorkspaceVault(normalized, passphrase)
      window.localStorage.setItem(INTAKE_WORKSPACE_STORAGE_KEY, JSON.stringify(vault))
      hydrateWorkspace(normalized)
      setVaultPassphrase(passphrase)
      setVaultPasswordInput("")
      setVaultConfirmInput("")
      setLegacyWorkspace(null)
      setVaultStatus("unlocked")
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the encrypted intake vault.")
    }
  }

  const unlockVault = async () => {
    const passphrase = vaultPasswordInput.trim()
    if (passphrase.length < 8) {
      setMessage("Enter the intake vault passphrase.")
      return
    }

    try {
      const raw = window.localStorage.getItem(INTAKE_WORKSPACE_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (!isEncryptedIntakeWorkspaceVault(parsed)) {
        setVaultStatus(raw ? "legacy" : "setup")
        setMessage(raw ? "This workspace needs to be encrypted before continuing." : "Create an encrypted intake vault before continuing.")
        return
      }

      const nextWorkspace = await decryptEncryptedIntakeWorkspaceVault(parsed, passphrase)
      hydrateWorkspace(nextWorkspace)
      setVaultPassphrase(passphrase)
      setVaultPasswordInput("")
      setVaultConfirmInput("")
      setVaultStatus("unlocked")
      setMessage("Intake vault unlocked for this browser session.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not unlock the intake vault.")
    }
  }

  const lockVault = () => {
    hydrateWorkspace(createDefaultIntakeWorkspace())
    setVaultPassphrase("")
    setVaultPasswordInput("")
    setVaultConfirmInput("")
    setVaultStatus("locked")
    setMessage("Intake vault locked.")
  }

  const resetCorruptVault = () => {
    window.localStorage.removeItem(INTAKE_WORKSPACE_STORAGE_KEY)
    hydrateWorkspace(createDefaultIntakeWorkspace())
    setVaultPassphrase("")
    setVaultPasswordInput("")
    setVaultConfirmInput("")
    setLegacyWorkspace(null)
    setVaultStatus("setup")
    setMessage("Unreadable local vault data removed. Create a new encrypted intake vault to continue.")
  }

  if (vaultStatus !== "unlocked") {
    return (
      <VaultGatePanel
        status={vaultStatus}
        message={message}
        password={vaultPasswordInput}
        confirmation={vaultConfirmInput}
        onPasswordChange={setVaultPasswordInput}
        onConfirmationChange={setVaultConfirmInput}
        onUnlockVault={unlockVault}
        onCreateVault={() => createVaultFromWorkspace(createDefaultIntakeWorkspace(), "Encrypted intake vault created and unlocked for this browser session.")}
        onEncryptLegacyWorkspace={() => createVaultFromWorkspace(legacyWorkspace ?? createDefaultIntakeWorkspace(), "Existing plaintext intake workspace encrypted and unlocked for this browser session.")}
        onResetCorruptVault={resetCorruptVault}
      />
    )
  }

  return (
    <AppPageShell width="full">
      <AppSurface
        title="Intake Form Builder"
        description="Build, fill, review, and export local-first intake documents inside an encrypted browser vault."
        icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <AppStatusTile label="Storage" value="Encrypted local vault" description="Unlocked for this browser session; no clinical API upload." />
          <AppStatusTile label="Templates" value={`${workspace.templates.filter((template: AnyRecord) => !template.archived).length}`} description="Built-in and local custom forms." />
          <AppStatusTile label="Documents" value={`${workspace.documents.length}`} description="Linked local form responses." />
        </div>
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={lockVault}>
            <KeyRound className="mr-2 h-4 w-4" />
            Lock vault
          </Button>
        </div>
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
            encryptedPassword={encryptedPassword}
            fileInputRef={fileInputRef}
            onSelectClient={setSelectedClientId}
            onSelectDocument={setSelectedDocumentId}
            onManualClientChange={setManualClient}
            onAddManualClient={addManualClient}
            onSaveWorkspace={() => persistWorkspace()}
            onImportWorkspace={() => fileInputRef.current?.click()}
            onImportWorkspaceFile={importWorkspace}
            onExportWorkspaceJson={exportWorkspaceJson}
            onExportSelectedDocumentJson={exportSelectedDocumentJson}
            onExportSelectedDocumentDoc={exportSelectedDocumentDoc}
            onPrintSelectedDocumentPdf={printSelectedDocumentPdf}
            onEncryptedPasswordChange={setEncryptedPassword}
            onExportEncryptedBundle={exportEncryptedBundle}
            onClearLocalWorkspace={clearLocalWorkspace}
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
            onUpdateTemplate={(next: AnyRecord) => updateTemplate(builderTemplate.id, (template) => ({ ...template, ...next }))}
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
  )
}

function VaultGatePanel({
  status,
  message,
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  onUnlockVault,
  onCreateVault,
  onEncryptLegacyWorkspace,
  onResetCorruptVault,
}: AnyRecord) {
  const isSetup = status === "setup"
  const isLegacy = status === "legacy"
  const isLocked = status === "locked"
  const isCorrupt = status === "corrupt"
  const title = isSetup
    ? "Create encrypted vault"
    : isLegacy
      ? "Encrypt existing workspace"
      : isCorrupt
        ? "Intake vault needs attention"
        : "Unlock intake vault"
  const description = isSetup
    ? "Create an offline passphrase for this browser before making or viewing intake documents."
    : isLegacy
      ? "A previous plaintext local workspace exists. Encrypt it with a passphrase before continuing."
      : isCorrupt
        ? "MassageLab could not read this browser's intake vault data."
        : "Enter the passphrase to unlock local intake documents for this browser session."

  return (
    <AppPageShell width="narrow">
      <AppSurface
        title={title}
        description={description}
        icon={<KeyRound className="h-5 w-5" aria-hidden="true" />}
        className={appCalloutClassName}
      >
        <AppNotice
          title="Local professional-record vault"
          description="The intake module stays locked until the therapist unlocks it. The passphrase is not sent to MassageLab and cannot be recovered by the server."
        />

        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">Checking this browser&apos;s intake vault...</p>
        ) : null}

        {isLocked ? (
          <AppInset className="grid gap-3 p-4">
            <div className="space-y-2">
              <Label htmlFor="intakeVaultPassword">Vault passphrase</Label>
              <Input
                id="intakeVaultPassword"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="button" onClick={onUnlockVault} className="justify-self-start bg-primary hover:bg-brand-orange-glow">
              <KeyRound className="mr-2 h-4 w-4" />
              Unlock vault
            </Button>
          </AppInset>
        ) : null}

        {isSetup || isLegacy ? (
          <AppInset className="grid gap-3 p-4">
            <div className="space-y-2">
              <Label htmlFor="newIntakeVaultPassword">New vault passphrase</Label>
              <Input
                id="newIntakeVaultPassword"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmIntakeVaultPassword">Confirm passphrase</Label>
              <Input
                id="confirmIntakeVaultPassword"
                type="password"
                value={confirmation}
                onChange={(event) => onConfirmationChange(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              type="button"
              onClick={isLegacy ? onEncryptLegacyWorkspace : onCreateVault}
              className="justify-self-start bg-primary hover:bg-brand-orange-glow"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {isLegacy ? "Encrypt existing workspace" : "Create encrypted vault"}
            </Button>
          </AppInset>
        ) : null}

        {isCorrupt ? (
          <AppInset className="grid gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              If you have an exported backup, keep it outside this browser before resetting. Resetting removes this unreadable local vault entry only.
            </p>
            <Button type="button" variant="outline" onClick={onResetCorruptVault} className="justify-self-start">
              <Trash2 className="mr-2 h-4 w-4" />
              Reset local vault
            </Button>
          </AppInset>
        ) : null}

        {message ? <p className="text-sm text-brand-orange">{message}</p> : null}
      </AppSurface>
    </AppPageShell>
  )
}

function DashboardPanel({
  workspace,
  selectedClientId,
  selectedDocumentId,
  manualClient,
  message,
  encryptedPassword,
  fileInputRef,
  onSelectClient,
  onSelectDocument,
  onManualClientChange,
  onAddManualClient,
  onSaveWorkspace,
  onImportWorkspace,
  onImportWorkspaceFile,
  onExportWorkspaceJson,
  onExportSelectedDocumentJson,
  onExportSelectedDocumentDoc,
  onPrintSelectedDocumentPdf,
  onEncryptedPasswordChange,
  onExportEncryptedBundle,
  onClearLocalWorkspace,
}: AnyRecord) {
  const selectedClient = workspace.clients.find((client: AnyRecord) => client.id === selectedClientId)
  const clientDocuments = selectedClient
    ? workspace.documents.filter((document: AnyRecord) => document.localClientId === selectedClient.id)
    : workspace.documents

  return (
    <>
      <AppSurface
        title="Therapist local dashboard"
        description="Review local clients and linked clinical documents stored in this browser."
        icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
      >
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportWorkspaceFile} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onImportWorkspace}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Import workspace
          </Button>
          <Button type="button" variant="outline" onClick={onSaveWorkspace}>
            <Save className="mr-2 h-4 w-4" />
            Save local workspace
          </Button>
          <Button type="button" onClick={onExportWorkspaceJson} className="bg-primary hover:bg-brand-orange-glow">
            <Download className="mr-2 h-4 w-4" />
            Export workspace JSON
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
                  This removes local clients, templates, and documents from this browser. Export anything needed before clearing.
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
              {workspace.clients.length > 0 ? workspace.clients.map((client: AnyRecord) => (
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
              <div className="mt-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm">
                <p className="font-medium">{selectedClient.displayName || "Unnamed local client"}</p>
                <p className="mt-1 text-muted-foreground">{[selectedClient.email, selectedClient.phone].filter(Boolean).join(" / ") || "No contact details"}</p>
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              {clientDocuments.length > 0 ? clientDocuments.map((document: AnyRecord) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => onSelectDocument(document.id)}
                  className={`rounded-md border p-3 text-left text-sm transition ${
                    selectedDocumentId === document.id ? "border-primary bg-primary/10" : "border-border/80 bg-background/70 hover:border-primary/60"
                  }`}
                >
                  <span className="block font-medium">{document.title}</span>
                  <span className="mt-1 block text-muted-foreground">{document.kind} / {new Date(document.createdAt).toLocaleString()}</span>
                </button>
              )) : (
                <p className="rounded-md border border-dashed border-border/80 p-4 text-sm text-muted-foreground">No local documents linked yet.</p>
              )}
            </div>
          </AppInset>
        </div>
      </AppSurface>

      <AppSurface
        title="Local document exports"
        description="Generate user-controlled files from the selected local document or the whole workspace."
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onExportSelectedDocumentJson}>
            <Download className="mr-2 h-4 w-4" />
            Export document JSON
          </Button>
          <Button type="button" variant="outline" onClick={onExportSelectedDocumentDoc}>
            <FileText className="mr-2 h-4 w-4" />
            Export DOC
          </Button>
          <Button type="button" variant="outline" onClick={onPrintSelectedDocumentPdf}>
            <Printer className="mr-2 h-4 w-4" />
            Save PDF
          </Button>
        </div>
        <AppInset className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="encryptedBundlePassword">Encrypted export password</Label>
            <Input
              id="encryptedBundlePassword"
              type="password"
              value={encryptedPassword}
              onChange={(event) => onEncryptedPasswordChange(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="button" onClick={onExportEncryptedBundle} className="bg-primary hover:bg-brand-orange-glow">
            <KeyRound className="mr-2 h-4 w-4" />
            Export encrypted bundle
          </Button>
        </AppInset>
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
}: AnyRecord) {
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
              {templateOptions(workspace.templates).map((item: AnyRecord) => (
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
              {workspace.clients.map((client: AnyRecord) => (
                <SelectItem key={client.id} value={client.id}>{client.displayName || client.email || client.phone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5">
        {template.sections.map((section: AnyRecord) => (
          <AppInset key={section.id} className="p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.description ? <p className="mt-1 text-sm text-muted-foreground">{section.description}</p> : null}
            </div>
            <div className="grid gap-4">
              {section.questions.filter((field: AnyRecord) => shouldShowQuestion(field, response.answers)).map((field: AnyRecord) => (
                <QuestionField
                  key={field.id}
                  field={field}
                  value={response.answers[field.id]}
                  onChange={(value: any) => onAnswerChange(field.id, value)}
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
}: AnyRecord) {
  const inputId = `intake-${field.id}`

  if (field.type === "instruction") {
    return <AppNotice title={field.label} description={field.helpText} />
  }

  if (field.type === "long_text") {
    return (
      <div className="space-y-2">
        <Label htmlFor={inputId}>{field.label}{field.required ? " *" : ""}</Label>
        <Textarea id={inputId} value={value || ""} onChange={(event) => onChange(event.target.value)} className="min-h-28" />
      </div>
    )
  }

  if (field.type === "single_choice") {
    return (
      <div className="space-y-2">
        <Label>{field.label}{field.required ? " *" : ""}</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger aria-label={field.label}><SelectValue placeholder="Choose one" /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option: string) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.type === "multiple_choice") {
    const values = Array.isArray(value) ? value : []
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
    const answer = value ?? { selected: {}, notes: "" }
    const selected = answer.selected ?? {}
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
      <Input id={inputId} type={inputType} value={value || ""} onChange={(event) => onChange(event.target.value)} />
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
}: AnyRecord) {
  const readOnly = template.builtIn
  const allQuestions = template.sections.flatMap((section: AnyRecord) => section.questions)

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
              {workspace.templates.map((item: AnyRecord) => (
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
          <Select value={template.kind} disabled={readOnly} onValueChange={(value) => onUpdateTemplate({ kind: value })}>
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
        {template.sections.map((section: AnyRecord) => (
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
              {section.questions.map((field: AnyRecord) => (
                <AppInset key={field.id} className="grid gap-3 p-3">
                  <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr_auto]">
                    <div className="space-y-2">
                      <Label>Question label</Label>
                      <Input value={field.label} disabled={readOnly} onChange={(event) => onUpdateQuestion(template.id, section.id, field.id, { label: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={field.type} disabled={readOnly} onValueChange={(value) => onUpdateQuestion(template.id, section.id, field.id, { type: value, options: value.includes("choice") ? field.options : [] })}>
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
                          {allQuestions.filter((question: AnyRecord) => question.id !== field.id).map((question: AnyRecord) => (
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

function ClientAccountPanel({ client }: { client?: AnyRecord }) {
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
