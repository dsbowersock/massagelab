export const INTAKE_WORKSPACE_STORAGE_KEY = "massagelab-intake-workspace-v1"
export const INTAKE_WORKSPACE_VAULT_FORMAT = "massagelab-local-intake-vault"

export const FORM_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "date",
  "email",
  "phone",
  "single_choice",
  "multiple_choice",
  "checkbox",
  "signature",
  "body_map",
  "instruction",
]

export const BODY_MAP_SIDES = ["Left", "Middle", "Right"]

export const BODY_MAP_PARTS = [
  "Head",
  "Head (front)",
  "Head (back)",
  "Neck",
  "Neck (front)",
  "Neck (back)",
  "Shoulder",
  "Shoulders",
  "Shoulder Blade",
  "Chest",
  "Upper-arm",
  "Lower-ribs (front)",
  "Forearm",
  "Hand",
  "Abdomen",
  "Hip (side/front)",
  "Thigh (front)",
  "Thigh (back)",
  "Shin",
  "Foot",
  "Upper-back",
  "Mid-back",
  "Lower-back",
  "Sciatic Area (Buttock)",
  "Tail-bone",
  "Calf",
]

export const MEDICAL_CONDITION_OPTIONS = [
  "Contagious",
  "Heart condition",
  "Tendonitis",
  "TMJ",
  "Open sores",
  "High BP",
  "Osteoporosis",
  "CTS",
  "Bruising",
  "Circulatory disorder",
  "Epilepsy",
  "Tennis elbow",
  "Accident",
  "Varicose veins",
  "Headaches",
  "Golfers Elbow",
  "Fracture",
  "Atherosclerosis",
  "Migraines",
  "Pregnancy",
  "Surgery",
  "Phlebitis",
  "Cancer",
  "Skin condition",
  "Artificial joint",
  "DVT's",
  "Diabetes",
  "Open wounds",
  "Sprains",
  "Blood clots",
  "Dec. sensation",
  "Injury",
  "Fever",
  "Joint disorder",
  "Back problems",
  "Strains",
  "Swollen glands",
  "Osteoarthritis",
  "Neck problems",
  "Sensitivities",
  "Allergies",
  "Rheumatoid arthritis",
  "Fibromyalgia",
  "Low BP",
]

const YES_NO_OPTIONS = ["Yes", "No"]
const PRESSURE_OPTIONS = ["Light", "Medium", "Firm", "Deep", "Not sure"]
const FREQUENCY_OPTIONS = ["First visit", "Occasional", "Monthly", "Biweekly", "Weekly", "As needed"]
const MASSAGE_TYPE_OPTIONS = ["Relaxation", "Therapeutic", "Deep tissue", "Sports", "Prenatal", "Other"]
const STRESS_EFFECT_OPTIONS = ["Sleep", "Headaches", "Digestion", "Mood", "Muscle tension", "Energy", "Other"]
const INTAKE_TYPES = ["initial", "follow-up"]

