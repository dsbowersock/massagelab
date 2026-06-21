export type IntakeQuestionType =
  | "short_text"
  | "long_text"
  | "date"
  | "email"
  | "phone"
  | "single_choice"
  | "multiple_choice"
  | "checkbox"
  | "signature"
  | "body_map"
  | "instruction"

export type IntakeTemplateKind = "intake" | "pain-map" | "custom"
export type IntakeType = "initial" | "follow-up"

export type IntakeBodyMapAnswer = {
  selected: Record<string, string>
  notes: string
}

export type IntakeAnswerValue = string | boolean | string[] | IntakeBodyMapAnswer | null | undefined
export type IntakeAnswers = Record<string, IntakeAnswerValue>

export type IntakeShowIfRule = {
  questionId: string
  equals: string
}

export type IntakeQuestion = {
  id: string
  type: IntakeQuestionType
  label: string
  required: boolean
  options: string[]
  helpText: string
  showIf: IntakeShowIfRule | null
}

export type IntakeTemplateSection = {
  id: string
  title: string
  description: string
  questions: IntakeQuestion[]
}

export type IntakeTemplate = {
  id: string
  schemaVersion: number
  title: string
  description: string
  kind: IntakeTemplateKind
  intakeType?: IntakeType
  builtIn: boolean
  archived: boolean
  sections: IntakeTemplateSection[]
}

export type IntakeClientProfile = {
  id: string
  schemaVersion: number
  displayName: string
  email: string
  phone: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type IntakeFormResponse = {
  id: string
  schemaVersion: number
  templateId: string
  templateTitle: string
  intakeType: IntakeType | ""
  localClientId: string
  answers: IntakeAnswers
  completedAt: string
  createdAt: string
  updatedAt: string
}

export type IntakeClinicalDocument = {
  id: string
  schemaVersion: number
  kind: string
  intakeType?: IntakeType
  title: string
  localClientId: string
  templateId: string
  response: IntakeFormResponse
  createdAt: string
  updatedAt?: string
}

export type IntakeWorkspace = {
  schemaVersion: number
  activeTemplateId: string
  templates: IntakeTemplate[]
  clients: IntakeClientProfile[]
  documents: IntakeClinicalDocument[]
  createdAt?: string
  updatedAt: string
}

export type ManualClientDraft = Pick<IntakeClientProfile, "displayName" | "email" | "phone">

export function isIntakeBodyMapAnswer(value: IntakeAnswerValue): value is IntakeBodyMapAnswer {
  return Boolean(value && typeof value === "object" && "selected" in value && "notes" in value)
}

export function intakeStringAnswer(value: IntakeAnswerValue): string {
  return typeof value === "string" ? value : ""
}

export function intakeStringArrayAnswer(value: IntakeAnswerValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}
