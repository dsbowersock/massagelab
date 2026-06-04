import {
  formatBodyMapAnswer,
  normalizeIntakeType,
  shouldShowQuestion,
} from "./local-intake-builder.js"

const IDENTITY_QUESTION_IDS = new Set([
  "firstName",
  "lastName",
  "preferredName",
  "pronouns",
  "dateOfBirth",
  "phoneNumber",
  "emailAddress",
  "streetAddress",
  "city",
  "state",
  "zipCode",
  "occupation",
  "emergencyContactName",
  "emergencyContactPhoneNumber",
])

const CONSENT_QUESTION_IDS = new Set([
  "draping",
  "age",
  "guardianConsent",
  "informedConsent",
  "clientSignature",
])

const EMPTY_SOAP_NOTE = {
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

export function createEmptySoapNoteDraft() {
  return clone(EMPTY_SOAP_NOTE)
}

export function hasMeaningfulSoapDraft(draft) {
  if (!isPlainObject(draft)) return false
  const normalized = normalizeSoapNoteDraft(draft)
  const empty = createEmptySoapNoteDraft()
  return hasMeaningfulDifference(normalized, empty)
}

/**
 * @param {{
 *   document?: Record<string, any>,
 *   client?: Record<string, any>,
 *   template?: Record<string, any>,
 *   existingDraft?: Record<string, any> | null,
 *   mode?: "append" | "replace",
 *   now?: Date | string,
 * }} options
 */
export function createSoapDraftFromIntakeDocument({
  document,
  client,
  template,
  existingDraft = null,
  mode,
  now = new Date(),
} = {}) {
  const hasExistingDraft = hasMeaningfulSoapDraft(existingDraft)
  if (hasExistingDraft && mode !== "append" && mode !== "replace") {
    throw new Error("Choose append or replace before using an intake response in an existing SOAP draft.")
  }
  if (mode && mode !== "append" && mode !== "replace") {
    throw new Error("SOAP handoff mode must be append or replace.")
  }

  const action = hasExistingDraft && mode === "append" ? "append" : "replace"
  const baseDraft = action === "append" ? normalizeSoapNoteDraft(existingDraft) : createEmptySoapNoteDraft()
  const response = isPlainObject(document?.response) ? document.response : {}
  const answers = isPlainObject(response.answers) ? response.answers : {}
  const intakeType = normalizeIntakeType(document?.intakeType || response.intakeType || template?.intakeType)
  const sourceLabel = intakeType === "follow-up" ? "follow-up intake" : intakeType === "initial" ? "initial intake" : "intake"
  const subjectiveSeed = createSubjectiveSeedText({ response, answers, template, sourceLabel })
  const bodyMapSeed = createBodyMapSeedText({ answers, template, sourceLabel })
  const sessionDate = text(answers.followUpSessionDate)
    || text(answers.sessionDate)
    || dateOnly(response.completedAt)
    || dateOnly(document?.createdAt)
    || dateOnly(now)

  const nextDraft = normalizeSoapNoteDraft({
    ...baseDraft,
    clientName: action === "replace" || !text(baseDraft.clientName)
      ? text(client?.displayName) || text(answers.clientName) || clientNameFromAnswers(answers) || baseDraft.clientName
      : baseDraft.clientName,
    dateOfBirth: action === "replace" || !text(baseDraft.dateOfBirth)
      ? text(answers.dateOfBirth) || baseDraft.dateOfBirth
      : baseDraft.dateOfBirth,
    date: action === "replace" || !text(baseDraft.date)
      ? sessionDate || baseDraft.date
      : baseDraft.date,
    generalNotes: action === "append" ? appendText(baseDraft.generalNotes, subjectiveSeed) : subjectiveSeed,
    bodyDiagram: {
      ...baseDraft.bodyDiagram,
      notes: action === "append" ? appendText(baseDraft.bodyDiagram.notes, bodyMapSeed) : bodyMapSeed,
      painMapSelections: Array.isArray(baseDraft.bodyDiagram.painMapSelections) ? baseDraft.bodyDiagram.painMapSelections : [],
    },
  })

  return nextDraft
}

function createSubjectiveSeedText({ response, answers, template, sourceLabel }) {
  const lines = [
    `From local ${sourceLabel} response`,
    `Template: ${text(template?.title) || text(response.templateTitle) || "Local intake"}`,
  ]
  const completedAt = text(response.completedAt) || text(response.updatedAt)
  if (completedAt) lines.push(`Completed: ${completedAt}`)

  for (const field of flattenQuestions(template)) {
    if (field.type === "instruction" || field.type === "body_map" || field.type === "signature") continue
    if (IDENTITY_QUESTION_IDS.has(field.id) || CONSENT_QUESTION_IDS.has(field.id)) continue
    if (!shouldShowQuestion(field, answers)) continue
    const formatted = formatAnswer(field, answers[field.id])
    if (!formatted) continue
    lines.push(`${field.label}: ${formatted}`)
  }

  return lines.join("\n")
}

function createBodyMapSeedText({ answers, template, sourceLabel }) {
  const lines = []
  for (const field of flattenQuestions(template)) {
    if (field.type !== "body_map" || !shouldShowQuestion(field, answers)) continue
    const formatted = formatBodyMapAnswer(answers[field.id])
    if (formatted === "None selected") continue
    if (lines.length === 0) lines.push(`From local ${sourceLabel} response body map`)
    lines.push(`${field.label}: ${formatted}`)
  }
  return lines.join("\n")
}

function normalizeSoapNoteDraft(value) {
  const source = isPlainObject(value) ? value : {}
  return {
    ...createEmptySoapNoteDraft(),
    ...source,
    schemaVersion: 2,
    noteType: "soap",
    subjectiveEntries: Array.isArray(source.subjectiveEntries) ? source.subjectiveEntries : [],
    objectiveEntries: Array.isArray(source.objectiveEntries) ? source.objectiveEntries : [],
    assessment: {
      ...EMPTY_SOAP_NOTE.assessment,
      ...(isPlainObject(source.assessment) ? source.assessment : {}),
      techniques: Array.isArray(source.assessment?.techniques) ? source.assessment.techniques : [],
    },
    treatmentPlan: {
      ...EMPTY_SOAP_NOTE.treatmentPlan,
      ...(isPlainObject(source.treatmentPlan) ? source.treatmentPlan : {}),
    },
    bodyDiagram: {
      ...EMPTY_SOAP_NOTE.bodyDiagram,
      ...(isPlainObject(source.bodyDiagram) ? source.bodyDiagram : {}),
      painMapSelections: Array.isArray(source.bodyDiagram?.painMapSelections) ? source.bodyDiagram.painMapSelections : [],
    },
    transcriptSegments: Array.isArray(source.transcriptSegments) ? source.transcriptSegments : [],
  }
}

function formatAnswer(field, value) {
  if (field.type === "checkbox") return value === true ? "Yes" : ""
  if (field.type === "multiple_choice") return Array.isArray(value) && value.length > 0 ? value.join(", ") : ""
  return text(value)
}

function hasMeaningfulDifference(value, emptyValue) {
  if (Array.isArray(value)) return value.length > 0
  if (isPlainObject(value)) {
    return Object.entries(value).some(([key, entry]) => {
      if (key === "schemaVersion" || key === "noteType") return false
      return hasMeaningfulDifference(entry, emptyValue?.[key])
    })
  }
  if (typeof value === "boolean") return value !== Boolean(emptyValue)
  return text(value) !== text(emptyValue)
}

function flattenQuestions(template) {
  return (template?.sections ?? []).flatMap((section) => section.questions ?? [])
}

function clientNameFromAnswers(answers) {
  return [
    text(answers.firstName),
    text(answers.preferredName) ? `"${text(answers.preferredName)}"` : "",
    text(answers.lastName),
  ].filter(Boolean).join(" ").trim()
}

function appendText(current, next) {
  const cleanCurrent = text(current)
  const cleanNext = text(next)
  if (cleanCurrent && cleanNext) return `${cleanCurrent}\n\n${cleanNext}`
  return cleanCurrent || cleanNext
}

function dateOnly(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10)
  }
  const clean = text(value)
  if (!clean) return ""
  const date = new Date(clean)
  if (Number.isNaN(date.getTime())) return clean.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}