export const starterIntakeTemplates = [
  {
    id: "template-full-intake-v1",
    schemaVersion: 1,
    title: "Full intake form",
    description: "Local-first replacement for the current Google intake form.",
    kind: "intake",
    intakeType: "initial",
    builtIn: true,
    archived: false,
    sections: [
      {
        id: "identity",
        title: "Identity",
        description: "Contact and demographic fields used to identify the local document.",
        questions: [
          question("firstName", "short_text", "First Name", { required: true }),
          question("lastName", "short_text", "Last Name", { required: true }),
          question("preferredName", "short_text", "Preferred Name"),
          question("pronouns", "short_text", "Pronouns"),
          question("dateOfBirth", "date", "Date of Birth"),
          question("phoneNumber", "phone", "Phone Number"),
          question("emailAddress", "email", "Email Address"),
          question("streetAddress", "short_text", "Street Address"),
          question("city", "short_text", "City"),
          question("state", "short_text", "State"),
          question("zipCode", "short_text", "Zip Code"),
          question("occupation", "short_text", "Occupation"),
          question("emergencyContactName", "short_text", "Emergency Contact Name"),
          question("emergencyContactPhoneNumber", "phone", "Emergency Contact Phone Number"),
        ],
      },
      {
        id: "massage-history",
        title: "Massage Preferences",
        questions: [
          question("previousMassage", "single_choice", "Have you had a professional massage before?", { options: YES_NO_OPTIONS }),
          question("massageFrequency", "single_choice", "Desired massage frequency", { options: FREQUENCY_OPTIONS }),
          question("massagePreferences", "long_text", "Liked/disliked about previous massages"),
          question("massageType", "multiple_choice", "Types of massage previously received", { options: MASSAGE_TYPE_OPTIONS }),
          question("uncomfortableAreas", "long_text", "Uncomfortable areas"),
          question("pressure", "single_choice", "Desired Pressure", { options: PRESSURE_OPTIONS }),
          question("positioning", "single_choice", "Trouble in a certain position?", { options: YES_NO_OPTIONS }),
          question("troublingPosition", "long_text", "What position?", { showIf: { questionId: "positioning", equals: "Yes" } }),
          question("lubricantAllergy", "single_choice", "Any lubricant allergy?", { options: YES_NO_OPTIONS }),
          question("lubricantAllergyExplained", "long_text", "To what?", { showIf: { questionId: "lubricantAllergy", equals: "Yes" } }),
          question("personalAids", "long_text", "Do you have or use any personal aids?"),
        ],
      },
      {
        id: "lifestyle",
        title: "Lifestyle And Goals",
        questions: [
          question("sitting", "single_choice", "Do you sit for long periods of time?", { options: YES_NO_OPTIONS }),
          question("sittingExplained", "long_text", "Sitting explained", { showIf: { questionId: "sitting", equals: "Yes" } }),
          question("standing", "single_choice", "Do you stand for long periods of time?", { options: YES_NO_OPTIONS }),
          question("standingExplained", "long_text", "Standing explained", { showIf: { questionId: "standing", equals: "Yes" } }),
          question("repetitiveTasks", "single_choice", "Do you perform any repetitive tasks?", { options: YES_NO_OPTIONS }),
          question("repetitiveTaskExplained", "long_text", "Repetitive task explained", { showIf: { questionId: "repetitiveTasks", equals: "Yes" } }),
          question("stress", "single_choice", "Do you experience stress?", { options: YES_NO_OPTIONS }),
          question("stressEffects", "multiple_choice", "Stress effects", { options: STRESS_EFFECT_OPTIONS, showIf: { questionId: "stress", equals: "Yes" } }),
          question("stressExplained", "long_text", "Stress explained", { showIf: { questionId: "stress", equals: "Yes" } }),
          question("tension", "single_choice", "Feeling discomfort?", { options: YES_NO_OPTIONS }),
          question("discomfortFelt", "long_text", "Discomfort explained", { showIf: { questionId: "tension", equals: "Yes" } }),
          question("shortTermGoals", "long_text", "Short term goals"),
          question("shortTermExplained", "long_text", "Short term explained"),
          question("longTermGoals", "long_text", "Long term goals"),
          question("longTermExplained", "long_text", "Long term explained"),
          question("exercise", "single_choice", "Do you exercise?", { options: YES_NO_OPTIONS }),
          question("exerciseExplained", "long_text", "Exercise explained"),
          question("diet", "long_text", "Diet"),
        ],
      },
      {
        id: "health-history",
        title: "Health History",
        questions: [
          question("medicalSupervision", "single_choice", "Medical supervision?", { options: YES_NO_OPTIONS }),
          question("medicalSupervisionExplained", "long_text", "Medical supervision explained", { showIf: { questionId: "medicalSupervision", equals: "Yes" } }),
          question("chiropractor", "single_choice", "Chiropractor?", { options: YES_NO_OPTIONS }),
          question("medication", "single_choice", "Are you taking any medications?", { options: YES_NO_OPTIONS }),
          question("medicationListed", "long_text", "Medications listed", { showIf: { questionId: "medication", equals: "Yes" } }),
          question("medicalConditions", "multiple_choice", "Medical Conditions", { options: MEDICAL_CONDITION_OPTIONS }),
          question("conditionsExplained", "long_text", "Conditions explained"),
          question("healthHistory", "long_text", "Health history"),
        ],
      },
      {
        id: "consent",
        title: "Consent",
        questions: [
          question("draping", "checkbox", "Draping understood", { required: true }),
          question("age", "single_choice", "17yo or younger?", { options: YES_NO_OPTIONS }),
          question("guardianConsent", "checkbox", "Guardian consent", { showIf: { questionId: "age", equals: "Yes" } }),
          question("informedConsent", "checkbox", "Informed Consent", { required: true }),
          question("clientSignature", "signature", "Client signature", { required: true }),
        ],
      },
      {
        id: "initial-pain-map",
        title: "Initial Pain/Discomfort Map",
        description: "Reusable as a standalone pre-session pain map.",
        questions: [
          question("initialPainMap", "body_map", "Pain/discomfort map"),
        ],
      },
    ],
  },
  {
    id: "template-follow-up-intake-v1",
    schemaVersion: 1,
    title: "Follow-up intake",
    description: "Short local-first return-visit intake for an existing local client.",
    kind: "intake",
    intakeType: "follow-up",
    builtIn: true,
    archived: false,
    sections: [
      {
        id: "follow-up-visit",
        title: "Visit Context",
        description: "Keep this tied to the existing local client rather than re-asking stable profile basics.",
        questions: [
          question("followUpSessionDate", "date", "Session date", { required: true }),
          question("feltAfterLastSession", "long_text", "How did you feel after the last session?"),
          question("changesSinceLastVisit", "long_text", "Changes since last visit"),
          question("todaysGoals", "long_text", "Today's goals", { required: true }),
        ],
      },
      {
        id: "follow-up-updates",
        title: "Health And Safety Updates",
        questions: [
          question("currentSymptoms", "long_text", "Current symptoms", { required: true }),
          question("newMedicalConditions", "long_text", "New or changed medical conditions"),
          question("medicationChanges", "long_text", "Medication changes"),
          question("allergyChanges", "long_text", "Allergy changes"),
          question("contraindicationChanges", "long_text", "Contraindication changes"),
          question("surgeryOrInjuryUpdates", "long_text", "Recent surgeries, injuries, or accidents"),
          question("pregnancyStatusChange", "single_choice", "Pregnancy status changed?", { options: YES_NO_OPTIONS }),
          question("pregnancyStatusNotes", "long_text", "Pregnancy status notes", { showIf: { questionId: "pregnancyStatusChange", equals: "Yes" } }),
          question("newSafetyConcerns", "long_text", "New safety concerns"),
        ],
      },
      {
        id: "follow-up-preferences",
        title: "Today's Session Preferences",
        questions: [
          question("preferredFocusAreas", "long_text", "Preferred focus areas"),
          question("pressurePreference", "single_choice", "Pressure preference today", { options: PRESSURE_OPTIONS }),
          question("pressurePreferenceChanges", "long_text", "Pressure preference changes"),
          question("positioningUpdates", "long_text", "Positioning or comfort updates"),
        ],
      },
      {
        id: "follow-up-pain-map",
        title: "Current Pain/Discomfort Map",
        questions: [
          question("followUpPainMap", "body_map", "Current pain/discomfort map"),
        ],
      },
    ],
  },
  {
    id: "template-pain-map-v1",
    schemaVersion: 1,
    title: "Pain/discomfort map",
    description: "Standalone local pre-session body map.",
    kind: "pain-map",
    intakeType: "",
    builtIn: true,
    archived: false,
    sections: [
      {
        id: "session",
        title: "Session",
        questions: [
          question("sessionDate", "date", "Session date", { required: true }),
          question("clientName", "short_text", "Client name"),
        ],
      },
      {
        id: "pain-map",
        title: "Pain/Discomfort Map",
        questions: [
          question("painMap", "body_map", "Pain/discomfort map", { required: true }),
          question("painMapNotes", "long_text", "Additional pain map notes"),
        ],
      },
    ],
  },
]

