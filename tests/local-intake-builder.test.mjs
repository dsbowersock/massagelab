import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BODY_MAP_PARTS,
  BODY_MAP_SIDES,
  FORM_QUESTION_TYPES,
  INTAKE_WORKSPACE_STORAGE_KEY,
  createClinicalDocumentFromResponse,
  createClientProfileFromResponse,
  createDefaultIntakeWorkspace,
  createFormResponseExportText,
  createPainMapPlaceholderValues,
  formatBodyMapAnswer,
  normalizeFormResponse,
  normalizeIntakeWorkspace,
  requiredQuestionIssues,
  starterIntakeTemplates,
  validateFormDefinition,
} from "../lib/local-intake-builder.js"
import {
  createEmptyProfessionalRecordVaultPayload,
  createEncryptedProfessionalRecordVault,
  decryptEncryptedProfessionalRecordVault,
  setProfessionalRecordVaultIntakeWorkspace,
} from "../lib/professional-record-vault.js"

describe("local intake form builder", () => {
  it("defines the local-only intake workspace contract and starter templates", () => {
    const workspace = createDefaultIntakeWorkspace("2026-05-28T12:00:00.000Z")
    const fullIntake = workspace.templates.find((template) => template.id === "template-full-intake-v1")
    const followUpIntake = workspace.templates.find((template) => template.id === "template-follow-up-intake-v1")
    const painMap = workspace.templates.find((template) => template.id === "template-pain-map-v1")

    assert.equal(INTAKE_WORKSPACE_STORAGE_KEY, "massagelab-intake-workspace-v1")
    assert.ok(FORM_QUESTION_TYPES.includes("body_map"))
    assert.equal(workspace.schemaVersion, 1)
    assert.equal(workspace.clients.length, 0)
    assert.equal(workspace.documents.length, 0)
    assert.equal(fullIntake.kind, "intake")
    assert.equal(fullIntake.intakeType, "initial")
    assert.equal(followUpIntake.kind, "intake")
    assert.equal(followUpIntake.intakeType, "follow-up")
    assert.ok(followUpIntake.sections.some((section) => section.id === "follow-up-updates"))
    assert.ok(followUpIntake.sections.some((section) => section.id === "follow-up-pain-map"))
    assert.equal(
      followUpIntake.sections.flatMap((section) => section.questions).some((question) => question.id === "firstName"),
      false,
    )
    assert.ok(followUpIntake.sections.flatMap((section) => section.questions).some((question) => question.id === "currentSymptoms"))
    assert.ok(followUpIntake.sections.flatMap((section) => section.questions).some((question) => question.id === "followUpPainMap"))
    assert.equal(painMap.kind, "pain-map")
    assert.equal(painMap.intakeType, "")
    assert.ok(fullIntake.sections.some((section) => section.id === "health-history"))
    assert.ok(fullIntake.sections.some((section) => section.id === "initial-pain-map"))
  })

  it("validates configurable form definitions and simple show-if dependencies", () => {
    const issues = validateFormDefinition({
      id: "custom",
      title: "Custom",
      kind: "custom",
      sections: [
        {
          id: "section",
          title: "Section",
          questions: [
            { id: "needs-options", type: "single_choice", label: "Choose", options: [] },
            { id: "conditional", type: "short_text", label: "Follow-up", showIf: { questionId: "missing", equals: "Yes" } },
          ],
        },
      ],
    })

    assert.ok(issues.some((issue) => issue.includes("needs options")))
    assert.ok(issues.some((issue) => issue.includes("depends on unknown question missing")))
    assert.deepEqual(validateFormDefinition(starterIntakeTemplates[0]), [])
  })

  it("rejects malformed raw form definitions before normalization can coerce them", () => {
    const issues = validateFormDefinition({
      id: "malformed",
      title: " ",
      kind: "custom",
      sections: [
        {
          id: "section",
          title: "",
          questions: [
            { id: "unknown-type", type: "mystery", label: "Unknown type" },
            { id: "missing-label", type: "short_text", label: "" },
            { id: "empty-choice", type: "single_choice", label: "Choose", options: [""] },
          ],
        },
      ],
    })

    assert.ok(issues.some((issue) => issue.includes("Template title is required")))
    assert.ok(issues.some((issue) => issue.includes("Section section needs a title")))
    assert.ok(issues.some((issue) => issue.includes("unknown-type has an unsupported type")))
    assert.ok(issues.some((issue) => issue.includes("missing-label needs a label")))
    assert.ok(issues.some((issue) => issue.includes("empty-choice needs options")))
  })

  it("normalizes responses to the known template question shape", () => {
    const response = normalizeFormResponse({
      templateId: "template-full-intake-v1",
      answers: {
        firstName: "  Jane ",
        lastName: " Client ",
        informedConsent: true,
        medicalConditions: ["Headaches", "", "Low BP"],
        ignored: "drop me",
      },
    }, starterIntakeTemplates)

    assert.equal(response.templateTitle, "Full intake form")
    assert.equal(response.answers.firstName, "Jane")
    assert.equal(response.answers.lastName, "Client")
    assert.equal(response.answers.informedConsent, true)
    assert.deepEqual(response.answers.medicalConditions, ["Headaches", "Low BP"])
    assert.equal("ignored" in response.answers, false)
  })

  it("normalizes intake workflow types without breaking old local documents", () => {
    const workspace = createDefaultIntakeWorkspace("2026-06-03T12:00:00.000Z")
    const followUpTemplate = workspace.templates.find((template) => template.id === "template-follow-up-intake-v1")
    const fullIntakeTemplate = workspace.templates.find((template) => template.id === "template-full-intake-v1")
    const customTemplate = {
      id: "custom-intake",
      schemaVersion: 1,
      title: "Custom intake",
      kind: "intake",
      sections: [{ id: "section", title: "Section", questions: [{ id: "clientName", type: "short_text", label: "Client name" }] }],
    }
    const followUpResponse = normalizeFormResponse({
      templateId: followUpTemplate.id,
      localClientId: "client-1",
      answers: {
        followUpSessionDate: "2026-06-03",
        currentSymptoms: "Left shoulder tightness.",
        followUpPainMap: { selected: { "Left [Shoulder]": "Tender" }, notes: "Worse after overhead work." },
        ignored: "drop me",
      },
    }, workspace.templates)
    const initialResponse = normalizeFormResponse({
      templateId: fullIntakeTemplate.id,
      answers: {
        firstName: "Jane",
        lastName: "Client",
        draping: true,
        informedConsent: true,
        clientSignature: "Jane Client",
      },
    }, workspace.templates)
    const customResponse = normalizeFormResponse({
      templateId: customTemplate.id,
      answers: { clientName: "Custom Client" },
    }, [customTemplate])

    assert.equal(followUpResponse.intakeType, "follow-up")
    assert.equal(followUpResponse.answers.currentSymptoms, "Left shoulder tightness.")
    assert.equal("ignored" in followUpResponse.answers, false)
    assert.equal(initialResponse.intakeType, "initial")
    assert.equal(customResponse.intakeType, "")

    const client = { id: "client-1", displayName: "Jane Client" }
    const followUpDocument = createClinicalDocumentFromResponse(followUpResponse, client, followUpTemplate, "2026-06-03T12:05:00.000Z")
    const normalizedWorkspace = normalizeIntakeWorkspace({
      ...workspace,
      documents: [
        followUpDocument,
        {
          id: "legacy-document",
          schemaVersion: 1,
          kind: "intake",
          title: "Legacy full intake",
          templateId: fullIntakeTemplate.id,
          localClientId: "client-1",
          response: initialResponse,
          status: "LOCAL_ONLY",
        },
      ],
    })

    assert.equal(followUpDocument.intakeType, "follow-up")
    assert.equal(normalizedWorkspace.documents[0].intakeType, "follow-up")
    assert.equal(normalizedWorkspace.documents[1].intakeType, "initial")
  })

  it("links normalized responses to local client profiles and documents", () => {
    const template = starterIntakeTemplates[0]
    const response = normalizeFormResponse({
      templateId: template.id,
      answers: {
        firstName: "Jane",
        preferredName: "J",
        lastName: "Client",
        phoneNumber: "555-1212",
        emailAddress: "JANE@EXAMPLE.COM",
        informedConsent: true,
        draping: true,
        clientSignature: "Jane Client",
      },
    }, [template])
    const client = createClientProfileFromResponse(response, template, "2026-05-28T12:00:00.000Z")
    const document = createClinicalDocumentFromResponse({ ...response, localClientId: client.id }, client, template, "2026-05-28T12:05:00.000Z")

    assert.equal(client.displayName, 'Jane "J" Client')
    assert.equal(client.email, "jane@example.com")
    assert.equal(document.localClientId, client.id)
    assert.equal(document.kind, "intake")
    assert.equal(document.status, "LOCAL_ONLY")
  })

  it("formats exports with local-first language and required-field issues", () => {
    const template = starterIntakeTemplates[0]
    const response = normalizeFormResponse({
      templateId: template.id,
      answers: {
        firstName: "Jane",
        lastName: "Client",
        pressure: "Medium",
        draping: false,
        informedConsent: true,
      },
    }, [template])
    const text = createFormResponseExportText({ response, template, client: { displayName: "Jane Client" } })
    const issues = requiredQuestionIssues(template, response.answers)

    assert.match(text, /MassageLab Local Intake Export/)
    assert.match(text, /MassageLab did not upload/)
    assert.match(text, /Desired Pressure: Medium/)
    assert.ok(issues.some((issue) => issue.includes("Draping understood")))
    assert.ok(issues.some((issue) => issue.includes("Client signature")))
  })

  it("maps body-map selections to legacy placeholders", () => {
    const answer = {
      selected: {
        "Left [Shoulder]": "Tender",
        "Middle [Upper-back]": "Aching",
        "Right [Calf]": "",
        "Unknown [Region]": "drop me",
      },
      notes: "Worse after sitting.",
    }
    const placeholders = createPainMapPlaceholderValues(answer)

    assert.equal(BODY_MAP_SIDES.length, 3)
    assert.ok(BODY_MAP_PARTS.includes("Sciatic Area (Buttock)"))
    assert.equal(placeholders["{{Left [Shoulder]}}"], "Tender")
    assert.equal(placeholders["{{Middle [Upper-back]}}"], "Aching")
    assert.equal(placeholders["{{Right [Calf]}}"], "")
    assert.equal(placeholders["{{Unknown [Region]}}"], undefined)
    assert.match(formatBodyMapAnswer(answer), /Left \[Shoulder\]: Tender/)
    assert.match(formatBodyMapAnswer(answer), /Notes: Worse after sitting/)
  })

  it("normalizes imported workspaces and preserves starter template migrations", () => {
    const workspace = normalizeIntakeWorkspace({
      schemaVersion: 1,
      templates: [{ id: "custom", title: "Custom intake", kind: "custom", sections: [] }],
      clients: [{ displayName: "Jane Client", email: "jane@example.com" }],
      documents: [],
      activeTemplateId: "custom",
    })

    assert.ok(workspace.templates.some((template) => template.id === "template-full-intake-v1"))
    assert.ok(workspace.templates.some((template) => template.id === "template-pain-map-v1"))
    assert.ok(workspace.templates.some((template) => template.id === "custom"))
    assert.equal(workspace.activeTemplateId, "custom")
    assert.equal(workspace.clients[0].displayName, "Jane Client")
  })

  it("stores intake workspaces through the shared professional-record vault", async () => {
    const workspace = normalizeIntakeWorkspace({
      ...createDefaultIntakeWorkspace("2026-05-29T12:00:00.000Z"),
      clients: [{ displayName: "Sensitive Client", email: "sensitive@example.com", phone: "555-1212" }],
    })
    const payload = setProfessionalRecordVaultIntakeWorkspace(
      createEmptyProfessionalRecordVaultPayload("2026-05-29T12:00:00.000Z"),
      workspace,
      "2026-05-29T12:30:00.000Z",
    )
    const vault = await createEncryptedProfessionalRecordVault(payload, "correct horse battery staple", {
      iterations: 1000,
      updatedAt: "2026-05-29T12:30:00.000Z",
    })
    const serialized = JSON.stringify(vault)
    const decrypted = await decryptEncryptedProfessionalRecordVault(vault, "correct horse battery staple")

    assert.equal(vault.format, "massagelab-professional-record-vault")
    assert.equal(vault.purpose, "professional-record-vault")
    assert.equal(serialized.includes("Sensitive Client"), false)
    assert.equal(serialized.includes("sensitive@example.com"), false)
    assert.equal(decrypted.records.intake.workspace.clients[0].displayName, "Sensitive Client")
    await assert.rejects(() => decryptEncryptedProfessionalRecordVault(vault, "wrong horse battery staple"), /Could not unlock/)
    await assert.rejects(() => createEncryptedProfessionalRecordVault(payload, "short"), /at least 8/)
  })
})