export function createDefaultIntakeWorkspace(now = new Date()) {
  const nowValue = isoDate(now)
  return {
    schemaVersion: 1,
    templates: clone(starterIntakeTemplates),
    clients: [],
    documents: [],
    activeTemplateId: starterIntakeTemplates[0].id,
    createdAt: nowValue,
    updatedAt: nowValue,
  }
}

export function normalizeIntakeWorkspace(value) {
  const fallback = createDefaultIntakeWorkspace()
  if (!isPlainObject(value)) {
    return fallback
  }

  const templates = Array.isArray(value.templates)
    ? mergeStarterTemplates(value.templates.map(normalizeFormDefinition).filter(Boolean))
    : fallback.templates

  const clients = Array.isArray(value.clients) ? value.clients.map(normalizeLocalClientProfile).filter(Boolean) : []
  const documents = Array.isArray(value.documents)
    ? value.documents.map((document) => normalizeLocalClinicalDocument(document, templates)).filter(Boolean)
    : []
  const activeTemplateId = templates.some((template) => template.id === value.activeTemplateId)
    ? value.activeTemplateId
    : templates[0]?.id ?? starterIntakeTemplates[0].id

  return {
    schemaVersion: 1,
    templates,
    clients,
    documents,
    activeTemplateId,
    createdAt: text(value.createdAt) || fallback.createdAt,
    updatedAt: text(value.updatedAt) || fallback.updatedAt,
  }
}

export function normalizeFormDefinition(value) {
  if (!isPlainObject(value)) return null
  const sections = Array.isArray(value.sections) ? value.sections.map(normalizeFormSection).filter(Boolean) : []
  return {
    id: text(value.id) || createLocalId("template"),
    schemaVersion: 1,
    title: text(value.title) || "Untitled form",
    description: text(value.description),
    kind: ["intake", "pain-map", "custom"].includes(value.kind) ? value.kind : "custom",
    intakeType: inferTemplateIntakeType(value),
    builtIn: value.builtIn === true,
    archived: value.archived === true,
    sections,
  }
}

export function validateFormDefinition(template) {
  const issues = validateRawFormDefinition(template)
  if (issues.length > 0) return issues

  const normalized = normalizeFormDefinition(template)
  if (!normalized) return ["Template must be an object."]

  const ids = new Set()
  const questionIds = new Set()

  for (const section of normalized.sections) {
    if (ids.has(section.id)) issues.push(`Duplicate section id: ${section.id}`)
    ids.add(section.id)
    if (!section.title) issues.push(`Section ${section.id} needs a title.`)

    for (const field of section.questions) {
      if (questionIds.has(field.id)) issues.push(`Duplicate question id: ${field.id}`)
      questionIds.add(field.id)
      if (!field.label && field.type !== "instruction") issues.push(`Question ${field.id} needs a label.`)
      if (!FORM_QUESTION_TYPES.includes(field.type)) issues.push(`Question ${field.id} has an unsupported type.`)
      if ((field.type === "single_choice" || field.type === "multiple_choice") && field.options.length === 0) {
        issues.push(`Question ${field.id} needs options.`)
      }
    }
  }

  for (const section of normalized.sections) {
    for (const field of section.questions) {
      if (field.showIf?.questionId && !questionIds.has(field.showIf.questionId)) {
        issues.push(`Question ${field.id} depends on unknown question ${field.showIf.questionId}.`)
      }
    }
  }

  return issues
}

export function validateRawFormDefinition(template) {
  if (!isPlainObject(template)) return ["Template must be an object."]

  const issues = []
  if (!text(template.title)) issues.push("Template title is required.")
  if (!Array.isArray(template.sections) || template.sections.length === 0) {
    issues.push("Template needs at least one section.")
    return issues
  }

  const sectionIds = new Set()
  const questionIds = new Set()

  for (const section of template.sections) {
    if (!isPlainObject(section)) {
      issues.push("Section must be an object.")
      continue
    }

    const sectionId = text(section.id)
    const sectionLabel = sectionId || "unknown"
    if (!sectionId) {
      issues.push("Section id is required.")
    } else if (sectionIds.has(sectionId)) {
      issues.push(`Duplicate section id: ${sectionId}`)
    } else {
      sectionIds.add(sectionId)
    }

    if (!text(section.title)) issues.push(`Section ${sectionLabel} needs a title.`)
    if (!Array.isArray(section.questions)) continue

    for (const field of section.questions) {
      if (!isPlainObject(field)) {
        issues.push(`Question in section ${sectionLabel} must be an object.`)
        continue
      }

      const questionId = text(field.id)
      const questionLabel = questionId || "unknown"
      const questionType = text(field.type)
      if (!questionId) {
        issues.push(`Question in section ${sectionLabel} needs an id.`)
      } else if (questionIds.has(questionId)) {
        issues.push(`Duplicate question id: ${questionId}`)
      } else {
        questionIds.add(questionId)
      }

      if (!FORM_QUESTION_TYPES.includes(questionType)) issues.push(`Question ${questionLabel} has an unsupported type.`)
      if (!text(field.label) && questionType !== "instruction") issues.push(`Question ${questionLabel} needs a label.`)
      if ((questionType === "single_choice" || questionType === "multiple_choice")
        && (!Array.isArray(field.options) || field.options.map(text).filter(Boolean).length === 0)) {
        issues.push(`Question ${questionLabel} needs options.`)
      }
    }
  }

  for (const section of template.sections) {
    if (!isPlainObject(section) || !Array.isArray(section.questions)) continue

    for (const field of section.questions) {
      if (!isPlainObject(field)) continue
      const questionId = text(field.id) || "unknown"
      const dependsOn = isPlainObject(field.showIf) ? text(field.showIf.questionId) : ""
      if (dependsOn && !questionIds.has(dependsOn)) {
        issues.push(`Question ${questionId} depends on unknown question ${dependsOn}.`)
      }
    }
  }

  return issues
}

export function normalizeFormResponse(value, templates = starterIntakeTemplates) {
  if (!isPlainObject(value)) return null
  const template = findTemplate(templates, value.templateId)
  if (!template) return null
  const answers = isPlainObject(value.answers) ? value.answers : {}

  return {
    id: text(value.id) || createLocalId("response"),
    schemaVersion: 1,
    templateId: template.id,
    templateTitle: template.title,
    intakeType: normalizeIntakeType(template.intakeType),
    localClientId: text(value.localClientId),
    answers: normalizeAnswersForTemplate(template, answers),
    completedAt: text(value.completedAt) || "",
    createdAt: text(value.createdAt) || isoDate(),
    updatedAt: text(value.updatedAt) || isoDate(),
  }
}

export function normalizeLocalClientProfile(value) {
  if (!isPlainObject(value)) return null
  const displayName = text(value.displayName)
  const email = text(value.email).toLowerCase()
  const phone = text(value.phone)
  if (!displayName && !email && !phone) return null
  return {
    id: text(value.id) || createLocalId("client"),
    schemaVersion: 1,
    displayName,
    email,
    phone,
    notes: text(value.notes),
    createdAt: text(value.createdAt) || isoDate(),
    updatedAt: text(value.updatedAt) || isoDate(),
  }
}

export function createClientProfileFromResponse(response, template, now = new Date()) {
  const answers = response?.answers ?? {}
  const firstName = text(answers.firstName)
  const lastName = text(answers.lastName)
  const preferredName = text(answers.preferredName)
  const explicitName = text(answers.clientName)
  const displayName = explicitName || [firstName, preferredName ? `"${preferredName}"` : "", lastName].filter(Boolean).join(" ").trim()
  const fallbackName = text(response?.templateTitle) ? `${response.templateTitle} client` : "Local client"

  return normalizeLocalClientProfile({
    id: createLocalId("client"),
    displayName: displayName || fallbackName,
    email: answers.emailAddress,
    phone: answers.phoneNumber,
    notes: "",
    createdAt: isoDate(now),
    updatedAt: isoDate(now),
  })
}

export function createClinicalDocumentFromResponse(response, client, template, now = new Date()) {
  const nowValue = isoDate(now)
  return normalizeLocalClinicalDocument({
    id: createLocalId("document"),
    schemaVersion: 1,
    kind: template?.kind ?? "custom",
    intakeType: normalizeIntakeType(template?.intakeType) || normalizeIntakeType(response?.intakeType),
    title: template?.title ?? response?.templateTitle ?? "Local form response",
    localClientId: client?.id ?? response?.localClientId ?? "",
    templateId: response?.templateId,
    response,
    status: "LOCAL_ONLY",
    createdAt: nowValue,
    updatedAt: nowValue,
  }, [template].filter(Boolean))
}

export function normalizeLocalClinicalDocument(value, templates = starterIntakeTemplates) {
  if (!isPlainObject(value)) return null
  const response = normalizeFormResponse(value.response, templates)
  const kind = ["intake", "pain-map", "custom"].includes(value.kind) ? value.kind : "custom"
  const template = findTemplate(templates, text(value.templateId) || response?.templateId)
  const intakeType = normalizeIntakeType(value.intakeType)
    || normalizeIntakeType(response?.intakeType)
    || normalizeIntakeType(template?.intakeType)
  return {
    id: text(value.id) || createLocalId("document"),
    schemaVersion: 1,
    kind,
    intakeType,
    title: text(value.title) || response?.templateTitle || "Local clinical document",
    localClientId: text(value.localClientId) || response?.localClientId || "",
    templateId: text(value.templateId) || response?.templateId || "",
    response,
    status: "LOCAL_ONLY",
    createdAt: text(value.createdAt) || isoDate(),
    updatedAt: text(value.updatedAt) || isoDate(),
  }
}

export function shouldShowQuestion(question, answers) {
  if (!question?.showIf?.questionId) return true
  const actual = answers?.[question.showIf.questionId]
  const expected = question.showIf.equals

  if (Array.isArray(actual)) return actual.includes(expected)
  if (typeof actual === "boolean") return String(actual) === String(expected) || actual === expected
  return text(actual) === text(expected)
}

export function requiredQuestionIssues(template, answers) {
  const issues = []
  for (const question of flattenQuestions(template)) {
    if (!question.required || !shouldShowQuestion(question, answers)) continue
    const answer = answers?.[question.id]
    if (question.type === "checkbox") {
      if (answer !== true) issues.push(`${question.label} is required.`)
    } else if (question.type === "multiple_choice") {
      if (!Array.isArray(answer) || answer.length === 0) issues.push(`${question.label} is required.`)
    } else if (question.type === "body_map") {
      if (formatBodyMapAnswer(answer) === "None selected") issues.push(`${question.label} is required.`)
    } else if (!text(answer)) {
      issues.push(`${question.label} is required.`)
    }
  }
  return issues
}

export function createFormResponseExportText({ response, template, client }) {
  const normalizedTemplate = normalizeFormDefinition(template)
  const normalizedResponse = normalizeFormResponse(response, [normalizedTemplate].filter(Boolean))
  if (!normalizedTemplate || !normalizedResponse) {
    return "MassageLab Local Intake Export\nCould not read this form response."
  }

  const lines = [
    "MassageLab Local Intake Export",
    "Local-first export. MassageLab did not upload this clinical document.",
    "",
    `Template: ${normalizedTemplate.title}`,
    `Client: ${client?.displayName || "Unlinked local client"}`,
    `Completed: ${normalizedResponse.completedAt || normalizedResponse.updatedAt}`,
    "",
  ]

  for (const section of normalizedTemplate.sections) {
    lines.push(section.title)
    for (const field of section.questions) {
      if (field.type === "instruction" || !shouldShowQuestion(field, normalizedResponse.answers)) continue
      lines.push(`${field.label}: ${formatAnswer(field, normalizedResponse.answers[field.id])}`)
    }
    lines.push("")
  }

  return lines.join("\n").trim()
}

export function createWorkspaceExport(workspace, exportedAt = new Date()) {
  const normalized = normalizeIntakeWorkspace(workspace)
  return {
    ...normalized,
    exportedAt: isoDate(exportedAt),
    localFirst: true,
    notice: "MassageLab did not upload these local clinical documents. User controls storage and sharing.",
  }
}

export function createPainMapPlaceholderValues(answer) {
  const selected = isPlainObject(answer?.selected) ? answer.selected : {}
  const values = {}
  for (const side of BODY_MAP_SIDES) {
    for (const part of BODY_MAP_PARTS) {
      const key = `${side} [${part}]`
      values[`{{${key}}}`] = text(selected[key])
    }
  }
  return values
}

export function formatBodyMapAnswer(answer) {
  const selected = isPlainObject(answer?.selected) ? answer.selected : {}
  const rows = Object.entries(selected)
    .filter(([, value]) => text(value))
    .map(([key, value]) => `${key}: ${text(value)}`)

  if (text(answer?.notes)) rows.push(`Notes: ${text(answer.notes)}`)
  return rows.length > 0 ? rows.join("; ") : "None selected"
}

export async function createEncryptedIntakeBundle(data, password, options = {}) {
  const cleanPassword = text(password)
  if (cleanPassword.length < 8) {
    throw new Error("Encrypted exports require a password with at least 8 characters.")
  }

  const iterations = options.iterations ?? 150000
  const encrypted = await encryptJsonPayload(data, cleanPassword, iterations)

  return {
    schemaVersion: 1,
    format: "massagelab-local-encrypted-bundle",
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
    salt: encrypted.salt,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
    exportedAt: isoDate(options.exportedAt ?? new Date()),
    localFirst: true,
  }
}

export async function decryptEncryptedIntakeBundle(bundle, password) {
  if (!isPlainObject(bundle) || bundle.format !== "massagelab-local-encrypted-bundle") {
    throw new Error("Expected a MassageLab encrypted bundle.")
  }

  try {
    const cryptoApi = getCryptoApi()
    const salt = base64ToBytes(bundle.salt)
    const iv = base64ToBytes(bundle.iv)
    const ciphertext = base64ToBytes(bundle.ciphertext)
    const key = await deriveAesGcmKey(text(password), salt, Number(bundle.iterations) || 150000)
    const plaintext = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
    return JSON.parse(new TextDecoder().decode(plaintext))
  } catch (error) {
    throw new Error("Failed to decrypt intake bundle", { cause: error })
  }
}

export function isEncryptedIntakeWorkspaceVault(value) {
  return isPlainObject(value)
    && value.format === INTAKE_WORKSPACE_VAULT_FORMAT
    && value.algorithm === "AES-GCM"
    && value.kdf === "PBKDF2-SHA-256"
    && Boolean(text(value.salt))
    && Boolean(text(value.iv))
    && Boolean(text(value.ciphertext))
}

export async function createEncryptedIntakeWorkspaceVault(workspace, password, options = {}) {
  const cleanPassword = text(password)
  if (cleanPassword.length < 8) {
    throw new Error("Intake vault passphrase must be at least 8 characters.")
  }

  const normalized = normalizeIntakeWorkspace(workspace)
  const iterations = options.iterations ?? 150000
  const encrypted = await encryptJsonPayload(normalized, cleanPassword, iterations)
  const timestamp = isoDate(options.updatedAt ?? new Date())

  return {
    schemaVersion: 1,
    format: INTAKE_WORKSPACE_VAULT_FORMAT,
    purpose: "professional-record-vault",
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
    salt: encrypted.salt,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
    createdAt: text(options.createdAt) || timestamp,
    updatedAt: timestamp,
    localFirst: true,
  }
}

export async function decryptEncryptedIntakeWorkspaceVault(vault, password) {
  if (!isEncryptedIntakeWorkspaceVault(vault)) {
    throw new Error("Expected a MassageLab intake workspace vault.")
  }

  try {
    const cryptoApi = getCryptoApi()
    const salt = base64ToBytes(vault.salt)
    const iv = base64ToBytes(vault.iv)
    const ciphertext = base64ToBytes(vault.ciphertext)
    const key = await deriveAesGcmKey(text(password), salt, Number(vault.iterations) || 150000)
    const plaintext = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
    return normalizeIntakeWorkspace(JSON.parse(new TextDecoder().decode(plaintext)))
  } catch {
    throw new Error("Could not unlock intake vault. Check the passphrase and try again.")
  }
}

function question(id, type, label, options = {}) {
  return {
    id,
    type,
    label,
    required: options.required === true,
    options: Array.isArray(options.options) ? [...options.options] : [],
    helpText: text(options.helpText),
    showIf: isPlainObject(options.showIf) ? { questionId: text(options.showIf.questionId), equals: options.showIf.equals } : null,
  }
}

function normalizeFormSection(value) {
  if (!isPlainObject(value)) return null
  return {
    id: text(value.id) || createLocalId("section"),
    title: text(value.title) || "Untitled section",
    description: text(value.description),
    questions: Array.isArray(value.questions) ? value.questions.map(normalizeFormQuestion).filter(Boolean) : [],
  }
}

function normalizeFormQuestion(value) {
  if (!isPlainObject(value)) return null
  const type = FORM_QUESTION_TYPES.includes(value.type) ? value.type : "short_text"
  return {
    id: text(value.id) || createLocalId("question"),
    type,
    label: text(value.label) || (type === "instruction" ? "Instruction" : "Untitled question"),
    required: value.required === true,
    options: Array.isArray(value.options) ? value.options.map(text).filter(Boolean) : [],
    helpText: text(value.helpText),
    showIf: isPlainObject(value.showIf) && text(value.showIf.questionId)
      ? { questionId: text(value.showIf.questionId), equals: value.showIf.equals }
      : null,
  }
}

function normalizeAnswersForTemplate(template, answers) {
  const normalized = {}
  for (const field of flattenQuestions(template)) {
    const value = answers[field.id]
    if (field.type === "multiple_choice") {
      normalized[field.id] = Array.isArray(value) ? value.map(text).filter(Boolean) : []
    } else if (field.type === "checkbox") {
      normalized[field.id] = value === true
    } else if (field.type === "body_map") {
      normalized[field.id] = normalizeBodyMapAnswer(value)
    } else {
      normalized[field.id] = text(value)
    }
  }
  return normalized
}

function normalizeBodyMapAnswer(value) {
  const source = isPlainObject(value) ? value : {}
  const selectedSource = isPlainObject(source.selected) ? source.selected : {}
  const selected = {}
  for (const side of BODY_MAP_SIDES) {
    for (const part of BODY_MAP_PARTS) {
      const key = `${side} [${part}]`
      const answer = text(selectedSource[key])
      if (answer) selected[key] = answer
    }
  }
  return { selected, notes: text(source.notes) }
}

function formatAnswer(field, value) {
  if (field.type === "checkbox") return value ? "Yes" : "No"
  if (field.type === "multiple_choice") return Array.isArray(value) && value.length > 0 ? value.join(", ") : ""
  if (field.type === "body_map") return formatBodyMapAnswer(value)
  return text(value)
}

function flattenQuestions(template) {
  return (template?.sections ?? []).flatMap((section) => section.questions ?? [])
}

function mergeStarterTemplates(templates) {
  const byId = new Map()
  for (const template of starterIntakeTemplates) byId.set(template.id, clone(template))
  for (const template of templates) byId.set(template.id, template)
  return [...byId.values()]
}

function findTemplate(templates, templateId) {
  return templates.find((template) => template?.id === templateId) ?? null
}

function inferTemplateIntakeType(value) {
  const explicit = normalizeIntakeType(value?.intakeType)
  if (explicit) return explicit
  const id = text(value?.id)
  if (id === "template-full-intake-v1") return "initial"
  if (id === "template-follow-up-intake-v1") return "follow-up"
  return ""
}

export function normalizeIntakeType(value) {
  const clean = text(value)
  return INTAKE_TYPES.includes(clean) ? clean : ""
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

function createLocalId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function getCryptoApi() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto is required for encrypted local exports.")
  }
  return globalThis.crypto
}

async function encryptJsonPayload(data, password, iterations) {
  const cryptoApi = getCryptoApi()
  const salt = cryptoApi.getRandomValues(new Uint8Array(16))
  const iv = cryptoApi.getRandomValues(new Uint8Array(12))
  const key = await deriveAesGcmKey(password, salt, iterations)
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

async function deriveAesGcmKey(password, salt, iterations) {
  const cryptoApi = getCryptoApi()
  const material = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  )

  return cryptoApi.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }

  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"))
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
